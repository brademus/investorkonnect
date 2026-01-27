import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import AgreementPanel from '@/components/AgreementPanel';
import { toast } from 'sonner';

export default function MyAgreement() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roomId = params.get('roomId');
  const dealIdParam = params.get('dealId');
  const signedFlag = params.get('signed');
  const { profile, loading: loadingProfile } = useCurrentProfile();

  const [dealId, setDealId] = useState(dealIdParam || null);
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);

  // Resolve dealId from roomId if needed
  useEffect(() => {
    (async () => {
      if (dealIdParam) return;
      if (!roomId) return;
      try {
        const rows = await base44.entities.Room.filter({ id: roomId });
        if (rows?.[0]?.deal_id) {
          setDealId(rows[0].deal_id);
        }
      } catch (_) {}
    })();
  }, [roomId, dealIdParam]);

  // Load full deal details and check if already signed
  useEffect(() => {
    (async () => {
      if (!dealId) return;
      setLoading(true);
      try {
        const res = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const dataDeal = res?.data?.deal || res?.data || null;
        setDeal(dataDeal);
        
        // If investor already signed, redirect to Pipeline immediately
        const agreementRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        const agreement = agreementRes?.data?.agreement;
        if (agreement?.investor_signed_at) {
          console.log('[MyAgreement] Agreement already signed, redirecting...');
          navigate(createPageUrl('Pipeline'), { replace: true });
          return;
        }
      } catch (e) {
        toast.error('Failed to load agreement context');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, navigate]);

  // After signing, redirect to Pipeline immediately
  useEffect(() => {
    if (!dealId || !signedFlag) return;
    
    console.log('[MyAgreement] Signed flag detected, redirecting to Pipeline...');
    
    const redirect = async () => {
      // Optional: send deal request in background (don't block redirect)
      const agentProfileId = deal?.agent_id || sessionStorage.getItem('selectedAgentId');
      if (agentProfileId) {
        base44.functions.invoke('sendDealRequest', { 
          deal_id: dealId, 
          agent_profile_id: agentProfileId 
        }).catch(() => {});
      }
      
      await new Promise(r => setTimeout(r, 800));
      toast.success('Agreement signed successfully');
      navigate(createPageUrl('Pipeline'), { replace: true });
    };
    
    redirect();
  }, [dealId, signedFlag, navigate]);

  const isInvestor = useMemo(() => profile?.user_role === 'investor', [profile?.user_role]);

  // Helpers for displaying key terms
  const formatCurrency = (val) => {
    if (val == null || val === '') return '—';
    const num = Number(val);
    if (Number.isNaN(num)) return '—';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    } catch {
      return String(val);
    }
  };
  const safe = (v) => (v ?? '—');

  // Derived values for buyer commission display (memoized for stability)
  const keyTerms = useMemo(() => {
    const purchasePrice = Number(deal?.purchase_price ?? deal?.budget) || 0;
    const buyerType = deal?.proposed_terms?.buyer_commission_type;
    const buyerPct = Number(deal?.proposed_terms?.buyer_commission_percentage ?? NaN);
    const buyerFlat = Number(deal?.proposed_terms?.buyer_flat_fee ?? NaN);
    const buyerCommissionAmount = buyerType === 'percentage' && !Number.isNaN(buyerPct)
      ? purchasePrice * (buyerPct / 100)
      : null;
    return { purchasePrice, buyerType, buyerPct, buyerFlat, buyerCommissionAmount };
  }, [deal?.purchase_price, deal?.budget, deal?.proposed_terms]);

  if (loadingProfile || loading || !deal) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-3" />
          <p className="text-sm text-[#808080]">Preparing your agreement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`${createPageUrl("AgentMatching")}?dealId=${deal?.id || dealId}`)}
            className="text-[#808080] hover:text-[#E3C567] text-sm"
          >
            Back to Matched Agents
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">My Agreement</h1>
          <p className="text-sm text-[#808080] mt-1">Generate and sign to unlock your pipeline</p>
        </div>

        <AgreementPanel
          dealId={deal?.id || dealId}
          profile={profile}
          onUpdate={async () => {
            const res = await base44.functions.invoke('getDealDetailsForUser', { dealId: deal.id });
            if (res?.data) setDeal(res.data);
          }}
        />

        {/* Key Deal Terms - only render once deal fully loaded to prevent flicker */}
        {deal && !loading && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-xl font-bold text-[#E3C567] mb-3">Key Deal Terms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#808080]">Purchase Price</p>
                <p className="text-[#FAFAFA]">{formatCurrency(keyTerms.purchasePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-[#808080]">Buyer Commission</p>
                <p className="text-[#FAFAFA]">
                  {keyTerms.buyerType === 'percentage' && !Number.isNaN(keyTerms.buyerPct) 
                    ? `${keyTerms.buyerPct}%` 
                    : keyTerms.buyerType === 'flat' && !Number.isNaN(keyTerms.buyerFlat)
                    ? formatCurrency(keyTerms.buyerFlat)
                    : '—'}
                </p>
              </div>
              {keyTerms.buyerType === 'percentage' && !Number.isNaN(keyTerms.buyerPct) && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#808080]">Buyer Commission (Estimated)</p>
                  <p className="text-[#FAFAFA]">{formatCurrency(keyTerms.buyerCommissionAmount)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}