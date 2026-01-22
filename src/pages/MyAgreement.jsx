import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import LegalAgreementPanel from '@/components/LegalAgreementPanel';
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

  // Load full deal details
  useEffect(() => {
    (async () => {
      if (!dealId) return;
      setLoading(true);
      try {
        const res = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const dataDeal = res?.data?.deal || res?.data || null;
        setDeal(dataDeal);
      } catch (e) {
        toast.error('Failed to load agreement context');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId]);

  // If already signed, redirect investor away from My Agreement to Pipeline
  useEffect(() => {
    (async () => {
      if (!dealId) return;
      try {
        const res = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        const ag = res?.data?.agreement;
        const status = String(ag?.status || '').toLowerCase();
        const alreadySigned = status === 'investor_signed' || status === 'fully_signed' || !!ag?.investor_signed_at;
        if (alreadySigned) {
          try {
            const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
            const agentProfileId = dealRes?.data?.agent_id || sessionStorage.getItem('selectedAgentId');
            if (agentProfileId) {
              try { await base44.functions.invoke('sendDealRequest', { deal_id: dealId, agent_profile_id: agentProfileId }); } catch (_) {}
            }
          } catch (_) {}
          navigate(createPageUrl('Pipeline'));
        }
      } catch (_) {}
    })();
  }, [dealId]);

  // After DocuSign return with ?signed=1, verify investor signed and redirect to Pipeline
  useEffect(() => {
    (async () => {
      if (!dealId || !signedFlag) return;
      try {
        const res = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        const ag = res?.data?.agreement;
        if (ag?.investor_signed_at) {
          // After investor signs, create/send room to the selected agent
          try {
            // Prefer agent on deal; fallback to session
            const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
            const agentProfileId = dealRes?.data?.agent_id || sessionStorage.getItem('selectedAgentId');
            if (agentProfileId) {
              try {
                await base44.functions.invoke('sendDealRequest', { deal_id: dealId, agent_profile_id: agentProfileId });
              } catch (e) {
                // Ignore 409/conflicts if already exists
              }
            }
          } catch (_) {}

          // If agent already countersigned or NJ auto-approves later, Room UI will unlock via subscriptions
          try { await base44.entities.Deal.update(dealId, { status: 'active' }); } catch (_) {}
          toast.success('Agreement signed. Redirecting to your pipeline...');
          setTimeout(() => navigate(createPageUrl('Pipeline') + '?signed=1'), 800);
        }
      } catch (_) {}
    })();
  }, [dealId, signedFlag]);

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

  // Derived values for buyer commission display
  const purchasePrice = Number(deal?.purchase_price ?? deal?.budget) || 0;
  const buyerType = deal?.proposed_terms?.buyer_commission_type;
  const buyerPct = Number(deal?.proposed_terms?.buyer_commission_percentage ?? NaN);
  const buyerFlat = Number(deal?.proposed_terms?.buyer_flat_fee ?? NaN);
  const buyerCommissionAmount = buyerType === 'percentage' && !Number.isNaN(buyerPct)
    ? purchasePrice * (buyerPct / 100)
    : null;

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

        <LegalAgreementPanel
          deal={deal}
          profile={profile}
          dealId={deal?.id || dealId}
          allowGenerate={true}
          onUpdate={async () => {
            // Refresh local deal
            const res = await base44.functions.invoke('getDealDetailsForUser', { dealId: deal.id });
            const dataDeal = res?.data?.deal || res?.data || deal;
            setDeal(dataDeal);
            // If investor just signed, send to Pipeline
            try {
              const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: deal.id });
              const ag = agRes?.data?.agreement;
              if (ag?.investor_signed_at && isInvestor) {
                // After investor signs, create/send room to the selected agent
                try {
                  const agentProfileId = (res?.data?.agent_id) || deal.agent_id || sessionStorage.getItem('selectedAgentId');
                  if (agentProfileId) {
                    try {
                      await base44.functions.invoke('sendDealRequest', { deal_id: deal.id, agent_profile_id: agentProfileId });
                    } catch (e) {
                      // Ignore conflict if already created
                    }
                  }
                } catch (_) {}

                try { await base44.entities.Deal.update(deal.id, { status: 'active' }); } catch (_) {}
                toast.success('Agreement signed. Redirecting to your pipeline...');
                setTimeout(() => navigate(createPageUrl('Pipeline')), 800);
              }
            } catch (_) {}
          }}
        />

        {/* Key Deal Terms - simplified for My Agreement: show only purchase price, buyer commission, and computed amount when percentage */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-5">
          <h2 className="text-xl font-bold text-[#E3C567] mb-3">Key Deal Terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#808080]">Purchase Price</p>
              <p className="text-[#FAFAFA]">{formatCurrency(deal.purchase_price ?? deal.budget)}</p>
            </div>
            <div>
              <p className="text-xs text-[#808080]">Buyer Commission</p>
              <p className="text-[#FAFAFA]">{buyerType === 'percentage' && !Number.isNaN(buyerPct) ? `${buyerPct}%` : '—'}</p>
            </div>
            {buyerType === 'percentage' && !Number.isNaN(buyerPct) && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[#808080]">Buyer Commission (Estimated)</p>
                <p className="text-[#FAFAFA]">{formatCurrency(buyerCommissionAmount)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}