import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contractFile, setContractFile] = useState(null);
  
  // Deal Data State
  const [createdDealId, setCreatedDealId] = useState(null);
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

  // Agents State
  const [matchedAgents, setMatchedAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  useEffect(() => {
    document.title = "Start New Deal - Investor Konnect";
    
    // Check for resume param
    const params = new URLSearchParams(window.location.search);
    const resumeDealId = params.get('dealId');
    
    if (resumeDealId) {
      resumeDeal(resumeDealId);
    }
  }, []);

  const resumeDeal = async (dealId) => {
    setLoading(true);
    try {
      // Fetch deal details
      const deals = await base44.entities.Deal.filter({ id: dealId });
      if (deals && deals.length > 0) {
        const deal = deals[0];
        setCreatedDealId(deal.id);
        setDealData(prev => ({
          ...prev,
          address: deal.property_address || '',
          city: deal.city || '',
          state: deal.state || '',
          county: deal.county || '',
          zip: deal.zip || '',
          purchasePrice: deal.purchase_price || '',
          contractUrl: deal.contract_url || ''
        }));
        
        // Find matches
        const matchRes = await base44.functions.invoke('findBestAgents', {
          state: deal.state,
          county: deal.county,
          dealId: deal.id
        });

        if (matchRes.data?.results) {
          setMatchedAgents(matchRes.data.results);
        }
        
        setStep(3);
      }
    } catch (e) {
      console.error("Error resuming deal:", e);
      toast.error("Could not load deal details");
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 1: UPLOAD & EXTRACT ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF contract');
      return;
    }

    setUploading(true);
    setContractFile(file);

    try {
      // 1. Upload File
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setDealData(prev => ({ ...prev, contractUrl: file_url }));
      setUploading(false);
      setExtracting(true);

      // 2. CREATE DEAL IMMEDIATELY (Safety Net)
      // This ensures the deal exists even if extraction fails or user quits
      let newDealId = null;
      try {
        const user = await base44.auth.me();
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        const myProfile = profiles[0];
        
        if (myProfile) {
            const initialDeal = await base44.entities.Deal.create({
              investor_id: myProfile.id,
              title: file.name || 'New Contract',
              status: 'active',
              pipeline_stage: 'new_deal_under_contract',
              contract_url: file_url,
              created_date: new Date().toISOString()
            });
            newDealId = initialDeal.id;
            setCreatedDealId(initialDeal.id);
            await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
        }
      } catch (createErr) {
        console.error("Critical: Failed to create initial deal", createErr);
      }

      // 3. Extract Data (Attempt)
      try {
          const response = await base44.functions.invoke('extractContractData', { fileUrl: file_url });
          
          if (response.data?.success) {
            const extracted = response.data.data;
            setDealData(prev => ({
              ...prev,
              address: extracted.address || '',
              city: extracted.city || '',
              state: extracted.state || '',
              county: extracted.county || '',
              zip: extracted.zip || '',
              purchasePrice: extracted.purchase_price || '',
              closingDate: extracted.key_dates?.closing_date || '',
              inspectionDate: extracted.key_dates?.inspection_period_end || '',
              earnestMoneyDate: extracted.key_dates?.earnest_money_due || ''
            }));
            
            // Update the deal we just created
            if (newDealId) {
                await base44.entities.Deal.update(newDealId, {
                    title: extracted.address || file.name || 'New Deal',
                    property_address: extracted.address,
                    city: extracted.city,
                    state: extracted.state,
                    county: extracted.county,
                    zip: extracted.zip,
                    purchase_price: extracted.purchase_price ? parseFloat(extracted.purchase_price) : 0,
                    key_dates: extracted.key_dates
                });
                await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
            }
            
            toast.success('Contract data extracted!');
          } else {
             toast.warning('Manual entry required.');
          }
      } catch (extractErr) {
          console.error("Extraction failed", extractErr);
          toast.warning('Auto-extraction failed. Please enter details.');
      }
      
      setStep(2);

    } catch (error) {
      console.error('Upload/Extract error:', error);
      toast.error('Error processing file. Please try again.');
      setUploading(false);
    } finally {
      setExtracting(false);
      setUploading(false);
    }
  };

  // --- STEP 2: CONFIRM & SAVE ---
  const handleConfirmDetails = async () => {
    if (!dealData.state || !dealData.purchasePrice) {
      toast.error('State and Purchase Price are required');
      return;
    }

    setLoading(true);

    try {
      const user = await base44.auth.me();
      if (!user) throw new Error("Not authenticated");

      // Robust profile fetching
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const myProfile = profiles[0];
      
      if (!myProfile) {
        toast.error("Profile not found. Please complete onboarding.");
        return;
      }

      // 1. Save Deal
      const dealPayload = {
        investor_id: myProfile.id,
        title: `${dealData.address || 'New Deal'}`,
        property_address: dealData.address,
        city: dealData.city,
        state: dealData.state,
        county: dealData.county,
        zip: dealData.zip,
        purchase_price: parseFloat(dealData.purchasePrice),
        contract_url: dealData.contractUrl,
        key_dates: {
          closing_date: dealData.closingDate,
          inspection_period_end: dealData.inspectionDate,
          earnest_money_due: dealData.earnestMoneyDate
        },
        status: 'active',
        pipeline_stage: 'new_deal_under_contract',
        created_date: new Date().toISOString()
      };

      let createdDeal;
      if (createdDealId) {
          // Update existing draft if resuming
          await base44.entities.Deal.update(createdDealId, dealPayload);
          createdDeal = { ...dealPayload, id: createdDealId };
      } else {
          // Create new
          createdDeal = await base44.entities.Deal.create(dealPayload);
          setCreatedDealId(createdDeal.id);
      }

      // 2. Update Profile with deal submission (Persist to Profile as requested)
      if (myProfile) {
        try {
          await base44.entities.Profile.update(myProfile.id, {
            investor: {
              ...(myProfile.investor || {}),
              deal_submission: {
                ...dealPayload,
                deal_id: createdDeal.id
              }
            }
          });
        } catch (profileErr) {
          console.error("Failed to update profile with deal submission", profileErr);
          // Don't block flow if this fails
        }
      }

      toast.success("Deal saved to your profile!");
      
      // Force refresh of dashboard data
      await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      
      navigate(createPageUrl("Dashboard"));

    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error('Failed to create deal.');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: SELECT AGENT & START ---
  const handleSelectAgent = async () => {
    if (!selectedAgentId) return;

    setLoading(true);
    try {
      const user = await base44.auth.me();
      // Fetch user profile to get ID
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const myProfile = profiles[0];

      // Create Room
      const roomPayload = {
        investorId: myProfile.id,
        agentId: selectedAgentId,
        deal_id: createdDealId,
        status: 'active',
        created_date: new Date().toISOString()
      };
      
      await base44.entities.Room.create(roomPayload);
      
      toast.success('Deal Room Created!');
      // Redirect to the specific room instead of DealRooms listing page
      navigate(`${createPageUrl("Room")}?roomId=${roomPayload.id}`);

    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to connect with agent.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="text-center py-10">
      <div className="w-20 h-20 bg-[#E3C567]/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <UploadCloud className="w-10 h-10 text-[#E3C567]" />
      </div>
      <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2 font-serif">Upload Your Contract</h2>
      <p className="text-[#808080] mb-8 max-w-md mx-auto">
        Upload your signed purchase agreement (PDF). We'll automatically extract the property details and key dates.
      </p>

      {extracting ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
          <p className="text-sm font-medium text-[#808080]">Analyzing contract...</p>
        </div>
      ) : uploading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
          <p className="text-sm font-medium text-[#808080]">Uploading...</p>
        </div>
      ) : (
        <div className="flex justify-center">
          <label className="cursor-pointer bg-[#0D0D0D] border border-[#1F1F1F] hover:border-[#E3C567] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-3">
            <UploadCloud className="w-5 h-5 text-[#E3C567]" />
            Select PDF File
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
        <h2 className="text-xl font-bold text-[#FAFAFA] font-serif">Confirm Deal Details</h2>
        <span className="text-xs text-[#E3C567] bg-[#E3C567]/10 px-2 py-1 rounded border border-[#E3C567]/20">Extracted from PDF</span>
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
              />
            </div>
          </div>
          <div>
            <Label className="text-[#FAFAFA]">Closing Date</Label>
            <Input 
              value={dealData.closingDate} 
              onChange={e => setDealData({...dealData, closingDate: e.target.value})} 
              placeholder="YYYY-MM-DD" 
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] placeholder:text-[#808080]"
            />
          </div>
          <div>
            <Label className="text-[#FAFAFA]">Inspection End</Label>
            <Input 
              value={dealData.inspectionDate} 
              onChange={e => setDealData({...dealData, inspectionDate: e.target.value})} 
              placeholder="YYYY-MM-DD" 
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] placeholder:text-[#808080]"
            />
          </div>
        </div>
      </div>
      
      <div className="pt-6 flex justify-end">
        <Button onClick={handleConfirmDetails} disabled={loading} className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-serif font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          Confirm & Find Agent
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#FAFAFA] font-serif">Matches in {dealData.county || dealData.city}, {dealData.state}</h2>
        <p className="text-[#808080]">Select an agent to start the transaction.</p>
      </div>

      {matchedAgents.length === 0 ? (
        <div className="text-center py-8 text-[#808080] bg-[#141414] rounded-xl border border-dashed border-[#1F1F1F]">
          No agents found in this exact location. <br/>
          <p className="text-sm mt-2">Try uploading a contract for a supported market.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matchedAgents.map((match) => (
            <div 
              key={match.profile.id}
              onClick={() => setSelectedAgentId(match.profile.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedAgentId === match.profile.id 
                  ? 'border-[#E3C567] bg-[#E3C567]/10' 
                  : 'border-[#1F1F1F] bg-[#141414] hover:border-[#E3C567]/50'
              }`}
            >
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#E3C567] font-bold text-lg border border-[#333]">
                {match.profile.full_name?.charAt(0)}
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-[#FAFAFA]">{match.profile.full_name}</h3>
                <p className="text-sm text-[#808080]">{match.profile.agent?.brokerage || 'Independent Agent'}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-[#E3C567]">
                  <MapPin className="w-3 h-3" />
                  {match.region || match.profile.target_state}
                </div>
              </div>
              <div className="text-right">
                {selectedAgentId === match.profile.id && (
                  <CheckCircle className="w-6 h-6 text-[#E3C567]" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-6 flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => setStep(2)}
          className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] hover:text-white rounded-full font-serif"
        >
          Back
        </Button>
        <Button 
          onClick={handleSelectAgent} 
          disabled={!selectedAgentId || loading} 
          className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-serif font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Start Deal Room
        </Button>
      </div>
    </div>
  );

  const progress = (step / 3) * 100;

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
          <Progress value={progress} className="h-1 bg-[#1F1F1F]" indicatorClassName="bg-[#E3C567]" />
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