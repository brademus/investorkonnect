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

        // Normalize for comparison
        const normalize = (str) => String(str || '').toLowerCase().trim();
        const normalizePrice = (val) => {
          const num = String(val || '').replace(/[$,\s]/g, '');
          return Number(num) || 0;
        };

        // Check property address
        if (normalize(extracted.property_address) === normalize(dealData.propertyAddress)) {
          matches.push("Property Address");
        } else {
          mismatches.push({
            field: "Property Address",
            contract: extracted.property_address || 'Not found',
            deal: dealData.propertyAddress || 'Not provided'
          });
        }

        // Check city
        if (normalize(extracted.city) === normalize(dealData.city)) {
          matches.push("City");
        } else {
          mismatches.push({
            field: "City",
            contract: extracted.city || 'Not found',
            deal: dealData.city || 'Not provided'
          });
        }

        // Check state
        if (normalize(extracted.state) === normalize(dealData.state)) {
          matches.push("State");
        } else {
          mismatches.push({
            field: "State",
            contract: extracted.state || 'Not found',
            deal: dealData.state || 'Not provided'
          });
        }

        // Check ZIP
        if (normalize(extracted.zip) === normalize(dealData.zip)) {
          matches.push("ZIP Code");
        } else if (extracted.zip || dealData.zip) {
          mismatches.push({
            field: "ZIP Code",
            contract: extracted.zip || 'Not found',
            deal: dealData.zip || 'Not provided'
          });
        }

        // Check purchase price
        const extractedPrice = normalizePrice(extracted.purchase_price);
        const dealPrice = normalizePrice(dealData.purchasePrice);
        if (extractedPrice === dealPrice) {
          matches.push("Purchase Price");
        } else {
          mismatches.push({
            field: "Purchase Price",
            contract: extractedPrice ? `$${extractedPrice.toLocaleString()}` : 'Not found',
            deal: dealPrice ? `$${dealPrice.toLocaleString()}` : 'Not provided'
          });
        }

        // Check seller name
        if (normalize(extracted.seller_name) === normalize(dealData.sellerName)) {
          matches.push("Seller Name");
        } else {
          mismatches.push({
            field: "Seller Name",
            contract: extracted.seller_name || 'Not found',
            deal: dealData.sellerName || 'Not provided'
          });
        }

        // Check closing date
        if (extracted.closing_date && dealData.closingDate) {
          const extractedDate = new Date(extracted.closing_date).toDateString();
          const dealDate = new Date(dealData.closingDate).toDateString();
          if (extractedDate === dealDate) {
            matches.push("Closing Date");
          } else {
            mismatches.push({
              field: "Closing Date",
              contract: new Date(extracted.closing_date).toLocaleDateString(),
              deal: new Date(dealData.closingDate).toLocaleDateString()
            });
          }
        }

        setVerificationResult({ matches, mismatches, extracted, file_url });
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