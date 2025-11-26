import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
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

/**
 * INVESTOR ONBOARDING - 8-Step Deep Intake
 * 
 * Filters for serious, professional investors and collects rich data
 * for high-quality matching with investor-friendly agents.
 * Takes approximately 5 minutes to complete.
 * 
 * Steps:
 * 1. Basic Profile (investor type, deal count, deal size)
 * 2. Capital & Financing (capital, financing methods, lined up, POF intent)
 * 3. Strategy & Deals (strategies, property types, condition)
 * 4. Target Markets (specific areas, importance, price range)
 * 5. Deal Structure (deal types, structure, priorities, hold period)
 * 6. Risk & Speed (decision speed, earnest money, recent deal)
 * 7. Working with Agent (services, communication, response time, deal breakers)
 * 8. Experience & Accreditation (accredited, holding structure, links, notes)
 */
function InvestorOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh, kycVerified } = useCurrentProfile();
  const { selectedState } = useWizard();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Basic Profile
    investor_description: '',
    deals_closed_24mo: '',
    typical_deal_size: '',
    
    // Step 2: Capital & Financing
    capital_available_12mo: '',
    financing_methods: [],
    financing_other: '',
    financing_lined_up: '',
    pof_verification_intent: '',
    
    // Step 3: Strategy & Deals
    investment_strategies: [],
    strategy_other: '',
    primary_strategy: '',
    property_types: [],
    property_type_other: '',
    property_condition: '',
    
    // Step 4: Target Markets
    specific_cities_counties: '',
    market_area_importance: '',
    state_price_min: '',
    state_price_max: '',
    primary_state: selectedState || '',
    
    // Step 5: Deal Structure
    deal_types_open_to: [],
    preferred_deal_structure: [],
    most_important_now: '',
    target_hold_period: '',
    
    // Step 6: Risk & Speed
    decision_speed_on_deal: '',
    typical_earnest_money_pct: '',
    comfortable_non_refundable_em: '',
    most_recent_deal: '',
    
    // Step 7: Working with Agent
    what_from_agent: [],
    communication_preferences: [],
    preferred_agent_response_time: '',
    agent_deal_breakers: '',
    
    // Step 8: Experience & Accreditation
    accredited_investor: '',
    investment_holding_structures: [],
    background_links: '',
    anything_else_for_agent: '',
  });

  const TOTAL_STEPS = 8;
  const STEP_NAMES = [
    'Basic Profile',
    'Capital & Financing',
    'Strategy & Deals',
    'Target Markets',
    'Deal Structure',
    'Risk & Speed',
    'Working with Agent',
    'Experience & Details'
  ];

  useEffect(() => {
    document.title = "Complete Your Investor Profile - Investor Konnect";

    // Load existing profile data if available
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

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.investor_description) {
          toast.error("Please select what best describes you as an investor");
          return false;
        }
        if (!formData.deals_closed_24mo) {
          toast.error("Please select how many deals you've closed");
          return false;
        }
        if (!formData.typical_deal_size) {
          toast.error("Please select your typical deal size");
          return false;
        }
        return true;

      case 2:
        if (!formData.capital_available_12mo) {
          toast.error("Please select capital available");
          return false;
        }
        if (!formData.financing_methods?.length) {
          toast.error("Please select at least one financing method");
          return false;
        }
        if (!formData.financing_lined_up) {
          toast.error("Please indicate if you have financing lined up");
          return false;
        }
        return true;

      case 3:
        if (!formData.investment_strategies?.length) {
          toast.error("Please select at least one investment strategy");
          return false;
        }
        if (!formData.primary_strategy) {
          toast.error("Please select your primary strategy");
          return false;
        }
        if (!formData.property_types?.length) {
          toast.error("Please select at least one property type");
          return false;
        }
        if (!formData.property_condition) {
          toast.error("Please select property condition preference");
          return false;
        }
        return true;

      case 4:
        if (!formData.market_area_importance) {
          toast.error("Please indicate area importance");
          return false;
        }
        return true;

      case 5:
        if (!formData.deal_types_open_to?.length) {
          toast.error("Please select at least one deal type");
          return false;
        }
        if (!formData.preferred_deal_structure?.length) {
          toast.error("Please select at least one deal structure");
          return false;
        }
        if (!formData.most_important_now) {
          toast.error("Please select what's most important to you");
          return false;
        }
        return true;

      case 6:
        if (!formData.decision_speed_on_deal) {
          toast.error("Please select your decision speed");
          return false;
        }
        if (!formData.comfortable_non_refundable_em) {
          toast.error("Please indicate comfort with non-refundable earnest money");
          return false;
        }
        return true;

      case 7:
        if (!formData.what_from_agent?.length) {
          toast.error("Please select what you're looking for from an agent");
          return false;
        }
        if (!formData.communication_preferences?.length) {
          toast.error("Please select at least one communication preference");
          return false;
        }
        if (!formData.preferred_agent_response_time) {
          toast.error("Please select preferred response time");
          return false;
        }
        return true;

      case 8:
        // All fields optional in final step
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
      // Save progress after each step
      await saveProgress();
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const saveProgress = async () => {
    try {
      if (!profile) return;

      // Structure data into metadata sections for better organization
      const metadata = {
        basicProfile: {
          investor_description: formData.investor_description,
          deals_closed_24mo: formData.deals_closed_24mo,
          typical_deal_size: formData.typical_deal_size,
        },
        capitalFinancing: {
          capital_available_12mo: formData.capital_available_12mo,
          financing_methods: formData.financing_methods,
          financing_other: formData.financing_other,
          financing_lined_up: formData.financing_lined_up,
          pof_verification_intent: formData.pof_verification_intent,
        },
        strategyDeals: {
          investment_strategies: formData.investment_strategies,
          strategy_other: formData.strategy_other,
          primary_strategy: formData.primary_strategy,
          property_types: formData.property_types,
          property_type_other: formData.property_type_other,
          property_condition: formData.property_condition,
        },
        targetMarkets: {
          specific_cities_counties: formData.specific_cities_counties,
          market_area_importance: formData.market_area_importance,
          state_price_min: formData.state_price_min,
          state_price_max: formData.state_price_max,
          primary_state: formData.primary_state,
        },
        dealStructure: {
          deal_types_open_to: formData.deal_types_open_to,
          preferred_deal_structure: formData.preferred_deal_structure,
          most_important_now: formData.most_important_now,
          target_hold_period: formData.target_hold_period,
        },
        riskSpeed: {
          decision_speed_on_deal: formData.decision_speed_on_deal,
          typical_earnest_money_pct: formData.typical_earnest_money_pct,
          comfortable_non_refundable_em: formData.comfortable_non_refundable_em,
          most_recent_deal: formData.most_recent_deal,
        },
        agentWorking: {
          what_from_agent: formData.what_from_agent,
          communication_preferences: formData.communication_preferences,
          preferred_agent_response_time: formData.preferred_agent_response_time,
          agent_deal_breakers: formData.agent_deal_breakers,
        },
        experienceAccreditation: {
          accredited_investor: formData.accredited_investor,
          investment_holding_structures: formData.investment_holding_structures,
          background_links: formData.background_links,
          anything_else_for_agent: formData.anything_else_for_agent,
        },
      };

      await base44.entities.Profile.update(profile.id, {
        markets: [formData.primary_state],
        metadata: {
          ...profile.metadata,
          ...metadata,
        },
      });

      console.log('[InvestorOnboarding] Progress saved for step', step);
    } catch (error) {
      console.error('[InvestorOnboarding] Save progress error:', error);
      // Don't block navigation on save error
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      await saveProgress();

      console.log('[InvestorOnboarding] 🎯 Final submit - setting v2 completion flags...');

      // CRITICAL: Set v2 onboarding flags
      await base44.entities.Profile.update(profile.id, {
        // NEW onboarding flags (v2)
        user_role: 'investor',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'v2',
        
        // Set target state if available
        target_state: formData.primary_state || selectedState,
        markets: [formData.primary_state || selectedState].filter(Boolean)
      });

      console.log('[InvestorOnboarding] ✅ v2 flags set');

      // Force profile refresh to load new data
      await refresh();
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      toast.success("Profile completed! Next: verify your identity.");
      
      // CRITICAL: Navigate to Persona/KYC verification (not Dashboard)
      // Only skip if KYC is already verified (edge case: admin manually verified)
      if (kycVerified) {
        console.log('[InvestorOnboarding] KYC already verified, going to NDA');
        navigate(createPageUrl("NDA"), { replace: true });
      } else {
        console.log('[InvestorOnboarding] Going to Persona verification');
        navigate(createPageUrl("Verify"), { replace: true });
      }

    } catch (error) {
      console.error('[InvestorOnboarding] ❌ Submit error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Simple Header with Logo */}
      <header className="h-20 flex items-center justify-center border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-black">INVESTOR KONNECT</span>
        </div>
      </header>

      {/* Progress Indicator */}
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
        {/* Form Card */}
        <div className="bg-white rounded-3xl p-12 border border-[#E5E5E5]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
          
          {/* Step Content */}
          {step === 1 && (
            <BasicProfileStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 2 && (
            <CapitalFinancingStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 3 && (
            <StrategyDealsStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 4 && (
            <MarketsStep
              data={formData}
              onChange={updateFormData}
              initialState={formData.primary_state}
            />
          )}

          {step === 5 && (
            <DealStructureStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 6 && (
            <RiskSpeedStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 7 && (
            <AgentWorkingStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 8 && (
            <ExperienceAccreditationStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E5E5]">
            {step > 1 ? (
              <button
                onClick={handleBack}
                disabled={saving}
                className="text-[#666666] hover:text-black font-medium transition-colors"
              >
                ← Back
              </button>
            ) : <div />}
            
            <button
              onClick={handleNext}
              disabled={saving}
              className="h-12 px-8 rounded-lg bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold transition-all duration-200 disabled:bg-[#E5E5E5] disabled:text-[#999999]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Saving...
                </>
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
    <StepGuard requiredStep={3}> {/* Requires AUTH + ROLE */}
      <InvestorOnboardingContent />
    </StepGuard>
  );
}