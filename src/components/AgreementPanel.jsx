import React, { useState, useEffect } from 'react';
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
 * AGREEMENT PANEL - Simplified, consistent counter-offer flow
 * 
 * Single source of truth: LegalAgreement entity
 * No AgreementVersion confusion
 * Clean state machine based on Deal.requires_regenerate flag
 */

export default function AgreementPanel({ dealId, profile, onUpdate }) {
  const [agreement, setAgreement] = useState(null);
  const [pendingCounter, setPendingCounter] = useState(null);
  const [dealTerms, setDealTerms] = useState(null);
  const [requiresRegenerate, setRequiresRegenerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  // Counter modal state
  const [counterModal, setCounterModal] = useState(false);
  const [counterType, setCounterType] = useState('flat');
  const [counterAmount, setCounterAmount] = useState('');
  
  // Regenerate confirm modal
  const [regenerateModal, setRegenerateModal] = useState(false);
  const [lastCounterTime, setLastCounterTime] = useState(0);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';

  // Load state from server (single source of truth)
  const loadState = async (forceRefresh = false) => {
    if (!dealId) return;

    try {
      // Add cache buster to force fresh data if requested
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : '';
      const res = await base44.functions.invoke('getAgreementState', { deal_id: dealId, force_refresh: forceRefresh });
      if (res.data) {
        setAgreement(res.data.agreement || null);
        setPendingCounter(res.data.pending_counter || null);
        setDealTerms(res.data.deal_terms || {});
        setRequiresRegenerate(!!res.data.requires_regenerate);
        
        console.log('[AgreementPanel] State loaded:', {
          hasAgreement: !!res.data.agreement,
          agreementId: res.data.agreement?.id,
          hasPendingCounter: !!res.data.pending_counter,
          requiresRegenerate: !!res.data.requires_regenerate,
          investorSigned: !!res.data.agreement?.investor_signed_at,
          agentSigned: !!res.data.agreement?.agent_signed_at
        });
      }
    } catch (error) {
      console.error('[AgreementPanel] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState(true); // Force refresh on mount

    // Reload after DocuSign return with force refresh
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === '1') {
      window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[&?]signed=1/g, ''));
      
      // Aggressive refresh to catch newly signed agreements
      loadState(true);
      setTimeout(() => loadState(true), 500);
      setTimeout(() => loadState(true), 1500);
      setTimeout(() => loadState(true), 3000);
      setTimeout(() => loadState(true), 5000);
      setTimeout(() => {
        loadState(true);
        // Also notify parent to refresh deal data (Pipeline, Room, etc.)
        if (onUpdate) onUpdate();
      }, 8000);
    }

    const handleFocus = () => loadState(true); // Force refresh on focus
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
        console.log('[AgreementPanel] Counter event:', event.type);
        loadState();
      }
    });
    unsubs.push(unsubCounter);

    // Subscribe to LegalAgreement only
    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.deal_id === dealId) {
        console.log('[AgreementPanel] Agreement event:', event.type, 'Agreement ID:', event?.data?.id);
        loadState(true); // Force fresh data on real-time updates
      }
    });
    unsubs.push(unsubAgreement);

    // Subscribe to Deal for regenerate flag
    const unsubDeal = base44.entities.Deal.subscribe((event) => {
      if (event?.data?.id === dealId || event?.id === dealId) {
        console.log('[AgreementPanel] Deal event:', event.type);
        loadState();
      }
    });
    unsubs.push(unsubDeal);

    return () => unsubs.forEach(u => { try { u?.(); } catch (_) {} });
  }, [dealId]);

  // Derived state
  const isFullySigned = !!(agreement?.investor_signed_at && agreement?.agent_signed_at);
  const investorSigned = !!agreement?.investor_signed_at;
  const agentSigned = !!agreement?.agent_signed_at;
  const hasPendingOffer = !!pendingCounter && pendingCounter?.status === 'pending';
  const myRole = isInvestor ? 'investor' : 'agent';
  const amRecipient = hasPendingOffer && pendingCounter?.to_role === myRole;

  console.log('[AgreementPanel] Render state:', { 
    hasAgreement: !!agreement,
    agreementId: agreement?.id,
    hasPendingOffer, 
    amRecipient, 
    myRole,
    requiresRegenerate,
    investorSigned,
    agentSigned,
    isFullySigned
  });

  // Actions
  const handleGenerate = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('regenerateActiveAgreement', { deal_id: dealId });
      if (res.data?.error) {
        console.error('[AgreementPanel] Generation error:', res.data);
        const errorMsg = res.data.details?.missing_placeholders 
          ? `Missing: ${res.data.details.missing_placeholders.join(', ')}`
          : res.data.error;
        toast.error(errorMsg);
      } else {
        toast.success('Agreement generated');
        await loadState();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('[AgreementPanel] Generation exception:', error);
      toast.error(error?.message || 'Failed to generate agreement');
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async (role, agreementIdOverride) => {
    const agreementId = agreementIdOverride || agreement?.id;
    if (!agreementId) {
      toast.error('No agreement to sign');
      return;
    }

    setBusy(true);

    try {
      // ALWAYS return to deal context (never Pipeline)
      const params = new URLSearchParams(window.location.search);
      const currentRoomId = params.get('roomId');

      const returnUrl = currentRoomId 
        ? `/Room?roomId=${currentRoomId}&dealId=${dealId}&tab=agreement&signed=1`
        : `/Pipeline`;

      console.log('[AgreementPanel] Signing request:', { agreement_id: agreementId, role, returnUrl });

      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreementId,
        role,
        redirect_url: returnUrl,
        room_id: currentRoomId
      });

      console.log('[AgreementPanel] Signing response:', res.data);

      if (res.data?.error) {
        toast.error(res.data.error);
        setBusy(false);
      } else if (res.data?.signing_url) {
        window.location.assign(res.data.signing_url);
      } else {
        toast.error('No signing URL returned');
        console.error('[AgreementPanel] No signing URL in response:', res.data);
        setBusy(false);
      }
    } catch (error) {
      console.error('[AgreementPanel] Signing error:', error);
      toast.error(error?.message || 'Failed to start signing');
      setBusy(false);
    }
  };

  const handleSendCounter = async () => {
    if (!counterAmount || !dealId) return;
    
    // Rate limit protection: 4 second cooldown
    const now = Date.now();
    if (now - lastCounterTime < 4000) {
      toast.error('Please wait a moment before sending another counter');
      return;
    }
    
    setLastCounterTime(now);
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

    // Rate limit protection: 4 second cooldown
    const now = Date.now();
    if (now - lastCounterTime < 4000) {
      toast.error('Please wait a moment before responding to offer');
      return;
    }
    
    setLastCounterTime(now);
    setBusy(true);
    console.log('[AgreementPanel] respondToCounter:', { action, counter_id: pendingCounter.id });

    try {
      const payload = {
        counter_offer_id: pendingCounter.id,
        action
      };

      if (action === 'recounter' && customTerms) {
        payload.terms_delta = customTerms;
      }

      console.log('[AgreementPanel] Sending payload:', payload);
      const res = await base44.functions.invoke('respondToCounterOffer', payload);
      console.log('[AgreementPanel] Response:', res.data);

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
      console.error('[AgreementPanel] respondToCounter error:', error);
      toast.error('Failed to respond');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateAndSign = async () => {
    setBusy(true);
    
    try {
      console.log('[AgreementPanel] Regenerating agreement for deal:', dealId);
      const res = await base44.functions.invoke('regenerateActiveAgreement', { deal_id: dealId });
      
      if (res.data?.error) {
        toast.error(res.data.error);
        setBusy(false);
        setRegenerateModal(false);
        return;
      }
      
      const newAgreement = res.data?.agreement;
      if (!newAgreement?.id) {
        toast.error('No agreement returned from regeneration');
        setBusy(false);
        setRegenerateModal(false);
        return;
      }
      
      toast.success('Agreement regenerated - opening signing...');
      await new Promise(r => setTimeout(r, 1000));
      await loadState();
      setRegenerateModal(false);
      
      // Auto-open signing for investor with NEW agreement ID
      setTimeout(() => handleSign('investor', newAgreement.id), 500);
    } catch (error) {
      toast.error('Regeneration failed');
      setBusy(false);
      setRegenerateModal(false);
    }
  };

  // Terms display helper
  const formatCommission = (terms) => {
    if (!terms) return '—';
    if (terms.buyer_commission_type === 'percentage') {
      return `${terms.buyer_commission_percentage || 0}% of purchase price`;
    }
    return `$${(terms.buyer_flat_fee || 0).toLocaleString()} flat fee`;
  };

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
          {/* Pending Counter - HIGHEST PRIORITY for recipient */}
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
                      {(pendingCounter.terms_delta?.buyer_commission_type || pendingCounter.terms?.buyer_commission_type) === 'percentage' ? 'Percentage' : 'Flat Fee'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#808080] mb-1">Amount</div>
                    <div className="text-[#E3C567] font-bold text-lg">
                      {(pendingCounter.terms_delta?.buyer_commission_type || pendingCounter.terms?.buyer_commission_type) === 'percentage'
                        ? `${pendingCounter.terms_delta?.buyer_commission_percentage || pendingCounter.terms?.buyer_commission_percentage || 0}%`
                        : `$${(pendingCounter.terms_delta?.buyer_flat_fee || pendingCounter.terms?.buyer_flat_fee || 0).toLocaleString()}`}
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
                      const td = pendingCounter.terms_delta || pendingCounter.terms;
                      const type = td?.buyer_commission_type || 'flat';
                      setCounterType(type);
                      const amt = type === 'percentage'
                        ? (td?.buyer_commission_percentage || 0)
                        : (td?.buyer_flat_fee || 0);
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

          {/* No Agreement - Investor Generate */}
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

          {/* Agreement Exists */}
          {agreement && (
            <div className="space-y-4">
              {/* Current Terms */}
              <div className="bg-[#141414] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#FAFAFA]">Buyer Agent Compensation</h4>
                  {isAgent && !isFullySigned && !hasPendingOffer && !requiresRegenerate && (
                    <Button
                      size="sm"
                      className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black text-xs"
                      onClick={() => {
                        const terms = dealTerms || {};
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
                  {formatCommission(dealTerms)}
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

              {/* Investor Actions */}
              {isInvestor && !hasPendingOffer && (
                <>
                  {/* Initial Sign - no counter accepted, investor hasn't signed */}
                  {!investorSigned && !requiresRegenerate && (
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

                  {/* Regenerate & Sign - counter accepted OR regenerate flag set */}
                  {requiresRegenerate && (
                    <Button
                      onClick={() => setRegenerateModal(true)}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : 'Regenerate & Sign'}
                    </Button>
                  )}

                  {/* Investor Waiting for Agent */}
                  {investorSigned && !agentSigned && !requiresRegenerate && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                      <p className="text-sm text-[#FAFAFA] font-semibold">You signed</p>
                      <p className="text-xs text-[#808080] mt-1">Waiting for agent to sign</p>
                    </div>
                  )}
                </>
              )}

              {/* Agent Actions */}
              {isAgent && !hasPendingOffer && (
                <>
                  {/* Agent Wait - investor hasn't signed or regenerate required */}
                  {(!investorSigned || requiresRegenerate) && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <Clock className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                      <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for investor</p>
                      <p className="text-xs text-[#808080] mt-1">
                        {requiresRegenerate ? 'Investor is regenerating agreement with new terms' : 'You\'ll sign after investor completes'}
                      </p>
                    </div>
                  )}

                  {/* Agent Sign - investor signed, no regenerate needed */}
                  {investorSigned && !agentSigned && !requiresRegenerate && (
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
                </>
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

      {/* Regenerate Confirm Modal */}
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
                  {formatCommission(dealTerms)}
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