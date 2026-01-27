import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ContractVerify() {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dealData, setDealData] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get deal data from sessionStorage
  useEffect(() => {
    const draft = sessionStorage.getItem("newDealDraft");
    if (draft) {
      try {
        const data = JSON.parse(draft);
        setDealData(data);
        setLoading(false);
      } catch (err) {
        console.error("Error parsing draft:", err);
        toast.error("Failed to load deal data");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleVerify = async () => {
    if (!file) {
      toast.error("Please select a contract PDF");
      return;
    }

    if (!dealData) {
      toast.error("Deal data not found");
      return;
    }

    setUploading(true);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: file,
      });

      setUploading(false);
      setVerifying(true);

      // Verify with AI
      const extractedData = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            property_address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zip: { type: "string" },
            purchase_price: { type: "number" },
            seller_name: { type: "string" },
            earnest_money: { type: "number" },
            closing_date: { type: "string" },
          },
        },
      });

      setVerifying(false);

      if (extractedData.status === "success") {
        const extracted = extractedData.output;
        const matches = [];
        const mismatches = [];

        if (
          extracted.property_address?.toLowerCase() === dealData.propertyAddress?.toLowerCase()
        ) {
          matches.push("Property Address ✓");
        } else {
          mismatches.push(`Address: "${extracted.property_address}" vs "${dealData.propertyAddress}"`);
        }

        if (extracted.city?.toLowerCase() === dealData.city?.toLowerCase()) {
          matches.push("City ✓");
        } else {
          mismatches.push(`City: "${extracted.city}" vs "${dealData.city}"`);
        }

        if (extracted.state?.toUpperCase() === dealData.state?.toUpperCase()) {
          matches.push("State ✓");
        } else {
          mismatches.push(`State: "${extracted.state}" vs "${dealData.state}"`);
        }

        if (extracted.purchase_price === Number(dealData.purchasePrice)) {
          matches.push("Purchase Price ✓");
        } else {
          mismatches.push(`Price: $${extracted.purchase_price} vs $${dealData.purchasePrice}`);
        }

        if (extracted.seller_name?.toLowerCase() === dealData.sellerName?.toLowerCase()) {
          matches.push("Seller Name ✓");
        } else {
          mismatches.push(`Seller: "${extracted.seller_name}" vs "${dealData.sellerName}"`);
        }

        setVerificationResult({ matches, mismatches, extracted });
      } else {
        toast.error("Failed to extract contract data");
      }
    } catch (error) {
      console.error("Error:", error);
      setUploading(false);
      setVerifying(false);
      toast.error("Failed to process contract");
    }
  };

  const handleProceed = async () => {
    if (verificationResult) {
      try {
        // Create deal in database
        const dealData = JSON.parse(sessionStorage.getItem("newDealDraft") || "{}");
        const cleanedPrice = String(dealData.purchasePrice || "").replace(/[$,\s]/g, "").trim();

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
            has_basement: dealData.hasBasement === "yes" ? true : null,
          },
          seller_info: {
            seller_name: dealData.sellerName,
            earnest_money: dealData.earnestMoney ? Number(dealData.earnestMoney) : null,
            number_of_signers: dealData.numberOfSigners,
            second_signer_name: dealData.secondSignerName,
          },
          proposed_terms: {
            seller_commission_type: dealData.sellerCommissionType,
            seller_commission_percentage: dealData.sellerCommissionPercentage
              ? Number(dealData.sellerCommissionPercentage)
              : null,
            seller_flat_fee: dealData.sellerFlatFee ? Number(dealData.sellerFlatFee) : null,
            buyer_commission_type: dealData.buyerCommissionType,
            buyer_commission_percentage: dealData.buyerCommissionPercentage
              ? Number(dealData.buyerCommissionPercentage)
              : null,
            buyer_flat_fee: dealData.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
            agreement_length: dealData.agreementLength
              ? Number(dealData.agreementLength)
              : null,
          },
          status: "draft",
          pipeline_stage: "new_listings",
        });

        sessionStorage.removeItem("newDealDraft");
        navigate(`${createPageUrl("ContractVerify")}?dealId=${newDeal.id}`);
        toast.success("Deal created successfully!");
      } catch (error) {
        console.error("Error creating deal:", error);
        toast.error("Failed to create deal");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#808080]">Loading...</div>
      </div>
    );
  }

  if (!dealData) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("NewDeal"))}
            className="flex items-center gap-2 text-[#E3C567] hover:text-[#EDD89F] mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Deal Form
          </button>
          <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-semibold text-[#FAFAFA]">No Deal Data</h2>
            </div>
            <p className="text-sm text-[#808080] mb-6">
              Please fill out the deal form first.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("NewDeal"))}
          className="flex items-center gap-2 text-[#E3C567] hover:text-[#EDD89F] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deal Form
        </button>

        <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-8 mb-8">
          <h1 className="text-3xl font-bold text-[#FAFAFA] mb-2">Verify Contract</h1>
          <p className="text-[#808080] mb-8">
            Upload your purchase contract so we can verify the information matches your deal details.
          </p>

          {!verificationResult ? (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-[#1F1F1F] rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div>
                    <p className="text-[#FAFAFA] font-medium mb-2">
                      {file ? file.name : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-sm text-[#808080]">PDF files only</p>
                  </div>
                </label>
              </div>

              <Button
                onClick={handleVerify}
                disabled={!file || uploading || verifying}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Contract"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[#FAFAFA]">Verification Results</h3>
                {verificationResult.matches.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-[#34D399]">Matches:</h4>
                    {verificationResult.matches.map((match, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[#34D399]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">{match}</span>
                      </div>
                    ))}
                  </div>
                )}
                {verificationResult.mismatches.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-yellow-500">Differences:</h4>
                    {verificationResult.mismatches.map((mismatch, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-yellow-500">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{mismatch}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleProceed}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11"
              >
                Create Deal
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}