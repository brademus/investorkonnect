import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import { useQueryClient } from '@tanstack/react-query';
import LoadingAnimation from '@/components/LoadingAnimation';
import SimpleAgreementPanel from '@/components/SimpleAgreementPanel';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MyAgreement() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dealId = params.get('dealId');
  const { profile, loading: loadingProfile } = useCurrentProfile();
  const queryClient = useQueryClient();

  const [deal, setDeal] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [agentProfiles, setAgentProfiles] = useState([]);
  const [selectedAgentForSigning, setSelectedAgentForSigning] = useState(null);

  // Load deal, selected agents, and agreement state
  useEffect(() => {
    if (!dealId || !profile) return;
    
    (async () => {
      try {
        const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const loadedDeal = dealRes?.data?.deal || dealRes?.data;
        setDeal(loadedDeal);

        // Load agreement FIRST to check if investor already signed
        const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        const loadedAgreement = agRes?.data?.agreement || null;
        setAgreement(loadedAgreement);

        // CRITICAL: If investor already signed and rooms exist, redirect immediately
        // Check BOTH agreement and room status for signed state
        const roomsForDeal = await base44.entities.Room.filter({ deal_id: dealId });
        const hasSignedStatus = loadedAgreement?.investor_signed_at || 
                               roomsForDeal.some(r => r.agreement_status === 'investor_signed' || r.agreement_status === 'fully_signed');
        
        if (roomsForDeal?.length > 0 && profile?.user_role === 'investor' && hasSignedStatus) {
          console.log('[MyAgreement] Investor already signed and rooms exist, redirecting to Room');
          navigate(`${createPageUrl("Room")}?roomId=${roomsForDeal[0].id}`, { replace: true });
          return;
        }

        // Load selected agent IDs from deal or sessionStorage
        const storedAgentIds = sessionStorage.getItem("selectedAgentIds");
        const agentIds = loadedDeal?.selected_agent_ids || loadedDeal?.metadata?.selected_agent_ids || (storedAgentIds ? JSON.parse(storedAgentIds) : []);
        
        setSelectedAgentIds(agentIds);

        // Load agent profiles
        if (agentIds.length > 0) {
          const agentPromises = agentIds.map(id => 
            base44.entities.Profile.filter({ id }).then(profiles => profiles[0])
          );
          const agents = await Promise.all(agentPromises);
          setAgentProfiles(agents.filter(Boolean));
        }
      } catch (e) {
        toast.error('Failed to load agreement');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, navigate, profile]);

  // Subscribe to real-time agreement updates (ONLY base agreement, not room-scoped)
  useEffect(() => {
    if (!dealId) return;

    const unsub = base44.entities.LegalAgreement.subscribe((event) => {
      const a = event?.data;
      if (!a) return;
      if (a.deal_id !== dealId) return;
      if (a.room_id != null) return; // ONLY base agreement updates
      setAgreement(a);
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

  // After investor signs, wait for invites to be created then redirect
  const handlePostSigningNavigation = async () => {
    if (!dealId) return;

    try {
      // Wait for invites to be created by DocuSignReturn
      await new Promise(r => setTimeout(r, 1000));

      // Clear caches
      queryClient.invalidateQueries({ queryKey: ['rooms', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

      // Navigate to Pipeline to see the deal
      navigate(createPageUrl('Pipeline'), { replace: true });
    } catch (e) {
      console.error('[MyAgreement] Navigation error:', e);
      navigate(createPageUrl('Pipeline'), { replace: true });
    }
  };



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
          <h1 className="text-3xl font-bold text-[#E3C567]">Generate & Sign Agreement</h1>
          <p className="text-sm text-[#808080]">Review your selected agents and sign to send the deal</p>
        </div>

        {/* Selected Agents - Before Signing */}
        {agentProfiles.length > 0 && !agreement?.investor_signed_at && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-[#E3C567] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selected Agents ({agentProfiles.length})
            </h2>
            <div className="space-y-3">
              {agentProfiles.map(agent => (
                <div key={agent.id} className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[#FAFAFA] font-semibold">{agent.full_name}</p>
                    <p className="text-sm text-[#808080]">{agent.email}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#34D399]" />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#808080] mt-4">
              {agentProfiles.length > 1 
                ? 'After you sign, select which agent you want to work with.'
                : 'After you sign, the deal will be sent to this agent.'}
            </p>
          </div>
        )}



        <SimpleAgreementPanel 
          dealId={dealId} 
          agreement={agreement} 
          profile={profile}
          onInvestorSigned={handlePostSigningNavigation}
        />

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