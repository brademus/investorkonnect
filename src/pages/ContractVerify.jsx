import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { validatePDF } from "@/components/utils/fileValidation";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import LoadingAnimation from "@/components/LoadingAnimation";

export default function ContractVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentProfile();
  
  const dealIdFromUrl = searchParams.get("dealId");
  
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dealData, setDealData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      // Load deal data from sessionStorage
      const stored = sessionStorage.getItem("newDealDraft");
      if (!stored) {
        toast.error("No deal data found. Please start from Build Your Deal.");
        navigate(createPageUrl("NewDeal"));
        return;
      }
      
      try {
        const parsed = JSON.parse(stored);
        
        // If this is an existing deal, load proposed terms from Room
        const existingDealId = dealIdFromUrl || parsed.dealId;
        if (existingDealId) {
          try {
            const rooms = await base44.entities.Room.filter({ deal_id: existingDealId });
            if (rooms.length > 0 && rooms[0].proposed_terms) {
              const terms = rooms[0].proposed_terms;
              console.log('[ContractVerify] Loading existing proposed terms:', terms);
              
              // Merge terms into parsed deal data
              parsed.sellerCommissionType = terms.seller_commission_type || parsed.sellerCommissionType;
              parsed.sellerCommissionPercentage = terms.seller_commission_percentage !== null && terms.seller_commission_percentage !== undefined 
                ? terms.seller_commission_percentage 
                : parsed.sellerCommissionPercentage;
              parsed.sellerFlatFee = terms.seller_flat_fee !== null && terms.seller_flat_fee !== undefined
                ? terms.seller_flat_fee
                : parsed.sellerFlatFee;
              
              parsed.buyerCommissionType = terms.buyer_commission_type || parsed.buyerCommissionType;
              parsed.buyerCommissionPercentage = terms.buyer_commission_percentage !== null && terms.buyer_commission_percentage !== undefined
                ? terms.buyer_commission_percentage
                : parsed.buyerCommissionPercentage;
              parsed.buyerFlatFee = terms.buyer_flat_fee !== null && terms.buyer_flat_fee !== undefined
                ? terms.buyer_flat_fee
                : parsed.buyerFlatFee;
              
              parsed.agreementLength = terms.agreement_length !== null && terms.agreement_length !== undefined
                ? terms.agreement_length
                : parsed.agreementLength;
            }
          } catch (e) {
            console.log('[ContractVerify] No existing room terms to load');
          }
        }
        
        setDealData(parsed);
        
        // Check if contract already uploaded
        if (parsed.contractFileUrl) {
          setFileUrl(parsed.contractFileUrl);
          setFileName(parsed.contractFileName || "Contract.pdf");
        }
      } catch (e) {
        toast.error("Invalid deal data");
        navigate(createPageUrl("NewDeal"));
      }
    };
    
    loadData();
  }, [navigate, dealIdFromUrl]);

  const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeName = (name) => {
    if (!name) return '';
    let normalized = normalizeString(name);
    // Remove common business suffixes
    normalized = normalized
      .replace(/\b(llc|inc|ltd|co|corp|corporation|company)\b/gi, '')
      .trim();
    return normalized;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const validation = validatePDF(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    setVerified(false);
    setErrors([]);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      setFileName(file.name);
      
      // Update sessionStorage
      const updated = { ...dealData, contractFileUrl: file_url, contractFileName: file.name };
      sessionStorage.setItem("newDealDraft", JSON.stringify(updated));
      setDealData(updated);
      
      toast.success("Contract uploaded. Click Verify to check details.");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload contract");
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!fileUrl) {
      toast.error("Please upload a contract first");
      return;
    }

    setVerifying(true);
    setErrors([]);

    try {
      // Extract contract data
      const extractRes = await base44.functions.invoke('extractContractData', {
        fileUrl: fileUrl
      });

      if (!extractRes.data?.success || !extractRes.data.data) {
        throw new Error("Failed to extract data from contract");
      }

      const extracted = extractRes.data.data;
      const validationErrors = [];

      // Verify address (normalized comparison)
      if (dealData.propertyAddress && extracted.address) {
        const inputAddr = normalizeString(dealData.propertyAddress);
        const extractedAddr = normalizeString(extracted.address);
        const inputStreet = inputAddr.split(',')[0].trim();
        const extractedStreet = extractedAddr.split(',')[0].trim();
        
        if (!extractedAddr.includes(inputStreet) && !inputAddr.includes(extractedStreet)) {
          validationErrors.push(`Address mismatch: You entered "${dealData.propertyAddress}" but contract shows "${extracted.address}"`);
        }
      }

      // Verify state (exact match, case-insensitive)
      if (dealData.state && extracted.state) {
        if (dealData.state.toLowerCase() !== extracted.state.toLowerCase()) {
          validationErrors.push(`State mismatch: You entered "${dealData.state}" but contract shows "${extracted.state}"`);
        }
      }

      // Verify purchase price (5% tolerance)
      if (dealData.purchasePrice && extracted.purchase_price) {
        const inputPrice = Number(String(dealData.purchasePrice).replace(/[$,\s]/g, ''));
        const contractPrice = Number(String(extracted.purchase_price).replace(/[$,\s]/g, ''));
        const diff = Math.abs(inputPrice - contractPrice);
        const tolerance = inputPrice * 0.05;
        
        if (diff > tolerance) {
          validationErrors.push(`Price mismatch: You entered $${inputPrice.toLocaleString()} but contract shows $${contractPrice.toLocaleString()}`);
        }
      }

      // Verify closing date (normalized YYYY-MM-DD)
      if (dealData.closingDate && extracted.key_dates?.closing_date) {
        const inputDate = new Date(dealData.closingDate).toISOString().split('T')[0];
        const contractDate = new Date(extracted.key_dates.closing_date).toISOString().split('T')[0];
        
        if (inputDate !== contractDate) {
          validationErrors.push(`Closing date mismatch: You entered ${dealData.closingDate} but contract shows ${extracted.key_dates.closing_date}`);
        }
      }

      // NEW: Verify seller name
      if (dealData.sellerName && extracted.seller_info?.seller_name) {
        const inputName = normalizeName(dealData.sellerName);
        const extractedName = normalizeName(extracted.seller_info.seller_name);
        
        // Check exact match or strong containment
        const isMatch = 
          inputName === extractedName ||
          (inputName.length >= 3 && extractedName.includes(inputName)) ||
          (extractedName.length >= 3 && inputName.includes(extractedName));
        
        if (!isMatch) {
          validationErrors.push(`Seller name mismatch: You entered "${dealData.sellerName}" but contract shows "${extracted.seller_info.seller_name}"`);
        }
      }

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        toast.error("Contract verification failed");
      } else {
        setVerified(true);
        toast.success("Contract verified successfully!");
      }

    } catch (error) {
      console.error("Verification failed:", error);
      toast.error("Failed to verify contract");
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!verified) {
      toast.error("Please verify your contract first");
      return;
    }

    try {
      const cleanedPrice = String(dealData.purchasePrice).replace(/[$,\s]/g, '');
      const cleanedEarnestMoney = dealData.earnestMoney ? String(dealData.earnestMoney).replace(/[$,\s]/g, '') : null;

      const contractDocument = {
        url: fileUrl,
        name: fileName,
        type: "contract",
        uploaded_at: new Date().toISOString()
      };

      const dealPayload = {
        investor_id: profile.id,
        title: dealData.propertyAddress,
        property_address: dealData.propertyAddress,
        city: dealData.city,
        state: dealData.state,
        county: dealData.county || "",
        zip: dealData.zip,
        purchase_price: Number(cleanedPrice),
        property_type: dealData.propertyType,
        notes: dealData.notes,
        special_notes: dealData.specialNotes,
        property_details: {
          beds: dealData.beds ? Number(dealData.beds) : undefined,
          baths: dealData.baths ? Number(dealData.baths) : undefined,
          sqft: dealData.sqft ? Number(dealData.sqft) : undefined,
          year_built: dealData.yearBuilt ? Number(dealData.yearBuilt) : undefined,
          number_of_stories: dealData.numberOfStories,
          has_basement: dealData.hasBasement
        },
        seller_info: {
          seller_name: dealData.sellerName,
          earnest_money: cleanedEarnestMoney ? Number(cleanedEarnestMoney) : undefined,
          number_of_signers: dealData.numberOfSigners,
          second_signer_name: dealData.secondSignerName
        },
        key_dates: {
          closing_date: dealData.closingDate,
          contract_date: dealData.contractDate
        },
        contract_url: fileUrl,
        contract_document: contractDocument,
        status: 'active',
        pipeline_stage: 'new_listings'
      };

      // Determine dealId - from URL, from dealData, or will create new
      const existingDealId = dealIdFromUrl || dealData.dealId;
      
      let finalDealId;
      
      if (existingDealId) {
        // UPDATE existing deal
        await base44.entities.Deal.update(existingDealId, dealPayload);
        finalDealId = existingDealId;
        toast.success("Deal updated successfully!");
      } else {
        // CREATE new deal
        const deal = await base44.entities.Deal.create(dealPayload);
        finalDealId = deal.id;
        toast.success("Deal created successfully!");
      }

      // Always save proposed terms to Room entity (for both new and existing deals with rooms)
      try {
        const existingRooms = await base44.entities.Room.filter({ deal_id: finalDealId });
        if (existingRooms.length > 0) {
          // Update existing room with proposed terms
          await base44.entities.Room.update(existingRooms[0].id, {
            proposed_terms: {
              seller_commission_type: dealData.sellerCommissionType || "percentage",
              seller_commission_percentage: dealData.sellerCommissionPercentage ? Number(dealData.sellerCommissionPercentage) : null,
              seller_flat_fee: dealData.sellerFlatFee ? Number(dealData.sellerFlatFee) : null,
              buyer_commission_type: dealData.buyerCommissionType || "percentage",
              buyer_commission_percentage: dealData.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
              buyer_flat_fee: dealData.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
              agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null
            }
          });
        }
      } catch (e) {
        console.log("No existing room to update terms");
      }
      
      // Store deal ID and terms for agent matching (for new deals)
      sessionStorage.setItem("createdDealId", finalDealId);
      sessionStorage.setItem("newDealData", JSON.stringify({
        sellerCommissionType: dealData.sellerCommissionType,
        sellerCommissionPercentage: dealData.sellerCommissionPercentage,
        sellerFlatFee: dealData.sellerFlatFee,
        buyerCommissionType: dealData.buyerCommissionType,
        buyerCommissionPercentage: dealData.buyerCommissionPercentage,
        buyerFlatFee: dealData.buyerFlatFee,
        agreementLength: dealData.agreementLength
      }));

      navigate(createPageUrl("AgentMatching") + `?dealId=${finalDealId}`);

    } catch (error) {
      console.error("Failed to save deal:", error);
      toast.error("Failed to save deal: " + (error.message || 'Unknown error'));
    }
  };

  if (!dealData) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              const editDealId = dealIdFromUrl || dealData?.dealId;
              navigate(editDealId ? `${createPageUrl("NewDeal")}?dealId=${editDealId}` : createPageUrl("NewDeal"));
            }}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Deal Details
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Verify Contract</h1>
          <p className="text-sm text-[#808080]">Upload and verify your purchase agreement</p>
        </div>

        {/* Verification Errors */}
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Verification Failed
            </h3>
            <ul className="space-y-2 mb-4">
              {errors.map((error, idx) => (
                <li key={idx} className="text-red-300 text-sm flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => navigate(createPageUrl("NewDeal"))}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back to Fix Details
            </Button>
          </div>
        )}

        {/* Success State */}
        {verified && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-green-400 font-semibold">Contract Verified!</h3>
                <p className="text-green-300/70 text-sm">All details match your input</p>
              </div>
            </div>
            <Button
              onClick={handleCreateDeal}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
            >
              {dealIdFromUrl || dealData?.dealId ? 'Update Deal & Continue' : 'Create Deal & Find Agents'}
            </Button>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#E3C567]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">Purchase Agreement</h2>
              <p className="text-sm text-[#808080]">PDF format only (max 15MB)</p>
            </div>
          </div>

          {uploading || verifying ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingAnimation className="w-32 h-32 mb-4" />
              <p className="text-sm font-medium text-[#808080]">
                {uploading ? "Uploading contract..." : "Verifying contract details..."}
              </p>
            </div>
          ) : fileUrl ? (
            <div className="space-y-4">
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#E3C567]" />
                  <div>
                    <p className="text-sm font-medium text-[#FAFAFA]">{fileName}</p>
                    <p className="text-xs text-[#808080]">Uploaded</p>
                  </div>
                </div>
                <label className="cursor-pointer text-sm text-[#E3C567] hover:text-[#EDD89F]">
                  Replace
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {!verified && (
                <Button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Verify Contract
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#1F1F1F] rounded-xl p-8 text-center hover:border-[#E3C567]/50 transition-colors">
              <div className="w-16 h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#E3C567]" />
              </div>
              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">Upload Purchase Agreement</h3>
              <p className="text-sm text-[#808080] mb-6">Select your PDF contract file</p>
              <label className="cursor-pointer bg-[#E3C567] hover:bg-[#EDD89F] text-black px-6 py-3 rounded-full font-semibold inline-flex items-center gap-2 transition-colors">
                <FileText className="w-5 h-5" />
                Select PDF
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          <div className="mt-6 bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
            <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">We'll verify:</h4>
            <ul className="space-y-2 text-sm text-[#808080]">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Property address matches
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Purchase price is accurate (5% tolerance)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Closing date aligns
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                State/location is correct
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Seller name matches
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}