import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Download, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LegalAgreementPanel({ deal, profile, onUpdate, dealId = null }) {
  const [state, setState] = useState({
    agreement: null,
    latestVersion: null,
    pendingCounter: null,
    termsMismatch: false,
    dealTerms: null,
    loading: true
  });
  
  const [actionInProgress, setActionInProgress] = useState(null);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterType, setCounterType] = useState('flat');
  const [counterAmount, setCounterAmount] = useState('');
  
  const effectiveDealId = deal?.id || deal?.deal_id || dealId;
  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';

  // Load agreement state from server
  const loadState = async () => {
    if (!effectiveDealId) return;
    
    try {
      const response = await base44.functions.invoke('getAgreementState', { deal_id: effectiveDealId });
      if (response.data) {
        setState({
          agreement: response.data.agreement,
          latestVersion: response.data.latest_version,
          pendingCounter: response.data.pending_counter,
          termsMismatch: response.data.terms_mismatch,
          dealTerms: response.data.deal_terms,
          loading: false
        });
      }
    } catch (error) {
      console.error('[LegalAgreementPanel] Error loading state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Initial load
  useEffect(() => {
    loadState();
  }, [effectiveDealId]);

  // Real-time updates - counter offers
  useEffect(() => {
    if (!effectiveDealId) return;
    
    const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
      if (event?.data?.deal_id === effectiveDealId) {
        console.log('[LegalAgreementPanel] Counter event:', event.type, event.data?.status);
        loadState();
      }
    });
    
    return () => { try { unsubCounter?.(); } catch (_) {} };
  }, [effectiveDealId]);

  // Real-time updates - agreement versions
  useEffect(() => {
    if (!effectiveDealId) return;
    
    const unsubVersion = base44.entities.AgreementVersion.subscribe((event) => {
      if (event?.data?.deal_id === effectiveDealId) {
        console.log('[LegalAgreementPanel] Version event:', event.type, event.data?.status);
        loadState();
      }
    });
    
    return () => { try { unsubVersion?.(); } catch (_) {} };
  }, [effectiveDealId]);

  // Real-time updates - legacy agreement
  useEffect(() => {
    if (!effectiveDealId) return;
    
    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.deal_id === effectiveDealId) {
        console.log('[LegalAgreementPanel] Agreement event:', event.type);
        loadState();
      }
    });
    
    return () => { try { unsubAgreement?.(); } catch (_) {} };
  }, [effectiveDealId]);

  // Polling fallback for first 15 seconds after action
  useEffect(() => {
    if (!actionInProgress) return;
    
    let count = 0;
    const maxPolls = 5;
    const interval = setInterval(() => {
      count++;
      if (count > maxPolls) {
        clearInterval(interval);
        setActionInProgress(null);
        return;
      }
      loadState();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [actionInProgress]);

  const handleSendCounter = async () => {
    if (!counterAmount || !effectiveDealId) return;
    
    setActionInProgress('counter');
    
    try {
      const terms_delta = {
        buyer_commission_type: counterType,
        buyer_commission_percentage: counterType === 'percentage' ? Number(counterAmount) : null,
        buyer_flat_fee: counterType === 'flat' ? Number(counterAmount) : null
      };
      
      const response = await base44.functions.invoke('createCounterOffer', {
        deal_id: effectiveDealId,
        from_role: isAgent ? 'agent' : 'investor',
        terms_delta
      });
      
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success('Counter offer sent');
        setShowCounterModal(false);
        setCounterAmount('');
        await loadState();
      }
    } catch (error) {
      toast.error('Failed to send counter: ' + error.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRespondToCounter = async (action, customTerms = null) => {
    if (!state.pendingCounter?.id) return;
    
    setActionInProgress(action);
    
    try {
      const payload = {
        counter_offer_id: state.pendingCounter.id,
        action
      };
      
      if (action === 'recounter' && customTerms) {
        payload.terms_delta = customTerms;
      }
      
      const response = await base44.functions.invoke('respondToCounterOffer', payload);
      
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        if (action === 'accept') {
          toast.success('Counter accepted - regenerating agreement...');
        } else if (action === 'decline') {
          toast.success('Counter offer declined');
        } else {
          toast.success('Counter offer sent');
          setShowCounterModal(false);
          setCounterAmount('');
        }
        await loadState();
      }
    } catch (error) {
      toast.error('Failed to respond: ' + error.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSign = async (role) => {
    if (!state.agreement?.id) {
      toast.error('No agreement to sign');
      return;
    }
    
    setActionInProgress('signing');
    
    try {
      const currentUrl = window.location.pathname;
      const isInMyAgreement = currentUrl.includes('MyAgreement');
      const params = new URLSearchParams(window.location.search);
      const currentRoomId = params.get('roomId');
      
      const returnUrl = currentRoomId 
        ? `/Room?roomId=${currentRoomId}&dealId=${effectiveDealId}&tab=agreement&signed=1`
        : isInMyAgreement
        ? `/MyAgreement?dealId=${effectiveDealId}&signed=1`
        : `/Room?dealId=${effectiveDealId}&tab=agreement&signed=1`;
      
      const response = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: state.agreement.id,
        role,
        redirect_url: returnUrl
      });
      
      if (response.data?.error) {
        toast.error(response.data.error);
        setActionInProgress(null);
        return;
      }
      
      if (response.data?.signing_url) {
        window.location.assign(response.data.signing_url);
      } else {
        toast.error('No signing URL returned');
        setActionInProgress(null);
      }
    } catch (error) {
      toast.error('Failed to open signing: ' + error.message);
      setActionInProgress(null);
    }
  };

  const handleRegenerate = async () => {
    if (!effectiveDealId) return;
    
    setActionInProgress('regenerating');
    
    try {
      const response = await base44.functions.invoke('regenerateAgreementVersion', {
        deal_id: effectiveDealId
      });
      
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success('Agreement regenerated - ready to sign');
        await new Promise(r => setTimeout(r, 1000));
        await loadState();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error('Failed to regenerate: ' + error.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const { agreement, pendingCounter, termsMismatch, dealTerms, loading } = state;
  const hasPendingOffer = pendingCounter?.status === 'pending';
  const isFullySigned = agreement?.investor_signed_at && agreement?.agent_signed_at;

  if (loading) {
    return (
      <Card className="ik-card p-0 overflow-hidden bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
        <CardHeader className="border-b border-[#1F1F1F] py-4">
          <CardTitle className="text-lg text-[#FAFAFA]">Legal Agreement</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8 text-[#808080]">Loading agreement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ik-card p-0 overflow-hidden bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
      <CardHeader className="border-b border-[#1F1F1F] py-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg text-[#FAFAFA] mb-1">Legal Agreement</CardTitle>
            <p className="text-sm text-[#808080]">Internal Agreement v1.0.1</p>
          </div>
          {agreement && (
            <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent border-[#1F1F1F]">
              {isFullySigned ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Fully Signed</span>
                </>
              ) : agreement.investor_signed_at ? (
                <>
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Awaiting Agent</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Awaiting Signatures</span>
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Pending Counter Offer - Show to recipient */}
        {hasPendingOffer && pendingCounter.to_role === (isInvestor ? 'investor' : 'agent') && (
          <div className="bg-[#F59E0B]/10 border-2 border-[#F59E0B]/50 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#FAFAFA]">⚠️ Counter Offer Pending</h3>
              <span className="text-xs text-[#808080]">from {pendingCounter.from_role}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-[#808080] mb-1">Type</div>
                <div className="text-base text-[#FAFAFA] font-medium capitalize">
                  {pendingCounter.terms_delta?.buyer_commission_type}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#808080] mb-1">Amount</div>
                <div className="text-base text-[#FAFAFA] font-medium">
                  {pendingCounter.terms_delta?.buyer_commission_type === 'percentage'
                    ? `${pendingCounter.terms_delta?.buyer_commission_percentage || 0}%`
                    : `$${(pendingCounter.terms_delta?.buyer_flat_fee || 0).toLocaleString()}`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button
                size="lg"
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-semibold"
                onClick={() => handleRespondToCounter('accept')}
                disabled={!!actionInProgress}
              >
                {actionInProgress === 'accept' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Accepting & Regenerating...
                  </>
                ) : 'Accept & Regenerate Agreement'}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="w-full font-semibold"
                onClick={() => handleRespondToCounter('decline')}
                disabled={!!actionInProgress}
              >
                Decline
              </Button>
              <Button
                size="lg"
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                onClick={() => {
                  const currentType = pendingCounter.terms_delta?.buyer_commission_type || 'flat';
                  setCounterType(currentType);
                  const amt = currentType === 'percentage'
                    ? pendingCounter.terms_delta?.buyer_commission_percentage || 0
                    : pendingCounter.terms_delta?.buyer_flat_fee || 0;
                  setCounterAmount(String(amt));
                  setShowCounterModal(true);
                }}
                disabled={!!actionInProgress}
              >
                Send Different Counter
              </Button>
            </div>
          </div>
        )}

        {/* No Agreement Yet */}
        {!agreement ? (
          hasPendingOffer && isInvestor ? null : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
              <p className="text-[#808080] mb-4">
                {isAgent ? 'Waiting for investor to generate agreement' : 'No agreement generated yet'}
              </p>
              {isInvestor && (
                <Button
                  onClick={handleRegenerate}
                  disabled={!!actionInProgress}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                >
                  {actionInProgress === 'regenerating' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : 'Generate Agreement'}
                </Button>
              )}
            </div>
          )
        ) : (
          /* Agreement Exists */
          <div className="space-y-4">
            {/* Terms Mismatch Warning */}
            {termsMismatch && isInvestor && !hasPendingOffer && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="text-sm text-[#FAFAFA] font-semibold mb-1">Agreement out of date</div>
                <div className="text-xs text-[#808080] mb-3">Terms changed. Regenerate before signing.</div>
                <Button
                  onClick={handleRegenerate}
                  disabled={!!actionInProgress}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  {actionInProgress === 'regenerating' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : 'Regenerate Agreement'}
                </Button>
              </div>
            )}

            {/* Current Terms Display */}
            {dealTerms && (
              <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[#808080]">Buyer Agent Compensation</div>
                  {isAgent && !isFullySigned && agreement && !hasPendingOffer && (
                    <Button
                      size="sm"
                      className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      onClick={() => {
                        const tType = dealTerms.buyer_commission_type || 'flat';
                        setCounterType(tType);
                        setCounterAmount(String(tType === 'percentage' 
                          ? (dealTerms.buyer_commission_percentage || 0) 
                          : (dealTerms.buyer_flat_fee || 0)));
                        setShowCounterModal(true);
                      }}
                    >
                      Counter
                    </Button>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Type</span>
                  <span className="text-[#FAFAFA] capitalize">{dealTerms.buyer_commission_type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Amount</span>
                  <span className="text-[#FAFAFA]">
                    {dealTerms.buyer_commission_type === 'percentage'
                      ? `${dealTerms.buyer_commission_percentage || 0}%`
                      : `$${(dealTerms.buyer_flat_fee || 0).toLocaleString()}`}
                  </span>
                </div>
              </div>
            )}

            {/* Agreement Details */}
            {agreement && (
              <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#808080]">Governing State:</span>
                  <span className="text-[#FAFAFA]">{agreement.governing_state}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Transaction Type:</span>
                  <span className="text-[#FAFAFA]">{agreement.transaction_type}</span>
                </div>
              </div>
            )}

            {/* Signature Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                <div className="text-xs text-[#808080] mb-2">Investor</div>
                {agreement?.investor_signed_at ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Signed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#808080]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending</span>
                  </div>
                )}
              </div>
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                <div className="text-xs text-[#808080] mb-2">Agent</div>
                {agreement?.agent_signed_at ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Signed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#808080]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {/* Investor: Sign if not signed and no blocks */}
              {!agreement.investor_signed_at && isInvestor && !hasPendingOffer && !termsMismatch && (
                <Button
                  onClick={() => handleSign('investor')}
                  disabled={!!actionInProgress}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                >
                  {actionInProgress === 'signing' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening DocuSign...
                    </>
                  ) : 'Sign as Investor'}
                </Button>
              )}

              {/* Agent: Wait for investor */}
              {!agreement.investor_signed_at && isAgent && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                  <Clock className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for investor</p>
                  <p className="text-xs text-[#808080] mt-1">You'll be notified when it's your turn to sign</p>
                </div>
              )}

              {/* Agent: Sign if investor signed and no blocks */}
              {agreement.investor_signed_at && !agreement.agent_signed_at && isAgent && (
                hasPendingOffer || termsMismatch ? (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-[#FAFAFA] font-semibold">
                      {hasPendingOffer ? 'Counter offer pending' : 'Agreement needs regeneration'}
                    </p>
                    <p className="text-xs text-[#808080] mt-1">Wait for investor to respond and regenerate</p>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSign('agent')}
                    disabled={!!actionInProgress}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                  >
                    {actionInProgress === 'signing' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opening DocuSign...
                      </>
                    ) : 'Sign as Agent'}
                  </Button>
                )
              )}

              {/* Investor: Waiting for agent */}
              {agreement.investor_signed_at && !agreement.agent_signed_at && isInvestor && !termsMismatch && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">You signed</p>
                  <p className="text-xs text-[#808080] mt-1">Waiting for agent to sign</p>
                </div>
              )}

              {/* Fully Signed */}
              {isFullySigned && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
                  <p className="text-xs text-[#808080] mt-1">Agreement complete</p>
                </div>
              )}

              {/* Download PDF */}
              {(agreement?.signed_pdf_url || agreement?.final_pdf_url) && (
                isAgent ? (
                  isFullySigned && (
                    <Button
                      onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url, '_blank')}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Signed PDF
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url, '_blank')}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {agreement.signed_pdf_url ? 'Download Signed PDF' : 'View Agreement PDF'}
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Counter Offer Modal */}
      <Dialog open={showCounterModal} onOpenChange={setShowCounterModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Propose Counter Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[#FAFAFA] mb-1">Compensation Type</Label>
              <Select value={counterType} onValueChange={setCounterType}>
                <SelectTrigger className="w-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectItem value="flat" className="text-[#FAFAFA]">Flat Fee</SelectItem>
                  <SelectItem value="percentage" className="text-[#FAFAFA]">Percentage of Purchase Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#FAFAFA] mb-1">Amount</Label>
              <Input
                type="number"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                placeholder={counterType === 'percentage' ? 'Enter %' : 'Enter $ amount'}
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#999999]"
              />
              <p className="text-xs text-[#808080] mt-1">
                {counterType === 'percentage' ? 'Example: 3 for 3%' : 'Example: 5000 for $5,000'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCounterModal(false)}
              disabled={!!actionInProgress}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black"
              onClick={() => {
                if (hasPendingOffer && pendingCounter) {
                  // Responding with a different counter
                  const terms_delta = {
                    buyer_commission_type: counterType,
                    buyer_commission_percentage: counterType === 'percentage' ? Number(counterAmount) : null,
                    buyer_flat_fee: counterType === 'flat' ? Number(counterAmount) : null
                  };
                  handleRespondToCounter('recounter', terms_delta);
                } else {
                  // New counter
                  handleSendCounter();
                }
              }}
              disabled={!!actionInProgress || !counterAmount}
            >
              {actionInProgress ? 'Sending...' : 'Submit Counter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}