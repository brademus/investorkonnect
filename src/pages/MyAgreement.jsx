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
    if (!dealId) return;
    
    (async () => {
      try {
        const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const loadedDeal = dealRes?.data?.deal || dealRes?.data;
        setDeal(loadedDeal);

        // Load selected agent IDs from sessionStorage or deal metadata
        const storedAgentIds = sessionStorage.getItem("selectedAgentIds");
        const agentIds = storedAgentIds 
          ? JSON.parse(storedAgentIds) 
          : (loadedDeal?.metadata?.selected_agent_ids || []);
        
        setSelectedAgentIds(agentIds);

        // CRITICAL: Ensure deal metadata has selected_agent_ids before signing
        if (agentIds.length > 0 && !loadedDeal?.metadata?.selected_agent_ids) {
          console.log('[MyAgreement] Updating deal metadata with agent IDs:', agentIds);
          await base44.entities.Deal.update(dealId, {
            metadata: {
              ...loadedDeal?.metadata,
              selected_agent_ids: agentIds
            }
          });
        }

        // Load agent profiles
        if (agentIds.length > 0) {
          const agentPromises = agentIds.map(id => 
            base44.entities.Profile.filter({ id }).then(profiles => profiles[0])
          );
          const agents = await Promise.all(agentPromises);
          setAgentProfiles(agents.filter(Boolean));
        }

        const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        const loadedAgreement = agRes?.data?.agreement || null;
        setAgreement(loadedAgreement);

        // If investor already signed, redirect to Pipeline immediately
        if (loadedAgreement?.investor_signed_at) {
          console.log('[MyAgreement] Investor already signed, redirecting to Pipeline');
          toast.info('You already signed this agreement');
          setTimeout(() => {
            navigate(createPageUrl('Pipeline'), { replace: true });
          }, 1000);
        }
      } catch (e) {
        toast.error('Failed to load agreement');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, navigate]);

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

  // After investor signs, create invites for all selected agents
  const handlePostSigningNavigation = async () => {
    if (!dealId) return;

    try {
      // Re-fetch fresh deal and base agreement to ensure we have latest data
      const freshDeals = await base44.entities.Deal.filter({ id: dealId });
      const freshDeal = freshDeals?.[0];
      if (freshDeal) {
        setDeal(freshDeal);
      }

      const freshAgreements = await base44.entities.LegalAgreement.filter({ 
        deal_id: dealId, 
        room_id: null 
      });
      const freshAgreement = freshAgreements?.sort((a,b) => 
        new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0)
      )?.[0];

      if (!freshAgreement?.investor_signed_at) {
        return;
      }

      setAgreement(freshAgreement);
      
      // Get selected agents from sessionStorage, state, or fresh deal metadata
      let agentsToInvite = selectedAgentIds.length > 0 ? selectedAgentIds : (freshDeal?.metadata?.selected_agent_ids || deal?.metadata?.selected_agent_ids || []);
      if (agentsToInvite.length === 0) {
        const storedAgents = sessionStorage.getItem("selectedAgentIds");
        if (storedAgents) {
          agentsToInvite = JSON.parse(storedAgents);
        }
      }

      console.log('[MyAgreement] Agents to invite:', agentsToInvite);
      console.log('[MyAgreement] Deal metadata:', freshDeal?.metadata || deal?.metadata);

      // If no agents selected, show error
      if (agentsToInvite.length === 0) {
        console.error('[MyAgreement] No agents found after signing');
        toast.error('No agents selected. Please go back and select agents.');
        return;
      }
      
      console.log('[MyAgreement] Creating invites after investor signature for', agentsToInvite.length, 'agents');
      
      // Call function to create DealInvites, rooms, and agreements for all selected agents
      console.log('[MyAgreement] Calling createInvitesAfterInvestorSign');
      const res = await base44.functions.invoke('createInvitesAfterInvestorSign', {
        deal_id: dealId
      });

      console.log('[MyAgreement] Invite creation result:', res?.data);

      if (res?.data?.ok && res.data.invite_ids?.length > 0) {
        sessionStorage.removeItem("pendingDealId");
        sessionStorage.removeItem("selectedAgentIds");

        // Clear caches
        queryClient.invalidateQueries({ queryKey: ['rooms', profile?.id] });
        queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

        toast.success(`Deal sent to ${res.data.invite_ids.length} agent(s)!`);

        // Wait brief moment for DB to propagate
        await new Promise(r => setTimeout(r, 500));

        // Navigate to Pipeline to see the deal
        navigate(createPageUrl('Pipeline'), { replace: true });
      } else {
        console.error('[MyAgreement] Failed:', res?.data);
        toast.error('Failed to send deal to agents. Please try again.');
      }
    } catch (e) {
      console.error('Failed to create invites:', e);
      toast.error('Signed but failed to send to agents');
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