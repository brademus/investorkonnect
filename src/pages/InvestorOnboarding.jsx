import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { Loader2, CheckCircle } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

/**
 * INVESTOR ONBOARDING - Simple 3-step initial onboarding
 * 
 * Flow: Onboarding -> Pricing -> Identity Verification -> NDA -> Dashboard
 */
export default function InvestorOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh, user, onboarded, isPaidSubscriber } = useCurrentProfile();
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

  // Check access and redirect if already onboarded
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

  // Redirect if already onboarded
  useEffect(() => {
    if (!checking && onboarded) {
      // Already onboarded, check next step
      if (!isPaidSubscriber) {
        navigate(createPageUrl("Pricing"), { replace: true });
      } else {
        navigate(createPageUrl("Dashboard"), { replace: true });
      }
    }
  }, [checking, onboarded, isPaidSubscriber, navigate]);

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

  // Enforce role consistency: investors only
  useEffect(() => {
    if (!profile) return;
    const current = profile.user_role;
    if (!current || current === 'member') {
      base44.entities.Profile.update(profile.id, { user_role: 'investor', user_type: 'investor' }).catch(() => {});
    } else if (current === 'agent') {
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
    }
  }, [profile, navigate]);

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

      // Save basic info and mark onboarding as complete
      await base44.entities.Profile.update(profile.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        company: formData.company,
        goals: formData.goals,
        user_role: 'investor',
        user_type: 'investor',
        target_state: formData.primary_state,
        markets: [formData.primary_state].filter(Boolean),
        onboarding_step: 'basic_complete',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'investor-v1',
        metadata: {
          ...profile.metadata,
          basicProfile: {
            investment_experience: formData.investment_experience
          }
        }
      });

      await refresh();
      toast.success("Profile saved! Let's choose your plan.");
      
      // Navigate to Pricing (next step for investors)
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = createPageUrl("Pricing");
    } catch (error) {
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  const renderStep1 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Let's get started</h3>
      <p className="text-[18px] text-[#808080] mb-10">Tell us a bit about yourself</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="full_name" className="text-[#FAFAFA] text-[19px] font-medium">Full Name *</Label>
          <Input 
            id="full_name" 
            value={formData.full_name} 
            onChange={(e) => updateField('full_name', e.target.value)} 
            placeholder="Your full name" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
        <div>
          <Label htmlFor="phone" className="text-[#FAFAFA] text-[19px] font-medium">Phone Number</Label>
          <Input 
            id="phone" 
            type="tel" 
            value={formData.phone} 
            onChange={(e) => updateField('phone', e.target.value)} 
            placeholder="(555) 123-4567" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
        <div>
          <Label htmlFor="company" className="text-[#FAFAFA] text-[19px] font-medium">Company (optional)</Label>
          <Input 
            id="company" 
            value={formData.company} 
            onChange={(e) => updateField('company', e.target.value)} 
            placeholder="Your company name" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Your investment focus</h3>
      <p className="text-[18px] text-[#808080] mb-10">Where are you looking to invest?</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="primary_state" className="text-[#FAFAFA] text-[19px] font-medium">Primary Market / State *</Label>
          <select 
            id="primary_state" 
            value={formData.primary_state} 
            onChange={(e) => updateField('primary_state', e.target.value)} 
            className="h-16 w-full rounded-lg border border-[#1F1F1F] px-5 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
          >
            <option value="">Select your target state</option>
            {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="investment_experience" className="text-[#FAFAFA] text-[19px] font-medium">Investment Experience</Label>
          <select 
            id="investment_experience" 
            value={formData.investment_experience} 
            onChange={(e) => updateField('investment_experience', e.target.value)} 
            className="h-16 w-full rounded-lg border border-[#1F1F1F] px-5 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
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
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">What are your goals?</h3>
      <p className="text-[18px] text-[#808080] mb-10">Help us understand what you're looking for</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="goals" className="text-[#FAFAFA] text-[19px] font-medium">Investment Goals</Label>
          <Textarea 
            id="goals" 
            value={formData.goals} 
            onChange={(e) => updateField('goals', e.target.value)} 
            placeholder="e.g., Looking for buy-and-hold rentals in growing markets, interested in multifamily properties..." 
            rows={6}
            className="text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" 
          />
        </div>

        <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#E3C567]">
            Next, you'll choose a subscription plan to unlock agent matching and deal rooms.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      <header className="h-20 flex items-center justify-center border-b border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
            alt="Investor Konnect"
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-bold text-[#E3C567]">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="py-6 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx + 1 === step 
                  ? 'w-4 h-4 bg-[#E3C567] animate-pulse' 
                  : idx + 1 < step 
                    ? 'w-3 h-3 bg-[#E3C567]' 
                    : 'w-3 h-3 border-2 border-[#1F1F1F] bg-transparent'
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-[#808080]">Step {step} of {TOTAL_STEPS}</p>
      </div>

      <div className="max-w-[700px] mx-auto px-4 pb-12">
        <div className="bg-[#0D0D0D] rounded-3xl p-12 border border-[#1F1F1F]" style={{ boxShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F1F]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#808080] hover:text-[#E3C567] font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && !formData.primary_state)}
              className="h-12 px-8 rounded-lg bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold transition-all duration-200 disabled:bg-[#1F1F1F] disabled:text-[#666666]"
            >
              {saving ? (
                <><LoadingAnimation className="w-4 h-4 mr-2 inline text-black" />Saving...</>
              ) : step === TOTAL_STEPS ? (
                'Continue to Pricing →'
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
