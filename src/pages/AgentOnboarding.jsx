import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { upsertAgentOnboarding } from "@/components/functions";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

const SPECIALTIES = [
  "Residential (SFR)",
  "Multi-Family (2–4)",
  "Multi-Family (5+)",
  "Commercial (retail/office/industrial/mixed-use)",
  "Investment Properties",
  "Vacation/STR",
  "Land / Development",
  "REO / Foreclosure",
  "Short Sales",
  "New Construction",
  "Luxury"
];

const INVESTMENT_STRATEGIES = [
  "Fix-and-flip",
  "Buy & hold (long-term rentals)",
  "Short-term / vacation rentals",
  "BRRRR (buy, rehab, rent, refinance, repeat)",
  "Wholesaling",
  "New development / construction",
  "Syndications / JV structures",
  "Other"
];

const DEAL_SOURCING_METHODS = [
  "Networking with other agents",
  "MLS / Online portals",
  "Direct mail / marketing to owners",
  "Driving neighborhoods (\"driving for dollars\")",
  "Auctions / courthouse sales",
  "Wholesaler contacts",
  "Referrals from past clients",
  "Other"
];

const MARKETING_METHODS = [
  "Professional photography / listings",
  "Online ads / portals",
  "Social media promotion",
  "Email newsletters to buyers/investors",
  "Investor meetups / networking groups",
  "Open houses or tours",
  "Other"
];

const INVESTOR_TYPES = [
  "First-time investors",
  "Repeat/portfolio investors",
  "High-net-worth individuals",
  "Out-of-state investors",
  "Institutional / fund clients",
  "Other"
];

const METRICS_USED = [
  "Cap rate",
  "Cash-on-cash return",
  "Cash flow",
  "After Repair Value (ARV)",
  "IRR (Internal Rate of Return)",
  "Rent-to-price ratio",
  "Other"
];

const PRO_NETWORK_TYPES = [
  "Lenders / Loan officers",
  "General contractors",
  "Property managers",
  "Real estate attorneys",
  "Home inspectors",
  "Title / escrow companies",
  "Insurance agents",
  "Accountants / CPAs",
  "Other"
];

const LANGUAGES = ["English", "Spanish", "Chinese (Mandarin)", "Chinese (Cantonese)", "French", "German", "Italian", "Portuguese", "Russian", "Arabic", "Korean", "Japanese", "Vietnamese", "Tagalog", "Hindi", "Other"];

const COMMUNICATION_CHANNELS = ["Email", "Phone", "SMS/Text", "Video calls", "In-person", "Other"];

/**
 * AGENT ONBOARDING v2 - EXTENDED 5-Step Wizard
 * 
 * Same 5 steps, much deeper questions within each step
 */
function AgentOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Basic Info & Work Style
    full_name: '',
    phone: '',
    is_full_time_agent: null,
    experience_years: '',
    investor_experience_years: '',
    languages_spoken: [],
    preferred_communication_channels: [],
    works_in_team: null,
    team_role_notes: '',
    
    // Step 2: License & Jurisdiction
    license_number: '',
    license_state: '',
    license_type: '',
    licensed_states: [],
    state_experience_years: {},
    has_discipline_history: null,
    
    // Step 3: Markets & Sourcing
    markets: [],
    primary_neighborhoods_notes: '',
    deal_sourcing_methods: [],
    sources_off_market: null,
    off_market_methods_notes: '',
    marketing_methods: [],
    
    // Step 4: Specialties, Strategy & Deal Profile
    specialties: [],
    investment_strategies: [],
    typical_deal_price_range: '',
    investor_types_served: [],
    metrics_used: [],
    risk_approach_score: null,
    what_sets_you_apart: '',
    
    // Step 5: Experience with Investors, Service Model, Bio & Fit
    investor_clients_count: '',
    active_client_count: '',
    investment_deals_last_12m: '',
    client_focus: '',
    investor_client_percent_bucket: '',
    investor_friendly: null,
    personally_invests: null,
    personal_investing_notes: '',
    update_frequency: '',
    typical_response_time: '',
    pro_network_types: [],
    can_refer_professionals: null,
    refer_professionals_notes: '',
    can_provide_investor_references: null,
    investor_certifications: '',
    keeps_up_with_trends_notes: '',
    commission_structure: '',
    case_study_best_deal: '',
    why_good_fit_notes: '',
    investment_philosophy_notes: '',
    strengths_and_challenges_notes: '',
    bio: ''
  });

  const TOTAL_STEPS = 5;

  useEffect(() => {
    document.title = "Agent Onboarding - Investor Konnect";

    // Load existing profile data if available
    if (profile && profile.agent) {
      const a = profile.agent;
      setFormData({
        // Step 1
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        is_full_time_agent: a.is_full_time_agent ?? null,
        experience_years: a.experience_years || '',
        investor_experience_years: a.investor_experience_years || '',
        languages_spoken: a.languages_spoken || [],
        preferred_communication_channels: a.preferred_communication_channels || [],
        works_in_team: a.works_in_team ?? null,
        team_role_notes: a.team_role_notes || '',
        
        // Step 2
        license_number: a.license_number || profile.license_number || '',
        license_state: a.license_state || profile.license_state || '',
        license_type: a.license_type || '',
        licensed_states: a.licensed_states || [],
        state_experience_years: a.state_experience_years || {},
        has_discipline_history: a.has_discipline_history ?? null,
        
        // Step 3
        markets: a.markets || profile.markets || [],
        primary_neighborhoods_notes: a.primary_neighborhoods_notes || '',
        deal_sourcing_methods: a.deal_sourcing_methods || [],
        sources_off_market: a.sources_off_market ?? null,
        off_market_methods_notes: a.off_market_methods_notes || '',
        marketing_methods: a.marketing_methods || [],
        
        // Step 4
        specialties: a.specialties || [],
        investment_strategies: a.investment_strategies || [],
        typical_deal_price_range: a.typical_deal_price_range || '',
        investor_types_served: a.investor_types_served || [],
        metrics_used: a.metrics_used || [],
        risk_approach_score: a.risk_approach_score || null,
        what_sets_you_apart: a.what_sets_you_apart || '',
        
        // Step 5
        investor_clients_count: a.investor_clients_count || '',
        active_client_count: a.active_client_count || '',
        investment_deals_last_12m: a.investment_deals_last_12m || '',
        client_focus: a.client_focus || '',
        investor_client_percent_bucket: a.investor_client_percent_bucket || '',
        investor_friendly: a.investor_friendly ?? null,
        personally_invests: a.personally_invests ?? null,
        personal_investing_notes: a.personal_investing_notes || '',
        update_frequency: a.update_frequency || '',
        typical_response_time: a.typical_response_time || '',
        pro_network_types: a.pro_network_types || [],
        can_refer_professionals: a.can_refer_professionals ?? null,
        refer_professionals_notes: a.refer_professionals_notes || '',
        can_provide_investor_references: a.can_provide_investor_references ?? null,
        investor_certifications: a.investor_certifications || '',
        keeps_up_with_trends_notes: a.keeps_up_with_trends_notes || '',
        commission_structure: a.commission_structure || '',
        case_study_best_deal: a.case_study_best_deal || '',
        why_good_fit_notes: a.why_good_fit_notes || '',
        investment_philosophy_notes: a.investment_philosophy_notes || '',
        strengths_and_challenges_notes: a.strengths_and_challenges_notes || '',
        bio: a.bio || ''
      });
    }
  }, [profile]);

  const toggleItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const handleSkipLicense = () => {
    console.log('[AgentOnboarding] Skipping license step');
    toast.info("You can add your license later from your dashboard");
    setStep(3);
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.full_name.trim()) {
          toast.error("Please enter your full name");
          return false;
        }
        if (!formData.phone.trim()) {
          toast.error("Please enter your phone number");
          return false;
        }
        if (formData.is_full_time_agent === null) {
          toast.error("Please indicate if you're a full-time agent");
          return false;
        }
        if (!formData.experience_years) {
          toast.error("Please select your years of experience");
          return false;
        }
        if (!formData.investor_experience_years && formData.investor_experience_years !== 0) {
          toast.error("Please select your investor-specific experience");
          return false;
        }
        if (formData.languages_spoken.length === 0) {
          toast.error("Please select at least one language");
          return false;
        }
        if (formData.preferred_communication_channels.length === 0) {
          toast.error("Please select at least one communication channel");
          return false;
        }
        if (formData.works_in_team === null) {
          toast.error("Please indicate if you work in a team");
          return false;
        }
        return true;

      case 2:
        // License is optional when skipping
        return true;

      case 3:
        if (formData.markets.length === 0) {
          toast.error("Please select at least one market");
          return false;
        }
        if (formData.deal_sourcing_methods.length === 0) {
          toast.error("Please select at least one deal sourcing method");
          return false;
        }
        if (formData.sources_off_market === null) {
          toast.error("Please indicate if you source off-market deals");
          return false;
        }
        if (formData.marketing_methods.length === 0) {
          toast.error("Please select at least one marketing method");
          return false;
        }
        return true;

      case 4:
        if (formData.specialties.length === 0) {
          toast.error("Please select at least one specialty");
          return false;
        }
        if (formData.investment_strategies.length === 0) {
          toast.error("Please select at least one investment strategy");
          return false;
        }
        if (!formData.typical_deal_price_range) {
          toast.error("Please select typical deal price range");
          return false;
        }
        if (formData.investor_types_served.length === 0) {
          toast.error("Please select at least one investor type");
          return false;
        }
        if (formData.metrics_used.length === 0) {
          toast.error("Please select at least one metric");
          return false;
        }
        if (!formData.risk_approach_score) {
          toast.error("Please rate your risk approach");
          return false;
        }
        return true;

      case 5:
        if (!formData.investor_clients_count && formData.investor_clients_count !== 0) {
          toast.error("Please select investor clients count");
          return false;
        }
        if (!formData.active_client_count && formData.active_client_count !== 0) {
          toast.error("Please select active clients count");
          return false;
        }
        if (!formData.investment_deals_last_12m && formData.investment_deals_last_12m !== 0) {
          toast.error("Please select investment deals in last 12 months");
          return false;
        }
        if (!formData.client_focus) {
          toast.error("Please select buyer/seller focus");
          return false;
        }
        if (!formData.investor_client_percent_bucket) {
          toast.error("Please select investor client percentage");
          return false;
        }
        if (formData.investor_friendly === null) {
          toast.error("Please indicate if you prioritize investor clients");
          return false;
        }
        if (formData.personally_invests === null) {
          toast.error("Please indicate if you personally invest");
          return false;
        }
        if (!formData.update_frequency) {
          toast.error("Please select update frequency");
          return false;
        }
        if (!formData.typical_response_time) {
          toast.error("Please select typical response time");
          return false;
        }
        if (formData.pro_network_types.length === 0) {
          toast.error("Please select at least one professional network type");
          return false;
        }
        if (formData.can_refer_professionals === null) {
          toast.error("Please indicate if you can refer professionals");
          return false;
        }
        if (formData.can_provide_investor_references === null) {
          toast.error("Please indicate if you can provide references");
          return false;
        }
        if (!formData.commission_structure) {
          toast.error("Please select commission structure");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) {
      return;
    }

    if (step === TOTAL_STEPS) {
      await handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      console.log('[AgentOnboarding] 🎯 Submitting v2-agent onboarding...');

      const response = await upsertAgentOnboarding(formData);

      if (response.data?.ok) {
        console.log('[AgentOnboarding] ✅ Onboarding saved, nextStep:', response.data.nextStep);
        
        // Refresh profile to get updated data
        await refresh();
        
        toast.success("Profile completed! Next: verify your identity.");
        
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // CRITICAL: Route based on nextStep from backend
        const nextStep = response.data.nextStep;
        
        if (nextStep === 'verify') {
          console.log('[AgentOnboarding] Going to Persona verification');
          navigate(createPageUrl("Verify"), { replace: true });
        } else if (nextStep === 'nda') {
          console.log('[AgentOnboarding] Going to NDA');
          navigate(createPageUrl("NDA"), { replace: true });
        } else {
          console.log('[AgentOnboarding] Going to Dashboard');
          navigate(createPageUrl("Dashboard"), { replace: true });
        }
      } else {
        throw new Error(response.data?.message || 'Failed to save onboarding');
      }
    } catch (error) {
      console.error('[AgentOnboarding] ❌ Submit error:', error);
      toast.error(error.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-sm font-medium text-emerald-600">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Deep profile • Takes 10-15 minutes</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200 max-h-[calc(100vh-200px)] overflow-y-auto">
          
          {/* STEP 1: Basic Info & Work Style */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Basic info & work style</h2>
                <p className="text-slate-600">Tell us about yourself and how you work</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="Jane Doe" className="py-6" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+1 (555) 123-4567" className="py-6" />
              </div>

              <div className="space-y-3">
                <Label>Are you a full-time real estate agent? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, is_full_time_agent: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.is_full_time_agent === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200 hover:border-emerald-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exp_years">How many years have you worked as a licensed real estate agent? *</Label>
                <select id="exp_years" value={formData.experience_years} onChange={(e) => setFormData({...formData, experience_years: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="1">0–1 years</option>
                  <option value="5">2–5 years</option>
                  <option value="10">6–10 years</option>
                  <option value="11">10+ years</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv_exp">How many years have you worked specifically with investor clients? *</Label>
                <select id="inv_exp" value={formData.investor_experience_years} onChange={(e) => setFormData({...formData, investor_experience_years: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="0">0–1 years</option>
                  <option value="3">2–5 years</option>
                  <option value="8">6–10 years</option>
                  <option value="11">10+ years</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Which languages do you speak fluently with clients? *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto bg-slate-50 p-3 rounded-lg">
                  {LANGUAGES.map(lang => (
                    <div key={lang} className="flex items-center gap-2">
                      <Checkbox id={`lang-${lang}`} checked={formData.languages_spoken.includes(lang)} onCheckedChange={() => toggleItem('languages_spoken', lang)} />
                      <Label htmlFor={`lang-${lang}`} className="cursor-pointer font-normal text-sm">{lang}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{formData.languages_spoken.length} selected</p>
              </div>

              <div className="space-y-3">
                <Label>How do you prefer to communicate with clients? *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {COMMUNICATION_CHANNELS.map(ch => (
                    <div key={ch} className="flex items-center gap-2">
                      <Checkbox id={`ch-${ch}`} checked={formData.preferred_communication_channels.includes(ch)} onCheckedChange={() => toggleItem('preferred_communication_channels', ch)} />
                      <Label htmlFor={`ch-${ch}`} className="cursor-pointer font-normal text-sm">{ch}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Do you work independently or as part of a team? *</Label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setFormData({...formData, works_in_team: false})} className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.works_in_team === false ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                    I work independently
                  </button>
                  <button type="button" onClick={() => setFormData({...formData, works_in_team: true})} className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.works_in_team === true ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                    I work as part of a team
                  </button>
                </div>
                {formData.works_in_team && (
                  <div className="mt-3">
                    <Label htmlFor="team_notes">Which tasks do you handle vs your team? (optional)</Label>
                    <Textarea id="team_notes" value={formData.team_role_notes} onChange={(e) => setFormData({...formData, team_role_notes: e.target.value})} placeholder="e.g., I handle client relations; team handles paperwork..." rows={3} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: License & Jurisdiction */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">License & jurisdiction</h2>
                <p className="text-slate-600">We'll verify this information (optional for now)</p>
              </div>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    You can skip this step and add your license later from your dashboard.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">License Number</Label>
                <Input id="license" value={formData.license_number} onChange={(e) => setFormData({...formData, license_number: e.target.value})} placeholder="ABC123456" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_state">License State</Label>
                <select id="license_state" value={formData.license_state} onChange={(e) => setFormData({...formData, license_state: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select a state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {formData.license_number && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="license_type">What type of license do you hold?</Label>
                    <select id="license_type" value={formData.license_type} onChange={(e) => setFormData({...formData, license_type: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                      <option value="">Select type</option>
                      <option value="Salesperson / Agent">Salesperson / Agent</option>
                      <option value="Broker">Broker</option>
                      <option value="Broker Associate / Dual">Broker Associate / Dual</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <Label>In which states do you hold an active license?</Label>
                    <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto bg-slate-50 p-3 rounded-lg">
                      {US_STATES.map(s => (
                        <button key={s} type="button" onClick={() => toggleItem('licensed_states', s)}
                          className={`p-2 rounded border text-sm ${formData.licensed_states.includes(s) ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Have you ever been disciplined by a real estate regulatory authority?</Label>
                    <div className="flex gap-4">
                      {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                        <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, has_discipline_history: opt.val})}
                          className={`flex-1 p-4 rounded-lg border-2 ${formData.has_discipline_history === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Markets & Sourcing */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Markets & sourcing</h2>
                <p className="text-slate-600">Where you work and how you find deals</p>
              </div>

              <div className="space-y-3">
                <Label>Which states do you operate in? *</Label>
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto bg-slate-50 p-3 rounded-lg">
                  {US_STATES.map(s => (
                    <button key={s} type="button" onClick={() => toggleItem('markets', s)}
                      className={`p-2 rounded border text-sm ${formData.markets.includes(s) ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{formData.markets.length} selected</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhoods">Which cities or neighborhoods do you know best? (optional)</Label>
                <Textarea id="neighborhoods" value={formData.primary_neighborhoods_notes} onChange={(e) => setFormData({...formData, primary_neighborhoods_notes: e.target.value})} placeholder="e.g., Downtown Phoenix, Scottsdale..." rows={3} />
              </div>

              <div className="space-y-3">
                <Label>How do you usually find investment properties? *</Label>
                <div className="space-y-2">
                  {DEAL_SOURCING_METHODS.map(m => (
                    <div key={m} className="flex items-center gap-2">
                      <Checkbox id={`dsm-${m}`} checked={formData.deal_sourcing_methods.includes(m)} onCheckedChange={() => toggleItem('deal_sourcing_methods', m)} />
                      <Label htmlFor={`dsm-${m}`} className="cursor-pointer font-normal text-sm">{m}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Do you proactively source off-market deals? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, sources_off_market: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 ${formData.sources_off_market === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {formData.sources_off_market && (
                  <div className="mt-3">
                    <Label htmlFor="off_market_notes">How do you find off-market opportunities? (optional)</Label>
                    <Textarea id="off_market_notes" value={formData.off_market_methods_notes} onChange={(e) => setFormData({...formData, off_market_methods_notes: e.target.value})} placeholder="e.g., Direct mail campaigns, networking..." rows={3} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>How do you market properties for investor clients? *</Label>
                <div className="space-y-2">
                  {MARKETING_METHODS.map(m => (
                    <div key={m} className="flex items-center gap-2">
                      <Checkbox id={`mm-${m}`} checked={formData.marketing_methods.includes(m)} onCheckedChange={() => toggleItem('marketing_methods', m)} />
                      <Label htmlFor={`mm-${m}`} className="cursor-pointer font-normal text-sm">{m}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Specialties, Strategy & Deal Profile */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Specialties & strategy</h2>
                <p className="text-slate-600">Property types and investment approaches</p>
              </div>

              <div className="space-y-3">
                <Label>What types of properties do you focus on? *</Label>
                <div className="space-y-2">
                  {SPECIALTIES.map(sp => (
                    <div key={sp} className="flex items-center gap-2">
                      <Checkbox id={`sp-${sp}`} checked={formData.specialties.includes(sp)} onCheckedChange={() => toggleItem('specialties', sp)} />
                      <Label htmlFor={`sp-${sp}`} className="cursor-pointer font-normal text-sm">{sp}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Which investment strategies do you support? *</Label>
                <div className="space-y-2">
                  {INVESTMENT_STRATEGIES.map(st => (
                    <div key={st} className="flex items-center gap-2">
                      <Checkbox id={`st-${st}`} checked={formData.investment_strategies.includes(st)} onCheckedChange={() => toggleItem('investment_strategies', st)} />
                      <Label htmlFor={`st-${st}`} className="cursor-pointer font-normal text-sm">{st}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_range">Typical deal price range? *</Label>
                <select id="price_range" value={formData.typical_deal_price_range} onChange={(e) => setFormData({...formData, typical_deal_price_range: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="Under $100k">Under $100k</option>
                  <option value="$100k–$300k">$100k–$300k</option>
                  <option value="$300k–$600k">$300k–$600k</option>
                  <option value="$600k–$1M">$600k–$1M</option>
                  <option value="Over $1M">Over $1M</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Which types of investors do you work with? *</Label>
                <div className="space-y-2">
                  {INVESTOR_TYPES.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <Checkbox id={`it-${t}`} checked={formData.investor_types_served.includes(t)} onCheckedChange={() => toggleItem('investor_types_served', t)} />
                      <Label htmlFor={`it-${t}`} className="cursor-pointer font-normal text-sm">{t}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Which metrics do you use to evaluate properties? *</Label>
                <div className="space-y-2">
                  {METRICS_USED.map(m => (
                    <div key={m} className="flex items-center gap-2">
                      <Checkbox id={`met-${m}`} checked={formData.metrics_used.includes(m)} onCheckedChange={() => toggleItem('metrics_used', m)} />
                      <Label htmlFor={`met-${m}`} className="cursor-pointer font-normal text-sm">{m}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Rate your risk approach (1 = conservative, 5 = aggressive) *</Label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setFormData({...formData, risk_approach_score: n})}
                      className={`flex-1 p-4 rounded-lg border-2 text-lg font-semibold ${formData.risk_approach_score === n ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sets_apart">What sets you apart when working with investors? (optional)</Label>
                <Textarea id="sets_apart" value={formData.what_sets_you_apart} onChange={(e) => setFormData({...formData, what_sets_you_apart: e.target.value})} placeholder="e.g., Deep market knowledge, strong contractor network..." rows={4} />
              </div>
            </div>
          )}

          {/* STEP 5: Experience with Investors, Service Model, Bio & Fit */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Investor experience & fit</h2>
                <p className="text-slate-600">Your track record and service approach</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv_count">About how many investor clients have you worked with? *</Label>
                <select id="inv_count" value={formData.investor_clients_count} onChange={(e) => setFormData({...formData, investor_clients_count: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="0">0 (new to investors)</option>
                  <option value="3">1–3</option>
                  <option value="10">4–10</option>
                  <option value="20">10+</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="active_count">How many active clients do you have now? *</Label>
                <select id="active_count" value={formData.active_client_count} onChange={(e) => setFormData({...formData, active_client_count: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="3">0–5</option>
                  <option value="8">6–10</option>
                  <option value="15">11–20</option>
                  <option value="25">21+</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deals_12m">Investment transactions closed in last 12 months? *</Label>
                <select id="deals_12m" value={formData.investment_deals_last_12m} onChange={(e) => setFormData({...formData, investment_deals_last_12m: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="0">0</option>
                  <option value="2">1–3</option>
                  <option value="5">4–6</option>
                  <option value="8">7–10</option>
                  <option value="12">11+</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Are you mostly a buyer's agent, seller's agent, or both? *</Label>
                <div className="flex gap-3">
                  {[{val: 'buyers', label: 'Mostly buyers'}, {val: 'sellers', label: 'Mostly sellers'}, {val: 'both', label: 'Both equally'}].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setFormData({...formData, client_focus: opt.val})}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm ${formData.client_focus === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv_pct">What % of your clients are investors? *</Label>
                <select id="inv_pct" value={formData.investor_client_percent_bucket} onChange={(e) => setFormData({...formData, investor_client_percent_bucket: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select range</option>
                  <option value="0-25">0–25%</option>
                  <option value="26-50">26–50%</option>
                  <option value="51-75">51–75%</option>
                  <option value="76-100">76–100%</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Do you actively prioritize investor clients? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes, I focus on investors'}, {val: false, label: 'No, not my focus'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, investor_friendly: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 ${formData.investor_friendly === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Do you personally invest in real estate? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, personally_invests: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 ${formData.personally_invests === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {formData.personally_invests && (
                  <div className="mt-3">
                    <Label htmlFor="personal_inv">Describe your own investment experience (optional)</Label>
                    <Textarea id="personal_inv" value={formData.personal_investing_notes} onChange={(e) => setFormData({...formData, personal_investing_notes: e.target.value})} rows={3} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="upd_freq">How often do you update clients? *</Label>
                <select id="upd_freq" value={formData.update_frequency} onChange={(e) => setFormData({...formData, update_frequency: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select frequency</option>
                  <option value="Daily">Daily</option>
                  <option value="2–3 times per week">2–3 times per week</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Every other week">Every other week</option>
                  <option value="Only when material update">Only when material update</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resp_time">Typical response time to inquiries? *</Label>
                <select id="resp_time" value={formData.typical_response_time} onChange={(e) => setFormData({...formData, typical_response_time: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select time</option>
                  <option value="Within a few hours">Within a few hours</option>
                  <option value="Same day">Same day</option>
                  <option value="Within 1–2 days">Within 1–2 days</option>
                  <option value="More than 2 days">More than 2 days</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Which professionals do you have in your network? *</Label>
                <div className="space-y-2">
                  {PRO_NETWORK_TYPES.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <Checkbox id={`pro-${p}`} checked={formData.pro_network_types.includes(p)} onCheckedChange={() => toggleItem('pro_network_types', p)} />
                      <Label htmlFor={`pro-${p}`} className="cursor-pointer font-normal text-sm">{p}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Can you refer clients to professionals from your network? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, can_refer_professionals: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 ${formData.can_refer_professionals === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {formData.can_refer_professionals && (
                  <div className="mt-3">
                    <Label htmlFor="refer_notes">Which types can you refer? (optional)</Label>
                    <Input id="refer_notes" value={formData.refer_professionals_notes} onChange={(e) => setFormData({...formData, refer_professionals_notes: e.target.value})} placeholder="e.g., Lenders, contractors..." />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Can you provide investor client references? *</Label>
                <div className="flex gap-4">
                  {[{val: true, label: 'Yes'}, {val: false, label: 'No'}].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setFormData({...formData, can_provide_investor_references: opt.val})}
                      className={`flex-1 p-4 rounded-lg border-2 ${formData.can_provide_investor_references === opt.val ? 'border-emerald-600 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="certs">Investment certifications (optional)</Label>
                <Input id="certs" value={formData.investor_certifications} onChange={(e) => setFormData({...formData, investor_certifications: e.target.value})} placeholder="e.g., CIAS, CCIM..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trends">How do you stay informed about trends? (optional)</Label>
                <Textarea id="trends" value={formData.keeps_up_with_trends_notes} onChange={(e) => setFormData({...formData, keeps_up_with_trends_notes: e.target.value})} rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comm_struct">Your commission/fee structure? *</Label>
                <select id="comm_struct" value={formData.commission_structure} onChange={(e) => setFormData({...formData, commission_structure: e.target.value})} className="w-full px-4 py-3 border rounded-lg">
                  <option value="">Select structure</option>
                  <option value="Standard local commission">Standard local commission (%)</option>
                  <option value="Negotiable case by case">Negotiable case by case</option>
                  <option value="Flat fee model">Flat fee model</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case_study">Describe one of your best investment deals (optional)</Label>
                <Textarea id="case_study" value={formData.case_study_best_deal} onChange={(e) => setFormData({...formData, case_study_best_deal: e.target.value})} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="good_fit">Why are you a good fit for this platform? (optional)</Label>
                <Textarea id="good_fit" value={formData.why_good_fit_notes} onChange={(e) => setFormData({...formData, why_good_fit_notes: e.target.value})} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="philosophy">Your investment philosophy (optional)</Label>
                <Textarea id="philosophy" value={formData.investment_philosophy_notes} onChange={(e) => setFormData({...formData, investment_philosophy_notes: e.target.value})} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strengths">Your greatest strength and biggest challenge with investors (optional)</Label>
                <Textarea id="strengths" value={formData.strengths_and_challenges_notes} onChange={(e) => setFormData({...formData, strengths_and_challenges_notes: e.target.value})} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Tell investors how you work with them (optional)</Label>
                <Textarea id="bio" value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} placeholder="Describe your approach, strengths, connections..." rows={5} />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack} disabled={saving}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : <div />}
            
            <div className="flex gap-3">
              {step === 2 && (
                <Button variant="outline" onClick={handleSkipLicense} disabled={saving}>
                  Skip for now
                </Button>
              )}
              
              <Button onClick={handleNext} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : step === TOTAL_STEPS ? (
                  <>
                    Complete
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx + 1 === step ? 'w-8 bg-emerald-600' :
                idx + 1 < step ? 'w-2 bg-emerald-400' :
                'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AgentOnboarding() {
  return <AgentOnboardingContent />;
}