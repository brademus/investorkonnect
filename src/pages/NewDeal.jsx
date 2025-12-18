import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Home, Bed, Bath, Maximize2, DollarSign, Calendar, FileText, Handshake } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function NewDeal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useCurrentProfile();
  
  const dealId = searchParams.get("dealId");
  const [currentStep, setCurrentStep] = useState(1);

  // Deal Basics
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
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
            setPropertyAddress(deal.property_address || "");
            setCity(deal.city || "");
            setState(deal.state || "");
            setZip(deal.zip || "");
            setPurchasePrice(deal.purchase_price?.toString() || "");
            setClosingDate(deal.key_dates?.closing_date || "");
            setNotes(deal.notes || "");
          }
        } catch (error) {
          console.error("Failed to load deal:", error);
        }
      };
      loadDealData();
    }
  }, [dealId, profile?.id]);

  const validateStep1 = () => {
    if (!propertyAddress.trim()) {
      toast.error("Please enter a property address");
      return false;
    }
    if (!purchasePrice || isNaN(Number(purchasePrice))) {
      toast.error("Please enter a valid purchase price");
      return false;
    }
    if (!closingDate) {
      toast.error("Please select a target closing date");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleContinueToVerification = () => {
    const dealData = {
      propertyAddress,
      city,
      state,
      zip,
      sellerName,
      purchasePrice: Number(purchasePrice),
      closingDate,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      sqft: sqft ? Number(sqft) : null,
      propertyType,
      notes,
      commissionType,
      commissionPercentage: commissionType === "percentage" ? Number(commissionPercentage) : null,
      flatFee: commissionType === "flat" ? Number(flatFee) : null,
      agreementLength: agreementLength ? Number(agreementLength) : null
    };

    sessionStorage.setItem("newDealData", JSON.stringify(dealData));
    navigate(createPageUrl("DealWizard") + (dealId ? `?dealId=${dealId}` : ""));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-[#808080]">Loading...</p>
      </div>
    );
  }

  const steps = [
    { number: 1, label: "Deal Basics" },
    { number: 2, label: "Property Details" },
    { number: 3, label: "Agreement Terms" }
  ];

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">New Deal</h1>
          <p className="text-sm text-[#808080]">Step {currentStep} of 3</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    currentStep >= step.number 
                      ? 'bg-[#E3C567] text-black' 
                      : 'bg-[#1F1F1F] text-[#808080]'
                  }`}>
                    {step.number}
                  </div>
                  <p className={`text-xs mt-2 ${currentStep >= step.number ? 'text-[#E3C567]' : 'text-[#808080]'}`}>
                    {step.label}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 transition-colors ${
                    currentStep > step.number ? 'bg-[#E3C567]' : 'bg-[#1F1F1F]'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                <Home className="w-6 h-6 text-[#E3C567]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#FAFAFA]">Deal Basics</h2>
                <p className="text-sm text-[#808080]">Core information matching your contract</p>
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

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    City
                  </label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Phoenix"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    State
                  </label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="AZ"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    ZIP
                  </label>
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="85001"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
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
        )}

        {currentStep === 2 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#FAFAFA]">Property Details</h2>
                <p className="text-sm text-[#808080]">Physical characteristics and condition</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Bedrooms
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
                    Bathrooms
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
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family Home</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family (2-4 units)</SelectItem>
                    <SelectItem value="apartment">Apartment Building (5+ units)</SelectItem>
                    <SelectItem value="land">Land / Lot</SelectItem>
                    <SelectItem value="commercial">Commercial Property</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Property Notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Condition, renovations needed, unique features, etc."
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] min-h-[120px]"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#34D399]/20 rounded-full flex items-center justify-center">
                <Handshake className="w-6 h-6 text-[#34D399]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#FAFAFA]">Agreement Terms</h2>
                <p className="text-sm text-[#808080]">Set terms with your agent for this deal</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Commission Structure
                </label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage of Purchase Price</SelectItem>
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] text-sm">%</span>
                  </div>
                  {commissionPercentage && purchasePrice && (
                    <p className="text-xs text-[#808080] mt-2">
                      Estimated commission: ${((Number(purchasePrice) * Number(commissionPercentage)) / 100).toLocaleString()}
                    </p>
                  )}
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
                <p className="text-xs text-[#808080] mt-2">
                  How long will this agreement remain active?
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8">
          {currentStep > 1 ? (
            <Button
              onClick={handlePrevStep}
              variant="outline"
              className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <Button
              onClick={handleNextStep}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleContinueToVerification}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8"
            >
              Continue to Verification
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}