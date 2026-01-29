import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
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

        // Load agent profiles
        if (agentIds.length > 0) {
          const agentPromises = agentIds.map(id => 
            base44.entities.Profile.filter({ id }).then(profiles => profiles[0])
          );
          const agents = await Promise.all(agentPromises);
          setAgentProfiles(agents.filter(Boolean));
        }

        const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
        setAgreement(agRes?.data?.agreement || null);

        // Auto-redirect if already signed and rooms created
        if (agRes?.data?.agreement?.investor_signed_at) {
          const rooms = await base44.entities.Room.filter({ deal_id: dealId });
          if (rooms.length > 0) {
            navigate(createPageUrl('Pipeline'), { replace: true });
          }
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

  // After investor signs, check if we need agent selection first
  const handlePostSigningNavigation = async () => {
    if (!agreement?.investor_signed_at || !dealId) return;

    try {
      // If multiple agents, show selection UI instead of auto-creating rooms
      if (selectedAgentIds.length > 1) {
        setLoading(false); // Show agent selection UI
        return;
      }

      // Single agent - create room immediately
      if (selectedAgentIds.length === 1) {
        const agentId = selectedAgentIds[0];
        const res = await base44.functions.invoke('generateAgreementForAgent', {
          deal_id: dealId,
          agent_profile_id: agentId
        });

        if (res.data?.success) {
          sessionStorage.removeItem("pendingDealId");
          sessionStorage.removeItem("selectedAgentIds");
          toast.success('Agreement sent to agent!');
          navigate(createPageUrl('Pipeline'), { replace: true });
        } else {
          throw new Error(res.data?.error || 'Failed to create room');
        }
      }
    } catch (e) {
      console.error('Failed to create room:', e);
      toast.error('Signed but failed to send to agent');
    }
  };

  // Handle selecting an agent when multiple agents are available
  const handleSelectAgentAndProceed = async (agentId) => {
    try {
      const res = await base44.functions.invoke('generateAgreementForAgent', {
        deal_id: dealId,
        agent_profile_id: agentId
      });

      if (res.data?.success) {
        sessionStorage.removeItem("pendingDealId");
        sessionStorage.removeItem("selectedAgentIds");
        toast.success('Agreement sent to selected agent!');
        navigate(`${createPageUrl('Room')}?roomId=${res.data.room_id}`);
      } else {
        throw new Error(res.data?.error || 'Failed to create room');
      }
    } catch (e) {
      console.error('Failed:', e);
      toast.error('Failed to send to agent');
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

        {/* Agent Selection - After Investor Signs (Multiple Agents) */}
        {agreement?.investor_signed_at && !agreement?.agent_signed_at && agentProfiles.length > 1 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-[#E3C567] mb-4">Select Your Agent</h2>
            <p className="text-sm text-[#808080] mb-6">
              Your agreement is signed. Choose which agent you want to work with:
            </p>
            <div className="space-y-3">
              {agentProfiles.map(agent => (
                <Button
                  key={agent.id}
                  onClick={() => handleSelectAgentAndProceed(agent.id)}
                  className="w-full bg-[#141414] border border-[#1F1F1F] hover:border-[#E3C567] hover:bg-[#1F1F1F] text-[#FAFAFA] p-6 rounded-xl h-auto justify-start"
                >
                  <div className="text-left">
                    <p className="font-semibold text-[#FAFAFA] mb-1">{agent.full_name}</p>
                    <p className="text-sm text-[#808080]">{agent.email}</p>
                  </div>
                </Button>
              ))}
            </div>
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