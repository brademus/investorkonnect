import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Home, FileText, Handshake, DollarSign, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function NewDeal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useCurrentProfile();
  
  const dealId = searchParams.get("dealId");

  // Section 1: Property + Deal Info
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  // Section 2: Seller Info
  const [sellerName, setSellerName] = useState("");
  const [earnestMoney, setEarnestMoney] = useState("");
  const [numberOfSigners, setNumberOfSigners] = useState("1");
  const [secondSignerName, setSecondSignerName] = useState("");

  // Section 3: Proposed Terms
  const [sellerCommissionType, setSellerCommissionType] = useState("percentage");
  const [sellerCommissionPercentage, setSellerCommissionPercentage] = useState("");
  const [sellerFlatFee, setSellerFlatFee] = useState("");
  const [buyerCommissionType, setBuyerCommissionType] = useState("percentage");
  const [buyerCommissionPercentage, setBuyerCommissionPercentage] = useState("");
  const [buyerFlatFee, setBuyerFlatFee] = useState("");
  const [agreementLength, setAgreementLength] = useState("");

  // Property details (optional)
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [notes, setNotes] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [numberOfStories, setNumberOfStories] = useState("");
  const [hasBasement, setHasBasement] = useState("");
  const [county, setCounty] = useState("");

  // Load existing deal data if editing
  useEffect(() => {
    if (dealId && profile?.id) {
      const loadDealData = async () => {
        try {
          const deals = await base44.entities.Deal.filter({ id: dealId });
          if (deals.length > 0) {
            const deal = deals[0];
            
            setPropertyAddress(deal.property_address || "");
            setCity(deal.city || "");
            setState(deal.state || "");
            setZip(deal.zip || "");
            setCounty(deal.county || "");
            
            console.log('[NewDeal] Loaded county from deal:', deal.county);
            setPurchasePrice(deal.purchase_price?.toString() || "");
            setClosingDate(deal.key_dates?.closing_date || "");
            setContractDate(deal.key_dates?.contract_date || "");
            
            if (deal.seller_info) {
              setSellerName(deal.seller_info.seller_name || "");
              setEarnestMoney(deal.seller_info.earnest_money?.toString() || "");
              setNumberOfSigners(deal.seller_info.number_of_signers || "1");
              setSecondSignerName(deal.seller_info.second_signer_name || "");
            }
            
            setNotes(deal.notes || "");
            setSpecialNotes(deal.special_notes || "");
            setPropertyType(deal.property_type || "");
            
            if (deal.property_details) {
              setBeds(deal.property_details.beds?.toString() || "");
              setBaths(deal.property_details.baths?.toString() || "");
              setSqft(deal.property_details.sqft?.toString() || "");
              setYearBuilt(deal.property_details.year_built?.toString() || "");
              setNumberOfStories(deal.property_details.number_of_stories || "");
              setHasBasement(deal.property_details.has_basement || "");
            }
            
            // Load terms from Deal entity first, fallback to Room for backward compatibility
            let terms = deal.proposed_terms;
            
            // If not on Deal, try loading from Room (backward compatibility)
            if (!terms) {
              try {
                const rooms = await base44.entities.Room.filter({ deal_id: dealId });
                if (rooms.length > 0 && rooms[0].proposed_terms) {
                  terms = rooms[0].proposed_terms;
                  console.log('[NewDeal] Loaded terms from Room (backward compatibility):', terms);
                  
                  // Migrate: Save to Deal entity for future use
                  await base44.entities.Deal.update(dealId, { proposed_terms: terms });
                  console.log('[NewDeal] Migrated terms to Deal entity');
                }
              } catch (e) {
                console.error("Failed to load terms from Room:", e);
              }
            } else {
              console.log('[NewDeal] Loaded terms from Deal entity:', terms);
            }
            
            // Populate form fields if terms exist
            if (terms) {
              if (terms.seller_commission_type) {
                setSellerCommissionType(terms.seller_commission_type);
              }
              if (terms.seller_commission_percentage !== null && terms.seller_commission_percentage !== undefined) {
                setSellerCommissionPercentage(terms.seller_commission_percentage.toString());
              }
              if (terms.seller_flat_fee !== null && terms.seller_flat_fee !== undefined) {
                setSellerFlatFee(terms.seller_flat_fee.toString());
              }
              
              if (terms.buyer_commission_type) {
                setBuyerCommissionType(terms.buyer_commission_type);
              }
              if (terms.buyer_commission_percentage !== null && terms.buyer_commission_percentage !== undefined) {
                setBuyerCommissionPercentage(terms.buyer_commission_percentage.toString());
              }
              if (terms.buyer_flat_fee !== null && terms.buyer_flat_fee !== undefined) {
                setBuyerFlatFee(terms.buyer_flat_fee.toString());
              }
              
              if (terms.agreement_length !== null && terms.agreement_length !== undefined) {
                setAgreementLength(terms.agreement_length.toString());
              }
            }
          }
        } catch (error) {
          console.error("Failed to load deal:", error);
        }
      };
      loadDealData();
    }
  }, [dealId, profile?.id]);

  const handleContinue = async () => {
    // Validation - All fields required except special notes and county
    if (!propertyAddress.trim()) {
      toast.error("Please enter a property address");
      return;
    }
    if (!city.trim()) {
      toast.error("Please enter a city");
      return;
    }
    if (!state.trim()) {
      toast.error("Please enter a state");
      return;
    }
    if (!zip.trim()) {
      toast.error("Please enter a ZIP code");
      return;
    }
    if (!county.trim()) {
      toast.error("Please enter a county");
      return;
    }
    
    const cleanedPrice = String(purchasePrice || '').replace(/[$,\s]/g, '').trim();
    if (!cleanedPrice || isNaN(Number(cleanedPrice)) || Number(cleanedPrice) <= 0) {
      toast.error("Please enter a valid purchase price");
      return;
    }
    
    if (!closingDate) {
      toast.error("Please select a target closing date");
      return;
    }
    
    if (!sellerName.trim()) {
      toast.error("Please enter the seller name");
      return;
    }
    if (!earnestMoney.trim()) {
      toast.error("Please enter the earnest money amount");
      return;
    }
    
    if (sellerCommissionType === "percentage" && !sellerCommissionPercentage.trim()) {
      toast.error("Please enter the seller's agent commission percentage");
      return;
    }
    if (sellerCommissionType === "flat" && !sellerFlatFee.trim()) {
      toast.error("Please enter the seller's agent flat fee");
      return;
    }
    
    if (buyerCommissionType === "percentage" && !buyerCommissionPercentage.trim()) {
      toast.error("Please enter the buyer's agent commission percentage");
      return;
    }
    if (buyerCommissionType === "flat" && !buyerFlatFee.trim()) {
      toast.error("Please enter the buyer's agent flat fee");
      return;
    }
    
    if (!agreementLength.trim()) {
      toast.error("Please enter the agreement length");
      return;
    }

    // If editing existing deal, save all data to Deal entity immediately
    if (dealId) {
      try {
        console.log('[NewDeal] Updating deal with:', {
          county,
          seller_commission_type: sellerCommissionType,
          seller_flat_fee: sellerFlatFee,
          seller_commission_percentage: sellerCommissionPercentage
        });
        
        const updateData = {
          property_address: propertyAddress,
          city: city,
          state: state,
          zip: zip,
          county: county || null,
          purchase_price: Number(cleanedPrice),
          property_type: propertyType || null,
          notes: notes || null,
          special_notes: specialNotes || null,
          key_dates: {
            closing_date: closingDate,
            contract_date: contractDate || null
          },
          seller_info: {
            seller_name: sellerName,
            earnest_money: earnestMoney ? Number(earnestMoney) : null,
            number_of_signers: numberOfSigners,
            second_signer_name: secondSignerName || null
          },
          property_details: {
            beds: beds ? Number(beds) : null,
            baths: baths ? Number(baths) : null,
            sqft: sqft ? Number(sqft) : null,
            year_built: yearBuilt ? Number(yearBuilt) : null,
            number_of_stories: numberOfStories || null,
            has_basement: hasBasement || null
          },
          proposed_terms: {
            seller_commission_type: sellerCommissionType,
            seller_commission_percentage: sellerCommissionPercentage ? Number(sellerCommissionPercentage) : null,
            seller_flat_fee: sellerFlatFee ? Number(sellerFlatFee) : null,
            buyer_commission_type: buyerCommissionType,
            buyer_commission_percentage: buyerCommissionPercentage ? Number(buyerCommissionPercentage) : null,
            buyer_flat_fee: buyerFlatFee ? Number(buyerFlatFee) : null,
            agreement_length: agreementLength ? Number(agreementLength) : null
          }
        };
        
        await base44.entities.Deal.update(dealId, updateData);
        
        console.log('[NewDeal] ✅ Deal updated successfully');
        toast.success('Deal updated successfully');
        
        // Also update Room if it exists
        const rooms = await base44.entities.Room.filter({ deal_id: dealId });
        if (rooms.length > 0) {
          await base44.entities.Room.update(rooms[0].id, {
            property_address: propertyAddress,
            city: city,
            state: state,
            county: county || null,
            zip: zip,
            budget: Number(cleanedPrice),
            closing_date: closingDate,
            proposed_terms: {
              seller_commission_type: sellerCommissionType,
              seller_commission_percentage: sellerCommissionPercentage ? Number(sellerCommissionPercentage) : null,
              seller_flat_fee: sellerFlatFee ? Number(sellerFlatFee) : null,
              buyer_commission_type: buyerCommissionType,
              buyer_commission_percentage: buyerCommissionPercentage ? Number(buyerCommissionPercentage) : null,
              buyer_flat_fee: buyerFlatFee ? Number(buyerFlatFee) : null,
              agreement_length: agreementLength ? Number(agreementLength) : null
            }
          });
          console.log('[NewDeal] ✅ Room synced successfully');
        }
      } catch (e) {
        console.error("Failed to update deal:", e);
        toast.error('Failed to update deal: ' + e.message);
        return;
      }
    }

    // Save to sessionStorage - include dealId if editing
    sessionStorage.setItem("newDealDraft", JSON.stringify({
      dealId: dealId || null,
      propertyAddress,
      city,
      state,
      zip,
      county,
      purchasePrice,
      closingDate,
      contractDate,
      specialNotes,
      sellerName,
      earnestMoney,
      numberOfSigners,
      secondSignerName,
      sellerCommissionType,
      sellerCommissionPercentage,
      sellerFlatFee,
      buyerCommissionType,
      buyerCommissionPercentage,
      buyerFlatFee,
      agreementLength,
      beds,
      baths,
      sqft,
      propertyType,
      notes,
      yearBuilt,
      numberOfStories,
      hasBasement
    }));

    // Navigate with dealId if editing
    if (dealId) {
      navigate(`${createPageUrl("ContractVerify")}?dealId=${dealId}`);
    } else {
      navigate(createPageUrl("ContractVerify"));
    }
  };

  if (loading) {
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
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Build Your Deal</h1>
          <p className="text-sm text-[#808080]">Enter your deal details in 3 simple sections</p>
        </div>

        {/* Section 1: Property + Deal Info */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
              <Home className="w-6 h-6 text-[#E3C567]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">1. Property & Deal Info</h2>
              <p className="text-sm text-[#808080]">Basic details about the property</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                Property Address *
              </label>
              <Input
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main Street"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">City *</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Phoenix"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">State *</label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="AZ"
                  maxLength={2}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">County *</label>
                <Input
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="Maricopa"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">ZIP *</label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="85001"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Purchase Price *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                  <Input
                    type="text"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="250000"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Target Closing Date *</label>
                <Input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Special Notes</label>
              <Textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any additional comments or special conditions..."
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Seller Info */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#60A5FA]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">2. Seller Information</h2>
              <p className="text-sm text-[#808080]">Details about the seller and transaction</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Seller / Owner Name *</label>
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="John Doe"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Earnest Money *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                <Input
                  type="text"
                  value={earnestMoney}
                  onChange={(e) => setEarnestMoney(e.target.value)}
                  placeholder="5000"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Number of Signers *</label>
              <Select value={numberOfSigners} onValueChange={setNumberOfSigners}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Signer</SelectItem>
                  <SelectItem value="2">2 Signers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {numberOfSigners === "2" && (
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Second Signer Name *</label>
                <Input
                  value={secondSignerName}
                  onChange={(e) => setSecondSignerName(e.target.value)}
                  placeholder="Jane Doe"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Proposed Terms */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#34D399]/20 rounded-full flex items-center justify-center">
              <Handshake className="w-6 h-6 text-[#34D399]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">3. Proposed Agreement Terms</h2>
              <p className="text-sm text-[#808080]">Set commission structure for both agents</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Seller's Agent */}
            <div className="border-b border-[#1F1F1F] pb-6">
              <h3 className="text-lg font-semibold text-[#E3C567] mb-4">Seller's Agent Commission</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission Type *</label>
                  <Select value={sellerCommissionType} onValueChange={setSellerCommissionType}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Purchase Price</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sellerCommissionType === "percentage" ? (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission % *</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={sellerCommissionPercentage}
                        onChange={(e) => setSellerCommissionPercentage(e.target.value)}
                        placeholder="3.0"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] text-sm">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Flat Fee *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                      <Input
                        type="number"
                        value={sellerFlatFee}
                        onChange={(e) => setSellerFlatFee(e.target.value)}
                        placeholder="5000"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Buyer's Agent */}
            <div className="border-b border-[#1F1F1F] pb-6">
              <h3 className="text-lg font-semibold text-[#60A5FA] mb-4">Buyer's Agent Commission</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission Type *</label>
                  <Select value={buyerCommissionType} onValueChange={setBuyerCommissionType}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Purchase Price</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {buyerCommissionType === "percentage" ? (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission % *</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={buyerCommissionPercentage}
                        onChange={(e) => setBuyerCommissionPercentage(e.target.value)}
                        placeholder="3.0"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] text-sm">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Flat Fee *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                      <Input
                        type="number"
                        value={buyerFlatFee}
                        onChange={(e) => setBuyerFlatFee(e.target.value)}
                        placeholder="5000"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agreement Length */}
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Agreement Length (Days) *</label>
              <Input
                type="number"
                value={agreementLength}
                onChange={(e) => setAgreementLength(e.target.value)}
                placeholder="90"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
              <p className="text-xs text-[#808080] mt-2">How long will this agreement remain active?</p>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleContinue}
            className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 font-semibold"
          >
            Continue to Contract Verification
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}