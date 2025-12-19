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
import LoadingAnimation from "@/components/LoadingAnimation";

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
  const [contractDate, setContractDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [earnestMoney, setEarnestMoney] = useState("");
  const [numberOfSigners, setNumberOfSigners] = useState("1");
  const [secondSignerName, setSecondSignerName] = useState("");

  // Property Details
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [notes, setNotes] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [numberOfStories, setNumberOfStories] = useState("");
  const [hasBasement, setHasBasement] = useState("");

  // Agreement Terms - Seller's Agent
  const [sellerCommissionType, setSellerCommissionType] = useState("percentage");
  const [sellerCommissionPercentage, setSellerCommissionPercentage] = useState("");
  const [sellerFlatFee, setSellerFlatFee] = useState("");
  
  // Agreement Terms - Buyer's Agent
  const [buyerCommissionType, setBuyerCommissionType] = useState("percentage");
  const [buyerCommissionPercentage, setBuyerCommissionPercentage] = useState("");
  const [buyerFlatFee, setBuyerFlatFee] = useState("");
  
  const [agreementLength, setAgreementLength] = useState("");

  // Step 4 state (contract upload)
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationErrors, setVerificationErrors] = useState([]);

  // Load existing deal data if editing
  useEffect(() => {
    if (dealId && profile?.id) {
      const loadDealData = async () => {
        try {
          const deals = await base44.entities.Deal.filter({ id: dealId });
          if (deals.length > 0) {
            const deal = deals[0];
            
            // Step 1: Deal Basics
            setPropertyAddress(deal.property_address || "");
            setCity(deal.city || "");
            setState(deal.state || "");
            setZip(deal.zip || "");
            setPurchasePrice(deal.purchase_price?.toString() || "");
            setClosingDate(deal.key_dates?.closing_date || "");
            setContractDate(deal.key_dates?.contract_date || "");
            
            // Parse notes - might contain both notes and specialNotes
            if (deal.notes) {
              const noteParts = deal.notes.split('\n\n');
              if (noteParts.length > 1) {
                setNotes(noteParts[0] || "");
                setSpecialNotes(noteParts[1] || "");
              } else {
                setNotes(deal.notes);
              }
            }
            
            // Step 2: Property Details
            setPropertyType(deal.property_type || "");
            
            // Try to load terms from associated Room
            try {
              const rooms = await base44.entities.Room.filter({ deal_id: dealId });
              if (rooms.length > 0) {
                const room = rooms[0];
                const terms = room.proposed_terms;
                if (terms) {
                  // Load seller's agent terms
                  if (terms.seller_commission_type) {
                    setSellerCommissionType(terms.seller_commission_type);
                    if (terms.seller_commission_type === 'percentage') {
                      setSellerCommissionPercentage(terms.seller_commission_percentage?.toString() || "");
                    } else {
                      setSellerFlatFee(terms.seller_flat_fee?.toString() || "");
                    }
                  } else if (terms.commission_type) {
                    // Legacy format
                    setSellerCommissionType(terms.commission_type);
                    if (terms.commission_type === 'percentage') {
                      setSellerCommissionPercentage(terms.commission_percentage?.toString() || "");
                    } else {
                      setSellerFlatFee(terms.flat_fee?.toString() || "");
                    }
                  }
                  
                  // Load buyer's agent terms
                  if (terms.buyer_commission_type) {
                    setBuyerCommissionType(terms.buyer_commission_type);
                    if (terms.buyer_commission_type === 'percentage') {
                      setBuyerCommissionPercentage(terms.buyer_commission_percentage?.toString() || "");
                    } else {
                      setBuyerFlatFee(terms.buyer_flat_fee?.toString() || "");
                    }
                  }
                  
                  setAgreementLength(terms.agreement_length?.toString() || "");
                }
              }
            } catch (roomError) {
              console.log("No room found for this deal, skipping terms load");
            }
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
    // Strip out $ signs, commas, and spaces, then validate
    const cleanedPrice = String(purchasePrice || '').replace(/[$,\s]/g, '').trim();
    if (!cleanedPrice || isNaN(Number(cleanedPrice)) || Number(cleanedPrice) <= 0) {
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a PDF contract');
      return;
    }

    setUploading(true);
    setVerifying(false);
    setVerificationSuccess(false);
    setVerificationErrors([]);

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Store file URL immediately for retry functionality
      sessionStorage.setItem("contractFileUrl", file_url);
      
      setUploading(false);
      setVerifying(true);

      // Extract contract data
      const extractRes = await base44.functions.invoke('extractContractData', {
        fileUrl: file_url
      });

      if (!extractRes.data?.success || !extractRes.data.data) {
        throw new Error("Failed to extract data from contract");
      }

      const extracted = extractRes.data.data;
      
      // Verify against user input
      const errors = [];
      
      // Check address
      if (propertyAddress && extracted.address) {
        const inputAddr = propertyAddress.toLowerCase().trim();
        const extractedAddr = extracted.address.toLowerCase().trim();
        const firstPart = inputAddr.split(',')[0].trim();
        
        if (!extractedAddr.includes(firstPart) && !inputAddr.includes(extractedAddr.split(',')[0].trim())) {
          errors.push(`Address mismatch: You entered "${propertyAddress}" but contract shows "${extracted.address}"`);
        }
      }
      
      // Check state
      if (state && extracted.state) {
        if (state.toLowerCase() !== extracted.state.toLowerCase()) {
          errors.push(`State mismatch: You entered "${state}" but contract shows "${extracted.state}"`);
        }
      }
      
      // Check price (5% tolerance)
      if (purchasePrice && extracted.purchase_price) {
        const inputPrice = Number(purchasePrice);
        const contractPrice = Number(extracted.purchase_price.toString().replace(/[$,\s]/g, ''));
        const diff = Math.abs(inputPrice - contractPrice);
        const tolerance = inputPrice * 0.05;
        
        if (diff > tolerance) {
          errors.push(`Price mismatch: You entered $${inputPrice.toLocaleString()} but contract shows $${contractPrice.toLocaleString()}`);
        }
      }
      
      // Check closing date
      if (closingDate && extracted.key_dates?.closing_date) {
        const inputDate = new Date(closingDate).toISOString().split('T')[0];
        const contractDate = new Date(extracted.key_dates.closing_date).toISOString().split('T')[0];
        
        if (inputDate !== contractDate) {
          errors.push(`Closing date mismatch: You entered ${closingDate} but contract shows ${extracted.key_dates.closing_date}`);
        }
      }

      setVerifying(false);

      if (errors.length > 0) {
        setVerificationErrors(errors);
        toast.error("Contract data doesn't match your input");
      } else {
        setVerificationSuccess(true);
        
        // Auto-create deal and navigate to agent matching
        try {
          const contractDocument = {
            url: file_url,
            name: "Purchase Agreement.pdf",
            type: "contract",
            uploaded_at: new Date().toISOString()
          };

          const cleanedPrice = String(purchasePrice).replace(/[$,\s]/g, '');
          const cleanedEarnestMoney = earnestMoney ? String(earnestMoney).replace(/[$,\s]/g, '') : null;
          
          console.log('[NewDeal] Creating deal with:', {
            investor_id: profile.id,
            property_address: propertyAddress,
            state,
            purchase_price: Number(cleanedPrice)
          });
          
          const newDeal = await base44.entities.Deal.create({
            investor_id: profile.id,
            title: propertyAddress,
            property_address: propertyAddress,
            city,
            state,
            county: "",
            zip,
            purchase_price: Number(cleanedPrice),
            property_type: propertyType,
            notes: [notes, specialNotes].filter(Boolean).join('\n\n'),
            key_dates: {
              closing_date: closingDate,
              contract_date: contractDate
            },
            contract_url: file_url,
            contract_document: contractDocument,
            status: 'active',
            pipeline_stage: 'new_deal_under_contract'
          });

          console.log('[NewDeal] Deal created successfully:', newDeal.id);

          // Store deal ID for navigation
          sessionStorage.setItem("createdDealId", newDeal.id);

          // Store terms in sessionStorage for agent matching
          sessionStorage.setItem("newDealData", JSON.stringify({
            sellerCommissionType,
            sellerCommissionPercentage,
            sellerFlatFee,
            buyerCommissionType,
            buyerCommissionPercentage,
            buyerFlatFee,
            agreementLength
          }));
          
          toast.success("Contract verified! Click below to find agents.");
          
          console.log('[NewDeal] Deal ready, dealId stored:', newDeal.id);
        } catch (dealError) {
          console.error("Failed to create deal:", dealError);
          toast.error("Failed to create deal: " + (dealError.message || 'Unknown error'));
          setVerificationSuccess(false);
        }
      }

    } catch (error) {
      console.error("Upload/verification failed:", error);
      toast.error("Failed to process contract");
      setUploading(false);
      setVerifying(false);
    }
  };

  const handleFinalSubmit = async () => {
    const contractFileUrl = sessionStorage.getItem("contractFileUrl");
    
    if (!contractFileUrl) {
      toast.error("Please upload and verify your contract first");
      return;
    }

    setUploading(true);
    
    try {
      const contractDocument = {
        url: contractFileUrl,
        name: "Purchase Agreement.pdf",
        type: "contract",
        uploaded_at: new Date().toISOString()
      };

      const cleanedPrice = String(purchasePrice).replace(/[$,\s]/g, '');
      const cleanedEarnestMoney = earnestMoney ? String(earnestMoney).replace(/[$,\s]/g, '') : null;
      
      // Create deal with all data
      const newDeal = await base44.entities.Deal.create({
        investor_id: profile.id,
        title: propertyAddress,
        property_address: propertyAddress,
        city,
        state,
        county: "",
        zip,
        purchase_price: Number(cleanedPrice),
        property_type: propertyType,
        notes: [notes, specialNotes].filter(Boolean).join('\n\n'),
        key_dates: {
          closing_date: closingDate,
          contract_date: contractDate
        },
        contract_url: contractFileUrl,
        contract_document: contractDocument,
        status: 'active',
        pipeline_stage: 'new_deal_under_contract'
      });

      // Store terms in sessionStorage for agent matching
      sessionStorage.setItem("newDealData", JSON.stringify({
        sellerCommissionType,
        sellerCommissionPercentage,
        sellerFlatFee,
        buyerCommissionType,
        buyerCommissionPercentage,
        buyerFlatFee,
        agreementLength
      }));
      
      toast.success("Deal created successfully!");
      navigate(createPageUrl("AgentMatching") + `?dealId=${newDeal.id}`);

    } catch (error) {
      console.error("Failed to create deal:", error);
      toast.error("Failed to save deal");
      setUploading(false);
    }
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
    { number: 3, label: "Agreement Terms" },
    { number: 4, label: "Contract Upload" }
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
          <p className="text-sm text-[#808080]">Step {currentStep} of 4</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div 
                  className="flex flex-col items-center flex-1 cursor-pointer group"
                  onClick={() => {
                    // Allow going back to any previous step
                    if (step.number <= currentStep) {
                      setCurrentStep(step.number);
                    }
                  }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    currentStep >= step.number 
                      ? 'bg-[#E3C567] text-black' 
                      : 'bg-[#1F1F1F] text-[#808080]'
                  } ${step.number <= currentStep ? 'group-hover:ring-2 group-hover:ring-[#E3C567]' : ''}`}>
                    {step.number}
                  </div>
                  <p className={`text-xs mt-2 ${currentStep >= step.number ? 'text-[#E3C567]' : 'text-[#808080]'} ${step.number <= currentStep ? 'group-hover:text-[#E3C567]' : ''}`}>
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
                      type="text"
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

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Contract Date
                </label>
                <Input
                  type="date"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Earnest Money
                </label>
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
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Number of Signers
                </label>
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
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                    Second Signer Name
                  </label>
                  <Input
                    value={secondSignerName}
                    onChange={(e) => setSecondSignerName(e.target.value)}
                    placeholder="Jane Doe"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Special Notes
                </label>
                <Textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Any additional comments or special conditions..."
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] min-h-[100px]"
                />
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
                  Year Built
                </label>
                <Input
                  type="number"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value)}
                  placeholder="2005"
                  min="1800"
                  max={new Date().getFullYear()}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Number of Stories
                </label>
                <Select value={numberOfStories} onValueChange={setNumberOfStories}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue placeholder="Select stories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Story</SelectItem>
                    <SelectItem value="2">2 Stories</SelectItem>
                    <SelectItem value="3">3 Stories</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                  Basement
                </label>
                <Select value={hasBasement} onValueChange={setHasBasement}>
                  <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
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

        {currentStep === 4 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#A78BFA]/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#A78BFA]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#FAFAFA]">Upload & Verify Contract</h2>
                <p className="text-sm text-[#808080]">We'll verify your contract matches the details you entered</p>
              </div>
            </div>

            {verificationErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
                <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Contract Verification Failed
                </h3>
                <ul className="space-y-2 mb-4">
                  {verificationErrors.map((error, idx) => (
                    <li key={idx} className="text-red-300 text-sm flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setCurrentStep(1)}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back to Fix Details
                  </Button>
                  <Button
                    onClick={async () => {
                      const contractFileUrl = sessionStorage.getItem("contractFileUrl");
                      if (!contractFileUrl) {
                        toast.error("Contract file not found. Please upload again.");
                        return;
                      }
                      
                      setVerifying(true);
                      setVerificationErrors([]);
                      
                      try {
                        const extractRes = await base44.functions.invoke('extractContractData', {
                          fileUrl: contractFileUrl
                        });

                        if (!extractRes.data?.success || !extractRes.data.data) {
                          throw new Error("Failed to extract data from contract");
                        }

                        const extracted = extractRes.data.data;
                        const errors = [];
                        
                        // Check address
                        if (propertyAddress && extracted.address) {
                          const inputAddr = propertyAddress.toLowerCase().trim();
                          const extractedAddr = extracted.address.toLowerCase().trim();
                          const firstPart = inputAddr.split(',')[0].trim();
                          
                          if (!extractedAddr.includes(firstPart) && !inputAddr.includes(extractedAddr.split(',')[0].trim())) {
                            errors.push(`Address mismatch: You entered "${propertyAddress}" but contract shows "${extracted.address}"`);
                          }
                        }
                        
                        // Check state
                        if (state && extracted.state) {
                          if (state.toLowerCase() !== extracted.state.toLowerCase()) {
                            errors.push(`State mismatch: You entered "${state}" but contract shows "${extracted.state}"`);
                          }
                        }
                        
                        // Check price (5% tolerance)
                        if (purchasePrice && extracted.purchase_price) {
                          const cleanedInputPrice = String(purchasePrice).replace(/[$,\s]/g, '');
                          const inputPrice = Number(cleanedInputPrice);
                          const contractPrice = Number(extracted.purchase_price.toString().replace(/[$,\s]/g, ''));
                          const diff = Math.abs(inputPrice - contractPrice);
                          const tolerance = inputPrice * 0.05;
                          
                          if (diff > tolerance) {
                            errors.push(`Price mismatch: You entered $${inputPrice.toLocaleString()} but contract shows $${contractPrice.toLocaleString()}`);
                          }
                        }
                        
                        // Check closing date
                        if (closingDate && extracted.key_dates?.closing_date) {
                          const inputDate = new Date(closingDate).toISOString().split('T')[0];
                          const contractDate = new Date(extracted.key_dates.closing_date).toISOString().split('T')[0];
                          
                          if (inputDate !== contractDate) {
                            errors.push(`Closing date mismatch: You entered ${closingDate} but contract shows ${extracted.key_dates.closing_date}`);
                          }
                        }

                        setVerifying(false);

                        if (errors.length > 0) {
                          setVerificationErrors(errors);
                          toast.error("Contract data still doesn't match your input");
                        } else {
                          setVerificationSuccess(true);
                          toast.success("Contract verified successfully!");
                        }
                      } catch (error) {
                        console.error("Verification failed:", error);
                        toast.error("Failed to verify contract");
                        setVerifying(false);
                      }
                    }}
                    disabled={verifying}
                    className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                  >
                    {verifying ? "Verifying..." : "Retry Verification"}
                  </Button>
                </div>
              </div>
            )}

            {verificationSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-green-400 font-semibold">Contract Verified Successfully!</h3>
                    <p className="text-green-300/70 text-sm">Ready to find matching agents</p>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    const storedDealId = sessionStorage.getItem("createdDealId");
                    if (storedDealId) {
                      console.log('[NewDeal] Using stored dealId:', storedDealId);
                      navigate(createPageUrl("AgentMatching") + `?dealId=${storedDealId}`, { replace: true });
                    } else {
                      toast.error("Deal ID not found. Please try again.");
                    }
                  }}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  Find Matching Agents
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {!verificationSuccess && verificationErrors.length === 0 && (
              <div className="space-y-5">
                <div className="border-2 border-dashed border-[#1F1F1F] rounded-xl p-8 text-center hover:border-[#E3C567]/50 transition-colors">
                  {uploading || verifying ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <LoadingAnimation className="w-32 h-32 mb-4" />
                      <p className="text-sm font-medium text-[#808080]">
                        {uploading ? "Uploading contract..." : "Verifying contract details..."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-[#E3C567]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">Upload Purchase Agreement</h3>
                      <p className="text-sm text-[#808080] mb-6">PDF format only</p>
                      <label className="cursor-pointer bg-[#E3C567] hover:bg-[#EDD89F] text-black px-6 py-3 rounded-full font-semibold inline-flex items-center gap-2 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Select PDF
                        <input 
                          type="file" 
                          accept="application/pdf" 
                          className="hidden" 
                          onChange={handleFileUpload}
                          disabled={uploading || verifying}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">What we'll verify:</h4>
                  <ul className="space-y-2 text-sm text-[#808080]">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                      Property address matches
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                      Purchase price is accurate
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                      Closing date aligns
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                      State/location is correct
                    </li>
                  </ul>
                </div>
              </div>
            )}
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
                <p className="text-sm text-[#808080]">Set terms with your agents for this deal</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Seller's Agent Section */}
              <div className="border-b border-[#1F1F1F] pb-6">
                <h3 className="text-lg font-semibold text-[#E3C567] mb-4">Seller's Agent</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                      Commission Structure
                    </label>
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
                      <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                        Commission Percentage
                      </label>
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
                      {sellerCommissionPercentage && purchasePrice && (
                        <p className="text-xs text-[#808080] mt-2">
                          Estimated commission: ${((Number(purchasePrice) * Number(sellerCommissionPercentage)) / 100).toLocaleString()}
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

              {/* Buyer's Agent Section */}
              <div className="border-b border-[#1F1F1F] pb-6">
                <h3 className="text-lg font-semibold text-[#60A5FA] mb-4">Buyer's Agent</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                      Commission Structure
                    </label>
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
                      <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                        Commission Percentage
                      </label>
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
                      {buyerCommissionPercentage && purchasePrice && (
                        <p className="text-xs text-[#808080] mt-2">
                          Estimated commission: ${((Number(purchasePrice) * Number(buyerCommissionPercentage)) / 100).toLocaleString()}
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
              className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button
              onClick={handleNextStep}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}