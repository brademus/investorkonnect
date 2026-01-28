import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import SimpleAgreementPanel from '@/components/SimpleAgreementPanel';
import { toast } from 'sonner';

export default function MyAgreement() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dealId = params.get('dealId');
  const { profile, loading: loadingProfile } = useCurrentProfile();

  const [deal, setDeal] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load deal and agreement state
  useEffect(() => {
    if (!dealId) return;
    
    (async () => {
      try {
        const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const loadedDeal = dealRes?.data?.deal || dealRes?.data;
        setDeal(loadedDeal);

        const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        setAgreement(agRes?.data?.agreement || null);

        // Auto-redirect if already signed
        if (agRes?.data?.agreement?.investor_signed_at) {
          navigate(createPageUrl('Pipeline'), { replace: true });
        }
      } catch (e) {
        toast.error('Failed to load agreement');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, navigate]);

  // Subscribe to real-time agreement updates
  useEffect(() => {
    if (!dealId) return;

    const unsub = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.deal_id === dealId) {
        setAgreement(event.data);
      }
    });

    return () => unsub?.();
  }, [dealId]);

  if (loadingProfile || loading || !deal) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate(createPageUrl('Pipeline'))}
          className="text-[#808080] hover:text-[#E3C567] text-sm"
        >
          ← Back
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">Agreement</h1>
          <p className="text-sm text-[#808080]">Generate and sign to unlock your deals</p>
        </div>

        <SimpleAgreementPanel dealId={dealId} agreement={agreement} profile={profile} />

        {/* Deal Summary */}
        {deal && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-lg font-bold text-[#E3C567] mb-4">Deal Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#808080]">Property</p>
                <p className="text-[#FAFAFA] font-semibold">{deal.city}, {deal.state}</p>
              </div>
              <div>
                <p className="text-[#808080]">Price</p>
                <p className="text-[#FAFAFA] font-semibold">${(deal.purchase_price || 0).toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[#808080]">Buyer Commission</p>
                <p className="text-[#FAFAFA] font-semibold">
                  {deal.proposed_terms?.buyer_commission_type === 'percentage'
                    ? `${deal.proposed_terms?.buyer_commission_percentage}%`
                    : `$${(deal.proposed_terms?.buyer_flat_fee || 0).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}