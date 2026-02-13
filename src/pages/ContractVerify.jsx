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

      // Update deal data with contract URL (preserve ALL fields including walkthrough)
      const updatedDraft = {
        ...dealData,
        contractUrl: file_url
      };
      sessionStorage.setItem("newDealDraft", JSON.stringify(updatedDraft));
      
      // Also re-save the dedicated walkthrough key to ensure it's never lost
      if (dealData.walkthroughScheduled === true || dealData.walkthrough_scheduled === true) {
        sessionStorage.setItem("newDealWalkthrough", JSON.stringify({
          walkthrough_scheduled: true,
          walkthrough_datetime: dealData.walkthrough_datetime || null
        }));
      }
      
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
      
      Note: County is optional and not being verified.

      YOUR TASK:
      1. Carefully read through the ENTIRE contract PDF - contracts vary widely in format, layout, and structure.

      2. Extract the following information wherever it appears in the document:
      - property_address: Look for property address, subject property, premises, or legal description sections
      - city: May be part of address or listed separately
      - state: 2-letter abbreviation (e.g., AZ, TX, FL)
      - zip: 5-digit postal code
      - purchase_price: May be labeled as "purchase price", "sales price", "offer amount", or similar
      - seller_name: May be in seller section, grantor, or signatures
      - earnest_money: May be labeled as "earnest money", "deposit", "good faith deposit", "EMD"
      - closing_date: May be "closing date", "settlement date", "COE", or similar

      3. For each field, compare the extracted value with the user-provided data and determine:
      - MATCH: Values are the same (be flexible with formatting)
      - MISMATCH: Values are clearly different and incompatible
      - NOT_FOUND: Field not found in contract

      MATCHING RULES (Be Flexible):
      - Addresses: Ignore formatting differences ("Street" = "St", "Avenue" = "Ave", "123 Main St" = "123 Main Street")
      - Cities: Case-insensitive, trim spaces
      - States: Match any valid form (e.g., "AZ" = "Arizona" = "az")
      - ZIP: Match first 5 digits only (ignore ZIP+4)
      - Prices: Ignore all formatting ($, commas, spaces - just compare numbers)
      - Names: Case-insensitive, ignore middle initials, extra spaces, and suffixes (Jr, Sr, III)
      - Dates: Parse any common format (MM/DD/YYYY, YYYY-MM-DD, "January 15, 2026", etc.) and compare the actual dates

      IMPORTANT:
      - Real estate contracts vary widely - some are state-specific forms, some are custom, some are handwritten
      - Search the ENTIRE document thoroughly - fields may be anywhere
      - If you find multiple possible matches for a field, use the most prominent one
      - Be generous with matches - only mark as MISMATCH if truly incompatible
      - Provide helpful notes explaining your reasoning`;

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
    // If editing an existing deal, skip agent selection — agents are already assigned
    if (dealData?.dealId) {
      navigate(`${createPageUrl("MyAgreement")}?dealId=${dealData.dealId}`);
    } else {
      navigate(createPageUrl("SelectAgent"));
    }
  };

  const handleFixDeal = () => {
    // Keep the draft data and go back to fix it with fromVerify flag
    const params = dealData?.dealId ? `?dealId=${dealData.dealId}&fromVerify=1` : '?fromVerify=1';
    navigate(createPageUrl("NewDeal") + params);
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
                      className="flex-1 bg-[#1A1A1A] hover:bg-[#222] text-[#E3C567] border border-[#E3C567]/40 hover:border-[#E3C567] h-11 rounded-lg"
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
                  {dealData?.dealId ? "Continue to Agreement" : "Continue to Agent Selection"}
                </Button>
              )}
              </div>
              )}
        </div>
      </div>
    </div>
  );
}