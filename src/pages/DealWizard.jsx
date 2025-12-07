import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { upsertInvestorOnboarding, matchInvestor, findBestAgents } from '@/components/functions';
import { createPageUrl } from '@/components/utils';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  X, ArrowRight, ArrowLeft, Loader2, Home, 
  DollarSign, Calendar, ClipboardList, CheckCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const PROPERTY_TYPES = ['Single-Family', 'Multi-Family', 'Commercial', 'Land', 'Mixed-Use', 'Other'];
const INVESTMENT_STRATEGIES = ['Fix & Flip', 'Buy & Hold Rental', 'BRRRR', 'Wholesale', 'New Construction', 'Short-Term Rental', 'Other'];
const FINANCING_OPTIONS = ['Cash', 'Conventional Loan', 'Hard Money', 'Private Lending', 'Seller Financing', 'Other'];
const TIMELINE_OPTIONS = ['ASAP', '1-3 months', '3-6 months', '6-12 months', '1+ year'];

const STEPS = [
  { id: 1, title: 'Property Details', icon: Home },
  { id: 2, title: 'Investment Strategy', icon: DollarSign },
  { id: 3, title: 'Budget & Timeline', icon: Calendar },
  { id: 4, title: 'Requirements', icon: ClipboardList },
  { id: 5, title: 'Review & Submit', icon: CheckCircle }
];

export default function DealWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [findingMatches, setFindingMatches] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Property Details
    propertyAddress: '',
    city: '',
    state: '',
    zip: '',
    propertyType: '',
    priceMin: '',
    priceMax: '',
    
    // Step 2: Investment Strategy
    investmentStrategy: '',
    targetReturn: '',
    holdPeriod: '',
    strategyNotes: '',
    
    // Step 3: Budget & Timeline
    totalBudget: '',
    downPayment: '',
    financingType: '',
    timeline: '',
    
    // Step 4: Requirements
    mustHaves: [],
    niceToHaves: [],
    dealBreakers: '',
    additionalNotes: ''
  });

  useEffect(() => {
    document.title = "Submit New Deal - Investor Konnect";
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        toast.error('Please sign in to submit a deal');
        navigate(createPageUrl("Home"));
        return;
      }
      
      // Load existing buy box data from profile
      const emailLower = user.email.toLowerCase().trim();
      let profiles = await base44.entities.Profile.filter({ email: emailLower });
      if (!profiles || profiles.length === 0) {
        profiles = await base44.entities.Profile.filter({ user_id: user.id });
      }
      const profile = profiles[0];
      
      if (profile?.investor?.buy_box) {
        const buyBox = profile.investor.buy_box;
        setFormData(prev => ({
          ...prev,
          propertyAddress: buyBox.propertyAddress || '',
          city: buyBox.city || '',
          state: buyBox.state || '',
          zip: buyBox.zip || '',
          propertyType: buyBox.propertyType || '',
          priceMin: buyBox.priceMin || '',
          priceMax: buyBox.priceMax || '',
          investmentStrategy: buyBox.investmentStrategy || '',
          targetReturn: buyBox.targetReturn || '',
          holdPeriod: buyBox.holdPeriod || '',
          strategyNotes: buyBox.strategyNotes || '',
          totalBudget: buyBox.totalBudget || '',
          downPayment: buyBox.downPayment || '',
          financingType: buyBox.financingType || '',
          timeline: buyBox.timeline || '',
          mustHaves: buyBox.mustHaves || [],
          niceToHaves: buyBox.niceToHaves || [],
          dealBreakers: buyBox.dealBreakers || '',
          additionalNotes: buyBox.additionalNotes || ''
        }));
      }
    } catch (err) {
      console.error('Error loading data:', err);
      navigate(createPageUrl("Home"));
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter(i => i !== item) };
      }
      return { ...prev, [field]: [...arr, item] };
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.state && formData.propertyType;
      case 2:
        return formData.investmentStrategy;
      case 3:
        return formData.totalBudget && formData.timeline;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      // Create a Deal entity record
      const dealTitle = `${formData.propertyType} in ${formData.city || formData.state}`;
      const dealData = {
        title: dealTitle,
        description: formData.strategyNotes || `${formData.investmentStrategy} deal`,
        property_address: formData.propertyAddress || '',
        property_type: formData.propertyType,
        budget: parseFloat(formData.totalBudget?.replace(/[^0-9.]/g, '')) || 0,
        status: 'active',
        notes: JSON.stringify({
          ...formData,
          submitted_at: new Date().toISOString()
        })
      };
      
      try {
        await base44.entities.Deal.create(dealData);
      } catch (dealErr) {
        console.log('Could not create Deal entity:', dealErr.message);
        // Store in sessionStorage as fallback
        const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
        storedDeals.push({
          id: `deal-${Date.now()}`,
          ...dealData,
          created_date: new Date().toISOString()
        });
        sessionStorage.setItem('user_deals', JSON.stringify(storedDeals));
      }
      
      // Save buy box and deal submission to profile for matching
      try {
        const user = await base44.auth.me();
        const emailLower = user.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles || profiles.length === 0) {
          profiles = await base44.entities.Profile.filter({ user_id: user.id });
        }
        const profile = profiles[0];
        
        if (profile) {
          await base44.entities.Profile.update(profile.id, {
            investor: {
              ...profile.investor,
              buy_box: { ...formData },
              deal_submission: {
                ...formData,
                submitted_at: new Date().toISOString()
              }
            }
          });
        }
      } catch (saveErr) {
        console.log('Could not save buy box:', saveErr.message);
      }

      toast.success('Deal submitted successfully!');
      
      // Show finding matches animation
      setFindingMatches(true);
      
      // Trigger AI matching with the deal data
      try {
        await findBestAgents({ 
          limit: 3,
          dealSubmission: formData 
        });
      } catch (matchErr) {
        console.log('AI matching:', matchErr.message);
        try {
          await matchInvestor();
        } catch (fallbackErr) {
          // Continue even if matching fails
        }
      }
      
      // Create Room entries for each matched agent
      try {
        const user = await base44.auth.me();
        const emailLower = user.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles || profiles.length === 0) {
          profiles = await base44.entities.Profile.filter({ user_id: user.id });
        }
        const investorProfile = profiles[0];
        
        // Get matched agents from sessionStorage or create demo ones
        const matchedAgents = JSON.parse(sessionStorage.getItem('matched_agents') || '[]');
        const agentsToMatch = matchedAgents.length > 0 ? matchedAgents.slice(0, 5) : [
          { id: 'agent-1', full_name: 'Sarah Mitchell', agent: { bio: 'Expert in residential investments' } },
          { id: 'agent-2', full_name: 'John Davis', agent: { bio: 'Commercial real estate specialist' } },
          { id: 'agent-3', full_name: 'Emily Roberts', agent: { bio: 'Fix & flip expert' } }
        ];
        
        const rooms = [];
        for (const agent of agentsToMatch) {
          const room = {
            id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            investorId: investorProfile?.id || 'investor-temp',
            agentId: agent.id,
            counterparty_name: agent.full_name || agent.agent?.bio?.split(' ')[0] || 'Agent',
            counterparty_role: 'Agent',
            property_address: formData.propertyAddress || `${formData.propertyType} in ${formData.city || formData.state}`,
            budget: parseFloat(formData.totalBudget?.replace(/[^0-9.]/g, '')) || null,
            customer_name: investorProfile?.full_name || 'Investor',
            city: formData.city || '',
            state: formData.state || '',
            pipeline_stage: 'new_contract',
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString(),
            ndaAcceptedInvestor: false,
            ndaAcceptedAgent: false
          };
          
          rooms.push(room);
          
          // Try to create in database
          try {
            await base44.entities.Room.create(room);
          } catch (error) {
            console.log('Room will be created locally:', error.message);
          }
        }
        
        // Store in sessionStorage for immediate access
        const existingRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        sessionStorage.setItem('demo_rooms', JSON.stringify([...existingRooms, ...rooms]));
      } catch (error) {
        console.log('Room creation skipped:', error.message);
      }
      
      // Wait for animation then navigate to AgentDirectory to see suggested agents
      setTimeout(() => {
        navigate(createPageUrl("AgentDirectory"), { replace: true });
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting deal:', error);
      toast.error('Failed to submit deal. Please try again.');
      setSubmitting(false);
      setFindingMatches(false);
    }
  };

  const handleClose = () => {
    navigate(createPageUrl("Dashboard"));
  };

  // Finding matches animation
  if (findingMatches) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF3C7] to-[#FFFBEB] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-[#D3A029] rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-4 border-[#D3A029] border-t-transparent animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Finding your perfect matches...</h2>
          <p className="text-slate-600">Our AI is analyzing agents in your target market</p>
        </div>
      </div>
    );
  }

  const progress = (step / 5) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="default" showText={false} linkTo={createPageUrl("DealRooms")} />
            <h1 className="text-lg font-semibold text-slate-900">Submit New Deal</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isComplete = step > s.id;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isComplete ? 'bg-green-500 text-white' :
                    isActive ? 'bg-[#D3A029] text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`hidden sm:block text-sm ${isActive ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          
          {/* Step 1: Property Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Property Details</h2>
                <p className="text-slate-600">Tell us about the property you're looking for</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property Address (optional)</label>
                  <Input 
                    placeholder="Street address"
                    value={formData.propertyAddress}
                    onChange={(e) => updateFormData('propertyAddress', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Input 
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => updateFormData('city', e.target.value)}
                  />
                  <Select value={formData.state} onValueChange={(v) => updateFormData('state', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="State *" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="ZIP"
                    value={formData.zip}
                    onChange={(e) => updateFormData('zip', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Property Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROPERTY_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => updateFormData('propertyType', type)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          formData.propertyType === type
                            ? 'border-[#D3A029] bg-[#FEF3C7] text-slate-900'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Price Range</label>
                  <div className="flex items-center gap-3">
                    <Input 
                      placeholder="$100,000"
                      value={formData.priceMin}
                      onChange={(e) => updateFormData('priceMin', e.target.value)}
                    />
                    <span className="text-slate-500">to</span>
                    <Input 
                      placeholder="$500,000"
                      value={formData.priceMax}
                      onChange={(e) => updateFormData('priceMax', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Investment Strategy */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Investment Strategy</h2>
                <p className="text-slate-600">How do you plan to profit from this deal?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Strategy *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {INVESTMENT_STRATEGIES.map(strategy => (
                      <button
                        key={strategy}
                        onClick={() => updateFormData('investmentStrategy', strategy)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                          formData.investmentStrategy === strategy
                            ? 'border-[#D3A029] bg-[#FEF3C7] text-slate-900'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {strategy}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Return (%)</label>
                  <Input 
                    placeholder="e.g., 15% ROI"
                    value={formData.targetReturn}
                    onChange={(e) => updateFormData('targetReturn', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hold Period</label>
                  <Input 
                    placeholder="e.g., 6 months, 5 years"
                    value={formData.holdPeriod}
                    onChange={(e) => updateFormData('holdPeriod', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Strategy Notes</label>
                  <Textarea 
                    placeholder="Any additional details about your investment approach..."
                    value={formData.strategyNotes}
                    onChange={(e) => updateFormData('strategyNotes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Budget & Timeline */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Budget & Timeline</h2>
                <p className="text-slate-600">Your financial parameters for this deal</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget *</label>
                  <Input 
                    placeholder="$500,000"
                    value={formData.totalBudget}
                    onChange={(e) => updateFormData('totalBudget', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Down Payment / Cash Available</label>
                  <Input 
                    placeholder="$100,000"
                    value={formData.downPayment}
                    onChange={(e) => updateFormData('downPayment', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Financing Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FINANCING_OPTIONS.map(option => (
                      <button
                        key={option}
                        onClick={() => updateFormData('financingType', option)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          formData.financingType === option
                            ? 'border-[#D3A029] bg-[#FEF3C7] text-slate-900'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Timeline *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TIMELINE_OPTIONS.map(option => (
                      <button
                        key={option}
                        onClick={() => updateFormData('timeline', option)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          formData.timeline === option
                            ? 'border-[#D3A029] bg-[#FEF3C7] text-slate-900'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Requirements */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Requirements</h2>
                <p className="text-slate-600">What matters most in this deal?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Must-Haves</label>
                  <div className="space-y-2">
                    {['Close to schools', 'Low crime area', 'Good rental demand', 'Value-add potential', 'Turnkey ready', 'Owner financing available'].map(item => (
                      <label key={item} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <Checkbox 
                          checked={formData.mustHaves.includes(item)}
                          onCheckedChange={() => toggleArrayItem('mustHaves', item)}
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deal Breakers</label>
                  <Textarea 
                    placeholder="What would make you walk away from this deal?"
                    value={formData.dealBreakers}
                    onChange={(e) => updateFormData('dealBreakers', e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                  <Textarea 
                    placeholder="Anything else agents should know..."
                    value={formData.additionalNotes}
                    onChange={(e) => updateFormData('additionalNotes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Review & Submit</h2>
                <p className="text-slate-600">Make sure everything looks good before submitting</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Property Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Location:</span> {formData.city ? `${formData.city}, ` : ''}{formData.state}</div>
                    <div><span className="text-slate-500">Type:</span> {formData.propertyType}</div>
                    <div><span className="text-slate-500">Price Range:</span> {formData.priceMin || 'Any'} - {formData.priceMax || 'Any'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Investment Strategy</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Strategy:</span> {formData.investmentStrategy}</div>
                    <div><span className="text-slate-500">Target Return:</span> {formData.targetReturn || 'Not specified'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Budget & Timeline</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Budget:</span> {formData.totalBudget}</div>
                    <div><span className="text-slate-500">Financing:</span> {formData.financingType || 'Not specified'}</div>
                    <div><span className="text-slate-500">Timeline:</span> {formData.timeline}</div>
                  </div>
                </div>

                {formData.mustHaves.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-slate-900">Requirements</h3>
                    <div className="flex flex-wrap gap-2">
                      {formData.mustHaves.map(item => (
                        <span key={item} className="px-3 py-1 bg-[#FEF3C7] text-[#92400E] text-sm rounded-full">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {step < 5 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2 bg-[#D3A029] hover:bg-[#B8902A]"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-[#D3A029] hover:bg-[#B8902A]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Find Matching Agents
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}