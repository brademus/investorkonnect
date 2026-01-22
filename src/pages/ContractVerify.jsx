import React, { useState, useEffect } from "react";
import { StepGuard } from "@/components/StepGuard";
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
  const { profile, user } = useCurrentProfile();
  const isNameLocked = Boolean(
    profile?.verified_first_name ||
    profile?.verified_last_name ||
    profile?.identity_verified_at ||
    profile?.kyc_status === 'approved' ||
    profile?.identity_status === 'verified'
  );
  
  const dealIdFromUrl = searchParams.get("dealId");
  
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dealData, setDealData] = useState(null);
  const [buyerErrorInfo, setBuyerErrorInfo] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      // If editing existing deal, load directly from Deal entity
      const existingDealId = dealIdFromUrl;
      if (existingDealId) {
        try {
          const deals = await base44.entities.Deal.filter({ id: existingDealId });
          if (deals.length > 0) {
            const deal = deals[0];
            
            // Build dealData from Deal entity (same structure as sessionStorage)
            const loadedData = {
              dealId: deal.id,
              propertyAddress: deal.property_address || "",
              city: deal.city || "",
              state: deal.state || "",
              zip: deal.zip || "",
              county: deal.county || "",
              purchasePrice: deal.purchase_price?.toString() || "",
              closingDate: deal.key_dates?.closing_date || "",
              contractDate: deal.key_dates?.contract_date || "",
              specialNotes: deal.special_notes || "",
              sellerName: deal.seller_info?.seller_name || "",
              earnestMoney: deal.seller_info?.earnest_money?.toString() || "",
              numberOfSigners: deal.seller_info?.number_of_signers || "1",
              secondSignerName: deal.seller_info?.second_signer_name || "",
              sellerCommissionType: deal.proposed_terms?.seller_commission_type || "percentage",
              sellerCommissionPercentage: deal.proposed_terms?.seller_commission_percentage?.toString() || "",
              sellerFlatFee: deal.proposed_terms?.seller_flat_fee?.toString() || "",
              buyerCommissionType: deal.proposed_terms?.buyer_commission_type || "percentage",
              buyerCommissionPercentage: deal.proposed_terms?.buyer_commission_percentage?.toString() || "",
              buyerFlatFee: deal.proposed_terms?.buyer_flat_fee?.toString() || "",
              agreementLength: deal.proposed_terms?.agreement_length?.toString() || "",
              beds: deal.property_details?.beds?.toString() || "",
              baths: deal.property_details?.baths?.toString() || "",
              sqft: deal.property_details?.sqft?.toString() || "",
              propertyType: deal.property_type || "",
              notes: deal.notes || "",
              yearBuilt: deal.property_details?.year_built?.toString() || "",
              numberOfStories: deal.property_details?.number_of_stories || "",
              hasBasement: deal.property_details?.has_basement || "",
              contractFileUrl: deal.contract_url || "",
              contractFileName: deal.contract_document?.name || "Contract.pdf"
            };
            
            console.log('[ContractVerify] Loaded existing deal from DB:', loadedData);
            setDealData(loadedData);
            
            if (loadedData.contractFileUrl) {
              setFileUrl(loadedData.contractFileUrl);
              setFileName(loadedData.contractFileName);
            }
            return;
          }
        } catch (e) {
          console.error('[ContractVerify] Failed to load existing deal:', e);
        }
      }
      
      // Otherwise load from sessionStorage (new deal flow)
      const stored = sessionStorage.getItem("newDealDraft");
      if (!stored) {
        toast.error("No deal data found. Please start from Build Your Deal.");
        navigate(createPageUrl("NewDeal"));
        return;
      }
      
      try {
        const parsed = JSON.parse(stored);
        console.log('[ContractVerify] Loaded from sessionStorage:', parsed);
        setDealData(parsed);
        
        if (parsed.contractFileUrl) {
          setFileUrl(parsed.contractFileUrl);
          setFileName(parsed.contractFileName || "Contract.pdf");
        }
      } catch (e) {
        console.error('[ContractVerify] Error loading data:', e);
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

      // New: Buyer name verification (additive only)
      const verifiedFullFromProfile = [profile?.verified_first_name, profile?.verified_last_name].filter(Boolean).join(' ').trim();
      const fallbackOnboardingFull = [profile?.onboarding_first_name, profile?.onboarding_last_name].filter(Boolean).join(' ').trim();
      const expectedBuyerRaw = (verifiedFullFromProfile || profile?.full_name || fallbackOnboardingFull || user?.full_name || '').trim();
      const expectedBuyerCompany = (profile?.company || profile?.investor?.company_name || '').trim();

      const normalizeForCompare = (s) => {
        if (!s) return '';
        return s.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
          .replace(/\b(llc|inc|ltd|co|corp|corporation|company|jr|sr|ii|iii|iv)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const expectedBuyerNorm = normalizeForCompare(expectedBuyerRaw);
      const expectedCompanyNorm = normalizeForCompare(expectedBuyerCompany);
      const contractBuyerRaw = extracted?.buyer_name_raw || extracted?.buyer_name || null;
      const contractBuyerNorm = extracted?.buyer_name_normalized || normalizeForCompare(contractBuyerRaw || '');

      let buyerNameStatus = 'UNKNOWN';
      let buyerNameReason = '';

      if (!contractBuyerNorm) {
        buyerNameStatus = 'UNKNOWN';
        buyerNameReason = "We couldn’t confidently find the buyer name in this contract.";
        validationErrors.push(`Buyer name missing: ${buyerNameReason}`);
      } else {
        const nameMatch = expectedBuyerNorm && (expectedBuyerNorm === contractBuyerNorm || contractBuyerNorm.includes(expectedBuyerNorm) || expectedBuyerNorm.includes(contractBuyerNorm));
        const companyMatch = expectedCompanyNorm && (expectedCompanyNorm === contractBuyerNorm || contractBuyerNorm.includes(expectedCompanyNorm) || expectedCompanyNorm.includes(contractBuyerNorm));

        if (nameMatch || companyMatch) {
          buyerNameStatus = 'PASS';
        } else {
          buyerNameStatus = 'FAIL';
          buyerNameReason = "The buyer name on the uploaded contract doesn’t match the name on your account.";
          validationErrors.push(`Buyer name doesn’t match: Account="${expectedBuyerRaw || 'Unknown'}" vs Contract="${contractBuyerRaw || 'Unknown'}"`);
        }
      }

      setBuyerErrorInfo({
        status: buyerNameStatus,
        expectedName: expectedBuyerRaw || null,
        contractBuyerName: contractBuyerRaw || null,
        reason: buyerNameReason || null
      });
      console.log('[Verification] Comparing entered data vs extracted:', {
        entered: dealData,
        extracted: extracted
      });

      // 1. Verify property address (normalized comparison)
      if (dealData.propertyAddress && extracted.address) {
        const inputAddr = normalizeString(dealData.propertyAddress);
        const extractedAddr = normalizeString(extracted.address);
        const inputStreet = inputAddr.split(',')[0].trim();
        const extractedStreet = extractedAddr.split(',')[0].trim();
        
        if (!extractedAddr.includes(inputStreet) && !inputAddr.includes(extractedStreet)) {
          validationErrors.push(`❌ Address: You entered "${dealData.propertyAddress}" but contract shows "${extracted.address}"`);
        } else {
          console.log('✅ Address matches');
        }
      }

      // 2. Verify city
      if (dealData.city && extracted.city) {
        const inputCity = normalizeString(dealData.city);
        const extractedCity = normalizeString(extracted.city);
        if (inputCity !== extractedCity) {
          validationErrors.push(`❌ City: You entered "${dealData.city}" but contract shows "${extracted.city}"`);
        } else {
          console.log('✅ City matches');
        }
      }

      // 3. Verify state (exact match, case-insensitive)
      if (dealData.state && extracted.state) {
        if (dealData.state.toUpperCase() !== extracted.state.toUpperCase()) {
          validationErrors.push(`❌ State: You entered "${dealData.state}" but contract shows "${extracted.state}"`);
        } else {
          console.log('✅ State matches');
        }
      }

      // 4. Verify ZIP code
      if (dealData.zip && extracted.zip) {
        const inputZip = String(dealData.zip).replace(/\D/g, ''); // Remove non-digits
        const extractedZip = String(extracted.zip).replace(/\D/g, '');
        if (inputZip !== extractedZip) {
          validationErrors.push(`❌ ZIP Code: You entered "${dealData.zip}" but contract shows "${extracted.zip}"`);
        } else {
          console.log('✅ ZIP code matches');
        }
      }

      // 5. Verify county
      if (dealData.county && extracted.county) {
        const inputCounty = normalizeString(dealData.county);
        const extractedCounty = normalizeString(extracted.county);
        if (!extractedCounty.includes(inputCounty) && !inputCounty.includes(extractedCounty)) {
          validationErrors.push(`❌ County: You entered "${dealData.county}" but contract shows "${extracted.county}"`);
        } else {
          console.log('✅ County matches');
        }
      }

      // 6. Verify purchase price (CRITICAL - strict 2% tolerance)
      if (dealData.purchasePrice && extracted.purchase_price) {
        const inputPrice = Number(String(dealData.purchasePrice).replace(/[$,\s]/g, ''));
        const contractPrice = Number(String(extracted.purchase_price).replace(/[$,\s]/g, ''));
        const diff = Math.abs(inputPrice - contractPrice);
        const tolerance = inputPrice * 0.02; // 2% tolerance for OCR/formatting errors
        
        console.log('[Verification] Purchase price:', {
          entered: inputPrice,
          contract: contractPrice,
          diff: diff,
          tolerance: tolerance,
          percentDiff: ((diff / inputPrice) * 100).toFixed(2) + '%'
        });
        
        if (diff > tolerance) {
          validationErrors.push(`❌ Purchase Price: You entered $${inputPrice.toLocaleString()} but contract shows $${contractPrice.toLocaleString()} (difference: $${diff.toLocaleString()})`);
        } else {
          console.log('✅ Purchase price matches (within 2% tolerance)');
        }
      }

      // 7. Verify earnest money (10% tolerance for smaller amounts)
      if (dealData.earnestMoney && extracted.seller_info?.earnest_money) {
        const inputEM = Number(String(dealData.earnestMoney).replace(/[$,\s]/g, ''));
        const contractEM = Number(String(extracted.seller_info.earnest_money).replace(/[$,\s]/g, ''));
        const diff = Math.abs(inputEM - contractEM);
        const tolerance = Math.max(inputEM * 0.10, 100); // 10% or $100 minimum
        
        console.log('[Verification] Earnest money:', {
          entered: inputEM,
          contract: contractEM,
          diff: diff,
          tolerance: tolerance
        });
        
        if (diff > tolerance) {
          validationErrors.push(`❌ Earnest Money: You entered $${inputEM.toLocaleString()} but contract shows $${contractEM.toLocaleString()}`);
        } else {
          console.log('✅ Earnest money matches');
        }
      }

      // 8. Verify seller name
      if (dealData.sellerName && extracted.seller_info?.seller_name) {
        const inputName = normalizeName(dealData.sellerName);
        const extractedName = normalizeName(extracted.seller_info.seller_name);
        
        const isMatch = 
          inputName === extractedName ||
          (inputName.length >= 3 && extractedName.includes(inputName)) ||
          (extractedName.length >= 3 && inputName.includes(extractedName));
        
        console.log('[Verification] Seller name:', {
          entered: dealData.sellerName,
          contract: extracted.seller_info.seller_name,
          normalized_entered: inputName,
          normalized_contract: extractedName,
          match: isMatch
        });
        
        if (!isMatch) {
          validationErrors.push(`❌ Seller Name: You entered "${dealData.sellerName}" but contract shows "${extracted.seller_info.seller_name}"`);
        } else {
          console.log('✅ Seller name matches');
        }
      }

      // 9. Verify closing date (normalized YYYY-MM-DD)
      if (dealData.closingDate && extracted.key_dates?.closing_date) {
        try {
          const inputDate = new Date(dealData.closingDate).toISOString().split('T')[0];
          const contractDate = new Date(extracted.key_dates.closing_date).toISOString().split('T')[0];
          
          console.log('[Verification] Closing date:', {
            entered: dealData.closingDate,
            contract: extracted.key_dates.closing_date,
            normalized_entered: inputDate,
            normalized_contract: contractDate
          });
          
          if (inputDate !== contractDate) {
            validationErrors.push(`❌ Closing Date: You entered ${dealData.closingDate} but contract shows ${extracted.key_dates.closing_date}`);
          } else {
            console.log('✅ Closing date matches');
          }
        } catch (e) {
          console.warn('[Verification] Could not parse closing date:', e);
        }
      }

      // 10. Verify contract date if entered
      if (dealData.contractDate && extracted.key_dates?.contract_date) {
        try {
          const inputDate = new Date(dealData.contractDate).toISOString().split('T')[0];
          const contractDate = new Date(extracted.key_dates.contract_date).toISOString().split('T')[0];
          
          console.log('[Verification] Contract date:', {
            entered: dealData.contractDate,
            contract: extracted.key_dates.contract_date
          });
          
          if (inputDate !== contractDate) {
            validationErrors.push(`❌ Contract Date: You entered ${dealData.contractDate} but contract shows ${extracted.key_dates.contract_date}`);
          } else {
            console.log('✅ Contract date matches');
          }
        } catch (e) {
          console.warn('[Verification] Could not parse contract date:', e);
        }
      }

      console.log('[Verification] Validation complete:', {
        totalErrors: validationErrors.length,
        errors: validationErrors
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        toast.error("Contract verification failed");
      } else {
        setVerified(true);
        toast.success("Contract verified successfully!");
      }

      // Persist additive result on session (no schema changes) for downstream UI if needed
      try {
        const draft = JSON.parse(sessionStorage.getItem('newDealDraft') || '{}');
        draft.__verificationResult = {
          ...(draft.__verificationResult || {}),
          buyerNameCheck: {
            status: buyerNameStatus,
            expectedName: expectedBuyerRaw || null,
            contractBuyerName: contractBuyerRaw || null,
            reason: buyerNameReason || null
          }
        };
        sessionStorage.setItem('newDealDraft', JSON.stringify(draft));
      } catch (_) {}
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
        county: dealData.county,
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
        proposed_terms: {
          seller_commission_type: dealData.sellerCommissionType || "percentage",
          seller_commission_percentage: dealData.sellerCommissionPercentage ? Number(dealData.sellerCommissionPercentage) : null,
          seller_flat_fee: dealData.sellerFlatFee ? Number(dealData.sellerFlatFee) : null,
          buyer_commission_type: dealData.buyerCommissionType || "percentage",
          buyer_commission_percentage: dealData.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
          buyer_flat_fee: dealData.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
          agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null
        },
        contract_url: fileUrl,
        contract_document: contractDocument,
        status: 'draft',
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

      // Also update Room entity if it exists (for backward compatibility)
      try {
        const existingRooms = await base44.entities.Room.filter({ deal_id: finalDealId });
        if (existingRooms.length > 0) {
          await base44.entities.Room.update(existingRooms[0].id, {
            proposed_terms: dealPayload.proposed_terms
          });
        }
      } catch (e) {
        console.log("No existing room to sync terms");
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
    <StepGuard requiredStep={6}>
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
            {/* Buyer name mismatch helper UI (inline) */}
            <div className="mb-4 text-xs text-red-300">
              If the buyer name doesn’t match your account:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Re-upload the correct contract with your name listed as the buyer</li>
                {!isNameLocked && (
                  <li>Or update your profile name, then retry verification</li>
                )}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button
                  onClick={() => document.querySelector('input[type=file][accept=\"application/pdf\"]').click()}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full h-8 px-3 text-xs"
                >
                  Re-upload contract
                </Button>
                {!isNameLocked && (
                  <Button
                    onClick={() => navigate(createPageUrl('AccountProfile'))}
                    variant="outline"
                    className="rounded-full h-8 px-3 text-xs"
                  >
                    Edit my name
                  </Button>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                const editDealId = dealIdFromUrl || dealData?.dealId;
                if (editDealId) {
                  navigate(`${createPageUrl("NewDeal")}?dealId=${editDealId}&fromVerify=1`);
                } else {
                  navigate(`${createPageUrl("NewDeal")}?fromVerify=1`);
                }
              }}
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
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Earnest money amount (10% tolerance)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                Contract date (if entered)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </StepGuard>
  );
}