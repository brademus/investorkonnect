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
        setDeal(res.data || null);
      } catch (e) {
        toast.error('Failed to load agreement context');
      } finally {
        setLoading(false);
      }
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
          toast.success('Agreement signed. Redirecting to your pipeline...');
          setTimeout(() => navigate(createPageUrl('Pipeline')), 800);
        }
      } catch (_) {}
    })();
  }, [dealId, signedFlag]);

  const isInvestor = useMemo(() => profile?.user_role === 'investor', [profile?.user_role]);

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
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">My Agreement</h1>
          <p className="text-sm text-[#808080] mt-1">Generate and sign to unlock your pipeline</p>
        </div>

        <LegalAgreementPanel
          deal={deal}
          profile={profile}
          onUpdate={async () => {
            // Refresh local deal
            const res = await base44.functions.invoke('getDealDetailsForUser', { dealId: deal.id });
            setDeal(res.data || deal);
            // If investor just signed, send to Pipeline
            try {
              const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: deal.id });
              const ag = agRes?.data?.agreement;
              if (ag?.investor_signed_at && isInvestor) {
                toast.success('Agreement signed. Redirecting to your pipeline...');
                setTimeout(() => navigate(createPageUrl('Pipeline')), 800);
              }
            } catch (_) {}
          }}
        />
      </div>
    </div>
  );
}