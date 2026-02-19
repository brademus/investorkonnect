import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, Users, Briefcase, Trophy, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import AgentRatingStars from "@/components/AgentRatingStars";
import { fetchAgentRatings } from "@/components/useAgentRating";
import { rankAgentsForDeal, getZipCoords } from "@/components/utils/agentScoring";

export default function SelectAgent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proceeding, setProceeding] = useState(false);
  const [dealData, setDealData] = useState(null);

  // Get state from deal data
  useEffect(() => {
    const draft = sessionStorage.getItem("newDealDraft");
    if (draft) {
      try {
        const data = JSON.parse(draft);
        setDealData(data);
      } catch (err) {
        console.error("Error parsing draft:", err);
        toast.error("Failed to load deal data");
      }
    }
  }, []);

  // Load agents using ranking algorithm
  useEffect(() => {
    const loadAgents = async () => {
      if (!dealData?.state || !dealData?.city) {
        console.log('[SelectAgent] No deal state or city found, staying in loading');
        setLoading(false);
        return;
      }

      console.log('[SelectAgent] Loading agents for city:', dealData.city, 'state:', dealData.state);
      setLoading(true);
      try {
        // Fetch all agents and all deals in parallel
        const [allAgents, allDeals] = await Promise.all([
          base44.entities.Profile.filter({ user_role: "agent" }),
          base44.entities.Deal.filter({})
        ]);

        console.log('[SelectAgent] Total agents found:', allAgents.length);

        // Build IK deals count map
        const ikMap = new Map();
        allAgents.forEach(a => ikMap.set(a.id, 0));
        (allDeals || []).forEach(deal => {
          if (deal.locked_agent_id && ikMap.has(deal.locked_agent_id)) {
            ikMap.set(deal.locked_agent_id, ikMap.get(deal.locked_agent_id) + 1);
          }
        });

        // Fetch ratings for all agents
        const agentIds = allAgents.map(a => a.id);
        const ratingsMap = agentIds.length > 0 ? await fetchAgentRatings(agentIds) : new Map();

        // Get deal coordinates
        let lat = dealData.deal_lat ?? null;
        let lng = dealData.deal_lng ?? null;
        if ((lat == null || lng == null) && dealData.zip) {
          const coords = await getZipCoords(dealData.zip);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }

        const dealLocation = {
          state: dealData.state,
          county: dealData.county || "",
          lat,
          lng,
        };

        // Rank agents
        const ranked = rankAgentsForDeal(allAgents, dealLocation, ratingsMap, ikMap);
        console.log('[SelectAgent] Ranked agents for', dealData.city, dealData.state, ':', ranked.length);
        setAgents(ranked);

        if (ranked.length === 0) {
          toast.info("No agents available in this market yet");
        }
      } catch (err) {
        console.error("Error loading agents:", err);
        toast.error("Failed to load available agents");
      }
      setLoading(false);
    };

    if (dealData) {
      loadAgents();
    }
  }, [dealData]);

  const toggleAgent = (agentId) => {
    setSelectedAgentIds(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId);
      } else {
        if (prev.length >= 3) {
          toast.error("You can select up to 3 agents.");
          return prev;
        }
        return [...prev, agentId];
      }
    });
  };

  const handleProceed = async () => {
    if (selectedAgentIds.length === 0 || proceeding) {
      return;
    }

    setProceeding(true);
    try {
      // Save selected agents to sessionStorage - deal will be created AFTER investor signs
      const updatedDealData = {
        ...dealData,
        selectedAgentIds: selectedAgentIds
      };
      
      sessionStorage.setItem("newDealDraft", JSON.stringify(updatedDealData));
      sessionStorage.setItem("selectedAgentIds", JSON.stringify(selectedAgentIds));
      
      console.log('[SelectAgent] Saved agent selection to sessionStorage:', selectedAgentIds);
      
      // Navigate to MyAgreement page to generate and sign (deal will be created on signature)
      navigate(createPageUrl("MyAgreement"));
    } catch (error) {
      console.error("Error proceeding:", error);
      toast.error("Failed to proceed");
      setProceeding(false);
    }
  };

  if (!dealData?.state) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-[#808080]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`${createPageUrl("ContractVerify")}`)}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Select Your Agents</h1>
          <p className="text-sm text-[#808080]">
            Showing agents licensed in {dealData.state} · sorted by proximity &amp; rating
            {" "}({selectedAgentIds.length}/3 selected)
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-[#808080] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">No Agents Available</h3>
            <p className="text-[#808080] text-sm mb-6">
              There are currently no agents operating in {dealData.state}. Please try a different state.
            </p>
            <Button
              onClick={() => navigate(`${createPageUrl("ContractVerify")}`)}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-6 font-semibold"
            >
              Go Back
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => {
              const isSelected = selectedAgentIds.includes(agent.id);
              const md = agent.matchData || {};
              const badges = md.badges || [];
              return (
                <div
                  key={agent.id}
                  className={`w-full text-left bg-[#0D0D0D] border-2 rounded-2xl p-6 transition-all ${
                    isSelected
                      ? "border-[#E3C567] bg-[#141414] shadow-lg shadow-[#E3C567]/20"
                      : "border-[#1F1F1F] hover:border-[#E3C567]/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {/* Badges */}
                      {badges.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {badges.includes("bestMatch") && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
                              <Trophy className="w-3 h-3" /> Best Match
                            </span>
                          )}
                          {badges.includes("local") && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30">
                              <MapPin className="w-3 h-3" /> Local Expert
                            </span>
                          )}
                          {badges.includes("topRated") && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30">
                              <Star className="w-3 h-3" /> Top Rated
                            </span>
                          )}
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-[#FAFAFA] mb-1">
                        {agent.full_name || "Unnamed Agent"}
                      </h3>
                      {md.distanceMiles != null && (
                        <p className="text-xs text-[#808080] mb-1">~{md.distanceMiles} miles away</p>
                      )}
                      <p className="text-sm text-[#808080] mb-3">{agent.email}</p>
                      {/* Rating */}
                      <div className="mb-3">
                        <AgentRatingStars
                          rating={md.ratingScore != null ? (md.ratingScore / 80) * 5 : null}
                          reviewCount={0}
                          size="sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agent.agent?.investor_friendly && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#34D399]/20 text-[#34D399] text-xs font-medium">
                            ✓ Investor Friendly
                          </span>
                        )}
                        {agent.agent?.license_number && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#60A5FA]/20 text-[#60A5FA] text-xs font-medium">
                            Licensed
                          </span>
                        )}
                        {agent.agent?.experience_years > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium">
                            {agent.agent.experience_years}+ years
                          </span>
                        )}
                      </div>
                      {/* Deal Stats */}
                      {(agent.agent?.investment_deals_last_12m > 0 || (md.activityScore > 0)) && (
                        <div className="flex gap-3 mt-3">
                          {agent.agent?.investment_deals_last_12m > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0A0A] border border-[#1A1A1A]">
                              <Briefcase className="w-3.5 h-3.5 text-[#E3C567]" />
                              <span className="text-sm font-bold text-[#E3C567]">{agent.agent.investment_deals_last_12m}</span>
                              <span className="text-[10px] uppercase tracking-wider text-[#808080]">Outside IK</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-6 h-6 text-[#E3C567] flex-shrink-0 ml-4" />
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${createPageUrl("AgentProfile")}?profileId=${agent.id}`);
                      }}
                      size="sm"
                      className="bg-[#1A1A1A] hover:bg-[#222] text-[#E3C567] border-[#E3C567]/40 hover:border-[#E3C567] rounded-full"
                    >
                      View Profile
                    </Button>
                    <Button
                      onClick={() => toggleAgent(agent.id)}
                      size="sm"
                      className={`rounded-full ${
                        isSelected
                          ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                          : "bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA]"
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select Agent'}
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button
              onClick={handleProceed}
              disabled={proceeding || selectedAgentIds.length === 0}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 py-6 font-semibold text-base h-auto disabled:opacity-50 mt-6"
            >
              {proceeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Deal...
                </>
              ) : (
                `Continue with ${selectedAgentIds.length} Agent${selectedAgentIds.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}