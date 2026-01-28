import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
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
      } catch (err) {
        console.error("Error parsing draft:", err);
        toast.error("Failed to load deal data");
      }
    }
    setLoading(false);
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

      // Update deal data with contract URL
      const updatedDraft = {
        ...dealData,
        contractUrl: file_url
      };
      sessionStorage.setItem("newDealDraft", JSON.stringify(updatedDraft));
      setDealData(updatedDraft);

      setUploading(false);
      setVerifying(true);

      // Use AI with vision to verify contract against deal data
      const verificationPrompt = `You are verifying a real estate purchase contract PDF against deal information provided by the user.

      DEAL INFORMATION PROVIDED BY USER:
      - Property Address: ${dealData.propertyAddress}
      - City: ${dealData.city}
      - State: ${dealData.state}
      - ZIP: ${dealData.zip}
      - Purchase Price: $${dealData.purchasePrice}
      - Seller Name: ${dealData.sellerName}
      - Earnest Money: $${dealData.earnestMoney}
      - Closing Date: ${dealData.closingDate}

      YOUR TASK:
      1. Extract the following information from the contract PDF:
      - property_address (full street address)
      - city
      - state (2-letter code)
      - zip (5-digit code)
      - purchase_price (number only, no symbols)
      - seller_name (full legal name)
      - earnest_money (number only)
      - closing_date (YYYY-MM-DD format)

      2. Compare each extracted field with the user-provided deal data.

      3. For each field, determine if it's a MATCH or MISMATCH:
      - MATCH: The contract data matches the deal data (allow minor formatting differences)
      - MISMATCH: The values are clearly different

      4. Return the results in the specified JSON format.

      IMPORTANT:
      - Be thorough in reading the contract
      - For addresses, ignore minor formatting (e.g., "Street" vs "St")
      - For dates, parse flexibly (e.g., "01/15/2026" = "2026-01-15")
      - For prices, ignore commas and $ symbols
      - For names, ignore case and extra spaces
      - If a field is not found in the contract, mark it as "not_found"`;

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: verificationPrompt,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            extracted: {
              type: "object",
              properties: {
                property_address: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                zip: { type: "string" },
                purchase_price: { type: "number" },
                seller_name: { type: "string" },
                earnest_money: { type: "number" },
                closing_date: { type: "string" }
              }
            },
            verification: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  status: { type: "string", enum: ["match", "mismatch", "not_found"] },
                  contract_value: { type: "string" },
                  deal_value: { type: "string" },
                  note: { type: "string" }
                }
              }
            }
          }
        }
      });

      setVerifying(false);

      if (aiResult) {
        const matches = [];
        const mismatches = [];

        aiResult.verification.forEach((item) => {
          if (item.status === "match") {
            matches.push(item.field);
          } else if (item.status === "mismatch" || item.status === "not_found") {
            mismatches.push({
              field: item.field,
              contract: item.contract_value,
              deal: item.deal_value,
              note: item.note
            });
          }
        });

        setVerificationResult({ 
          matches, 
          mismatches, 
          extracted: aiResult.extracted, 
          file_url 
        });
      } else {
        toast.error("Failed to verify contract");
      }
    } catch (error) {
      console.error("Error:", error);
      setUploading(false);
      setVerifying(false);
      toast.error("Failed to process contract");
    }
  };

  const handleProceed = () => {
    navigate(createPageUrl("SelectAgent"));
  };

  const handleFixDeal = () => {
    // Keep the draft data and go back to fix it
    navigate(createPageUrl("NewDeal"));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-[#808080]">Loading...</div>
      </div>
    );
  }

  if (!dealData) {
    return (
      <div className="min-h-screen bg-transparent py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl("NewDeal"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-semibold text-[#FAFAFA]">No Deal Data</h2>
            </div>
            <p className="text-sm text-[#808080]">Please fill out the deal form first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("NewDeal"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Deal Builder
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2 font-sans">Verify Your Contract</h1>
          <p className="text-sm text-[#808080]">Upload your contract to verify details match your deal</p>
        </div>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">

          {!verificationResult ? (
             <div className="space-y-6">
                <div className="border-2 border-dashed border-[#1F1F1F] rounded-xl p-12 text-center cursor-pointer hover:border-[#E3C567]/50 hover:bg-[#141414] transition" onClick={() => document.querySelector('input[type="file"]')?.click()}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div>
                    <div className="w-16 h-16 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-[#E3C567]" />
                    </div>
                    <p className="text-[#FAFAFA] font-semibold mb-2">
                      {file ? file.name : "Upload Your Contract"}
                    </p>
                    <p className="text-sm text-[#808080]">PDF format • Maximum 10MB</p>
                  </div>
                </div>

              <Button
                onClick={handleVerify}
                disabled={!file || uploading || verifying}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11 rounded-lg"
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
              {/* Verification Results */}
              {verificationResult.mismatches.length === 0 ? (
                <div className="bg-[#141414] border border-[#34D399]/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-[#34D399]" />
                    <h3 className="font-semibold text-[#34D399] text-lg">Contract Verified</h3>
                  </div>
                  <div className="space-y-2">
                    {verificationResult.matches.map((field, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                        <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                        <span>{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Show matches */}
                  {verificationResult.matches.length > 0 && (
                    <div className="bg-[#141414] border border-[#34D399]/30 rounded-lg p-6 mb-4">
                      <h3 className="font-semibold text-[#34D399] text-sm mb-3">Verified Fields</h3>
                      <div className="space-y-2">
                        {verificationResult.matches.map((field, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                            <span>{field}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show mismatches */}
                  <div className="bg-[#141414] border border-[#F87171]/30 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-6 h-6 text-[#F87171]" />
                      <h3 className="font-semibold text-[#F87171] text-lg">Mismatches Found</h3>
                    </div>
                    <p className="text-sm text-[#808080] mb-4">
                      Please review and fix the following mismatches before continuing.
                    </p>
                    <div className="space-y-4">
                      {verificationResult.mismatches.map((item, i) => (
                        <div key={i} className="text-sm">
                          <div className="font-medium text-[#FAFAFA] mb-2">{item.field}</div>
                          <div className="grid grid-cols-2 gap-4 pl-4">
                            <div>
                              <div className="text-[#808080] text-xs mb-1">Contract:</div>
                              <div className="text-[#F87171]">{item.contract}</div>
                            </div>
                            <div>
                              <div className="text-[#808080] text-xs mb-1">Your Deal:</div>
                              <div className="text-[#60A5FA]">{item.deal}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons for mismatch case */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleFixDeal}
                      className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11 rounded-lg"
                    >
                      Fix Deal Details
                    </Button>
                    <Button
                      onClick={() => {
                        setFile(null);
                        setVerificationResult(null);
                      }}
                      variant="outline"
                      className="flex-1 border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414] h-11 rounded-lg"
                    >
                      Upload New Contract
                    </Button>
                  </div>
                </div>
              )}

              {/* Only show continue button if verified successfully */}
              {verificationResult.mismatches.length === 0 && (
                <Button
                  onClick={handleProceed}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11 rounded-lg"
                >
                  Continue to Agent Selection
                </Button>
              )}
              </div>
              )}
        </div>
      </div>
    </div>
  );
}