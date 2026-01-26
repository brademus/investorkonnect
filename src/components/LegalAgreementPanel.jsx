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

export default function LegalAgreementPanel({ deal, profile, onUpdate, allowGenerate = false, initialAgreement = null, dealId = null, hideRegenerateButton = false }) {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const [freshDeal, setFreshDeal] = useState(deal || null);
  const [currentDealId, setCurrentDealId] = useState(null);

  // Generation state tracking
  const generationInProgressRef = React.useRef(false);
  const generationTimeoutRef = React.useRef(null);

  // Effective deal ID (works even if full deal object isn't loaded yet)
  const effectiveDealId = deal?.id || deal?.deal_id || dealId;

  // Reset and load data when deal ID changes
  useEffect(() => {
    if (!effectiveDealId) return;
    
    // Detect deal change and reset state
    if (currentDealId && currentDealId !== effectiveDealId) {
      console.log('[LegalAgreementPanel] Deal ID changed, resetting state');
      setAgreement(null);
      setPendingOffer(null);
      setLoading(true);
    }
    
    setCurrentDealId(effectiveDealId);
  }, [effectiveDealId, currentDealId]);

  // Single coordinated initial load - always fresh
  useEffect(() => {
    if (!effectiveDealId) return;
    
    let mounted = true;
    
    (async () => {
      try {
        console.log('[LegalAgreementPanel] Starting fresh load for deal:', effectiveDealId);
        
        const [dealResponse, agreementResponse, offers] = await Promise.all([
          base44.functions.invoke('getDealDetailsForUser', { dealId: effectiveDealId }).catch(e => {
            console.error('[LegalAgreementPanel] Deal load failed:', e);
            return null;
          }),
          base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId }).catch(e => {
            console.error('[LegalAgreementPanel] Agreement load failed:', e);
            return null;
          }),
          base44.entities.CounterOffer.filter({ deal_id: effectiveDealId, status: 'pending' }, '-created_date', 1).catch(e => {
            console.error('[LegalAgreementPanel] Counter offers load failed:', e);
            return [];
          })
        ]);
        
        if (!mounted || effectiveDealId !== (deal?.id || deal?.deal_id || dealId)) return;
        
        // Set deal
        if (dealResponse?.data) {
          console.log('[LegalAgreementPanel] Deal loaded successfully');
          setFreshDeal(dealResponse.data);
        } else {
          console.log('[LegalAgreementPanel] Deal load failed');
          setFreshDeal(null);
        }
        
        // Set agreement - always update to ensure correctness
        if (agreementResponse?.data?.agreement) {
          console.log('[LegalAgreementPanel] Agreement loaded:', agreementResponse.data.agreement.id);
          setAgreement(agreementResponse.data.agreement);
        } else {
          console.log('[LegalAgreementPanel] No agreement found');
          setAgreement(null);
        }
        
        // Set pending offers
        if (offers && offers.length > 0) {
          console.log('[LegalAgreementPanel] Found pending counter offer:', offers[0].id);
          setPendingOffer(offers[0]);
        } else {
          console.log('[LegalAgreementPanel] No pending counter offers');
          setPendingOffer(null);
        }
        
        setLoading(false);
      } catch (e) {
        console.error('[LegalAgreementPanel] Unexpected error during load:', e);
        if (mounted) setLoading(false);
      }
    })();
    
    return () => { mounted = false; };
  }, [effectiveDealId]);

  // Keep freshDeal in sync with deal prop updates
  useEffect(() => {
    if (deal && deal.id === effectiveDealId) {
      setFreshDeal(prev => prev?.id === deal.id ? { ...prev, ...deal } : deal);
    }
  }, [deal, effectiveDealId]);

  // Subscribe to Deal updates to get fresh terms immediately
  useEffect(() => {
    if (!effectiveDealId) return;
    
    const unsubscribe = base44.entities.Deal.subscribe((event) => {
      if (event?.data?.id === effectiveDealId && event.type === 'update') {
        setFreshDeal(prev => ({ ...(prev || {}), ...event.data }));
      }
    });
    
    return () => { try { unsubscribe && unsubscribe(); } catch (_) {} };
  }, [effectiveDealId]);

  // Derived gating flags - use freshDeal or fall back to deal
  const activeDeal = freshDeal || deal;
  const hasPendingOffer = !!pendingOffer && pendingOffer.status === 'pending';
  const termsMismatch = (() => {
    try {
      const t = activeDeal?.proposed_terms;
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

  // Role detection - user_role is authoritative (memoized to prevent recalculation)
  const isInvestor = React.useMemo(() => profile?.user_role === 'investor', [profile?.user_role]);
  const isAgent = React.useMemo(() => profile?.user_role === 'agent', [profile?.user_role]);
  const isFullySigned = React.useMemo(() => 
    Boolean(agreement?.investor_signed_at && agreement?.agent_signed_at) || agreement?.status === 'fully_signed',
    [agreement?.investor_signed_at, agreement?.agent_signed_at, agreement?.status]
  );

  const handleOpenGenerateModal = async () => {
    // Block regeneration if there's a pending counter offer
    if (hasPendingOffer) {
      toast.error('You must respond to the counter offer before regenerating the agreement.');
      return;
    }
    
    const genId = effectiveDealId;
    if (!genId) return;
    try {
      // Try to fetch fresh data, but fall back to freshDeal or deal if fetch fails
      let currentDeal = freshDeal || deal;
      try {
        const { data } = await base44.functions.invoke('getDealDetailsForUser', { dealId: genId });
        if (data?.deal || data) {
          currentDeal = data?.deal || data;
          setFreshDeal(currentDeal);
        }
      } catch (fetchError) {
        console.log('[LegalAgreementPanel] Fetch failed, using cached freshDeal:', fetchError);
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
      console.error('[LegalAgreementPanel] Error loading deal data:', error);
      toast.error('Failed to load deal data');
    }
  };

  const handleCloseGenerateModal = () => {
    setExhibitA(null);
    setShowGenerateModal(false);
  };

  const loadAgreement = async () => {
    if (!effectiveDealId) return;
    try {
      console.log('[LegalAgreementPanel] Loading agreement for deal:', effectiveDealId);
      const response = await base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId });
      console.log('[LegalAgreementPanel] Agreement loaded:', response?.data?.agreement);
      if (response?.data?.agreement) {
        setAgreement(response.data.agreement);
        return response.data.agreement;
      } else {
        console.log('[LegalAgreementPanel] No agreement found, keeping existing');
        return null;
      }
    } catch (error) {
      console.error('[LegalAgreementPanel] Error loading agreement:', error);
      return null;
    }
  };

  // Real-time subscriptions to counter offer changes + initial load
  useEffect(() => {
    if (!effectiveDealId) return;

    let mounted = true;

    // Load initial pending offers only
    const loadOffers = async () => {
      try {
        const pendingOffers = await base44.entities.CounterOffer.filter({ deal_id: effectiveDealId, status: 'pending' }, '-created_date', 1);
        if (mounted && pendingOffers?.length > 0) {
          console.log('[LegalAgreementPanel] Loaded pending offer:', pendingOffers[0].id);
          setPendingOffer(pendingOffers[0]);
        } else if (mounted) {
          setPendingOffer(null);
        }
      } catch (e) {
        console.error('[LegalAgreementPanel] Error loading counter offers:', e);
        if (mounted) setPendingOffer(null);
      }
    };

    loadOffers();

    // Subscribe to real-time updates - trigger immediately on any event
    const unsubscribe = base44.entities.CounterOffer.subscribe((event) => {
      if (!mounted) return;
      if (event?.data?.deal_id !== effectiveDealId) return;

      console.log('[LegalAgreementPanel] CounterOffer event:', event.type, event.data?.id, event.data?.status);

      // On create: immediately show if pending
      if (event.type === 'create') {
        if (event.data?.status === 'pending') {
          console.log('[LegalAgreementPanel] New pending offer received instantly:', event.data.id);
          setPendingOffer(event.data);
        }
        return;
      }

      // On update: check if it changed to declined/superseded
      if (event.type === 'update') {
        const status = event.data?.status;
        if (status === 'accepted') {
          console.log('[LegalAgreementPanel] Offer accepted, clearing:', event.data.id);
          setPendingOffer(null);
        } else if (status === 'declined' || status === 'superseded') {
          console.log('[LegalAgreementPanel] Offer declined/superseded, clearing:', event.data.id);
          setPendingOffer(null);
        } else if (status === 'pending') {
          setPendingOffer(event.data);
        }
        return;
      }

      // On delete: clear if it was our pending offer
      if (event.type === 'delete' && event.data?.id === pendingOffer?.id) {
        console.log('[LegalAgreementPanel] Pending offer deleted');
        setPendingOffer(null);
      }
    });

    return () => { 
      mounted = false;
      try { unsubscribe?.(); } catch (_) {} 
    };
    }, [effectiveDealId]);

  // Refresh agreement when returning from DocuSign without signing
  useEffect(() => {
    const handleDocuSignReturn = async () => {
      // Check if we're returning from DocuSign (has DocuSign params but no signed=1)
      const params = new URLSearchParams(window.location.search);
      if ((params.get('code') || params.get('state')) && !params.get('signed')) {
        // User cancelled or went back from DocuSign without signing - refresh agreement
        console.log('[LegalAgreementPanel] User returned from DocuSign without signing, refreshing...');
        await loadAgreement();
      }
    };
    
    handleDocuSignReturn();
  }, [window.location.search]);

  const submitCounterOffer = async (fromRole) => {
    if (!effectiveDealId) {
      toast.error('Deal ID missing');
      return;
    }

    if ((agreement?.investor_signed_at && agreement?.agent_signed_at) || agreement?.status === 'fully_signed') {
      toast.error('Agreement is already fully signed. Cannot propose counter offers.');
      return;
    }

    try {
      // Build new terms from counter
      const newTerms = {
        buyer_commission_type: counterType,
        buyer_commission_percentage: counterType === 'percentage' ? Number(counterAmount || 0) : null,
        buyer_flat_fee: counterType === 'flat' ? Number(counterAmount || 0) : null,
      };

      // Void old agreement if exists
      if (agreement?.docusign_envelope_id) {
        try {
          console.log('[Counter] Voiding old agreement envelope:', agreement.docusign_envelope_id);
          await base44.entities.LegalAgreement.update(agreement.id, {
            docusign_envelope_id: null,
            docusign_status: 'voided',
            investor_signed_at: null,
            agent_signed_at: null,
            investor_recipient_id: null,
            agent_recipient_id: null,
            status: 'draft'
          });
        } catch (e) {
          console.warn('[Counter] Warning clearing old agreement:', e?.message);
        }
      }

      // Mark existing pending counter offer as superseded
      if (pendingOffer?.status === 'pending') {
        await base44.entities.CounterOffer.update(pendingOffer.id, { 
          status: 'superseded',
          responded_by_role: fromRole 
        });
      }

      // Create new counter offer
      const newOffer = await base44.entities.CounterOffer.create({
        deal_id: effectiveDealId,
        from_role: fromRole,
        terms: newTerms,
        status: 'pending'
      });

      // Update deal with new terms
      await base44.entities.Deal.update(effectiveDealId, {
        proposed_terms: {
          ...(activeDeal?.proposed_terms || {}),
          ...newTerms
        }
      });

      // Clear UI
      setShowCounterModal(false);
      setCounterAmount('');
      setPendingOffer(newOffer);
      setFreshDeal(prev => ({
        ...(prev || {}),
        proposed_terms: { ...(prev?.proposed_terms || {}), ...newTerms }
      }));

      if (onUpdate) onUpdate();
      toast.success('Counter offer sent successfully');
    } catch (error) {
      toast.error(error?.message || 'Failed to send counter offer');
      console.error('[Counter] Error:', error);
    }
  };

  const acceptOffer = async () => {
    if (!pendingOffer) return;
    if (generationInProgressRef.current) {
      toast.info('Please wait...');
      return;
    }

    try {
      const currentTerms = (freshDeal || deal)?.proposed_terms || {};
      const newTerms = {
        ...currentTerms,
        buyer_commission_type: pendingOffer.terms?.buyer_commission_type,
        buyer_commission_percentage: pendingOffer.terms?.buyer_commission_percentage,
        buyer_flat_fee: pendingOffer.terms?.buyer_flat_fee,
        seller_commission_type: currentTerms.seller_commission_type,
        seller_commission_percentage: currentTerms.seller_commission_percentage,
        seller_flat_fee: currentTerms.seller_flat_fee,
      };

      // Mark counter as accepted and update deal
      await base44.entities.CounterOffer.update(pendingOffer.id, { 
        status: 'accepted', 
        responded_by_role: isInvestor ? 'investor' : 'agent' 
      });
      
      await base44.entities.Deal.update(effectiveDealId, { proposed_terms: newTerms });

      // Update local state
      setFreshDeal(prev => ({ ...(prev || deal), proposed_terms: newTerms }));
      setPendingOffer(null);

      // Auto-regenerate for investor
      if (isInvestor) {
        toast.success('Counter accepted - regenerating agreement...');
        
        // Auto-generate agreement directly
        generationInProgressRef.current = true;
        setGenerating(true);

        if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = setTimeout(() => {
          generationInProgressRef.current = false;
          setGenerating(false);
        }, 90000);

        try {
          let compensationModel = 'FLAT_FEE';
          if (newTerms.buyer_commission_type === 'percentage') compensationModel = 'COMMISSION_PCT';

          const derivedExhibitA = {
            compensation_model: compensationModel,
            flat_fee_amount: newTerms.buyer_flat_fee || 0,
            commission_percentage: newTerms.buyer_commission_percentage || 0,
            transaction_type: activeDeal?.transaction_type || 'ASSIGNMENT',
            agreement_length_days: activeDeal?.proposed_terms?.agreement_length || 180,
            termination_notice_days: 30,
            buyer_commission_type: newTerms.buyer_commission_type,
            buyer_commission_amount: newTerms.buyer_commission_percentage || newTerms.buyer_flat_fee,
          };

          const response = await base44.functions.invoke('generateLegalAgreement', {
            deal_id: effectiveDealId,
            exhibit_a: derivedExhibitA,
            use_buyer_terms: true,
          });

          if (response.data?.error) {
            toast.error(response.data.error);
            return;
          }

          toast.success('Agreement regenerated - ready to sign');
          
          // Reload data
          await loadAgreement();
          const { data } = await base44.functions.invoke('getDealDetailsForUser', { dealId: effectiveDealId });
          if (data) setFreshDeal(data);

          if (onUpdate) onUpdate();
        } catch (genError) {
          const errorMessage = genError?.response?.data?.error || genError?.message || String(genError);
          toast.error('Failed to regenerate: ' + errorMessage, { duration: 5000 });
        } finally {
          if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
          setGenerating(false);
          generationInProgressRef.current = false;
        }
      } else {
        toast.success('Counter accepted - waiting for investor to regenerate');
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error('Failed to accept counter offer');
      console.error('[LegalAgreementPanel] Error accepting offer:', error);
    }
  };

  const denyOffer = async () => {
    if (!pendingOffer) return;
    try {
      await base44.entities.CounterOffer.update(pendingOffer.id, { 
        status: 'declined', 
        responded_by_role: isInvestor ? 'investor' : 'agent' 
      });
      setPendingOffer(null);
      toast.success('Counter offer declined');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to decline counter offer');
      console.error('[LegalAgreementPanel] Error declining offer:', error);
    }
  };

  const handleGenerate = async () => {
    if (generationInProgressRef.current) {
      toast.info('Generation in progress...');
      return;
    }

    const genDealId = resolvedDealId || effectiveDealId;
    if (!genDealId) { toast.error('Missing deal ID'); return; }

    generationInProgressRef.current = true;
    setGenerating(true);

    if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
    generationTimeoutRef.current = setTimeout(() => {
      generationInProgressRef.current = false;
      setGenerating(false);
    }, 90000);

    try {

      let compensationModel = 'FLAT_FEE';
      if (exhibitA?.commission_type === 'percentage') compensationModel = 'COMMISSION_PCT';
      else if (exhibitA?.commission_type === 'net') compensationModel = 'NET_SPREAD';

      const dealToUse = freshDeal || deal;
      const derivedExhibitA = {
        compensation_model: compensationModel,
        flat_fee_amount: exhibitA?.flat_fee_amount || 0,
        commission_percentage: exhibitA?.commission_percentage || 0,
        net_target: exhibitA?.net_target || 0,
        transaction_type: exhibitA?.transaction_type || dealToUse?.transaction_type || 'ASSIGNMENT',
        agreement_length_days: exhibitA?.agreement_length_days || 180,
        termination_notice_days: exhibitA?.termination_notice_days || 30,
        buyer_commission_type: dealToUse?.proposed_terms?.buyer_commission_type,
        buyer_commission_amount: dealToUse?.proposed_terms?.buyer_commission_percentage || dealToUse?.proposed_terms?.buyer_flat_fee,
        seller_commission_type: dealToUse?.proposed_terms?.seller_commission_type,
        seller_commission_amount: dealToUse?.proposed_terms?.seller_commission_percentage || dealToUse?.proposed_terms?.seller_flat_fee,
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

      // Reload agreement and deal data
      const freshAgreement = await loadAgreement();
      const { data } = await base44.functions.invoke('getDealDetailsForUser', { dealId: genDealId });
      if (data) setFreshDeal(data);

      setShowGenerateModal(false);
      
      if (onUpdate) onUpdate();
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.message || String(error);
      const lowerError = errorMessage.toLowerCase();
      
      if (lowerError.includes('rate limit') || lowerError.includes('too many') || lowerError.includes('temporarily busy')) {
        toast.error('Processing your request... This may take a moment. Please wait.', { duration: 4000 });
      } else if (lowerError.includes('missing required fields') || lowerError.includes('missing:')) {
        toast.error(errorMessage, { duration: 6000 });
      } else {
        toast.error(`Failed to generate: ${errorMessage}`, { duration: 5000 });
      }
    } finally {
      if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
      setGenerating(false);
      generationInProgressRef.current = false;
    }
  };

  const handleSign = async (signatureType) => {
    try {
      if (signatureType === 'agent') {
        if (hasPendingOffer) {
          toast.error('Counter offer pending. Wait for investor to respond and regenerate the agreement.');
          return;
        }
        if (termsMismatch) {
          toast.error('Agreement out of date. Wait for investor to regenerate and sign.');
          return;
        }
        if (!agreement?.investor_signed_at) {
          toast.error('Investor must sign first.');
          return;
        }
      } else if (signatureType === 'investor') {
        if (hasPendingOffer) {
          toast.error('Respond to the counter offer first.');
          return;
        }
        if (termsMismatch) {
          toast.error('Regenerate the agreement to reflect current terms before signing.');
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

  // Reset signing state when user returns from DocuSign without completing signature
  useEffect(() => {
    if (!window.location.search.includes('signed=1')) {
      setSigning(false);
    }
  }, [window.location.search]);

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

  // Loading card - only shown on initial load
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
         {/* Pending Counter Offer Panel - Show to investor when there's a counter */}
         {pendingOffer && pendingOffer.status === 'pending' && isInvestor && !loading && (
           <div className="bg-[#0D0D0D] border-2 border-[#F59E0B]/50 rounded-xl p-5 mb-4">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-[#FAFAFA]">Proposed New Deal Terms</h3>
               <span className="text-xs text-[#808080]">from agent</span>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                 <div className="text-sm text-[#808080] mb-1">Type</div>
                 <div className="text-base text-[#FAFAFA] font-medium capitalize">{pendingOffer.terms?.buyer_commission_type}</div>
               </div>
               <div>
                 <div className="text-sm text-[#808080] mb-1">Amount</div>
                 <div className="text-base text-[#FAFAFA] font-medium">
                   {pendingOffer.terms?.buyer_commission_type === 'percentage'
                     ? `${pendingOffer.terms?.buyer_commission_percentage || 0}%`
                     : `$${(pendingOffer.terms?.buyer_flat_fee || 0).toLocaleString()}`}
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-1 gap-2">
               <Button 
                 size="lg" 
                 className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-semibold" 
                 onClick={acceptOffer}
                 disabled={generating}
               >
                 Accept & Regenerate
               </Button>
               <Button 
                 size="lg" 
                 variant="destructive" 
                 className="w-full font-semibold" 
                 onClick={denyOffer}
               >
                 Decline
               </Button>
               <Button 
                 size="lg" 
                 className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold" 
                 onClick={() => {
                   setCounterType(pendingOffer.terms?.buyer_commission_type || 'flat');
                   const amt = pendingOffer.terms?.buyer_commission_type === 'percentage'
                     ? pendingOffer.terms?.buyer_commission_percentage || 0
                     : pendingOffer.terms?.buyer_flat_fee || 0;
                   setCounterAmount(String(amt));
                   setShowCounterModal(true);
                 }}
               >
                 Counter Offer
               </Button>
             </div>
           </div>
         )}

         {/* No agreement yet */}
         {!agreement ? (
          pendingOffer && pendingOffer.status === 'pending' && isInvestor ? null : isInvestor ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
                <p className="text-[#808080] mb-4">No agreement generated yet</p>
                <Button 
                  onClick={handleOpenGenerateModal}
                  disabled={generating}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold"
                >
                  {generating ? 'Generating...' : 'Generate Agreement'}
                </Button>
              </div>
          ) : isAgent ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-[#F59E0B] mx-auto mb-4" />
              <p className="text-[#FAFAFA] font-semibold mb-2">Waiting for investor</p>
              <p className="text-xs text-[#808080] mt-1">The investor will create and sign the agreement first</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[#808080]">No agreement available</p>
            </div>
          )
        ) : (
          /* Agreement exists */
          <div className="space-y-4">
            {/* Terms Mismatch Warning - investor needs to regenerate */}
            {termsMismatch && isInvestor && !hasPendingOffer && !hideRegenerateButton && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="text-sm text-[#FAFAFA] font-semibold mb-1">Agreement out of date</div>
                <div className="text-xs text-[#808080] mb-3">Terms changed. Regenerate and sign before agent can sign.</div>
                <Button onClick={handleOpenGenerateModal} disabled={generating} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold">
                  {generating ? 'Regenerating...' : 'Regenerate Agreement'}
                </Button>
              </div>
            )}

            {/* If agreement exists but investor hasn't signed yet - ONLY if no pending counter and no terms mismatch */}
            {!agreement.investor_signed_at && isInvestor && !termsMismatch && !hasPendingOffer && (
              <div className="space-y-3">
                <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    {getStatusDisplay()}
                  </div>
                  <p className="text-sm text-[#FAFAFA] mb-3">Your agreement is ready. Please sign to continue.</p>
                  <Button onClick={() => handleSign('investor')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold">
                    {signing ? 'Opening DocuSign...' : 'Sign as Investor'}
                  </Button>
                </div>
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

            {/* Key Terms (from deal) - show to both investor and agent */}
            {activeDeal?.proposed_terms && (isInvestor || isAgent) && (
              <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[#808080]">Buyer Agent Compensation</div>
                  {isAgent && !isFullySigned && agreement && (
                      <Button
                      size="sm"
                      className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      onClick={() => {
                        const t = activeDeal.proposed_terms || {};
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
                  <span className="text-[#FAFAFA] capitalize">{activeDeal.proposed_terms.buyer_commission_type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">Amount</span>
                  <span className="text-[#FAFAFA]">
                    {activeDeal.proposed_terms.buyer_commission_type === 'percentage'
                      ? `${activeDeal.proposed_terms.buyer_commission_percentage || 0}%`
                      : `$${(activeDeal.proposed_terms.buyer_flat_fee || 0).toLocaleString()}`}
                  </span>
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
              {!agreement.investor_signed_at && isInvestor && !hasPendingOffer && !termsMismatch && (
                <Button onClick={() => handleSign('investor')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold">
                  {signing ? 'Opening DocuSign...' : 'Sign as Investor'}
                </Button>
              )}

              {/* Regenerate button - investor can regenerate anytime before agent signs */}
              {!isFullySigned && isInvestor && !hideRegenerateButton && !hasPendingOffer && termsMismatch && (
                <Button onClick={handleOpenGenerateModal} disabled={generating} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold">
                  {generating ? 'Regenerating...' : 'Regenerate Agreement'}
                </Button>
              )}

              {!agreement.investor_signed_at && isAgent && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                  <Clock className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Waiting for investor</p>
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

              {agreement.investor_signed_at && !agreement.agent_signed_at && isInvestor && !termsMismatch && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center mb-2">{getStatusDisplay()}</div>
                  <p className="text-sm text-[#FAFAFA] font-semibold">You signed</p>
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
                <Button variant="outline" onClick={() => setShowGenerateModal(false)} disabled={generating} className="flex-1">Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold">
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