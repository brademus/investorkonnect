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
  
  // Block navigation away during onboarding (except to mandatory steps)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (step !== 3) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    primary_state: selectedState || '',
    primary_states: selectedState ? [selectedState] : [],
    nationwide: false,
    investment_experience: '',
    deal_types: [],
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
          navigate(createPageUrl("Pipeline"), { replace: true });
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
      console.log('[InvestorOnboarding] Already onboarded, checking next step...');
      console.log('[InvestorOnboarding] isPaidSubscriber:', isPaidSubscriber);
      console.log('[InvestorOnboarding] subscription_status:', profile?.subscription_status);
      
      // Already onboarded, check next step
      if (!isPaidSubscriber) {
        console.log('[InvestorOnboarding] Redirecting to Pricing');
        navigate(createPageUrl("Pricing"), { replace: true });
      } else {
        console.log('[InvestorOnboarding] Redirecting to IdentityVerification');
        navigate(createPageUrl("IdentityVerification"), { replace: true });
      }
    }
  }, [checking, onboarded, isPaidSubscriber, navigate, profile?.subscription_status]);

  // Load existing data
  useEffect(() => {
    document.title = "Complete Your Profile - Investor Konnect";
    if (profile) {
      const nameParts = (profile.full_name || '').split(' ');
      const existingFirst = profile.onboarding_first_name || nameParts[0] || '';
      const existingLast = profile.onboarding_last_name || nameParts.slice(1).join(' ') || '';
      const existingMarkets = profile.markets || [];
      const existingPrimaryState = selectedState || profile.target_state || existingMarkets[0] || '';
      const isNationwide = existingPrimaryState === 'Nationwide' || existingMarkets.includes('Nationwide');
      setFormData(prev => ({
        ...prev,
        first_name: existingFirst,
        last_name: existingLast,
        phone: profile.phone || '',
        company: profile.company || '',
        primary_state: existingPrimaryState,
        primary_states: isNationwide ? [] : (existingMarkets.length > 0 ? existingMarkets : (existingPrimaryState ? [existingPrimaryState] : [])),
        nationwide: isNationwide,
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
      // Get fresh profile data to ensure we have the latest
      let currentProfile = profile;
      if (!currentProfile) {
        console.log('[InvestorOnboarding] Profile not in state, fetching fresh...');
        const profiles = await base44.entities.Profile.filter({ user_id: user?.id });
        currentProfile = profiles[0];
      }
      
      if (!currentProfile?.id) {
        throw new Error('Unable to load profile. Please refresh the page.');
      }

      console.log('[InvestorOnboarding] Saving profile:', currentProfile.id);

      // Save basic info and mark onboarding as complete
      const combinedName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      await base44.entities.Profile.update(currentProfile.id, {
        full_name: combinedName,
        onboarding_first_name: formData.first_name.trim(),
        onboarding_last_name: formData.last_name.trim(),
        phone: formData.phone,
        company: formData.company,
        goals: formData.goals,
        user_role: 'investor',
        user_type: 'investor',
        target_state: formData.nationwide ? 'Nationwide' : (formData.primary_states[0] || formData.primary_state),
        markets: formData.nationwide ? ['Nationwide'] : (formData.primary_states.length > 0 ? formData.primary_states : [formData.primary_state]).filter(Boolean),
        onboarding_step: 'basic_complete',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'investor-v1',
        metadata: {
          ...(currentProfile.metadata || {}),
          basicProfile: {
            investment_experience: formData.investment_experience,
            deal_types: formData.deal_types
          }
        }
      });

      console.log('[InvestorOnboarding] Profile saved successfully');
      
      toast.success("Profile saved! Let's choose your plan.");
      
      // Hard navigate to ensure fresh page load with updated profile
      window.location.href = createPageUrl("Pricing");
    } catch (error) {
      console.error('[InvestorOnboarding] Save error:', error);
      toast.error(error?.message || "Failed to save. Please try again.");
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" className="text-[#FAFAFA] text-[19px] font-medium">First Name *</Label>
            <Input 
              id="first_name" 
              value={formData.first_name} 
              onChange={(e) => updateField('first_name', e.target.value)} 
              placeholder="First name" 
              className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
            />
          </div>
          <div>
            <Label htmlFor="last_name" className="text-[#FAFAFA] text-[19px] font-medium">Last Name *</Label>
            <Input 
              id="last_name" 
              value={formData.last_name} 
              onChange={(e) => updateField('last_name', e.target.value)} 
              placeholder="Last name" 
              className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
            />
          </div>
        </div>
        <div>
          <Label htmlFor="phone" className="text-[#FAFAFA] text-[19px] font-medium">Phone Number *</Label>
          <Input 
            id="phone" 
            type="tel" 
            value={formData.phone} 
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              let formatted = '';
              if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
              if (digits.length >= 3) formatted += ') ' + digits.slice(3, 6);
              if (digits.length >= 6) formatted += '-' + digits.slice(6, 10);
              updateField('phone', formatted);
            }} 
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

  const toggleState = (state) => {
    setFormData(prev => {
      const current = prev.primary_states || [];
      const updated = current.includes(state)
        ? current.filter(s => s !== state)
        : [...current, state];
      return { ...prev, primary_states: updated, primary_state: updated[0] || '' };
    });
  };

  const toggleNationwide = (checked) => {
    setFormData(prev => ({
      ...prev,
      nationwide: checked,
      primary_states: checked ? [] : prev.primary_states,
      primary_state: checked ? 'Nationwide' : (prev.primary_states[0] || '')
    }));
  };

  const renderStep2 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Your investment focus</h3>
      <p className="text-[18px] text-[#808080] mb-10">What are your primary states?</p>
      
      <div className="space-y-7">
        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium mb-4 block">Primary States *</Label>
          
          {/* Nationwide option */}
          <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-4"
            style={{
              borderColor: formData.nationwide ? '#E3C567' : '#1F1F1F',
              backgroundColor: formData.nationwide ? 'rgba(227,197,103,0.1)' : '#141414'
            }}
          >
            <input
              type="checkbox"
              checked={formData.nationwide}
              onChange={(e) => toggleNationwide(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${formData.nationwide ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
              {formData.nationwide && <CheckCircle className="w-3.5 h-3.5 text-black" />}
            </div>
            <span className="text-[#FAFAFA] text-[17px] font-semibold">Nationwide</span>
          </label>

          {/* State checkboxes */}
          {!formData.nationwide && (
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 max-h-[280px] overflow-y-auto p-1">
              {US_STATES.map(state => (
                <button
                  key={state}
                  type="button"
                  onClick={() => toggleState(state)}
                  className={`p-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    (formData.primary_states || []).includes(state)
                      ? 'border-[#E3C567] bg-[#E3C567]/15 text-[#E3C567]'
                      : 'border-[#1F1F1F] bg-[#141414] text-[#808080] hover:border-[#E3C567]/40 hover:text-[#FAFAFA]'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          )}
          {!formData.nationwide && (formData.primary_states || []).length > 0 && (
            <p className="text-sm text-[#E3C567] mt-2">{formData.primary_states.length} state{formData.primary_states.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium mb-4 block">Type of Deals *</Label>
          {(() => {
            const DEAL_TYPES = ["Wholesale", "Novation", "Whole-tail", "Fix & Flip", "Buy & Hold", "Sub-2"];
            const allSelected = formData.deal_types.length === DEAL_TYPES.length;
            const toggleAll = (checked) => {
              updateField('deal_types', checked ? [...DEAL_TYPES] : []);
            };
            const toggleDealType = (type) => {
              const current = formData.deal_types || [];
              const updated = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
              updateField('deal_types', updated);
            };
            return (
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{
                    borderColor: allSelected ? '#E3C567' : '#1F1F1F',
                    backgroundColor: allSelected ? 'rgba(227,197,103,0.1)' : '#141414'
                  }}>
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${allSelected ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                    {allSelected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <span className="text-[#FAFAFA] text-[17px] font-semibold">All</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DEAL_TYPES.map(type => {
                    const selected = (formData.deal_types || []).includes(type);
                    return (
                      <label key={type} className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                        style={{
                          borderColor: selected ? '#E3C567' : '#1F1F1F',
                          backgroundColor: selected ? 'rgba(227,197,103,0.1)' : '#141414'
                        }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleDealType(type)} className="sr-only" />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                          {selected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                        </div>
                        <span className="text-[#FAFAFA] text-[15px]">{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
        <div>
          <Label htmlFor="investment_experience" className="text-[#FAFAFA] text-[19px] font-medium">How many deals have you done?</Label>
          <input 
            id="investment_experience" 
            type="text"
            inputMode="numeric"
            placeholder="e.g. 5"
            value={formData.investment_experience} 
            onChange={(e) => updateField('investment_experience', e.target.value)} 
            className="h-16 w-full rounded-lg border border-[#1F1F1F] px-5 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Tell us about yourself</h3>
      <p className="text-[18px] text-[#808080] mb-10">Let agents know a little bit about you</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="goals" className="text-[#FAFAFA] text-[19px] font-medium">Your Bio</Label>
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
              disabled={saving || (step === 1 && (!formData.first_name || !formData.last_name || !formData.phone)) || (step === 2 && !formData.nationwide && (!formData.primary_states || formData.primary_states.length === 0))}
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