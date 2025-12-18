import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import { CheckCircle, MapPin, Briefcase, Star, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function AgentMatching() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentProfile();
  const dealId = searchParams.get("dealId");

  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(true);
  const [sending, setSending] = useState(false);
  const [deal, setDeal] = useState(null);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    console.log('[AgentMatching] useEffect triggered:', { dealId, profileId: profile?.id });
    
    if (!dealId) {
      console.log('[AgentMatching] No dealId, redirecting to Pipeline');
      navigate(createPageUrl("Pipeline"));
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
        navigate(createPageUrl("Pipeline"));
        return;
      }

      const loadedDeal = deals[0];
      console.log('[AgentMatching] Deal loaded:', loadedDeal.property_address, loadedDeal.state);
      setDeal(loadedDeal);

      // Find matching agents
      const matchRes = await base44.functions.invoke('matchAgentsForInvestor', {
        investorId: profile.id,
        state: loadedDeal.state,
        limit: 3
      });

      if (matchRes.data?.matches && matchRes.data.matches.length > 0) {
        setAgents(matchRes.data.matches);
      } else {
        // Fallback: get any agents in the state
        const fallbackAgents = await base44.entities.Profile.filter({ 
          user_role: 'agent',
          'agent.markets': loadedDeal.state 
        });
        
        setAgents(fallbackAgents.slice(0, 3).map(agent => ({
          agent: agent,
          score: 50,
          explanation: `Licensed agent in ${loadedDeal.state}`
        })));
      }

    } catch (error) {
      console.error("Failed to load agents:", error);
      toast.error("Failed to load agents");
    } finally {
      // Wait before showing results
      setTimeout(() => {
        setMatching(false);
        setLoading(false);
      }, 1500);
    }
  };

  const handleSelectAgent = async (agentProfile) => {
    if (sending) return;

    setSending(true);
    try {
      // Create a room for this deal and agent with pending status
      const roomRes = await base44.functions.invoke('createDealRoom', {
        dealId: deal.id,
        agentProfileId: agentProfile.id
      });

      if (roomRes.data?.room) {
        // Update room to pending status
        await base44.entities.Room.update(roomRes.data.room.id, {
          deal_status: 'pending_agent_review'
        });

        // Store proposed terms in room metadata
        const storedData = sessionStorage.getItem("newDealData");
        if (storedData) {
          const parsed = JSON.parse(storedData);
          await base44.entities.Room.update(roomRes.data.room.id, {
            proposed_terms: {
              commission_type: parsed.commissionType,
              commission_percentage: parsed.commissionPercentage,
              flat_fee: parsed.flatFee,
              agreement_length: parsed.agreementLength
            }
          });
        }

        toast.success(`Deal request sent to ${agentProfile.full_name || 'agent'}`);
        navigate(createPageUrl("Pipeline"));
      } else {
        throw new Error("Failed to create room");
      }

    } catch (error) {
      console.error("Failed to send deal:", error);
      toast.error("Failed to send deal to agent");
      setSending(false);
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
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[#E3C567]" />
          </div>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Top Matched Agents</h1>
          <p className="text-[#808080]">
            Choose the best agent for your deal at {deal?.property_address}
          </p>
        </div>

        {/* Agent Cards */}
        {agents.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <p className="text-[#808080] mb-4">No agents available in {deal?.state} yet</p>
            <Button
              onClick={() => navigate(createPageUrl("Pipeline"))}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
            >
              Return to Pipeline
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.slice(0, 3).map((match, index) => {
              const agent = match.agent;
              const headshotUrl = agent.headshotUrl || agent.agent?.headshot_url;
              const agentName = agent.full_name || "Agent";
              const brokerage = agent.agent?.brokerage || agent.broker;
              const experienceYears = agent.agent?.experience_years;
              const markets = agent.agent?.markets || [];
              const specialties = agent.agent?.specialties || [];

              return (
                <div
                  key={agent.id}
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

                  {/* Match Reason */}
                  <div className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-[#E3C567] font-medium">
                      {match.explanation || `Match score: ${match.score}%`}
                    </p>
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
                    onClick={() => handleSelectAgent(agent)}
                    disabled={sending}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                  >
                    {sending ? "Sending..." : "Send Deal to This Agent"}
                  </Button>
                </div>
              );
            })}
          </div>
          
          {/* View All Button */}
          {agents.length > 3 && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={() => navigate(createPageUrl("AgentDirectory") + `?dealId=${dealId}`)}
                variant="outline"
                className="border-[#E3C567]/50 text-[#E3C567] hover:bg-[#E3C567]/10 rounded-full"
              >
                View All {agents.length} Agents
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
}