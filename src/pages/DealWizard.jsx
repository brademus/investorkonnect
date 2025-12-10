import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  X, ArrowRight, ArrowLeft, Loader2, UploadCloud, 
  FileText, CheckCircle, MapPin, DollarSign, Calendar, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Upload Contract', icon: UploadCloud },
  { id: 2, title: 'Confirm Details', icon: CheckCircle },
  { id: 3, title: 'Match Agent', icon: Sparkles }
];

export default function DealWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false); // For upload/extract
  
  // Data State
  const [dealId, setDealId] = useState(searchParams.get('dealId') || null);
  const [dealData, setDealData] = useState({
    contractUrl: '',
    address: '',
    city: '',
    state: '',
    county: '',
    zip: '',
    purchasePrice: '',
    closingDate: '',
    inspectionDate: '',
    earnestMoneyDate: ''
  });

  const [matchedAgents, setMatchedAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  // Initial Load / Resume
  useEffect(() => {
    document.title = "Start New Deal - Investor Konnect";
    if (dealId) {
      loadExistingDeal(dealId);
    }
  }, [dealId]);

  const loadExistingDeal = async (id) => {
    try {
      setLoading(true);
      const deals = await base44.entities.Deal.filter({ id });
      if (deals && deals.length > 0) {
        const deal = deals[0];
        setDealData(prev => ({
          ...prev,
          contractUrl: deal.contract_url || prev.contractUrl,
          address: deal.property_address || prev.address,
          city: deal.city || prev.city,
          state: deal.state || prev.state,
          county: deal.county || prev.county,
          zip: deal.zip || prev.zip,
          purchasePrice: deal.purchase_price ? deal.purchase_price.toString() : prev.purchasePrice,
          closingDate: deal.key_dates?.closing_date || prev.closingDate,
          inspectionDate: deal.key_dates?.inspection_period_end || prev.inspectionDate,
          earnestMoneyDate: deal.key_dates?.earnest_money_due || prev.earnestMoneyDate
        }));
        
        // If we have an ID but still on step 1, move to step 2 automatically if data exists
        if (step === 1 && deal.property_address) {
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error loading deal:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely parse price
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    // Remove '$', ',', and whitespace
    const cleanStr = priceStr.toString().replace(/[$,\s]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  // --- STEP 1: UPLOAD ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF contract');
      return;
    }

    setProcessing(true);
    try {
      // 1. Upload
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // 2. Create Deal Record Immediately
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (!profiles[0]) throw new Error("No profile found");

      let currentId = dealId;
      if (!currentId) {
        const newDeal = await base44.entities.Deal.create({
          investor_id: profiles[0].id,
          title: file.name,
          contract_url: file_url,
          status: 'active',
          pipeline_stage: 'new_deal_under_contract',
          created_date: new Date().toISOString()
        });
        currentId = newDeal.id;
        setDealId(currentId);
        setSearchParams({ dealId: currentId });
        await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      } else {
        await base44.entities.Deal.update(currentId, {
            contract_url: file_url,
            title: file.name
        });
      }

      setDealData(prev => ({ ...prev, contractUrl: file_url }));

      // 3. Extract Data
      try {
        const res = await base44.functions.invoke('extractContractData', { fileUrl: file_url });
        if (res.data?.success) {
          const extracted = res.data.data;
          const updates = {
            address: extracted.address || '',
            city: extracted.city || '',
            state: extracted.state || '',
            county: extracted.county || '',
            zip: extracted.zip || '',
            purchasePrice: extracted.purchase_price ? extracted.purchase_price.toString() : '',
            closingDate: extracted.key_dates?.closing_date || '',
            inspectionDate: extracted.key_dates?.inspection_period_end || '',
            earnestMoneyDate: extracted.key_dates?.earnest_money_due || ''
          };
          
          setDealData(prev => ({ ...prev, ...updates }));
          
          // Save extracted data to DB immediately
          await base44.entities.Deal.update(currentId, {
             property_address: updates.address,
             city: updates.city,
             state: updates.state,
             county: updates.county,
             zip: updates.zip,
             purchase_price: parsePrice(updates.purchasePrice),
             key_dates: {
                closing_date: updates.closingDate,
                inspection_period_end: updates.inspectionDate,
                earnest_money_due: updates.earnestMoneyDate
             }
          });
          
          toast.success("Contract analyzed successfully");
        }
      } catch (extractError) {
        console.error("Extraction failed:", extractError);
        toast.warning("Could not auto-extract data. Please enter manually.");
      }

      setStep(2);

    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // --- STEP 2: CONFIRM ---
  const handleConfirm = async () => {
    if (!dealData.address || !dealData.purchasePrice) {
      toast.error("Address and Purchase Price are required");
      return;
    }

    setLoading(true);
    try {
      if (!dealId) throw new Error("No deal ID found");

      // Robust Save
      const price = parsePrice(dealData.purchasePrice);
      
      await base44.entities.Deal.update(dealId, {
        title: dealData.address, // Use address as title for better visibility
        property_address: dealData.address,
        city: dealData.city,
        state: dealData.state,
        county: dealData.county,
        zip: dealData.zip,
        purchase_price: price,
        key_dates: {
          closing_date: dealData.closingDate,
          inspection_period_end: dealData.inspectionDate,
          earnest_money_due: dealData.earnestMoneyDate
        },
        // Ensure status is active
        status: 'active',
        pipeline_stage: 'new_deal_under_contract'
      });

      // Find Agents for Step 3
      try {
        const matchRes = await base44.functions.invoke('findBestAgents', {
            state: dealData.state,
            county: dealData.county,
            dealId: dealId
        });
        if (matchRes.data?.results) {
            setMatchedAgents(matchRes.data.results);
        }
      } catch (e) {
        console.error("Matching failed:", e);
      }

      await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      toast.success("Deal details saved");
      setStep(3);

    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save deal details");
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: MATCH ---
  const handleMatch = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      
      const newRoom = await base44.entities.Room.create({
        investorId: profiles[0].id,
        agentId: selectedAgentId,
        deal_id: dealId,
        status: 'active',
        created_date: new Date().toISOString()
      });

      await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      
      navigate(`${createPageUrl("Room")}?roomId=${newRoom.id}`);
      toast.success("Deal Room created!");

    } catch (error) {
      console.error("Room creation failed:", error);
      toast.error("Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  // Renders...
  const renderStep1 = () => (
    <div className="text-center py-10">
      <div className="w-20 h-20 bg-[#E3C567]/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <UploadCloud className="w-10 h-10 text-[#E3C567]" />
      </div>
      <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2 font-serif">Upload Purchase Agreement</h2>
      <p className="text-[#808080] mb-8 max-w-md mx-auto">
        Upload your PDF contract. We'll automatically create the deal and extract key details.
      </p>

      {processing ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
          <p className="text-sm font-medium text-[#808080]">Processing contract...</p>
        </div>
      ) : (
        <div className="flex justify-center">
          <label className="cursor-pointer bg-[#0D0D0D] border border-[#1F1F1F] hover:border-[#E3C567] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-3">
            <UploadCloud className="w-5 h-5 text-[#E3C567]" />
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#FAFAFA] font-serif">Confirm Details</h2>
        <span className="text-xs text-[#E3C567] bg-[#E3C567]/10 px-2 py-1 rounded border border-[#E3C567]/20">Review & Edit</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Property Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-[#808080] border-b border-[#1F1F1F] pb-2 font-serif">Property</h3>
          <div>
            <Label className="text-[#FAFAFA]">Address</Label>
            <Input 
              value={dealData.address} 
              onChange={e => setDealData({...dealData, address: e.target.value})} 
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#FAFAFA]">City</Label>
              <Input 
                value={dealData.city} 
                onChange={e => setDealData({...dealData, city: e.target.value})} 
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
            <div>
              <Label className="text-[#FAFAFA]">State</Label>
              <Input 
                value={dealData.state} 
                onChange={e => setDealData({...dealData, state: e.target.value})} 
                maxLength={2} 
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#FAFAFA]">County</Label>
              <Input 
                value={dealData.county} 
                onChange={e => setDealData({...dealData, county: e.target.value})} 
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
            <div>
              <Label className="text-[#FAFAFA]">Zip</Label>
              <Input 
                value={dealData.zip} 
                onChange={e => setDealData({...dealData, zip: e.target.value})} 
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="space-y-4">
          <h3 className="font-semibold text-[#808080] border-b border-[#1F1F1F] pb-2 font-serif">Financials & Dates</h3>
          <div>
            <Label className="text-[#FAFAFA]">Purchase Price</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-[#808080]" />
              <Input 
                className="pl-9 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]" 
                value={dealData.purchasePrice} 
                onChange={e => setDealData({...dealData, purchasePrice: e.target.value})} 
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <Label className="text-[#FAFAFA]">Closing Date</Label>
            <Input 
              value={dealData.closingDate} 
              onChange={e => setDealData({...dealData, closingDate: e.target.value})} 
              placeholder="YYYY-MM-DD" 
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
            />
          </div>
          <div>
            <Label className="text-[#FAFAFA]">Inspection End</Label>
            <Input 
              value={dealData.inspectionDate} 
              onChange={e => setDealData({...dealData, inspectionDate: e.target.value})} 
              placeholder="YYYY-MM-DD" 
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
            />
          </div>
        </div>
      </div>
      
      <div className="pt-6 flex justify-end">
        <Button onClick={handleConfirm} disabled={loading} className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-serif font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          Confirm & Save
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#FAFAFA] font-serif">Agent Matches</h2>
        <p className="text-[#808080]">Found {matchedAgents.length} agents near {dealData.city}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto">
        {matchedAgents.length === 0 ? (
           <div className="p-8 text-center border border-dashed border-[#1F1F1F] rounded-xl">
             <p className="text-[#808080]">No exact matches found. You can proceed and invite an agent later.</p>
           </div>
        ) : (
          matchedAgents.map((match) => (
            <div 
              key={match.profile.id}
              onClick={() => setSelectedAgentId(match.profile.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedAgentId === match.profile.id 
                  ? 'border-[#E3C567] bg-[#E3C567]/10' 
                  : 'border-[#1F1F1F] bg-[#141414] hover:border-[#E3C567]/50'
              }`}
            >
              <div className="w-10 h-10 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#E3C567] font-bold border border-[#333]">
                {match.profile.full_name?.charAt(0)}
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-[#FAFAFA]">{match.profile.full_name}</h3>
                <p className="text-xs text-[#808080]">{match.profile.agent?.brokerage}</p>
              </div>
              {selectedAgentId === match.profile.id && <CheckCircle className="w-5 h-5 text-[#E3C567]" />}
            </div>
          ))
        )}
      </div>

      <div className="pt-6 flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => setStep(2)}
          className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] rounded-full"
        >
          Back
        </Button>
        <Button 
          onClick={handleMatch} 
          disabled={!selectedAgentId && matchedAgents.length > 0} 
          className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-serif font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (selectedAgentId ? 'Start Deal Room' : 'Skip & Save Deal')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505]">
      <header className="bg-[#0D0D0D] border-b border-[#1F1F1F] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="default" showText={false} linkTo={createPageUrl("Dashboard")} />
            <h1 className="text-lg font-semibold text-[#FAFAFA] font-serif">New Deal</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Dashboard"))} className="text-[#808080] hover:text-[#FAFAFA] hover:bg-[#1F1F1F]">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-0">
          <Progress value={(step/3)*100} className="h-1 bg-[#1F1F1F]" indicatorClassName="bg-[#E3C567]" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-[#0D0D0D] rounded-2xl shadow-xl border border-[#1F1F1F] p-6 sm:p-10">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </main>
    </div>
  );
}