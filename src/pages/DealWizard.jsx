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
import LoadingAnimation from '@/components/LoadingAnimation';
import { 
  X, ArrowLeft, Loader2, UploadCloud, 
  CheckCircle, DollarSign 
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Upload Contract', icon: UploadCloud },
  { id: 2, title: 'Confirm Details', icon: CheckCircle }
];

export default function DealWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [dealId, setDealId] = useState(searchParams.get('dealId') || null);
  const [dealData, setDealData] = useState({
    address: '',
    city: '',
    state: '',
    county: '',
    zip: '',
    purchasePrice: '',
    closingDate: ''
  });

  // Load existing deal if resuming
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
        setDealData({
          address: deal.property_address || '',
          city: deal.city || '',
          state: deal.state || '',
          county: deal.county || '',
          zip: deal.zip || '',
          purchasePrice: deal.purchase_price ? deal.purchase_price.toString() : '',
          closingDate: deal.key_dates?.closing_date || ''
        });
        
        if (deal.property_address) {
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error loading deal:", error);
    } finally {
      setLoading(false);
    }
  };

  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    const cleanStr = priceStr.toString().replace(/[$,\s]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  // STEP 1: Upload & Extract
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a PDF contract');
      return;
    }

    setProcessing(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const investorId = profiles[0].id;

      // 1. Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // 2. Extract data from contract
      const extractRes = await base44.functions.invoke('extractContractData', {
        file_url,
        deal_id: null
      });

      let extractedData = {
        address: '',
        city: '',
        state: '',
        county: '',
        zip: '',
        purchasePrice: '',
        closingDate: ''
      };

      if (extractRes.data?.status === 'success' && extractRes.data.output) {
        const extracted = extractRes.data.output;
        extractedData = {
          address: extracted.property_address || extracted.address || '',
          city: extracted.city || '',
          state: extracted.state || '',
          county: extracted.county || '',
          zip: extracted.zip || extracted.zipCode || '',
          purchasePrice: extracted.purchase_price || extracted.purchasePrice || '',
          closingDate: extracted.closing_date || extracted.closingDate || ''
        };
        setDealData(extractedData);
      }

      // 3. Check for existing deal with same address
      let currentDeal = null;
      
      if (extractedData.address) {
        const existingDeals = await base44.entities.Deal.filter({
          investor_id: investorId,
          property_address: extractedData.address
        });
        
        if (existingDeals.length > 0) {
          // Found existing deal with same address - update it
          currentDeal = existingDeals[0];
          await base44.entities.Deal.update(currentDeal.id, {
            contract_url: file_url,
            title: extractedData.address,
            city: extractedData.city,
            state: extractedData.state,
            county: extractedData.county,
            zip: extractedData.zip,
            purchase_price: parsePrice(extractedData.purchasePrice),
            key_dates: {
              closing_date: extractedData.closingDate
            }
          });
          toast.success("Deal updated with new contract");
        }
      }
      
      // 4. If no existing deal, create new one
      if (!currentDeal) {
        currentDeal = await base44.entities.Deal.create({
          investor_id: investorId,
          title: extractedData.address || file.name,
          contract_url: file_url,
          property_address: extractedData.address,
          city: extractedData.city,
          state: extractedData.state,
          county: extractedData.county,
          zip: extractedData.zip,
          purchase_price: parsePrice(extractedData.purchasePrice),
          key_dates: {
            closing_date: extractedData.closingDate
          },
          status: 'active',
          pipeline_stage: 'new_deal_under_contract'
        });
        toast.success("Contract analyzed successfully");
      }

      setDealId(currentDeal.id);
      await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

      setStep(2);

    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // STEP 2: Confirm and Navigate to Dashboard
  const handleConfirm = async () => {
    // State is required
    if (!dealData.state) {
      toast.error("State is required to continue");
      return;
    }

    // County missing: warning but allow save
    if (!dealData.county) {
      toast.warning("County is missing - this may limit agent matching accuracy");
    }

    setLoading(true);
    try {
      if (!dealId) throw new Error("No deal ID found");

      await base44.entities.Deal.update(dealId, {
        title: dealData.address,
        property_address: dealData.address,
        city: dealData.city,
        state: dealData.state,
        county: dealData.county,
        zip: dealData.zip,
        purchase_price: parsePrice(dealData.purchasePrice),
        key_dates: {
          closing_date: dealData.closingDate
        },
        status: 'active',
        pipeline_stage: 'new_deal_under_contract'
      });

      await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
      
      toast.success("Deal saved successfully");
      
      // Clear cache and navigate to dashboard
      sessionStorage.clear();
      navigate(createPageUrl("Dashboard"));

    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save deal details");
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="text-center py-10">
      <div className="w-20 h-20 bg-[#E3C567]/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <UploadCloud className="w-10 h-10 text-[#E3C567]" />
      </div>
      <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2 font-serif">Upload Purchase Agreement</h2>
      <p className="text-[#808080] mb-8 max-w-md mx-auto">
        Upload your PDF contract. We'll automatically extract details and check for duplicates.
      </p>

      {processing ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <LoadingAnimation className="w-64 h-64" />
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
        </div>
      </div>
      
      <div className="pt-6 flex justify-end gap-3">
        <Button onClick={() => setStep(1)} variant="outline" className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleConfirm} disabled={loading} className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-serif font-semibold">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          Save & Continue
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
          <Progress value={(step/2)*100} className="h-1 bg-[#1F1F1F]" indicatorClassName="bg-[#E3C567]" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-[#0D0D0D] rounded-2xl shadow-xl border border-[#1F1F1F] p-6 sm:p-10">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>
      </main>
    </div>
  );
}