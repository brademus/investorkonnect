import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContractVerify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useCurrentProfile();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dealId = params.get("dealId");

  useEffect(() => {
    const loadDeal = async () => {
      if (!dealId) {
        setError("No deal specified");
        setLoading(false);
        return;
      }

      try {
        const dealData = await base44.entities.Deal.filter({ id: dealId });
        if (dealData && dealData.length > 0) {
          setDeal(dealData[0]);
        } else {
          setError("Deal not found");
        }
      } catch (err) {
        console.error("Error loading deal:", err);
        setError("Failed to load deal");
      } finally {
        setLoading(false);
      }
    };

    loadDeal();
  }, [dealId]);

  const handleProceed = () => {
    if (deal) {
      navigate(createPageUrl("Pipeline"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#808080]">Loading deal details...</div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Card className="bg-[#0D0D0D] border-[#1F1F1F] max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold text-[#FAFAFA]">Error</h2>
          </div>
          <p className="text-sm text-[#808080] mb-6">{error}</p>
          <Button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
          >
            Back to Pipeline
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("Pipeline"))}
          className="flex items-center gap-2 text-[#E3C567] hover:text-[#EDD89F] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </button>

        <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-8 mb-8">
          <div className="flex items-start gap-4 mb-8">
            <CheckCircle2 className="w-8 h-8 text-[#E3C567] flex-shrink-0 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-[#FAFAFA] mb-2">
                Deal Created
              </h1>
              <p className="text-[#808080]">
                Your deal has been successfully created and is ready to be shared with agents.
              </p>
            </div>
          </div>

          <div className="bg-[#141414] rounded-lg p-6 mb-8 border border-[#1F1F1F]">
            <h3 className="text-lg font-semibold text-[#FAFAFA] mb-4">
              Deal Summary
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#808080] uppercase tracking-wide">
                  Title
                </p>
                <p className="text-[#FAFAFA] font-medium">{deal.title}</p>
              </div>

              {deal.property_address && (
                <div>
                  <p className="text-xs text-[#808080] uppercase tracking-wide">
                    Property Address
                  </p>
                  <p className="text-[#FAFAFA] font-medium">
                    {deal.property_address}
                  </p>
                </div>
              )}

              {deal.purchase_price && (
                <div>
                  <p className="text-xs text-[#808080] uppercase tracking-wide">
                    Purchase Price
                  </p>
                  <p className="text-[#FAFAFA] font-medium">
                    ${deal.purchase_price.toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-[#808080] uppercase tracking-wide">
                  Status
                </p>
                <p className="text-[#FAFAFA] font-medium capitalize">
                  {deal.status}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleProceed}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11"
            >
              Go to Pipeline
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}