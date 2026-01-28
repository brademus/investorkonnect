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

  const handleProceed = () => {
    navigate(createPageUrl("SelectAgent"));
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
              <div className="bg-[#141414] border border-[#34D399]/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#34D399]" />
                  <h3 className="font-semibold text-[#34D399] text-lg">Contract Verified</h3>
                </div>
              </div>

              <Button
                onClick={handleProceed}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11 rounded-lg"
              >
                Continue to Agent Selection
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}