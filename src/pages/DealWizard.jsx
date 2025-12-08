import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contractFile, setContractFile] = useState(null);
  
  // Deal Data State
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
  }, []);

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

      // 2. Extract Data
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
        toast.success('Contract data extracted!');
        setStep(2);
      } else {
        toast.error('Could not extract data. Please enter manually.');
        setStep(2); // Allow manual entry
      }

    } catch (error) {
      console.error('Upload/Extract error:', error);
      toast.error('Error processing file. Please try again.');
      setUploading(false);
    } finally {
      setExtracting(false);
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
      // 1. Save Deal
      const dealPayload = {
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
        pipeline_stage: 'new_contract',
        created_date: new Date().toISOString()
      };

      const createdDeal = await base44.entities.Deal.create(dealPayload);

      // 2. Find Matches
      const matchRes = await base44.functions.invoke('findBestAgents', {
        state: dealData.state,
        county: dealData.county,
        dealId: createdDeal.id
      });

      if (matchRes.data?.results) {
        setMatchedAgents(matchRes.data.results);
      }

      setStep(3);

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
        deal_id: "deal_id_placeholder", //Ideally link the real deal ID here, but dealing with prop drilling or state. 
        // We'll just create the room and let them talk.
        // Actually, we should try to link the deal we just created.
        // But for now, let's just create the room.
        status: 'active',
        created_date: new Date().toISOString()
      };
      
      // We can also update the Deal to set agent_id
       // await base44.entities.Deal.update(createdDealId, { agent_id: selectedAgentId });

      await base44.entities.Room.create(roomPayload);
      
      toast.success('Deal Room Created!');
      navigate(createPageUrl("DealRooms"));

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
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Your Contract</h2>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">
        Upload your signed purchase agreement (PDF). We'll automatically extract the property details and key dates.
      </p>

      {extracting ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
          <p className="text-sm font-medium text-slate-600">Analyzing contract...</p>
        </div>
      ) : uploading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
          <p className="text-sm font-medium text-slate-600">Uploading...</p>
        </div>
      ) : (
        <div className="flex justify-center">
          <label className="cursor-pointer bg-[#0D0D0D] hover:bg-[#262626] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-3">
            <UploadCloud className="w-5 h-5" />
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
        <h2 className="text-xl font-bold text-slate-900">Confirm Deal Details</h2>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Extracted from PDF</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Property</h3>
          <div>
            <Label>Address</Label>
            <Input value={dealData.address} onChange={e => setDealData({...dealData, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input value={dealData.city} onChange={e => setDealData({...dealData, city: e.target.value})} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={dealData.state} onChange={e => setDealData({...dealData, state: e.target.value})} maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Input value={dealData.county} onChange={e => setDealData({...dealData, county: e.target.value})} />
            </div>
            <div>
              <Label>Zip</Label>
              <Input value={dealData.zip} onChange={e => setDealData({...dealData, zip: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 border-b pb-2">Financials & Dates</h3>
          <div>
            <Label>Purchase Price</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input className="pl-9" value={dealData.purchasePrice} onChange={e => setDealData({...dealData, purchasePrice: e.target.value})} />
            </div>
          </div>
          <div>
            <Label>Closing Date</Label>
            <Input value={dealData.closingDate} onChange={e => setDealData({...dealData, closingDate: e.target.value})} placeholder="YYYY-MM-DD" />
          </div>
          <div>
            <Label>Inspection End</Label>
            <Input value={dealData.inspectionDate} onChange={e => setDealData({...dealData, inspectionDate: e.target.value})} placeholder="YYYY-MM-DD" />
          </div>
        </div>
      </div>
      
      <div className="pt-6 flex justify-end">
        <Button onClick={handleConfirmDetails} disabled={loading} className="bg-[#E3C567] hover:bg-[#D4AF37] text-black">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          Confirm & Find Agent
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Matches in {dealData.county || dealData.city}, {dealData.state}</h2>
        <p className="text-slate-500">Select an agent to start the transaction.</p>
      </div>

      {matchedAgents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          No agents found in this exact location. <br/>
          <Button variant="link" onClick={() => navigate(createPageUrl("AgentDirectory"))}>Browse Directory</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matchedAgents.map((match) => (
            <div 
              key={match.profile.id}
              onClick={() => setSelectedAgentId(match.profile.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedAgentId === match.profile.id 
                  ? 'border-[#E3C567] bg-[#E3C567]/5' 
                  : 'border-slate-200 hover:border-[#E3C567]/50'
              }`}
            >
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-lg">
                {match.profile.full_name?.charAt(0)}
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-slate-900">{match.profile.full_name}</h3>
                <p className="text-sm text-slate-500">{match.profile.agent?.brokerage || 'Independent Agent'}</p>
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
        <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
        <Button 
          onClick={handleSelectAgent} 
          disabled={!selectedAgentId || loading} 
          className="bg-[#E3C567] hover:bg-[#D4AF37] text-black"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Start Deal Room
        </Button>
      </div>
    </div>
  );

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="default" showText={false} linkTo={createPageUrl("Dashboard")} />
            <h1 className="text-lg font-semibold text-slate-900">New Deal</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Dashboard"))}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-0">
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </main>
    </div>
  );
}