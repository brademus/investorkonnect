import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

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

  // Load agents that have this state as a target market
  useEffect(() => {
    const loadAgents = async () => {
      if (!dealData?.state) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allAgents = await base44.entities.Profile.filter({ user_role: "agent" });
        
        // Filter agents that have this state in their markets
        const filteredAgents = allAgents.filter(agent => {
          const markets = agent.agent?.markets || agent.markets || [];
          const licensedStates = agent.agent?.licensed_states || [];
          return (
            markets.some(m => m === dealData.state || m.toUpperCase() === dealData.state.toUpperCase()) ||
            licensedStates.some(s => s === dealData.state || s.toUpperCase() === dealData.state.toUpperCase())
          );
        });

        setAgents(filteredAgents);
        if (filteredAgents.length === 0) {
          toast.info("No agents available in this market yet");
        }
      } catch (err) {
        console.error("Error loading agents:", err);
        toast.error("Failed to load available agents");
      }
      setLoading(false);
    };

    loadAgents();
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
      // Get current user to set investor_id
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const currentProfile = profiles[0];
      
      const cleanedPrice = String(dealData.purchasePrice || "").replace(/[$,\s]/g, "").trim();

      // Create ONE deal (temporarily set first agent as agent_id for backward compatibility)
      const newDeal = await base44.entities.Deal.create({
        title: `${dealData.propertyAddress}`,
        description: dealData.specialNotes || "",
        property_address: dealData.propertyAddress,
        city: dealData.city,
        state: dealData.state,
        zip: dealData.zip,
        county: dealData.county,
        purchase_price: Number(cleanedPrice),
        key_dates: {
          closing_date: dealData.closingDate,
          contract_date: dealData.contractDate,
        },
        property_type: dealData.propertyType || null,
        property_details: {
          beds: dealData.beds ? Number(dealData.beds) : null,
          baths: dealData.baths ? Number(dealData.baths) : null,
          sqft: dealData.sqft ? Number(dealData.sqft) : null,
          year_built: dealData.yearBuilt ? Number(dealData.yearBuilt) : null,
          number_of_stories: dealData.numberOfStories || null,
          has_basement: dealData.hasBasement || null,
        },
        seller_info: {
          seller_name: dealData.sellerName,
          earnest_money: dealData.earnestMoney ? Number(dealData.earnestMoney) : null,
          number_of_signers: dealData.numberOfSigners,
          second_signer_name: dealData.secondSignerName,
        },
        proposed_terms: {
          seller_commission_type: dealData.sellerCommissionType,
          seller_commission_percentage: dealData.sellerCommissionPercentage ? Number(dealData.sellerCommissionPercentage) : null,
          seller_flat_fee: dealData.sellerFlatFee ? Number(dealData.sellerFlatFee) : null,
          buyer_commission_type: dealData.buyerCommissionType,
          buyer_commission_percentage: dealData.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
          buyer_flat_fee: dealData.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
          agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null,
        },
        status: "draft",
        pipeline_stage: "new_listings",
        investor_id: currentProfile?.id,
        agent_id: selectedAgentIds[0], // Temporary: set first agent for backward compatibility
      });

      console.log('[SelectAgent] Created deal:', newDeal.id);

      // PHASE 7: Create ONE Room per selected agent with closing_date (parallel)
      const roomPromises = selectedAgentIds.map(agentId => 
        base44.entities.Room.create({
          deal_id: newDeal.id,
          investorId: currentProfile?.id,
          agentId: agentId,
          request_status: 'requested',
          agreement_status: 'draft',
          title: newDeal.title,
          property_address: newDeal.property_address,
          city: newDeal.city,
          state: newDeal.state,
          county: newDeal.county,
          zip: newDeal.zip,
          budget: newDeal.purchase_price,
          closing_date: newDeal.key_dates?.closing_date,
          proposed_terms: newDeal.proposed_terms,
          ndaAcceptedInvestor: false,
          ndaAcceptedAgent: false,
          requested_at: new Date().toISOString()
        })
      );

      const createdRooms = await Promise.all(roomPromises);
      console.log('[SelectAgent] Created rooms:', createdRooms.map(r => r.id));

      // DO NOT generate agreement or signing yet (Phase 1 scope)
      // Just navigate to the first room
      sessionStorage.removeItem("newDealDraft");
      toast.success(`Deal sent to ${selectedAgentIds.length} agent(s)!`);
      
      // Navigate to first room
      navigate(`${createPageUrl("Room")}?roomId=${createdRooms[0].id}&dealId=${newDeal.id}`);
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Failed to create deal");
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
          <p className="text-sm text-[#808080]">Choose up to 3 agents to send this deal to ({selectedAgentIds.length}/3 selected)</p>
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
                      <h3 className="text-lg font-semibold text-[#FAFAFA] mb-1">
                        {agent.full_name || "Unnamed Agent"}
                      </h3>
                      <p className="text-sm text-[#808080] mb-3">{agent.email}</p>
                      <div className="flex flex-wrap gap-2">
                        {agent.agent?.agent_friendly && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#34D399]/20 text-[#34D399] text-xs font-medium">
                            ✓ Investor Friendly
                          </span>
                        )}
                        {agent.agent?.license_number && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#60A5FA]/20 text-[#60A5FA] text-xs font-medium">
                            Licensed
                          </span>
                        )}
                        {agent.agent?.investor_experience_years && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium">
                            {agent.agent.investor_experience_years}+ years
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-6 h-6 text-[#E3C567] flex-shrink-0 ml-4" />
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${createPageUrl("AgentProfile")}?profileId=${agent.id}`);
                      }}
                      variant="outline"
                      size="sm"
                      className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414] rounded-full"
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
                  Creating Deal & Rooms...
                </>
              ) : (
                `Send Deal to ${selectedAgentIds.length} Agent${selectedAgentIds.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}