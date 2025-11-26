import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { StepGuard } from "@/components/StepGuard";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import BasicProfileStep from "@/components/investor-onboarding/BasicProfileStep";
import CapitalFinancingStep from "@/components/investor-onboarding/CapitalFinancingStep";
import StrategyDealsStep from "@/components/investor-onboarding/StrategyDealsStep";
import MarketsStep from "@/components/investor-onboarding/MarketsStep";
import DealStructureStep from "@/components/investor-onboarding/DealStructureStep";
import RiskSpeedStep from "@/components/investor-onboarding/RiskSpeedStep";
import AgentWorkingStep from "@/components/investor-onboarding/AgentWorkingStep";
import ExperienceAccreditationStep from "@/components/investor-onboarding/ExperienceAccreditationStep";

function InvestorOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh, kycVerified } = useCurrentProfile();
  const { selectedState } = useWizard();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    investor_description: '',
    deals_closed_24mo: '',
    typical_deal_size: '',
    capital_available_12mo: '',
    financing_methods: [],
    financing_other: '',
    financing_lined_up: '',
    pof_verification_intent: '',
    investment_strategies: [],
    strategy_other: '',
    primary_strategy: '',
    property_types: [],
    property_type_other: '',
    property_condition: '',
    specific_cities_counties: '',
    market_area_importance: '',
    state_price_min: '',
    state_price_max: '',
    primary_state: selectedState || '',
    deal_types_open_to: [],
    preferred_deal_structure: [],
    most_important_now: '',
    target_hold_period: '',
    decision_speed_on_deal: '',
    typical_earnest_money_pct: '',
    comfortable_non_refundable_em: '',
    most_recent_deal: '',
    what_from_agent: [],
    communication_preferences: [],
    preferred_agent_response_time: '',
    agent_deal_breakers: '',
    accredited_investor: '',
    investment_holding_structures: [],
    background_links: '',
    anything_else_for_agent: '',
  });

  const TOTAL_STEPS = 8;
  const STEP_COMPONENTS = [
    BasicProfileStep,
    CapitalFinancingStep,
    StrategyDealsStep,
    MarketsStep,
    DealStructureStep,
    RiskSpeedStep,
    AgentWorkingStep,
    ExperienceAccreditationStep
  ];

  useEffect(() => {
    document.title = "Complete Your Investor Profile - Investor Konnect";
    if (profile) {
      const metadata = profile.metadata || {};
      const savedData = {
        primary_state: selectedState || profile.markets?.[0] || '',
        ...metadata.basicProfile,
        ...metadata.capitalFinancing,
        ...metadata.strategyDeals,
        ...metadata.targetMarkets,
        ...metadata.dealStructure,
        ...metadata.riskSpeed,
        ...metadata.agentWorking,
        ...metadata.experienceAccreditation,
      };
      setFormData(prev => ({ ...prev, ...savedData }));
    }
  }, [profile, selectedState]);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    if (step === TOTAL_STEPS) {
      await handleSubmit();
    } else {
      await saveProgress();
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const saveProgress = async () => {
    try {
      if (!profile) return;
      const metadata = {
        basicProfile: { investor_description: formData.investor_description, deals_closed_24mo: formData.deals_closed_24mo, typical_deal_size: formData.typical_deal_size },
        capitalFinancing: { capital_available_12mo: formData.capital_available_12mo, financing_methods: formData.financing_methods, financing_other: formData.financing_other, financing_lined_up: formData.financing_lined_up, pof_verification_intent: formData.pof_verification_intent },
        strategyDeals: { investment_strategies: formData.investment_strategies, strategy_other: formData.strategy_other, primary_strategy: formData.primary_strategy, property_types: formData.property_types, property_type_other: formData.property_type_other, property_condition: formData.property_condition },
        targetMarkets: { specific_cities_counties: formData.specific_cities_counties, market_area_importance: formData.market_area_importance, state_price_min: formData.state_price_min, state_price_max: formData.state_price_max, primary_state: formData.primary_state },
        dealStructure: { deal_types_open_to: formData.deal_types_open_to, preferred_deal_structure: formData.preferred_deal_structure, most_important_now: formData.most_important_now, target_hold_period: formData.target_hold_period },
        riskSpeed: { decision_speed_on_deal: formData.decision_speed_on_deal, typical_earnest_money_pct: formData.typical_earnest_money_pct, comfortable_non_refundable_em: formData.comfortable_non_refundable_em, most_recent_deal: formData.most_recent_deal },
        agentWorking: { what_from_agent: formData.what_from_agent, communication_preferences: formData.communication_preferences, preferred_agent_response_time: formData.preferred_agent_response_time, agent_deal_breakers: formData.agent_deal_breakers },
        experienceAccreditation: { accredited_investor: formData.accredited_investor, investment_holding_structures: formData.investment_holding_structures, background_links: formData.background_links, anything_else_for_agent: formData.anything_else_for_agent },
      };
      await base44.entities.Profile.update(profile.id, { markets: [formData.primary_state], metadata: { ...profile.metadata, ...metadata } });
    } catch (error) {
      // Non-blocking error
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await saveProgress();
      await base44.entities.Profile.update(profile.id, {
        user_role: 'investor',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'v2',
        target_state: formData.primary_state || selectedState,
        markets: [formData.primary_state || selectedState].filter(Boolean)
      });
      await refresh();
      await new Promise(resolve => setTimeout(resolve, 300));
      toast.success("Profile completed! Next: verify your identity.");
      if (kycVerified) {
        navigate(createPageUrl("NDA"), { replace: true });
      } else {
        navigate(createPageUrl("Verify"), { replace: true });
      }
    } catch (error) {
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };
  
  const CurrentStepComponent = STEP_COMPONENTS[step - 1];

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
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx + 1 === step 
                  ? 'w-4 h-4 bg-[#D4AF37] animate-pulse' 
                  : idx + 1 < step 
                    ? 'w-3 h-3 bg-[#D4AF37]' 
                    : 'w-3 h-3 border-2 border-[#E5E5E5] bg-transparent'
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-[#666666]">Step {step} of {TOTAL_STEPS}</p>
      </div>

      <div className="max-w-[600px] mx-auto px-4 pb-12">
        <div className="bg-white rounded-3xl p-12 border border-[#E5E5E5]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CurrentStepComponent data={formData} onChange={updateFormData} />
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E5E5]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#666666] hover:text-black font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving}
              className="h-12 px-8 rounded-lg bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold transition-all duration-200 disabled:bg-[#E5E5E5] disabled:text-[#999999]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</>
              ) : step === TOTAL_STEPS ? (
                'Complete Onboarding →'
              ) : (
                'Continue →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvestorOnboarding() {
  return (
    <StepGuard requiredStep={3}>
      <InvestorOnboardingContent />
    </StepGuard>
  );
}