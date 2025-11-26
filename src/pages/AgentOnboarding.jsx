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
  const { profile, refresh } = useCurrentProfile();
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
        toast.success("Profile completed! Next: verify your identity.");
        await new Promise(resolve => setTimeout(resolve, 300));
        const nextStep = response.data.nextStep;
        if (nextStep === 'verify') navigate(createPageUrl("Verify"), { replace: true });
        else if (nextStep === 'nda') navigate(createPageUrl("NDA"), { replace: true });
        else navigate(createPageUrl("Dashboard"), { replace: true });
      } else { throw new Error(response.data?.message || 'Failed to save onboarding'); }
    } catch (error) {
      toast.error(error.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const Step1 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-black mb-2">Basic info & work style</h3>
      <p className="text-[16px] text-[#666666] mb-8 leading-relaxed">Tell us about yourself and how you work</p>
      {/* Form fields for Step 1 */}
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
          {step === 1 && <Step1 />}
          {/* Render other steps similarly */}
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