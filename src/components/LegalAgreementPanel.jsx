import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { FileText, CheckCircle2, Clock, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LegalAgreementPanel({ deal, profile, onUpdate, allowGenerate = false, initialAgreement = null, dealId = null }) {
  const [agreement, setAgreement] = useState(initialAgreement || null);
  const [loading, setLoading] = useState(!initialAgreement);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [exhibitA, setExhibitA] = useState(null);
  const [resolvedDealId, setResolvedDealId] = useState(null);
  const [modalTerms, setModalTerms] = useState(null);

  // Counter-offer state
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterType, setCounterType] = useState('flat');
  const [counterAmount, setCounterAmount] = useState('');
  const [pendingOffer, setPendingOffer] = useState(null);
  const [loadingOffer, setLoadingOffer] = useState(false);

  // Rate limiting for generate
  const generationInProgressRef = React.useRef(false);
  const lastGenerationTimeRef = React.useRef(0);

  // Effective deal ID (works even if full deal object isn't loaded yet)
  const effectiveDealId = deal?.id || deal?.deal_id || dealId;

  // Sync with preloaded agreement from parent (Room prefetch)
  useEffect(() => {
    if (initialAgreement && (!agreement || initialAgreement.id !== agreement.id)) {
      setAgreement(initialAgreement);
      setLoading(false);
    }
  }, [initialAgreement]);

  // Derived gating flags
  const hasPendingOffer = !!pendingOffer && pendingOffer.status === 'pending';
  const termsMismatch = (() => {
    try {
      const t = deal?.proposed_terms;
      const a = agreement?.exhibit_a_terms;
      if (!t || !a) return false;
      if (t.buyer_commission_type === 'percentage') {
        return !(a.compensation_model === 'COMMISSION_PCT' && Number(a.commission_percentage || 0) === Number(t.buyer_commission_percentage || 0));
      }
      if (t.buyer_commission_type === 'flat') {
        return !(a.compensation_model === 'FLAT_FEE' && Number(a.flat_fee_amount || 0) === Number(t.buyer_flat_fee || 0));
      }
      return false;
    } catch {
      return false;
    }
  })();

  // Role detection - user_role is authoritative
  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const isFullySigned = Boolean(agreement?.investor_signed_at && agreement?.agent_signed_at) || agreement?.status === 'fully_signed';

  // Load agreement when deal is known and agreement not in state
  useEffect(() => {
    if (effectiveDealId && !agreement) {
      loadAgreement();
    }
  }, [effectiveDealId, agreement]);

  const handleOpenGenerateModal = async () => {
    const genId = effectiveDealId;
    if (!genId) return;
    try {
      let currentDeal = deal || null;
      try {
        const { data } = await base44.functions.invoke('getDealDetailsForUser', { dealId: genId });
        if (data?.deal) currentDeal = data.deal; else if (data) currentDeal = data;
      } catch (e) {
        console.warn('[LegalAgreementPanel] Falling back to passed deal due to fetch error:', e);
      }
      if (!currentDeal) {
        toast.error('Failed to load deal data');
        return;
      }
      setResolvedDealId(currentDeal.id);
      const terms = currentDeal.proposed_terms || currentDeal.room?.proposed_terms || {};
      setModalTerms(terms);
      const newExhibitAState = {
        commission_type: terms.buyer_commission_type || 'flat',
        flat_fee_amount: terms.buyer_flat_fee || 0,
        commission_percentage: terms.buyer_commission_percentage || 0,
        net_target: terms.net_target || 0,
        transaction_type: terms.transaction_type || currentDeal.transaction_type || deal?.transaction_type || 'ASSIGNMENT',
        agreement_length_days: (typeof terms.agreement_length === 'number' ? terms.agreement_length : parseInt(terms.agreement_length, 10)) || 180,
        termination_notice_days: 30,
      };
      setExhibitA(newExhibitAState);
      setShowGenerateModal(true);
    } catch (error) {
      console.error('[LegalAgreementPanel] Error loading fresh deal data:', error);
      toast.error('Failed to load deal data');
    }
  };

  const handleCloseGenerateModal = () => {
    setExhibitA(null);
    setShowGenerateModal(false);
  };

  const loadAgreement = async () => {
    if (!effectiveDealId) { setLoading(false); return; }
    try {
      setLoading(true);
      const response = await base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId });
      setAgreement(response.data?.agreement || null);
    } catch (error) {
      console.error('[LegalAgreementPanel] Error loading agreement:', error);
      setAgreement(null);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestOffer = async () => {
    if (!effectiveDealId) {
      console.log('[LegalAgreementPanel] Cannot load offers - no effectiveDealId');
      return;
    }
    try {
      console.log('[LegalAgreementPanel] Loading counter offers for deal:', effectiveDealId);
      setLoadingOffer(true);
      const offers = await base44.entities.CounterOffer.filter({ deal_id: effectiveDealId, status: 'pending' }, '-created_date', 1);
      console.log('[LegalAgreementPanel] Found counter offers:', offers);
      console.log('[LegalAgreementPanel] Current role - isInvestor:', isInvestor, 'isAgent:', isAgent);
      setPendingOffer(offers?.[0] || null);
      if (offers?.[0]) {
        console.log('[LegalAgreementPanel] Set pending offer:', {
          id: offers[0].id,
          from_role: offers[0].from_role,
          terms: offers[0].terms,
          status: offers[0].status
        });
      } else {
        console.log('[LegalAgreementPanel] No pending offers found');
      }
    } catch (e) {
      console.error('[LegalAgreementPanel] Error loading counter offer:', e);
    } finally {
      setLoadingOffer(false);
    }
  };

  // Real-time subscriptions to counter offer changes
  useEffect(() => {
    if (!effectiveDealId) return;

    const unsubscribe = base44.entities.CounterOffer.subscribe((event) => {
      console.log('[LegalAgreementPanel] Counter offer event:', event);
      if (event?.data?.deal_id !== effectiveDealId) return;

      // Whenever a counter offer is created or updated, reload immediately
      if (event.type === 'create' || event.type === 'update') {
        console.log('[LegalAgreementPanel] Reloading counter offers after event');
        (async () => {
          try {
            setLoadingOffer(true);
            const offers = await base44.entities.CounterOffer.filter({ deal_id: effectiveDealId, status: 'pending' }, '-created_date', 1);
            console.log('[LegalAgreementPanel] Loaded counter offers:', offers);
            setPendingOffer(offers?.[0] || null);
          } finally {
            setLoadingOffer(false);
          }
        })();
      }
    });

    return () => { try { unsubscribe && unsubscribe(); } catch (_) {} };
  }, [effectiveDealId]);

  // Load counter offers when component mounts or deal/agreement changes
  useEffect(() => { 
    console.log('[LegalAgreementPanel] Component mounted/updated - Loading counter offers');
    console.log('[LegalAgreementPanel] State:', { effectiveDealId, hasAgreement: !!agreement, isInvestor, isAgent, profile_user_role: profile?.user_role });
    if (effectiveDealId) {
      loadLatestOffer();
    }
  }, [effectiveDealId, agreement]);

  const submitCounterOffer = async (fromRole) => {
    if ((agreement?.investor_signed_at && agreement?.agent_signed_at) || agreement?.status === 'fully_signed') {
      toast.error('Agreement is fully signed; countering is disabled.');
      setShowCounterModal(false);
      return;
    }
    if (!deal?.id) return;
    const terms = counterType === 'flat'
      ? { buyer_commission_type: 'flat', buyer_flat_fee: Number(counterAmount || 0), buyer_commission_percentage: null }
      : { buyer_commission_type: 'percentage', buyer_commission_percentage: Number(counterAmount || 0), buyer_flat_fee: null };
    await base44.entities.CounterOffer.create({ deal_id: deal.id, from_role: fromRole, terms, status: 'pending' });
    setShowCounterModal(false);
    setCounterAmount('');
    await loadLatestOffer();
    if (onUpdate) onUpdate();
    toast.success('Counter offer sent');
  };

  const acceptOffer = async () => {
    if (!pendingOffer) return;
    const newTerms = { ...(deal?.proposed_terms || {}), ...(pendingOffer.terms || {}) };
    await base44.entities.Deal.update(effectiveDealId, { proposed_terms: newTerms });
    await base44.entities.CounterOffer.update(pendingOffer.id, { status: 'accepted', responded_by_role: isInvestor ? 'investor' : 'agent' });
    await loadLatestOffer();
    if (onUpdate) onUpdate();
    toast.success('Terms updated');
  };

  const denyOffer = async () => {
    if (!pendingOffer) return;
    await base44.entities.CounterOffer.update(pendingOffer.id, { status: 'declined', responded_by_role: isInvestor ? 'investor' : 'agent' });
    await base44.functions.invoke('voidDeal', { deal_id: effectiveDealId });
    toast.success('Deal voided');
    if (onUpdate) onUpdate();
  };

  const handleGenerate = async () => {
    // Prevent rapid-fire generation attempts
    if (generationInProgressRef.current) {
      toast.error('Generation already in progress. Please wait.');
      return;
    }

    const now = Date.now();
    const timeSinceLastGen = now - lastGenerationTimeRef.current;
    if (timeSinceLastGen < 3000) {
      toast.error('Please wait before generating again');
      return;
    }

    const genDealId = resolvedDealId || effectiveDealId;
    if (!genDealId) { toast.error('Missing deal ID — cannot generate agreement.'); return; }
    if (!profile?.user_id) { toast.error('Missing user ID — cannot generate agreement.'); return; }
    if (!profile?.user_role) { toast.error('Missing user role — cannot generate agreement.'); return; }

    generationInProgressRef.current = true;
    lastGenerationTimeRef.current = now;
    setGenerating(true);
    try {
      let compensationModel = 'FLAT_FEE';
      if (exhibitA?.commission_type === 'percentage') compensationModel = 'COMMISSION_PCT';
      else if (exhibitA?.commission_type === 'net') compensationModel = 'NET_SPREAD';

      const derivedExhibitA = {
        compensation_model: compensationModel,
        flat_fee_amount: exhibitA?.flat_fee_amount || 0,
        commission_percentage: exhibitA?.commission_percentage || 0,
        net_target: exhibitA?.net_target || 0,
        transaction_type: exhibitA?.transaction_type || deal.transaction_type || 'ASSIGNMENT',
        agreement_length_days: exhibitA?.agreement_length_days || 180,
        termination_notice_days: exhibitA?.termination_notice_days || 30,
        buyer_commission_type: deal.proposed_terms?.buyer_commission_type,
        buyer_commission_amount: deal.proposed_terms?.buyer_commission_percentage || deal.proposed_terms?.buyer_flat_fee,
        seller_commission_type: deal.proposed_terms?.seller_commission_type,
        seller_commission_amount: deal.proposed_terms?.seller_commission_percentage || deal.proposed_terms?.seller_flat_fee,
      };

      const response = await base44.functions.invoke('generateLegalAgreement', {
        deal_id: genDealId,
        exhibit_a: derivedExhibitA,
        use_buyer_terms: true,
      });

      if (response.data?.error) {
        if (response.data?.missing_placeholders?.length) {
          toast.error(`Missing required data: ${response.data.missing_placeholders.join(', ')}`, { duration: 6000 });
        } else {
          toast.error(response.data.error);
        }
        return;
      }

      if (response.data?.converted_from_net) {
        toast.warning('Net listing converted to Flat Fee due to state restrictions');
      }

      if (!response.data?.agreement) {
        toast.error('Agreement generated but not returned from server');
        return;
      }

      if (response.data?.regenerated === false) toast.info('Agreement already up to date (no changes needed)');
      else toast.success('Agreement generated successfully');

      await loadAgreement();
      setShowGenerateModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.message || String(error);
      if (errorMessage.includes('rate limit')) {
        toast.error('Rate limit exceeded. Please wait a moment before trying again.', { duration: 5000 });
      } else {
        toast.error(`Generate agreement failed: ${errorMessage}`);
      }
    } finally {
      setGenerating(false);
      generationInProgressRef.current = false;
    }
  };

  const handleSign = async (signatureType) => {
    try {
      if (signatureType === 'agent') {
        if (hasPendingOffer || termsMismatch || !agreement?.investor_signed_at) {
          toast.error(hasPendingOffer ? 'Counter offer pending. Wait for investor to confirm and regenerate.' : (termsMismatch ? 'Agreement out of date. Wait for investor to regenerate and sign.' : 'Investor must sign first.'));
          return;
        }
      } else if (signatureType === 'investor') {
        if (hasPendingOffer || termsMismatch) {
          toast.error(hasPendingOffer ? 'Respond to the counter offer first.' : 'Regenerate the agreement to reflect current terms before signing.');
          return;
        }
      }
      setSigning(true);

      const returnTo = window.location.pathname + window.location.search;
      const response = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role: signatureType,
        redirect_url: (window.location.pathname.toLowerCase().includes('/myagreement') ? '/Pipeline' : returnTo),
      });

      if (!response?.data) {
        toast.error('No response from signing service');
        setSigning(false);
        return;
      }

      const data = response.data;

      if (data?.error && /investor must sign/i.test(data.error) && agreement?.investor_signed_at) {
        try {
          await base44.functions.invoke('docusignSyncEnvelope', { deal_id: effectiveDealId });
          const refreshed = await base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId });
          if (refreshed?.data?.agreement?.investor_signed_at && !refreshed?.data?.agreement?.agent_signed_at) {
            const retry = await base44.functions.invoke('docusignCreateSigningSession', {
              agreement_id: refreshed.data.agreement.id,
              role: signatureType,
              redirect_url: returnTo,
            });
            if (retry?.data?.signing_url) {
              window.location.assign(retry.data.signing_url);
              return;
            }
          }
        } catch (_) {}
      }

      if (data.error) {
        toast.error(data.error.includes('token expired') ? 'DocuSign connection expired. Please try again in a moment.' : data.error);
        setSigning(false);
        return;
      }

      if (!data.signing_url) {
        toast.error('Failed to get signing URL');
        setSigning(false);
        return;
      }

      window.location.assign(data.signing_url);
    } catch (error) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      toast.error(errorMsg.includes('token expired') ? 'DocuSign connection expired. Please try again in a moment - the system is reconnecting.' : 'Failed to open signing: ' + errorMsg);
      setSigning(false);
    }
  };

  const getStatusDisplay = () => {
    if (!agreement) return null;
    const statusConfig = {
      draft: { icon: FileText, color: 'text-[#808080]', ring: 'border-[#1F1F1F]', label: 'Sign Contract' },
      sent: { icon: Clock, color: 'text-blue-400', ring: 'border-blue-400/30', label: 'Sign Contract' },
      investor_signed: { icon: CheckCircle2, color: 'text-yellow-400', ring: 'border-yellow-400/30', label: 'Investor Signed' },
      agent_signed: { icon: CheckCircle2, color: 'text-yellow-400', ring: 'border-yellow-400/30', label: 'Agent Signed' },
      attorney_review_pending: { icon: Clock, color: 'text-orange-400', ring: 'border-orange-400/30', label: 'Attorney Review' },
      fully_signed: { icon: CheckCircle2, color: 'text-green-400', ring: 'border-green-400/30', label: 'Fully Executed' },
    };
    const config = statusConfig[agreement.status] || statusConfig.draft;
    const badge = getAgreementStatusLabel({ agreement, role: isAgent ? 'agent' : 'investor' });
    const displayLabel = badge?.label || config.label;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent ${config.ring}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{displayLabel}</span>
      </Badge>
    );
  };

  const getNJCountdown = () => {
    if (agreement?.status !== 'attorney_review_pending' || !agreement.nj_review_end_at) return null;
    const end = new Date(agreement.nj_review_end_at);
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return 'Review period ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  // Loading card
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
          {agreement && getStatusDisplay()}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* No agreement yet */}
        {!agreement && isInvestor && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
            <p className="text-[#808080] mb-4">No agreement generated yet</p>
            <Button onClick={handleOpenGenerateModal} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black">Generate Agreement</Button>
          </div>
        )}

        {/* If agreement exists but investor hasn't signed yet */}
        {agreement && !agreement.investor_signed_at && isInvestor && (
          hasPendingOffer || termsMismatch ? (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
              <p className="text-sm text-[#FAFAFA] mb-1">
                {hasPendingOffer ? 'An agent counter offer is pending. Review below and confirm or counter.' : 'Terms changed. Please regenerate the agreement before signing.'}
              </p>
              <div className="flex gap-2">
                <Button onClick={handleOpenGenerateModal} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full">{termsMismatch ? 'Regenerate Agreement' : 'Review & Generate'}</Button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                {getStatusDisplay()}
              </div>
              <p className="text-sm text-[#FAFAFA] mb-2">Your agreement is ready. Please sign to continue.</p>
              <Button onClick={() => handleSign('investor')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                {signing ? 'Opening DocuSign...' : 'Sign as Investor'}
              </Button>
            </div>
          )
        )}

        {/* Agent waiting copy */}
        {!agreement && isAgent && (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-[#F59E0B] mx-auto mb-4" />
            <p className="text-[#FAFAFA] font-semibold mb-2">Waiting for Investor to Generate Agreement</p>
            <p className="text-xs text-[#808080]">The investor will create and sign the agreement first</p>
          </div>
        )}

        {/* Agreement exists */}
        {agreement && (
          <div className="space-y-4">
            {termsMismatch && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="text-sm text-[#FAFAFA] font-semibold">Agreement out of date</div>
                <div className="text-xs text-[#808080]">Terms changed. Investor must regenerate and sign before agent can sign.</div>
              </div>
            )}

            {/* NJ Attorney Review Countdown */}
            {agreement.status === 'attorney_review_pending' && (
              <div className="bg-orange-400/10 border border-orange-400/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-orange-400 mb-1">NJ Attorney Review Period</div>
                    <div className="text-sm text-[#808080]">{getNJCountdown()}</div>
                    <div className="text-xs text-[#808080] mt-1">Either party may cancel until 11:59 PM on the review end date</div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Terms (from deal) */}
            {deal?.proposed_terms && (
              <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[#808080]">Buyer Agent Compensation</div>
                  {isAgent && !isFullySigned && (
                      <Button
                      size="sm"
                      className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      onClick={() => {
                        const t = deal.proposed_terms || {};
                        const tType = t.buyer_commission_type || 'flat';
                        setCounterType(tType);
                        setCounterAmount(String(tType === 'percentage' ? (t.buyer_commission_percentage || 0) : (t.buyer_flat_fee || 0)));
                        setShowCounterModal(true);
                      }}
                    >
                      Counter
                    </Button>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Type</span>
                  <span className="text-[#FAFAFA] capitalize">{deal.proposed_terms.buyer_commission_type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Amount</span>
                  <span className="text-[#FAFAFA]">
                    {deal.proposed_terms.buyer_commission_type === 'percentage'
                      ? `${deal.proposed_terms.buyer_commission_percentage || 0}%`
                      : `$${(deal.proposed_terms.buyer_flat_fee || 0).toLocaleString()}`}
                  </span>
                </div>
              </div>
            )}

            {/* Pending Counter Offer panel */}
            {console.log('[LegalAgreementPanel] Rendering - pendingOffer:', pendingOffer, 'hasPendingOffer:', hasPendingOffer)}
            {pendingOffer && (
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[#FAFAFA] font-semibold">Proposed New Deal Terms</div>
                  <div className="text-xs text-[#808080]">from {pendingOffer.from_role}</div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-[#808080]">Type</div>
                      <div className="text-[#FAFAFA] capitalize">{pendingOffer.terms?.buyer_commission_type}</div>
                    </div>
                    <div>
                      <div className="text-[#808080]">Amount</div>
                      <div className="text-[#FAFAFA]">
                        {pendingOffer.terms?.buyer_commission_type === 'percentage'
                          ? `${pendingOffer.terms?.buyer_commission_percentage || 0}%`
                          : `$${(pendingOffer.terms?.buyer_flat_fee || 0).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isFullySigned && ((isInvestor && pendingOffer.from_role === 'agent') || (isAgent && pendingOffer.from_role === 'investor')) ? (
                      <>
                        <Button size="sm" className="bg-[#10B981] hover:bg-[#059669]" onClick={acceptOffer}>Confirm</Button>
                        <Button size="sm" variant="destructive" onClick={denyOffer}>Deny</Button>
                        <Button size="sm" className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black" onClick={() => {
                          setCounterType(pendingOffer.terms?.buyer_commission_type || 'flat');
                          const amt = pendingOffer.terms?.buyer_commission_type === 'percentage'
                            ? pendingOffer.terms?.buyer_commission_percentage || 0
                            : pendingOffer.terms?.buyer_flat_fee || 0;
                          setCounterAmount(String(amt));
                          setShowCounterModal(true);
                        }}>Counter</Button>
                      </>
                    ) : (
                      <div className="text-xs text-[#808080]">Waiting for the other party</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Agreement Details */}
            <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#808080]">Governing State:</span>
                <span className="text-[#FAFAFA]">{agreement.governing_state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Transaction Type:</span>
                <span className="text-[#FAFAFA]">{agreement.transaction_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Compensation Model:</span>
                <span className="text-[#FAFAFA]">{agreement.exhibit_a_terms?.compensation_model}</span>
              </div>
              {agreement.exhibit_a_terms?.converted_from_net && (
                <div className="text-xs text-yellow-400 mt-2">* Converted from Net listing due to state restrictions</div>
              )}
            </div>

            {/* Signature Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                <div className="text-xs text-[#808080] mb-2">Investor</div>
                {agreement.investor_signed_at ? (
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
                {agreement.agent_signed_at ? (
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

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {!agreement.investor_signed_at && isInvestor && (
                <Button onClick={() => handleSign('investor')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  {signing ? 'Opening DocuSign...' : 'Sign as Investor'}
                </Button>
              )}

              {!agreement.investor_signed_at && isAgent && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                  <Clock className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for Investor Signature</p>
                  <p className="text-xs text-[#808080] mt-1">You'll be notified when it's your turn to sign</p>
                </div>
              )}

              {agreement.investor_signed_at && !agreement.agent_signed_at && isAgent && (
                hasPendingOffer || termsMismatch ? (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-[#FAFAFA] font-semibold">{hasPendingOffer ? 'Counter offer pending' : 'Agreement needs regeneration'}</p>
                    <p className="text-xs text-[#808080] mt-1">Agent cannot sign until investor confirms and regenerates, then signs.</p>
                  </div>
                ) : (
                  <Button onClick={() => handleSign('agent')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                    {signing ? 'Opening DocuSign...' : 'Sign as Agent'}
                  </Button>
                )
              )}

              {agreement.investor_signed_at && !agreement.agent_signed_at && isInvestor && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center mb-2">{getStatusDisplay()}</div>
                  <p className="text-sm text-[#FAFAFA] font-semibold">Investor Signed</p>
                  <p className="text-xs text-[#808080] mt-1">Waiting for agent to sign</p>
                </div>
              )}

              {agreement.investor_signed_at && agreement.agent_signed_at && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center mb-2">{getStatusDisplay()}</div>
                  <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
                  <p className="text-xs text-[#808080] mt-1">Agreement complete</p>
                </div>
              )}

              {/* PDF access: agents only after fully signed */}
              {isAgent ? (
                isFullySigned && (agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url) ? (
                  <Button
                    onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url, '_blank')}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Signed PDF
                  </Button>
                ) : null
              ) : (
                (agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url) && (
                  <Button
                    onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url, '_blank')}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {agreement.signed_pdf_url ? 'Download Signed PDF' : 'View Agreement PDF'}
                  </Button>
                )
              )}

              {isInvestor && !isFullySigned && (
                <Button onClick={handleOpenGenerateModal} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full">Regenerate Agreement</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={handleCloseGenerateModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Generate Agreement</DialogTitle>
          </DialogHeader>

          {!exhibitA ? (
            <div className="py-8 text-center text-[#808080]">Loading terms...</div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-[#FAFAFA]">Buyer's Agent Commission Type</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">
                  {exhibitA.commission_type === 'percentage' ? 'Percentage of Purchase Price' : exhibitA.commission_type === 'flat' ? 'Flat Fee' : exhibitA.commission_type === 'net' ? 'Net/Spread' : 'Not Set'}
                </div>
                <p className="text-xs text-[#808080] mt-1">From deal: buyer_commission_type = "{modalTerms?.buyer_commission_type ?? exhibitA.commission_type}"</p>
              </div>

              {exhibitA.commission_type === 'flat' && (
                <div>
                  <Label className="text-[#FAFAFA]">Buyer's Agent Flat Fee</Label>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">${(exhibitA.flat_fee_amount || 0).toLocaleString()}</div>
                  <p className="text-xs text-[#808080] mt-1">From deal: buyer_flat_fee = {modalTerms?.buyer_flat_fee ?? exhibitA.flat_fee_amount}</p>
                </div>
              )}

              {exhibitA.commission_type === 'percentage' && (
                <div>
                  <Label className="text-[#FAFAFA]">Buyer's Agent Commission %</Label>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">{exhibitA.commission_percentage || 0}%</div>
                  <p className="text-xs text-[#808080] mt-1">From deal: buyer_commission_percentage = {modalTerms?.buyer_commission_percentage ?? exhibitA.commission_percentage}</p>
                </div>
              )}

              {exhibitA.commission_type === 'net' && (
                <div>
                  <Label className="text-[#FAFAFA]">Net Target Amount</Label>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">${(exhibitA.net_target || 0).toLocaleString()}</div>
                </div>
              )}

              <div>
                <Label className="text-[#FAFAFA]">Transaction Type</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">{exhibitA.transaction_type === 'ASSIGNMENT' ? 'Assignment' : 'Double Close'}</div>
              </div>

              <div>
                <Label className="text-[#FAFAFA]">Agreement Length</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA]">{exhibitA.agreement_length_days || 180} Days</div>
              </div>

              <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 mt-4">
                <p className="text-sm text-[#FAFAFA]/80 mb-3">Need to change these terms? Go to the edit deal page to update commission type, amounts, or agreement length.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGenerateModal(false);
                    window.location.href = `/NewDeal?dealId=${effectiveDealId}`;
                  }}
                  className="border-[#60A5FA] text-[#60A5FA] hover:bg-[#60A5FA]/10 w-full"
                >
                  Edit Deal Terms
                </Button>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowGenerateModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Counter Modal */}
      <Dialog open={showCounterModal} onOpenChange={(v) => setShowCounterModal(Boolean(v))}>
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
              <p className="text-xs text-[#808080] mt-1">{counterType === 'percentage' ? 'Example: 3 for 3%' : 'Example: 5000 for $5,000'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCounterModal(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black" onClick={() => submitCounterOffer(isAgent ? 'agent' : 'investor')}>
              Submit Counter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}