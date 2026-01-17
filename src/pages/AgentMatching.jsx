import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import { CheckCircle, MapPin, Briefcase, Star, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AgentMatching() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentProfile();
  const dealId = searchParams.get("dealId");

  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(true);
  const [sendingToAgent, setSendingToAgent] = useState(null);
  const [deal, setDeal] = useState(null);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    console.log('[AgentMatching] useEffect triggered:', { dealId, profileId: profile?.id });
    
    if (!dealId) {
      console.log('[AgentMatching] No dealId, redirecting to ContractVerify');
      navigate(createPageUrl("ContractVerify"));
      return;
    }
    
    if (!profile?.id) {
      console.log('[AgentMatching] No profile yet, waiting...');
      return;
    }

    loadDealAndAgents();
  }, [dealId, profile?.id]);

  const loadDealAndAgents = async () => {
    try {
      setLoading(true);
      setMatching(true);

      console.log('[AgentMatching] Loading deal with ID:', dealId);

      // Load deal
      const deals = await base44.entities.Deal.filter({ id: dealId });
      console.log('[AgentMatching] Deals fetched:', deals?.length);
      
      if (!deals || deals.length === 0) {
        console.log('[AgentMatching] Deal not found');
        toast.error("Deal not found");
        navigate(createPageUrl("ContractVerify"));
        return;
      }

      const loadedDeal = deals[0];
      console.log('[AgentMatching] Deal loaded:', loadedDeal.property_address, loadedDeal.state);
      setDeal(loadedDeal);

      // Find matching agents - try AI matching first
      let matchedAgents = [];
      
      try {
        const matchRes = await base44.functions.invoke('matchAgentsForInvestor', {
          investorId: profile.id,
          state: loadedDeal.state,
          limit: 3
        });

        const raw = matchRes.data?.results || [];
        // Map backend shape -> UI shape and STRICTLY filter to licensed in deal state
        const normalizeState = (s) => (s ? s.toString().trim().toUpperCase() : '');
        const target = normalizeState(loadedDeal.state);

        const isLicensedInState = (agent) => {
          const a = agent.agent || {};
          const roots = [agent.license_state, agent.target_state].map(normalizeState);
          const lic = [a.license_state, ...(a.licensed_states || [])].map(normalizeState);
          return [...roots, ...lic].some((v) => v === target);
        };

        const mapped = raw
          .map((r) => ({ agent: r.profile || r.agent || r, score: r.score, explanation: r.reason }))
          .filter((m) => isLicensedInState(m.agent));

        if (mapped.length > 0) {
          console.log('[AgentMatching] AI matched licensed agents:', mapped.length);
          matchedAgents = mapped.slice(0, 3);
        }
      } catch (matchError) {
        console.log('[AgentMatching] AI matching failed, using fallback:', matchError.message);
      }

      // Fallback: strictly licensed in deal state (uses simple in-frontend filter)
      if (matchedAgents.length === 0) {
        console.log('[AgentMatching] Using fallback - fetching licensed agents in state:', loadedDeal.state);

        const allAgents = await base44.entities.Profile.filter({ user_role: 'agent' });
        const normalizeState = (s) => (s ? s.toString().trim().toUpperCase() : '');
        const target = normalizeState(loadedDeal.state);

        const licensedAgents = allAgents.filter((agent) => {
          const a = agent.agent || {};
          const roots = [agent.license_state, agent.target_state].map(normalizeState);
          const lic = [a.license_state, ...(a.licensed_states || [])].map(normalizeState);
          return [...roots, ...lic].some((v) => v === target);
        });

        console.log('[AgentMatching] Licensed agents in state:', licensedAgents.length);

        matchedAgents = licensedAgents.slice(0, 3).map((agent) => ({
          agent,
          score: 1.0,
          explanation: `Licensed in ${loadedDeal.state}`,
        }));
      }

      console.log('[AgentMatching] Final agent count (max 3):', matchedAgents.length);
      setAgents(matchedAgents);

    } catch (error) {
      console.error("Failed to load agents:", error);
      toast.error("Failed to load agents: " + error.message);
    } finally {
      // Wait before showing results
      setTimeout(() => {
        setMatching(false);
        setLoading(false);
      }, 1500);
    }
  };

  const handleSelectAgent = async (agentMatch) => {
    if (sendingToAgent) return;

    const agentProfile = agentMatch.agent;
    console.log('[AgentMatching] Selecting agent:', agentProfile.id, agentProfile.full_name);
    setSendingToAgent(agentProfile.id);
    
    try {
      // Use backend function to create/request room with proper checks and activity logging
      let roomIdToUse = null;
      try {
        const resp = await base44.functions.invoke('sendDealRequest', {
          deal_id: deal.id,
          agent_profile_id: agentProfile.id
        });
        if (resp.status === 200 && resp.data?.room_id) {
          roomIdToUse = resp.data.room_id;
        } else {
          throw new Error(resp?.data?.error || 'Failed to send request');
        }
      } catch (err) {
        const status = err?.response?.status || err?.status;
        const data = err?.response?.data || err?.data || {};
        if (status === 409 || data?.room_id) {
          // Already has an active request — use that room
          roomIdToUse = data.room_id;
          toast.error('This deal already has an active agent request');
        } else {
          throw err;
        }
      }

      // Store proposed terms on the room after creation (if we have them)
      if (roomIdToUse) {
        const storedData = sessionStorage.getItem('newDealData');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          await base44.entities.Room.update(roomIdToUse, {
            proposed_terms: {
              seller_commission_type: parsed.sellerCommissionType,
              seller_commission_percentage: parsed.sellerCommissionPercentage ? Number(parsed.sellerCommissionPercentage) : null,
              seller_flat_fee: parsed.sellerFlatFee ? Number(parsed.sellerFlatFee) : null,
              buyer_commission_type: parsed.buyerCommissionType,
              buyer_commission_percentage: parsed.buyerCommissionPercentage ? Number(parsed.buyerCommissionPercentage) : null,
              buyer_flat_fee: parsed.buyerFlatFee ? Number(parsed.buyerFlatFee) : null,
              agreement_length: parsed.agreementLength ? Number(parsed.agreementLength) : null
            }
          });
        }
      }

      const _first = (agentProfile.full_name || 'agent').split(' ')[0];
      toast.success(`Deal request sent to ${_first}`);
      // Go straight to the room Agreement tab for clarity
      navigate(`${createPageUrl('Room')}?roomId=${roomIdToUse || ''}&tab=agreement`);


    } catch (error) {
      console.error("Failed to send deal:", error);
      toast.error("Failed to send deal: " + error.message);
      setSendingToAgent(null);
    }
  };

  if (loading || matching) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <LoadingAnimation className="w-64 h-64 mb-8" />
        <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Finding Your Perfect Agent</h2>
        <p className="text-[#808080] text-center max-w-md">
          Analyzing agents in {deal?.county || deal?.state || 'your area'}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`${createPageUrl("ContractVerify")}?dealId=${deal?.id || dealId}`)}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Verification
          </button>
          <div className="text-center">
          <div className="w-16 h-16 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[#E3C567]" />
          </div>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Top 3 Matched Agents</h1>
          <p className="text-[#808080]">
            Best agents for {deal?.city}, {deal?.state} • Select one to send your deal
          </p>
        </div>
        </div>

        {/* Agent Cards */}
        {agents.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <p className="text-[#808080] mb-4">No agents available in {deal?.state} yet</p>
            <Button
              onClick={() => navigate(`${createPageUrl("ContractVerify")}?dealId=${deal?.id || dealId}`)}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
            >
              Back to Verification
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((match, index) => {
              const agent = match.agent;
              const agentId = agent.id;
              const headshotUrl = agent.headshotUrl || agent.agent?.headshot_url;
              const fullName = agent.full_name || "Agent";
              const agentName = fullName.split(' ')[0]; // Show only first name
              const brokerage = agent.agent?.brokerage || agent.broker;
              const experienceYears = agent.agent?.experience_years;
              const markets = agent.agent?.markets || [];
              const specialties = agent.agent?.specialties || [];
              const isThisAgentSending = sendingToAgent === agentId;

              return (
                <div
                  key={agentId}
                  className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#E3C567] transition-all"
                >
                  {/* Agent Photo */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1F1F1F] flex-shrink-0">
                      {headshotUrl ? (
                        <img src={headshotUrl} alt={agentName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#808080]">
                          <Briefcase className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#FAFAFA] truncate">{agentName}</h3>
                      {brokerage && (
                        <p className="text-sm text-[#808080] truncate">{brokerage}</p>
                      )}
                      {experienceYears && (
                        <p className="text-xs text-[#808080] mt-1">{experienceYears} years experience</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="space-y-2 mb-4">
                    {markets.length > 0 && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#808080] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#808080]">{markets.slice(0, 2).join(', ')}</span>
                      </div>
                    )}
                    {specialties.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Star className="w-4 h-4 text-[#808080] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#808080]">{specialties.slice(0, 2).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Select Button */}
                  <Button
                    onClick={() => handleSelectAgent(match)}
                    disabled={sendingToAgent !== null}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold disabled:opacity-50"
                  >
                    {isThisAgentSending ? "Sending..." : "Send Deal to This Agent"}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
        )}
      </div>
    </div>
  );
}