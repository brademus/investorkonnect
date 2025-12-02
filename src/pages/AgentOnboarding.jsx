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
const LANGUAGES = ["English", "Spanish", "Chinese (Mandarin)", "Chinese (Cantonese)", "French", "German", "Italian", "Portuguese", "Russian", "Arabic", "Korean", "Japanese", "Vietnamese", "Tagalog", "Hindi", "Other"];
const COMMUNICATION_CHANNELS = ["Email", "Phone", "SMS/Text", "Video calls", "In-person", "Other"];

function AgentOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh, user } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '', phone: '', is_full_time_agent: null, experience_years: '', investor_experience_years: '',
    languages_spoken: [], preferred_communication_channels: [], works_in_team: null, team_role_notes: '',
    license_number: '', license_state: '', license_type: '', licensed_states: [], state_experience_years: {}, has_discipline_history: null,
    markets: [], primary_neighborhoods_notes: '', deal_sourcing_methods: [], sources_off_market: null, off_market_methods_notes: '', marketing_methods: [],
    specialties: [], investment_strategies: [], typical_deal_price_range: '', investor_types_served: [], metrics_used: [], risk_approach_score: null, what_sets_you_apart: '',
    investor_clients_count: '', active_client_count: '', investment_deals_last_12m: '', client_focus: '', investor_client_percent_bucket: '',
    investor_friendly: null, personally_invests: null, personal_investing_notes: '', update_frequency: '', typical_response_time: '',
    pro_network_types: [], can_refer_professionals: null, refer_professionals_notes: '', can_provide_investor_references: null,
    investor_certifications: '', keeps_up_with_trends_notes: '', commission_structure: '', case_study_best_deal: '',
    why_good_fit_notes: '', investment_philosophy_notes: '', strengths_and_challenges_notes: '', bio: ''
  });

  const TOTAL_STEPS = 5;

  // ADMIN BYPASS: Skip onboarding for admin users
  useEffect(() => {
    if (user?.role === 'admin') {
      console.log('[AgentOnboarding] Admin user - skipping to dashboard');
      toast.success('Admin access granted - onboarding bypassed');
      navigate(createPageUrl("Dashboard"), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    document.title = "Agent Onboarding - Investor Konnect";
    if (profile && profile.agent) {
      const a = profile.agent;
      setFormData({
        full_name: profile.full_name || '', phone: profile.phone || '', is_full_time_agent: a.is_full_time_agent ?? null, experience_years: a.experience_years || '', investor_experience_years: a.investor_experience_years || '',
        languages_spoken: a.languages_spoken || [], preferred_communication_channels: a.preferred_communication_channels || [], works_in_team: a.works_in_team ?? null, team_role_notes: a.team_role_notes || '',
        license_number: a.license_number || profile.license_number || '', license_state: a.license_state || profile.license_state || '', license_type: a.license_type || '', licensed_states: a.licensed_states || [],
        state_experience_years: a.state_experience_years || {}, has_discipline_history: a.has_discipline_history ?? null,
        markets: a.markets || profile.markets || [], primary_neighborhoods_notes: a.primary_neighborhoods_notes || '', deal_sourcing_methods: a.deal_sourcing_methods || [], sources_off_market: a.sources_off_market ?? null,
        off_market_methods_notes: a.off_market_methods_notes || '', marketing_methods: a.marketing_methods || [],
        specialties: a.specialties || [], investment_strategies: a.investment_strategies || [], typical_deal_price_range: a.typical_deal_price_range || '', investor_types_served: a.investor_types_served || [],
        metrics_used: a.metrics_used || [], risk_approach_score: a.risk_approach_score || null, what_sets_you_apart: a.what_sets_you_apart || '',
        investor_clients_count: a.investor_clients_count || '', active_client_count: a.active_client_count || '', investment_deals_last_12m: a.investment_deals_last_12m || '', client_focus: a.client_focus || '',
        investor_client_percent_bucket: a.investor_client_percent_bucket || '', investor_friendly: a.investor_friendly ?? null, personally_invests: a.personally_invests ?? null, personal_investing_notes: a.personal_investing_notes || '',
        update_frequency: a.update_frequency || '', typical_response_time: a.typical_response_time || '', pro_network_types: a.pro_network_types || [], can_refer_professionals: a.can_refer_professionals ?? null,
        refer_professionals_notes: a.refer_professionals_notes || '', can_provide_investor_references: a.can_provide_investor_references ?? null, investor_certifications: a.investor_certifications || '',
        keeps_up_with_trends_notes: a.keeps_up_with_trends_notes || '', commission_structure: a.commission_structure || '', case_study_best_deal: a.case_study_best_deal || '',
        why_good_fit_notes: a.why_good_fit_notes || '', investment_philosophy_notes: a.investment_philosophy_notes || '', strengths_and_challenges_notes: a.strengths_and_challenges_notes || '', bio: a.bio || ''
      });
    }
  }, [profile]);

  const handleNext = async () => {
    if (step === TOTAL_STEPS) await handleSubmit();
    else setStep(step + 1);
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const response = await upsertAgentOnboarding(formData);
      if (response.data?.ok) {
        await refresh();
        toast.success("Profile completed! Welcome to Investor Konnect.");
        await new Promise(resolve => setTimeout(resolve, 300));
        // DEMO MODE: Skip Verify and NDA, go straight to Dashboard
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else { throw new Error(response.data?.message || 'Failed to save onboarding'); }
    } catch (error) {
      toast.error(error.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  // Helper to update form field without losing focus
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const renderStep1 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">Basic info & work style</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">Tell us about yourself and how you work</p>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="full_name">Full Name *</Label>
          <Input id="full_name" value={formData.full_name} onChange={(e) => updateField('full_name', e.target.value)} placeholder="Your full name" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 123-4567" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label>Are you a full-time real estate agent? *</Label>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={() => updateField('is_full_time_agent', true)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.is_full_time_agent === true ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>Yes</button>
            <button type="button" onClick={() => updateField('is_full_time_agent', false)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.is_full_time_agent === false ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>No</button>
          </div>
        </div>
        <div>
          <Label htmlFor="experience_years">Years of Real Estate Experience *</Label>
          <Input id="experience_years" type="number" min="0" value={formData.experience_years} onChange={(e) => updateField('experience_years', e.target.value)} placeholder="e.g., 5" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="investor_experience_years">Years Working with Investors *</Label>
          <Input id="investor_experience_years" type="number" min="0" value={formData.investor_experience_years} onChange={(e) => updateField('investor_experience_years', e.target.value)} placeholder="e.g., 3" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label>Languages Spoken *</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {LANGUAGES.map((lang) => (
              <div key={lang} className="flex items-center gap-2">
                <Checkbox id={`lang-${lang}`} checked={formData.languages_spoken.includes(lang)} onCheckedChange={() => toggleArrayItem('languages_spoken', lang)} />
                <Label htmlFor={`lang-${lang}`} className="text-sm font-normal cursor-pointer">{lang}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Preferred Communication Channels *</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {COMMUNICATION_CHANNELS.map((channel) => (
              <div key={channel} className="flex items-center gap-2">
                <Checkbox id={`comm-${channel}`} checked={formData.preferred_communication_channels.includes(channel)} onCheckedChange={() => toggleArrayItem('preferred_communication_channels', channel)} />
                <Label htmlFor={`comm-${channel}`} className="text-sm font-normal cursor-pointer">{channel}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Do you work in a team? *</Label>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={() => updateField('works_in_team', true)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.works_in_team === true ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>Yes</button>
            <button type="button" onClick={() => updateField('works_in_team', false)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.works_in_team === false ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>No</button>
          </div>
        </div>
        {formData.works_in_team && (
          <div>
            <Label htmlFor="team_role_notes">Describe your role in the team</Label>
            <Textarea id="team_role_notes" value={formData.team_role_notes} onChange={(e) => updateField('team_role_notes', e.target.value)} placeholder="e.g., Lead buyer's agent, transaction coordinator, etc." rows={3} className="text-[16px]" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">License & credentials</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">We'll verify your license later</p>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="license_number">License Number *</Label>
          <Input id="license_number" value={formData.license_number} onChange={(e) => updateField('license_number', e.target.value)} placeholder="e.g., TX-123456" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="license_state">License State *</Label>
          <select id="license_state" value={formData.license_state} onChange={(e) => updateField('license_state', e.target.value)} required className="h-12 w-full rounded-lg border border-[#E5E5E5] px-4 text-[16px]">
            <option value="">Select state</option>
            {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="license_type">License Type *</Label>
          <Input id="license_type" value={formData.license_type} onChange={(e) => updateField('license_type', e.target.value)} placeholder="e.g., Broker, Salesperson" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label>Licensed in other states?</Label>
          <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto">
            {US_STATES.map((state) => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox id={`state-${state}`} checked={formData.licensed_states.includes(state)} onCheckedChange={() => toggleArrayItem('licensed_states', state)} />
                <Label htmlFor={`state-${state}`} className="text-sm font-normal cursor-pointer">{state}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Any disciplinary history? *</Label>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={() => updateField('has_discipline_history', true)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.has_discipline_history === true ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>Yes</button>
            <button type="button" onClick={() => updateField('has_discipline_history', false)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.has_discipline_history === false ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>No</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">Your markets & specialties</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">What markets and property types do you focus on?</p>
      
      <div className="space-y-6">
        <div>
          <Label>Markets / States *</Label>
          <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto">
            {US_STATES.map((state) => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox id={`market-${state}`} checked={formData.markets.includes(state)} onCheckedChange={() => toggleArrayItem('markets', state)} />
                <Label htmlFor={`market-${state}`} className="text-sm font-normal cursor-pointer">{state}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="neighborhoods">Key neighborhoods or areas of expertise</Label>
          <Textarea id="neighborhoods" value={formData.primary_neighborhoods_notes} onChange={(e) => updateField('primary_neighborhoods_notes', e.target.value)} placeholder="e.g., Downtown Austin, East Nashville, etc." rows={3} className="text-[16px]" />
        </div>
        <div>
          <Label>Do you source off-market deals? *</Label>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={() => updateField('sources_off_market', true)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.sources_off_market === true ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>Yes</button>
            <button type="button" onClick={() => updateField('sources_off_market', false)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.sources_off_market === false ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>No</button>
          </div>
        </div>
        {formData.sources_off_market && (
          <div>
            <Label htmlFor="off_market_methods">How do you source off-market deals?</Label>
            <Textarea id="off_market_methods" value={formData.off_market_methods_notes} onChange={(e) => updateField('off_market_methods_notes', e.target.value)} placeholder="Direct mail, networking, wholesalers, etc." rows={3} className="text-[16px]" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">Your investor clients</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">Help us understand your investor experience</p>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="investor_clients_count">How many investor clients have you worked with? *</Label>
          <Input id="investor_clients_count" type="number" min="0" value={formData.investor_clients_count} onChange={(e) => updateField('investor_clients_count', e.target.value)} placeholder="e.g., 15" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="active_client_count">Current active clients</Label>
          <Input id="active_client_count" type="number" min="0" value={formData.active_client_count} onChange={(e) => updateField('active_client_count', e.target.value)} placeholder="e.g., 5" className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="investment_deals_last_12m">Investment deals closed in last 12 months *</Label>
          <Input id="investment_deals_last_12m" type="number" min="0" value={formData.investment_deals_last_12m} onChange={(e) => updateField('investment_deals_last_12m', e.target.value)} placeholder="e.g., 8" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label>Do you personally invest in real estate? *</Label>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={() => updateField('personally_invests', true)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.personally_invests === true ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>Yes</button>
            <button type="button" onClick={() => updateField('personally_invests', false)} className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${formData.personally_invests === false ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-semibold' : 'border-[#E5E5E5] bg-white text-[#666666] hover:border-[#D4AF37]'}`}>No</button>
          </div>
        </div>
        {formData.personally_invests && (
          <div>
            <Label htmlFor="personal_investing_notes">Tell us about your personal investing experience</Label>
            <Textarea id="personal_investing_notes" value={formData.personal_investing_notes} onChange={(e) => updateField('personal_investing_notes', e.target.value)} placeholder="What properties do you own? What strategies?" rows={3} className="text-[16px]" />
          </div>
        )}
        <div>
          <Label htmlFor="what_sets_apart">What sets you apart for investors? *</Label>
          <Textarea id="what_sets_apart" value={formData.what_sets_you_apart} onChange={(e) => updateField('what_sets_you_apart', e.target.value)} placeholder="Your unique value proposition..." rows={4} required className="text-[16px]" />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">Final details</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">Last few questions and your bio</p>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="commission_structure">Commission structure *</Label>
          <Input id="commission_structure" value={formData.commission_structure} onChange={(e) => updateField('commission_structure', e.target.value)} placeholder="e.g., Standard 3%, negotiable on volume" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="typical_response_time">Typical response time to investor inquiries *</Label>
          <Input id="typical_response_time" value={formData.typical_response_time} onChange={(e) => updateField('typical_response_time', e.target.value)} placeholder="e.g., Within 2 hours" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="update_frequency">How often do you update clients? *</Label>
          <Input id="update_frequency" value={formData.update_frequency} onChange={(e) => updateField('update_frequency', e.target.value)} placeholder="e.g., Weekly or as needed" required className="h-12 text-[16px]" />
        </div>
        <div>
          <Label htmlFor="bio">Your bio (for your profile) *</Label>
          <Textarea id="bio" value={formData.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Introduce yourself and highlight your experience with investor clients..." rows={5} required className="text-[16px]" />
          <p className="text-sm text-[#666666] mt-1">This will appear on your public profile</p>
        </div>
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-6">
          <h4 className="font-semibold text-emerald-900 mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-emerald-800 mb-3">After submitting, you'll verify your license and identity before accessing the platform.</p>
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>✓ License verification takes 1-2 business days</li>
            <li>✓ Identity verification takes 2-3 minutes</li>
            <li>✓ Then you can start connecting with investors</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      <header className="h-20 flex items-center justify-center border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-black">INVESTOR KONNECT</span>
        </div>
      </header>
      <div className="py-6 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div key={idx} className={`rounded-full transition-all ${idx + 1 === step ? 'w-4 h-4 bg-[#D4AF37] animate-pulse' : idx + 1 < step ? 'w-3 h-3 bg-[#D4AF37]' : 'w-3 h-3 border-2 border-[#E5E5E5] bg-transparent'}`} />
          ))}
        </div>
        <p className="text-[14px] text-[#666666]">Step {step} of {TOTAL_STEPS}</p>
      </div>
      <div className="max-w-[600px] mx-auto px-4 pb-12">
        <div className="bg-white rounded-3xl p-12 border border-[#E5E5E5] max-h-[calc(100vh-220px)] overflow-y-auto" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E5E5]">
            {step > 1 ? (<button onClick={handleBack} disabled={saving} className="text-[#666666] hover:text-black font-medium transition-colors">← Back</button>) : <div />}
            <div className="flex gap-3">
              <button onClick={handleNext} disabled={saving} className="h-12 px-8 rounded-lg bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold transition-all duration-200 disabled:bg-[#E5E5E5] disabled:text-[#999999]">
                {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</>) : step === TOTAL_STEPS ? 'Complete →' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentOnboarding() { return <AgentOnboardingContent />; }