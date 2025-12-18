import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Home, Bed, Bath, Maximize2, DollarSign, Calendar, User, FileText, Handshake } from "lucide-react";
import { toast } from "sonner";

export default function NewDeal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useCurrentProfile();
  
  // Get dealId if editing
  const dealId = searchParams.get("dealId");

  // Deal Basics
  const [propertyAddress, setPropertyAddress] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [closingDate, setClosingDate] = useState("");

  // Property Details
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [notes, setNotes] = useState("");

  // Agreement Terms
  const [commissionType, setCommissionType] = useState("percentage");
  const [commissionPercentage, setCommissionPercentage] = useState("");
  const [flatFee, setFlatFee] = useState("");
  const [agreementLength, setAgreementLength] = useState("");

  // Load existing deal data if editing
  useEffect(() => {
    if (dealId && profile?.id) {
      const loadDealData = async () => {
        try {
          const deals = await base44.entities.Deal.filter({ id: dealId });
          if (deals.length > 0) {
            const deal = deals[0];
            // Populate form with existing data
            setPropertyAddress(deal.property_address || "");
            setPurchasePrice(deal.purchase_price?.toString() || "");
            setClosingDate(deal.key_dates?.closing_date || "");
            setNotes(deal.notes || "");
            // Add other fields as they exist in your Deal entity
          }
        } catch (error) {
          console.error("Failed to load deal:", error);
        }
      };
      loadDealData();
    }
  }, [dealId, profile?.id]);

  const handleContinue = () => {
    // Validation
    if (!propertyAddress.trim()) {
      toast.error("Please enter a property address");
      return;
    }
    if (!purchasePrice || isNaN(Number(purchasePrice))) {
      toast.error("Please enter a valid purchase price");
      return;
    }
    if (!closingDate) {
      toast.error("Please select a target closing date");
      return;
    }

    // Store deal data in sessionStorage to pass to verification
    const dealData = {
      // Deal Basics
      propertyAddress,
      sellerName,
      purchasePrice: Number(purchasePrice),
      closingDate,
      
      // Property Details
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      sqft: sqft ? Number(sqft) : null,
      propertyType,
      notes,
      
      // Agreement Terms
      commissionType,
      commissionPercentage: commissionType === "percentage" ? Number(commissionPercentage) : null,
      flatFee: commissionType === "flat" ? Number(flatFee) : null,
      agreementLength: agreementLength ? Number(agreementLength) : null
    };

    sessionStorage.setItem("newDealData", JSON.stringify(dealData));
    
    // Navigate to verification page
    navigate(createPageUrl("DealWizard") + (dealId ? `?dealId=${dealId}` : ""));
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">New Deal</h1>
          <p className="text-sm text-[#808080]">Enter your deal details below</p>
        </div>

        <div className="space-y-6">
          {/* Section 1: Deal Basics */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                <Home className="w-5 h-5 text-[#E3C567]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Deal Basics</h2>
                <p className="text-xs text-[#808080]">Core information about the property</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Property Address *
                </label>
                <Input
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Seller / Owner Name
                </label>
                <Input
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="John Doe"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Purchase Price *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                    <Input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="250000"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Target Closing Date *
                  </label>
                  <Input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Property Details */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Property Details</h2>
                <p className="text-xs text-[#808080]">Physical characteristics</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Beds
                  </label>
                  <div className="relative">
                    <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                    <Input
                      type="number"
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      placeholder="3"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Baths
                  </label>
                  <div className="relative">
                    <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                    <Input
                      type="number"
                      step="0.5"
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      placeholder="2"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Square Feet
                  </label>
                  <div className="relative">
                    <Maximize2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                    <Input
                      type="number"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      placeholder="1500"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Property Type
                </label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Notes / Description
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details about the property or deal situation..."
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] min-h-[100px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Agreement with Agent */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#34D399]/20 rounded-full flex items-center justify-center">
                <Handshake className="w-5 h-5 text-[#34D399]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Agreement with Your Agent</h2>
                <p className="text-xs text-[#808080]">Business terms for this deal</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Commission Structure
                </label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Commission</SelectItem>
                    <SelectItem value="flat">Flat Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {commissionType === "percentage" ? (
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Commission Percentage
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={commissionPercentage}
                      onChange={(e) => setCommissionPercentage(e.target.value)}
                      placeholder="3.0"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080]">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Flat Fee Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                    <Input
                      type="number"
                      value={flatFee}
                      onChange={(e) => setFlatFee(e.target.value)}
                      placeholder="5000"
                      className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Agreement Length (Days)
                </label>
                <Input
                  type="number"
                  value={agreementLength}
                  onChange={(e) => setAgreementLength(e.target.value)}
                  placeholder="90"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleContinue}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 py-6 text-base font-bold"
            >
              Continue to Verification
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}