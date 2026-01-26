import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AGREEMENT PANEL - Clean, deterministic agreement + counter-offer flow
 * 
 * State machine:
 * 1. No agreement → Investor can Generate
 * 2. Agreement unsigned → Both can sign (investor first)
 * 3. Pending counter → Recipient sees Accept/Decline/Counter Back
 * 4. Terms accepted → ONLY investor sees "Regenerate & Sign"
 * 5. Fully signed → Show success + download
 */

export default function AgreementPanel({ dealId, profile, onUpdate }) {
  const [agreement, setAgreement] = useState(null);
  const [pendingCounter, setPendingCounter] = useState(null);
  const [dealTerms, setDealTerms] = useState(null);
  const [termsChanged, setTermsChanged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  // Counter modal state
  const [counterModal, setCounterModal] = useState(false);
  const [counterType, setCounterType] = useState('flat');
  const [counterAmount, setCounterAmount] = useState('');
  
  // Regenerate confirm modal
  const [regenerateModal, setRegenerateModal] = useState(false);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';

  // Load state from server
    const loadState = async () => {
        if (!dealId) return;

        try {
          const res = await base44.functions.invoke('getAgreementState', { deal_id: dealId });
          if (res.data) {
            const agreement = res.data.agreement || null;
            const dealTerms = res.data.deal_terms || null;

            // If investor just signed, show toast
            if (agreement?.investor_signed_at && !investorSigned) {
              toast.success('✓ Your signature recorded!');
            }

            // Terms changed if deal_terms differ from agreement's exhibit_a_terms
            const termsHaveChanged = agreement && !!(
              dealTerms && 
              agreement.exhibit_a_terms && 
              (dealTerms.buyer_commission_percentage !== agreement.exhibit_a_terms.buyer_commission_percentage ||
               dealTerms.buyer_flat_fee !== agreement.exhibit_a_terms.buyer_flat_fee ||
               dealTerms.buyer_commission_type !== agreement.exhibit_a_terms.buyer_commission_type)
            );

            setAgreement(agreement);
            setPendingCounter(res.data.pending_counter || null);
            setDealTerms(dealTerms);
            setTermsChanged(termsHaveChanged);
          }
        } catch (error) {
          console.error('[AgreementPanel] Load error:', error);
        } finally {
          setLoading(false);
        }
      };

  useEffect(() => {
    loadState();

    // Reload state when user returns from DocuSign signing
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === '1') {
      // Remove the signed flag from URL
      const newUrl = window.location.pathname + window.location.search.replace('&signed=1', '').replace('?signed=1', '');
      window.history.replaceState({}, '', newUrl);

      // Reload state multiple times to catch webhook
      setTimeout(() => loadState(), 1500);
      setTimeout(() => loadState(), 3000);
      setTimeout(() => loadState(), 5000);
    }

    // Also reload on window focus (user switching tabs)
    const handleFocus = () => loadState();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [dealId]);

  // Real-time updates
  useEffect(() => {
    if (!dealId) return;
    
    const unsubs = [];
    
    // Subscribe to counter offers
    const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
      if (event?.data?.deal_id === dealId) {
        loadState();
      }
    });
    unsubs.push(unsubCounter);
    
    // Subscribe to legacy agreement
    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.deal_id === dealId) {
        loadState();
      }
    });
    unsubs.push(unsubAgreement);
    
    return () => unsubs.forEach(u => { try { u?.(); } catch (_) {} });
  }, [dealId]);

  // Derived state
  const isFullySigned = !!(agreement?.investor_signed_at && agreement?.agent_signed_at);
  const investorSigned = !!agreement?.investor_signed_at;
  const agentSigned = !!agreement?.agent_signed_at;
  const hasPendingOffer = !!pendingCounter && pendingCounter?.status === 'pending';
  const myRole = isInvestor ? 'investor' : 'agent';
  const amRecipient = hasPendingOffer && pendingCounter?.to_role === myRole;

  console.log('[AgreementPanel] State:', { 
    hasAgreement: !!agreement, 
    hasPendingOffer, 
    amRecipient, 
    myRole,
    counterToRole: pendingCounter?.to_role,
    counterStatus: pendingCounter?.status,
    investorSigned,
    agentSigned,
    agreement_investor_signed_at: agreement?.investor_signed_at,
    agreement_agent_signed_at: agreement?.agent_signed_at
  });

  // Actions
  const handleGenerate = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('regenerateAgreementVersion', { deal_id: dealId });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Agreement generated');
        await loadState();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error('Failed to generate');
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async (role) => {
    if (!agreement?.id) {
      toast.error('No agreement to sign');
      return;
    }
    
    setBusy(true);
    
    try {
      const params = new URLSearchParams(window.location.search);
      const currentRoomId = params.get('roomId');
      const currentPath = window.location.pathname;
      
      const returnUrl = currentRoomId 
        ? `/Room?roomId=${currentRoomId}&dealId=${dealId}&tab=agreement&signed=1`
        : currentPath.includes('MyAgreement')
        ? `/MyAgreement?dealId=${dealId}&signed=1`
        : `/Pipeline?dealId=${dealId}&signed=1`;
      
      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role,
        redirect_url: returnUrl
      });
      
      if (res.data?.error) {
        toast.error(res.data.error);
        setBusy(false);
      } else if (res.data?.signing_url) {
        window.location.assign(res.data.signing_url);
      } else {
        toast.error('No signing URL returned');
        setBusy(false);
      }
    } catch (error) {
      toast.error('Failed to start signing');
      setBusy(false);
    }
  };

  const handleSendCounter = async () => {
    if (!counterAmount || !dealId) return;
    
    setBusy(true);
    
    try {
      const terms_delta = {
        buyer_commission_type: counterType,
        buyer_commission_percentage: counterType === 'percentage' ? Number(counterAmount) : null,
        buyer_flat_fee: counterType === 'flat' ? Number(counterAmount) : null
      };
      
      const res = await base44.functions.invoke('createCounterOffer', {
        deal_id: dealId,
        from_role: isAgent ? 'agent' : 'investor',
        terms_delta
      });
      
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Counter offer sent');
        setCounterModal(false);
        setCounterAmount('');
        await loadState();
      }
    } catch (error) {
      toast.error('Failed to send counter');
    } finally {
      setBusy(false);
    }
  };

  const handleRespondToCounter = async (action, customTerms = null) => {
    if (!pendingCounter?.id) return;
    
    setBusy(true);
    
    try {
      const payload = {
        counter_offer_id: pendingCounter.id,
        action
      };
      
      if (action === 'recounter' && customTerms) {
        payload.terms_delta = customTerms;
      }
      
      const res = await base44.functions.invoke('respondToCounterOffer', payload);
      
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        if (action === 'accept') {
          toast.success('Counter accepted - click "Regenerate & Sign" to continue');
        } else if (action === 'decline') {
          toast.success('Counter declined');
        } else {
          toast.success('Counter sent');
          setCounterModal(false);
          setCounterAmount('');
        }
        await loadState();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error('Failed to respond');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateAndSign = async () => {
    setBusy(true);
    
    try {
      const res = await base44.functions.invoke('regenerateAgreementVersion', { deal_id: dealId });
      
      if (res.data?.error) {
        toast.error(res.data.error);
        setBusy(false);
        setRegenerateModal(false);
        return;
      }
      
      toast.success('Agreement regenerated - opening signing...');
      await new Promise(r => setTimeout(r, 1000));
      await loadState();
      setRegenerateModal(false);
      
      // Auto-open signing for investor
      setTimeout(() => handleSign('investor'), 500);
    } catch (error) {
      toast.error('Regeneration failed');
      setBusy(false);
      setRegenerateModal(false);
    }
  };

  // Terms display helpers
  const formatCommission = (terms) => {
    if (!terms) return '—';
    if (terms.buyer_commission_type === 'percentage') {
      return `${terms.buyer_commission_percentage || 0}% of purchase price`;
    }
    return `$${(terms.buyer_flat_fee || 0).toLocaleString()} flat fee`;
  };

  const getCurrentTerms = () => {
    // Show pending counter terms to recipient
    if (hasPendingOffer && amRecipient) {
      return pendingCounter.terms_delta;
    }
    // If unsigned agreement, prioritize deal_terms (accepted counter terms override old agreement)
    if (agreement && !isFullySigned && dealTerms) {
      return dealTerms;
    }
    // Show signed agreement terms
    if (agreement?.exhibit_a_terms && isFullySigned) {
      return agreement.exhibit_a_terms;
    }
    // Use deal terms as fallback
    if (dealTerms) {
      return dealTerms;
    }
    return null;
  };

  const currentTerms = getCurrentTerms();
  
  useEffect(() => {
    console.log('[AgreementPanel] currentTerms:', currentTerms);
  }, [currentTerms]);

  if (loading) {
    return (
      <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
        <CardContent className="p-6">
          <div className="text-center py-8 text-[#808080]">Loading agreement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
        <CardHeader className="border-b border-[#1F1F1F]">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-[#FAFAFA]">Agreement & Compensation</CardTitle>
              <p className="text-sm text-[#808080] mt-1">Internal agreement between investor and agent</p>
            </div>
            {agreement && (
              <Badge variant="outline" className="bg-transparent border-[#1F1F1F]">
                {isFullySigned ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Fully Signed
                  </span>
                ) : investorSigned ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Awaiting Agent
                  </span>
                ) : (
                  <span className="text-blue-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Awaiting Signatures
                  </span>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* Pending Counter Card - ALWAYS show FIRST and prominently to recipient when pending */}
          {hasPendingOffer && amRecipient && (
            <div className="bg-[#F59E0B]/10 border-2 border-[#F59E0B]/50 rounded-xl p-5 mb-6 ring-2 ring-[#F59E0B]/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#FAFAFA]">⚠️ Counter Offer Pending Your Response</h3>
                <span className="text-xs text-[#808080] bg-[#F59E0B]/20 px-2 py-1 rounded-full">from {pendingCounter.from_role}</span>
              </div>
              
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg p-4 mb-4">
                <div className="text-xs text-[#808080] mb-2 uppercase tracking-wider font-semibold">Proposed Terms</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#808080] mb-1">Commission Type</div>
                    <div className="text-[#FAFAFA] font-semibold capitalize text-lg">
                      {pendingCounter.terms_delta?.buyer_commission_type === 'percentage' ? 'Percentage' : 'Flat Fee'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#808080] mb-1">Amount</div>
                    <div className="text-[#E3C567] font-bold text-lg">
                      {pendingCounter.terms_delta?.buyer_commission_type === 'percentage'
                        ? `${pendingCounter.terms_delta?.buyer_commission_percentage || 0}%`
                        : `$${(pendingCounter.terms_delta?.buyer_flat_fee || 0).toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#808080] mb-4">What would you like to do?</p>

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-semibold py-2.5"
                  onClick={() => handleRespondToCounter('accept')}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  ✓ Accept These Terms
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleRespondToCounter('decline')}
                    disabled={busy}
                    className="py-2"
                  >
                    ✗ Decline
                  </Button>
                  <Button
                    className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold py-2"
                    onClick={() => {
                      const type = pendingCounter.terms_delta?.buyer_commission_type || 'flat';
                      setCounterType(type);
                      const amt = type === 'percentage'
                        ? pendingCounter.terms_delta?.buyer_commission_percentage || 0
                        : pendingCounter.terms_delta?.buyer_flat_fee || 0;
                      setCounterAmount(String(amt));
                      setCounterModal(true);
                    }}
                    disabled={busy}
                  >
                    ↔️ Counter Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* No Agreement - Investor Generate (only if NO pending counter) */}
          {!agreement && !hasPendingOffer && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
              <p className="text-[#808080] mb-4">
                {isAgent ? 'Waiting for investor to generate agreement' : 'Generate agreement to proceed'}
              </p>
              {isInvestor && (
                <Button
                  onClick={handleGenerate}
                  disabled={busy}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : 'Generate Agreement'}
                </Button>
              )}
            </div>
          )}

          {/* Agreement Exists - SHOW EVEN IF PENDING COUNTER */}
          {agreement && (
            <div className="space-y-4">
              {/* Current Terms */}
              <div className="bg-[#141414] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#FAFAFA]">Buyer Agent Compensation</h4>
                  {isAgent && !isFullySigned && !hasPendingOffer && (
                    <Button
                      size="sm"
                      className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black text-xs"
                      onClick={() => {
                        const terms = currentTerms || {};
                        const type = terms.buyer_commission_type || 'flat';
                        setCounterType(type);
                        const amt = type === 'percentage' 
                          ? (terms.buyer_commission_percentage || 0)
                          : (terms.buyer_flat_fee || 0);
                        setCounterAmount(String(amt));
                        setCounterModal(true);
                      }}
                      disabled={busy}
                    >
                      Counter
                    </Button>
                  )}
                </div>
                <div className="text-[#FAFAFA]">
                  {formatCommission(currentTerms)}
                </div>
              </div>

              {/* Signature Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#141414] rounded-xl p-4">
                  <div className="text-xs text-[#808080] mb-2">Investor</div>
                  {investorSigned ? (
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
                <div className="bg-[#141414] rounded-xl p-4">
                  <div className="text-xs text-[#808080] mb-2">Agent</div>
                  {agentSigned ? (
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

              {/* Waiting for Agent Card */}
              {investorSigned && !agentSigned && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                  <Clock className="w-8 h-8 text-[#60A5FA] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for Agent</p>
                  <p className="text-xs text-[#808080] mt-1">Agent will sign after you</p>
                </div>
              )}

              {/* Investor Actions */}
              {!isFullySigned && isInvestor && !hasPendingOffer && (
                <>
                  {/* Show Regenerate & Sign only if terms changed after counter acceptance */}
                  {termsChanged ? (
                    <Button
                      onClick={() => setRegenerateModal(true)}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                    >
                      Regenerate & Sign
                    </Button>
                  ) : (
                    /* Normal Sign button when no terms changes */
                    <Button
                      onClick={() => handleSign('investor')}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Opening DocuSign...
                        </>
                      ) : 'Sign Agreement'}
                    </Button>
                  )}
                </>
              )}

              {/* Agent Wait */}
              {!investorSigned && isAgent && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                  <Clock className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for investor</p>
                  <p className="text-xs text-[#808080] mt-1">You'll sign after investor completes</p>
                </div>
              )}

              {/* Agent Sign */}
              {investorSigned && !agentSigned && isAgent && !hasPendingOffer && (
                <Button
                  onClick={() => handleSign('agent')}
                  disabled={busy}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening DocuSign...
                    </>
                  ) : 'Sign as Agent'}
                </Button>
              )}

              {/* Investor Waiting */}
              {investorSigned && !agentSigned && isInvestor && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">You signed</p>
                  <p className="text-xs text-[#808080] mt-1">Waiting for agent to sign</p>
                </div>
              )}

              {/* Fully Signed Success */}
              {isFullySigned && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
                  <p className="text-xs text-[#808080] mt-1">Agreement complete</p>
                </div>
              )}

              {/* Download PDF */}
              {(agreement?.signed_pdf_url || agreement?.final_pdf_url) && (
                <Button
                  onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url, '_blank')}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {agreement.signed_pdf_url ? 'Download Signed PDF' : 'View Agreement PDF'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Counter Modal */}
      <Dialog open={counterModal} onOpenChange={setCounterModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Propose Counter Offer</DialogTitle>
            <DialogDescription className="text-[#808080]">
              Submit new compensation terms
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[#FAFAFA] mb-2">Type</Label>
              <Select value={counterType} onValueChange={setCounterType}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#1F1F1F]">
                  <SelectItem value="flat" className="text-[#FAFAFA]">Flat Fee</SelectItem>
                  <SelectItem value="percentage" className="text-[#FAFAFA]">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#FAFAFA] mb-2">Amount</Label>
              <Input
                type="number"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                placeholder={counterType === 'percentage' ? 'e.g., 3' : 'e.g., 5000'}
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
              <p className="text-xs text-[#808080] mt-1">
                {counterType === 'percentage' ? 'Enter % (e.g., 3 for 3%)' : 'Enter dollar amount'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCounterModal(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black"
              onClick={() => {
                if (hasPendingOffer && amRecipient) {
                  const terms = {
                    buyer_commission_type: counterType,
                    buyer_commission_percentage: counterType === 'percentage' ? Number(counterAmount) : null,
                    buyer_flat_fee: counterType === 'flat' ? Number(counterAmount) : null
                  };
                  handleRespondToCounter('recounter', terms);
                } else {
                  handleSendCounter();
                }
              }}
              disabled={busy || !counterAmount}
            >
              {busy ? 'Sending...' : 'Send Counter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirm Modal - INVESTOR ONLY */}
      {isInvestor && (
        <Dialog open={regenerateModal} onOpenChange={setRegenerateModal}>
          <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
            <DialogHeader>
              <DialogTitle className="text-[#FAFAFA]">Regenerate & Sign Agreement</DialogTitle>
              <DialogDescription className="text-[#808080]">
                Terms have been updated. Generate a new agreement and sign it.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="bg-[#141414] rounded-xl p-4 mb-4">
                <div className="text-sm text-[#808080] mb-1">New Compensation</div>
                <div className="text-[#FAFAFA] font-semibold">
                  {formatCommission(currentTerms)}
                </div>
              </div>
              
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 text-xs text-[#FAFAFA]">
                <AlertTriangle className="w-4 h-4 inline mr-2 text-[#F59E0B]" />
                The previous agreement will be voided and a new one generated.
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRegenerateModal(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                onClick={handleRegenerateAndSign}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : 'Generate & Sign'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}