import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

/**
 * INVESTOR ONBOARDING - Simple 3-step initial onboarding
 * Full 8-step onboarding is available from Dashboard checklist
 */
export default function InvestorOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh, user } = useCurrentProfile();
  const { selectedState } = useWizard();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company: '',
    primary_state: selectedState || '',
    investment_experience: '',
    goals: ''
  });

  const TOTAL_STEPS = 3;

  // Check access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const authUser = await base44.auth.me();
        if (!authUser) {
          base44.auth.redirectToLogin(createPageUrl("PostAuth"));
          return;
        }
        // Admin bypass
        if (authUser.role === 'admin') {
          toast.success('Admin access granted');
          navigate(createPageUrl("Dashboard"), { replace: true });
          return;
        }
        setChecking(false);
      } catch (e) {
        base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      }
    };
    checkAccess();
  }, [navigate]);

  // Load existing data
  useEffect(() => {
    document.title = "Complete Your Profile - Investor Konnect";
    if (profile) {
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
        primary_state: selectedState || profile.target_state || profile.markets?.[0] || '',
        investment_experience: profile.metadata?.basicProfile?.investment_experience || '',
        goals: profile.goals || ''
      }));
    }
  }, [profile, selectedState]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (step === TOTAL_STEPS) {
      await handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Save basic info but DON'T mark onboarding as complete
      // User must complete full 8-step deep onboarding from Dashboard checklist
      await base44.entities.Profile.update(profile.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        company: formData.company,
        goals: formData.goals,
        user_role: 'investor',
        target_state: formData.primary_state,
        markets: [formData.primary_state].filter(Boolean),
        // NOT setting onboarding_completed_at - that happens in deep onboarding
        onboarding_step: 'basic_complete',
        metadata: {
          ...profile.metadata,
          basicProfile: {
            investment_experience: formData.investment_experience
          }
        }
      });

      await refresh();
      toast.success("Welcome to Investor Konnect!");
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = createPageUrl("Dashboard");
    } catch (error) {
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin" />
      </div>
    );
  }

  const renderStep1 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-black mb-2">Let's get started</h3>
      <p className="text-[16px] text-[#666666] mb-8">Tell us a bit about yourself</p>
      
      <div className="space-y-5">
        <div>
          <Label htmlFor="full_name">Full Name *</Label>
          <Input 
            id="full_name" 
            value={formData.full_name} 
            onChange={(e) => updateField('full_name', e.target.value)} 
            placeholder="Your full name" 
            className="h-12 text-[16px] mt-1" 
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone" 
            type="tel" 
            value={formData.phone} 
            onChange={(e) => updateField('phone', e.target.value)} 
            placeholder="(555) 123-4567" 
            className="h-12 text-[16px] mt-1" 
          />
        </div>
        <div>
          <Label htmlFor="company">Company (optional)</Label>
          <Input 
            id="company" 
            value={formData.company} 
            onChange={(e) => updateField('company', e.target.value)} 
            placeholder="Your company name" 
            className="h-12 text-[16px] mt-1" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-black mb-2">Your investment focus</h3>
      <p className="text-[16px] text-[#666666] mb-8">Where are you looking to invest?</p>
      
      <div className="space-y-5">
        <div>
          <Label htmlFor="primary_state">Primary Market / State *</Label>
          <select 
            id="primary_state" 
            value={formData.primary_state} 
            onChange={(e) => updateField('primary_state', e.target.value)} 
            className="h-12 w-full rounded-lg border border-[#E5E5E5] px-4 text-[16px] mt-1"
          >
            <option value="">Select your target state</option>
            {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="investment_experience">Investment Experience</Label>
          <select 
            id="investment_experience" 
            value={formData.investment_experience} 
            onChange={(e) => updateField('investment_experience', e.target.value)} 
            className="h-12 w-full rounded-lg border border-[#E5E5E5] px-4 text-[16px] mt-1"
          >
            <option value="">Select your experience level</option>
            <option value="beginner">Beginner (0-2 deals)</option>
            <option value="intermediate">Intermediate (3-10 deals)</option>
            <option value="experienced">Experienced (10+ deals)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-black mb-2">What are your goals?</h3>
      <p className="text-[16px] text-[#666666] mb-8">Help us understand what you're looking for</p>
      
      <div className="space-y-5">
        <div>
          <Label htmlFor="goals">Investment Goals</Label>
          <Textarea 
            id="goals" 
            value={formData.goals} 
            onChange={(e) => updateField('goals', e.target.value)} 
            placeholder="e.g., Looking for buy-and-hold rentals in growing markets, interested in multifamily properties..." 
            rows={5}
            className="text-[16px] mt-1" 
          />
        </div>

        <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#92400E] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#92400E]">
            After completing this, you can refine your matching criteria from your dashboard to get better agent recommendations.
          </p>
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

      <div className="max-w-[500px] mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E5E5]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#666666] hover:text-black font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && !formData.primary_state)}
              className="h-12 px-8 rounded-lg bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold transition-all duration-200 disabled:bg-[#E5E5E5] disabled:text-[#999999]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</>
              ) : step === TOTAL_STEPS ? (
                'Complete Setup →'
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