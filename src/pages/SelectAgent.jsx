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
  const [selectedAgents, setSelectedAgents] = useState([]);
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

  // Load agents that have this state and city as a target market
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
        const allAgents = await base44.entities.Profile.filter({ user_role: "agent" });
        console.log('[SelectAgent] Total agents found:', allAgents.length);
        
        // Filter agents that have this state in their markets AND prefer by nearest city match
        const filteredAgents = allAgents.filter(agent => {
          const markets = agent.agent?.markets || agent.markets || [];
          const licensedStates = agent.agent?.licensed_states || [];
          return (
            markets.some(m => m === dealData.state || m.toUpperCase() === dealData.state.toUpperCase()) ||
            licensedStates.some(s => s === dealData.state || s.toUpperCase() === dealData.state.toUpperCase())
          );
        });

        // Sort by city proximity - prioritize agents with matching city in their profile
        const sortedAgents = filteredAgents.sort((a, b) => {
          const aCity = (a.agent?.primary_neighborhoods_notes || a.location || '').toLowerCase();
          const bCity = (b.agent?.primary_neighborhoods_notes || b.location || '').toLowerCase();
          const dealCity = dealData.city.toLowerCase();
          
          const aHasCity = aCity.includes(dealCity);
          const bHasCity = bCity.includes(dealCity);
          
          if (aHasCity && !bHasCity) return -1;
          if (!aHasCity && bHasCity) return 1;
          return 0;
        });

        console.log('[SelectAgent] Filtered agents for', dealData.city, dealData.state, ':', sortedAgents.length);
        setAgents(sortedAgents);
        if (sortedAgents.length === 0) {
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
    setSelectedAgents(prev => {
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

  const handleContinue = async () => {
    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    setProceeding(true);
    try {
      // Get draft data from sessionStorage
      const draftData = JSON.parse(sessionStorage.getItem('newDealDraft') || '{}');
      
      // Create draft
      const res = await base44.functions.invoke('createDealDraft', {
        property_address: draftData.propertyAddress,
        city: draftData.city,
        state: draftData.state,
        zip: draftData.zip,
        county: draftData.county,
        purchase_price: draftData.purchasePrice,
        property_type: draftData.propertyType,
        beds: draftData.beds,
        baths: draftData.baths,
        sqft: draftData.sqft,
        year_built: draftData.yearBuilt,
        number_of_stories: draftData.numberOfStories,
        has_basement: draftData.hasBasement,
        seller_name: draftData.sellerName,
        earnest_money: draftData.earnestMoney,
        number_of_signers: draftData.numberOfSigners,
        second_signer_name: draftData.secondSignerName,
        seller_commission_type: draftData.sellerCommissionType,
        seller_commission_percentage: draftData.sellerCommissionPercentage,
        seller_flat_fee: draftData.sellerFlatFee,
        buyer_commission_type: draftData.buyerCommissionType,
        buyer_commission_percentage: draftData.buyerCommissionPercentage,
        buyer_flat_fee: draftData.buyerFlatFee,
        agreement_length: draftData.agreementLength,
        contract_url: draftData.contractUrl,
        special_notes: draftData.specialNotes,
        closing_date: draftData.closingDate,
        contract_date: draftData.contractDate,
        selected_agent_ids: selectedAgents
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        setProceeding(false);
        return;
      }

      const draftId = res.data.draft_id;
      
      // Store draft ID for MyAgreement page
      sessionStorage.setItem('draft_id', draftId);
      sessionStorage.setItem('selectedAgentIds', JSON.stringify(selectedAgents));

      // Navigate to MyAgreement page
      navigate(createPageUrl('MyAgreement'));
    } catch (e) {
      console.error('[SelectAgent] Error:', e);
      toast.error('Failed to create draft');
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
          <p className="text-sm text-[#808080]">Choose up to 3 agents to send this deal to ({selectedAgents.length}/3 selected)</p>
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
              const isSelected = selectedAgents.includes(agent.id);
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
              onClick={handleContinue}
              disabled={proceeding || selectedAgents.length === 0}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 py-6 font-semibold text-base h-auto disabled:opacity-50 mt-6"
            >
              {proceeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Draft...
                </>
              ) : (
                `Continue with ${selectedAgents.length} Agent${selectedAgents.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}