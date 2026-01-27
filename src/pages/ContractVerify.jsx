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

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-3">Select Agent *</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue placeholder={loadingAgents ? "Loading agents..." : "Choose an agent"} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleProceed}
                disabled={creatingDeal || !selectedAgentId || loadingAgents}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-11 disabled:opacity-50"
              >
                {creatingDeal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Deal & Signing...
                  </>
                ) : (
                  "Create Deal & Sign Agreement"
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}