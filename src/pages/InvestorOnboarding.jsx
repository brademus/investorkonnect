import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import ProfileStep from "@/components/investor-onboarding/ProfileStep";
import StrategyStep from "@/components/investor-onboarding/StrategyStep";
import CriteriaStep from "@/components/investor-onboarding/CriteriaStep";
import GeographyStep from "@/components/investor-onboarding/GeographyStep";
import DealMechanicsStep from "@/components/investor-onboarding/DealMechanicsStep";
import AgentPreferencesStep from "@/components/investor-onboarding/AgentPreferencesStep";

/**
 * STEP 4A: RICH INVESTOR ONBOARDING
 * 
 * 6-step wizard: Profile → Strategy → Criteria → Geography → Deal Mechanics → Agent Preferences
 * Saves data progressively to profile.metadata for future matching
 */
function InvestorOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const { selectedState } = useWizard();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Profile step
    full_name: '',
    phone: '',
    company: '',
    investor_type: '',
    experience_level: '',
    typical_hold_period: '',
    decision_speed: '',
    // Strategy step
    strategies: [],
    asset_types: [],
    condition_preferences: [],
    deal_volume_goal: '',
    // Criteria step
    price_per_deal_min: '',
    price_per_deal_max: '',
    total_capital_to_deploy: '',
    min_cap_rate: '',
    target_cash_on_cash: '',
    min_deal_size_units: '',
    max_deal_size_units: '',
    preferred_financing: [],
    // Geography step
    primary_state: selectedState || '',
    target_markets: [],
    will_consider_other_markets: false,
    secondary_states: [],
    // Deal mechanics step
    has_proof_of_funds: false,
    has_preapproval_or_term_sheet: false,
    timeline_to_close: '',
    team_in_place: [],
    constraints_or_red_flags: '',
    // Agent preferences step
    communication_style: '',
    lead_types_desired: [],
    service_expectations: [],
    exclusivity_preference: '',
  });

  const TOTAL_STEPS = 6;
  const STEP_NAMES = [
    'Profile',
    'Strategy',
    'Criteria',
    'Geography',
    'Deal Mechanics',
    'Agent Preferences'
  ];

  useEffect(() => {
    document.title = "Investor Onboarding - AgentVault";

    // Load existing profile data if available
    if (profile) {
      const metadata = profile.metadata || {};
      const investorData = {
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
        primary_state: selectedState || profile.markets?.[0] || '',
        ...metadata.investorProfile,
        ...metadata.investorStrategy,
        ...metadata.financialCriteria,
        ...metadata.geography,
        ...metadata.dealMechanics,
        ...metadata.agentPreferences,
      };
      setFormData(prev => ({ ...prev, ...investorData }));
    }
  }, [profile, selectedState]);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.full_name?.trim()) {
          toast.error("Please enter your name");
          return false;
        }
        if (!formData.phone?.trim()) {
          toast.error("Please enter your phone number");
          return false;
        }
        if (!formData.investor_type) {
          toast.error("Please select investor type");
          return false;
        }
        if (!formData.experience_level) {
          toast.error("Please select experience level");
          return false;
        }
        if (!formData.typical_hold_period) {
          toast.error("Please select typical hold period");
          return false;
        }
        if (!formData.decision_speed) {
          toast.error("Please select decision speed");
          return false;
        }
        return true;

      case 2:
        if (!formData.strategies?.length) {
          toast.error("Please select at least one strategy");
          return false;
        }
        if (!formData.asset_types?.length) {
          toast.error("Please select at least one asset type");
          return false;
        }
        if (!formData.condition_preferences?.length) {
          toast.error("Please select at least one condition preference");
          return false;
        }
        if (!formData.deal_volume_goal) {
          toast.error("Please enter target deal volume");
          return false;
        }
        return true;

      case 3:
        if (!formData.price_per_deal_min) {
          toast.error("Please enter minimum price per deal");
          return false;
        }
        if (!formData.price_per_deal_max) {
          toast.error("Please enter maximum price per deal");
          return false;
        }
        if (!formData.total_capital_to_deploy) {
          toast.error("Please enter total capital to deploy");
          return false;
        }
        if (!formData.preferred_financing?.length) {
          toast.error("Please select at least one financing option");
          return false;
        }
        return true;

      case 4:
        if (!formData.target_markets?.length) {
          toast.error("Please add at least one target market/city");
          return false;
        }
        return true;

      case 5:
        if (!formData.timeline_to_close) {
          toast.error("Please select timeline to close");
          return false;
        }
        return true;

      case 6:
        if (!formData.communication_style) {
          toast.error("Please select communication style");
          return false;
        }
        if (!formData.lead_types_desired?.length) {
          toast.error("Please select at least one lead type");
          return false;
        }
        if (!formData.service_expectations?.length) {
          toast.error("Please select at least one service expectation");
          return false;
        }
        if (!formData.exclusivity_preference) {
          toast.error("Please select exclusivity preference");
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

      // Structure data into metadata sections
      const metadata = {
        investorProfile: {
          investor_type: formData.investor_type,
          experience_level: formData.experience_level,
          typical_hold_period: formData.typical_hold_period,
          decision_speed: formData.decision_speed,
        },
        investorStrategy: {
          strategies: formData.strategies,
          asset_types: formData.asset_types,
          condition_preferences: formData.condition_preferences,
          deal_volume_goal: formData.deal_volume_goal,
        },
        financialCriteria: {
          price_per_deal_min: formData.price_per_deal_min,
          price_per_deal_max: formData.price_per_deal_max,
          total_capital_to_deploy: formData.total_capital_to_deploy,
          min_cap_rate: formData.min_cap_rate,
          target_cash_on_cash: formData.target_cash_on_cash,
          min_deal_size_units: formData.min_deal_size_units,
          max_deal_size_units: formData.max_deal_size_units,
          preferred_financing: formData.preferred_financing,
        },
        geography: {
          primary_state: formData.primary_state,
          target_markets: formData.target_markets,
          will_consider_other_markets: formData.will_consider_other_markets,
          secondary_states: formData.secondary_states,
        },
        dealMechanics: {
          has_proof_of_funds: formData.has_proof_of_funds,
          has_preapproval_or_term_sheet: formData.has_preapproval_or_term_sheet,
          timeline_to_close: formData.timeline_to_close,
          team_in_place: formData.team_in_place,
          constraints_or_red_flags: formData.constraints_or_red_flags,
        },
        agentPreferences: {
          communication_style: formData.communication_style,
          lead_types_desired: formData.lead_types_desired,
          service_expectations: formData.service_expectations,
          exclusivity_preference: formData.exclusivity_preference,
        },
      };

      await base44.entities.Profile.update(profile.id, {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        company: formData.company?.trim() || null,
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

      // Mark onboarding as complete
      await base44.entities.Profile.update(profile.id, {
        onboarding_completed_at: new Date().toISOString()
      });

      await refresh();
      toast.success("Profile completed!");
      
      // Navigate to verification
      navigate(createPageUrl("Verify"));

    } catch (error) {
      console.error('[InvestorOnboarding] Submit error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Step {step} of {TOTAL_STEPS}: {STEP_NAMES[step - 1]}
            </span>
            <span className="text-sm font-medium text-blue-600">
              {Math.round((step / TOTAL_STEPS) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          
          {/* Step Content */}
          {step === 1 && (
            <ProfileStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 2 && (
            <StrategyStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 3 && (
            <CriteriaStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 4 && (
            <GeographyStep
              data={formData}
              onChange={updateFormData}
              initialState={formData.primary_state}
            />
          )}

          {step === 5 && (
            <DealMechanicsStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {step === 6 && (
            <AgentPreferencesStep
              data={formData}
              onChange={updateFormData}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : <div />}
            
            <Button
              onClick={handleNext}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : step === TOTAL_STEPS ? (
                <>
                  Complete Onboarding
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

        {/* Step Indicator Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx + 1 === step ? 'w-8 bg-blue-600' :
                idx + 1 < step ? 'w-2 bg-blue-400' :
                'w-2 bg-slate-300'
              }`}
            />
          ))}
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