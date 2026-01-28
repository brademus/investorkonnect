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
  const [selectedAgentId, setSelectedAgentId] = useState("");
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

  const handleProceed = async () => {
    if (!selectedAgentId || proceeding) {
      return;
    }

    setProceeding(true);
    try {
      const cleanedPrice = String(dealData.purchasePrice || "").replace(/[$,\s]/g, "").trim();

      // Create deal in database
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
        agent_id: selectedAgentId,
      });

      // Generate legal agreement and send to DocuSign for investor signing
      const agreementRes = await base44.functions.invoke("generateLegalAgreement", {
        deal_id: newDeal.id,
        agent_profile_id: selectedAgentId,
      });

      // Get DocuSign signing URL for investor
      const signingRes = await base44.functions.invoke("docusignCreateSigningSession", {
        agreement_id: agreementRes.data.agreement_id,
        role: "investor",
      });

      sessionStorage.removeItem("newDealDraft");
      toast.success("Agent selected! Redirecting to sign agreement...");

      // Redirect to DocuSign
      if (signingRes.data?.investor_signing_url) {
        window.location.href = signingRes.data.investor_signing_url;
      } else {
        navigate(createPageUrl("Pipeline"));
      }
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
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Select Your Agent</h1>
          <p className="text-sm text-[#808080]">Choose an agent to represent this deal in {dealData.state}</p>
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
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full text-left bg-[#0D0D0D] border-2 rounded-2xl p-6 transition-all ${
                  selectedAgentId === agent.id
                    ? "border-[#E3C567] bg-[#141414] shadow-lg shadow-[#E3C567]/20"
                    : "border-[#1F1F1F] hover:border-[#E3C567]/50"
                }`}
              >
                <div className="flex items-start justify-between">
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
                  {selectedAgentId === agent.id && (
                    <CheckCircle2 className="w-6 h-6 text-[#E3C567] flex-shrink-0 ml-4" />
                  )}
                </div>
              </button>
            ))}

            <Button
              onClick={handleProceed}
              disabled={proceeding || !selectedAgentId}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 py-6 font-semibold text-base h-auto disabled:opacity-50 mt-6"
            >
              {proceeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Deal & Signing...
                </>
              ) : (
                "Proceed to Signing"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}