import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

/**
 * AGENT ONBOARDING - Simple 3-step initial onboarding
 * Full detailed onboarding is available from Dashboard checklist
 */
export default function AgentOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh, user } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    license_state: '',
    markets: [],
    experience_years: '',
    bio: ''
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
      const agent = profile.agent || {};
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        license_number: agent.license_number || profile.license_number || '',
        license_state: agent.license_state || profile.license_state || '',
        markets: agent.markets || profile.markets || [],
        experience_years: agent.experience_years || '',
        bio: agent.bio || ''
      }));
    }
  }, [profile]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleMarket = (state) => {
    setFormData(prev => ({
      ...prev,
      markets: prev.markets.includes(state)
        ? prev.markets.filter(s => s !== state)
        : [...prev.markets, state]
    }));
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
        user_role: 'agent',
        user_type: 'agent',
        license_number: formData.license_number,
        license_state: formData.license_state,
        markets: formData.markets,
        // NOT setting onboarding_completed_at - that happens in deep onboarding
        onboarding_step: 'basic_complete',
        agent: {
          ...profile.agent,
          license_number: formData.license_number,
          license_state: formData.license_state,
          markets: formData.markets,
          experience_years: formData.experience_years,
          bio: formData.bio
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
          <Label htmlFor="phone">Phone Number *</Label>
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
          <Label htmlFor="experience_years">Years of Experience</Label>
          <Input 
            id="experience_years" 
            type="number"
            min="0"
            value={formData.experience_years} 
            onChange={(e) => updateField('experience_years', e.target.value)} 
            placeholder="e.g., 5" 
            className="h-12 text-[16px] mt-1" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-black mb-2">License & Markets</h3>
      <p className="text-[16px] text-[#666666] mb-8">Your license info and service areas</p>
      
      <div className="space-y-5">
        <div>
          <Label htmlFor="license_number">License Number *</Label>
          <Input 
            id="license_number" 
            value={formData.license_number} 
            onChange={(e) => updateField('license_number', e.target.value)} 
            placeholder="e.g., TX-123456" 
            className="h-12 text-[16px] mt-1" 
          />
        </div>
        <div>
          <Label htmlFor="license_state">License State *</Label>
          <select 
            id="license_state" 
            value={formData.license_state} 
            onChange={(e) => updateField('license_state', e.target.value)} 
            className="h-12 w-full rounded-lg border border-[#E5E5E5] px-4 text-[16px] mt-1"
          >
            <option value="">Select state</option>
            {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <Label>Markets You Serve *</Label>
          <div className="grid grid-cols-4 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border border-[#E5E5E5] rounded-lg">
            {US_STATES.map((state) => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox 
                  id={`market-${state}`} 
                  checked={formData.markets.includes(state)} 
                  onCheckedChange={() => toggleMarket(state)} 
                />
                <Label htmlFor={`market-${state}`} className="text-sm font-normal cursor-pointer">{state}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-black mb-2">Your Bio</h3>
      <p className="text-[16px] text-[#666666] mb-8">Tell investors about yourself</p>
      
      <div className="space-y-5">
        <div>
          <Label htmlFor="bio">Professional Bio</Label>
          <Textarea 
            id="bio" 
            value={formData.bio} 
            onChange={(e) => updateField('bio', e.target.value)} 
            placeholder="Introduce yourself and highlight your experience working with investor clients..." 
            rows={5}
            className="text-[16px] mt-1" 
          />
          <p className="text-sm text-[#666666] mt-1">This will appear on your public profile</p>
        </div>

        <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#92400E] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#92400E]">
            After completing this, you can add more details from your dashboard to improve your profile and get matched with more investors.
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
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && (!formData.license_number || !formData.license_state || formData.markets.length === 0))}
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