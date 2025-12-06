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
      // Get authenticated user
      const authUser = await base44.auth.me();
      if (!authUser) {
        throw new Error('Not authenticated');
      }
      
      // Find profile by email (canonical) or user_id
      const emailLower = authUser.email.toLowerCase().trim();
      let profiles = await base44.entities.Profile.filter({ email: emailLower });
      
      if (!profiles || profiles.length === 0) {
        profiles = await base44.entities.Profile.filter({ user_id: authUser.id });
      }
      
      let profileToUpdate = profiles[0];
      
      // If no profile exists, create one
      if (!profileToUpdate) {
        console.log('[AgentOnboarding] No profile found, creating new one');
        profileToUpdate = await base44.entities.Profile.create({
          user_id: authUser.id,
          email: emailLower,
          full_name: formData.full_name || authUser.full_name || '',
          user_role: 'agent',
          user_type: 'agent'
        });
        console.log('[AgentOnboarding] Created new profile:', profileToUpdate.id);
      }

      // Build the complete update data
      const updateData = {
        full_name: formData.full_name,
        phone: formData.phone,
        user_role: 'agent',
        user_type: 'agent',
        license_number: formData.license_number,
        license_state: formData.license_state,
        markets: formData.markets,
        target_state: formData.license_state || formData.markets[0] || '',
        onboarding_step: 'basic_complete',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'agent-v1',
        agent: {
          ...(profileToUpdate.agent || {}),
          license_number: formData.license_number,
          license_state: formData.license_state,
          markets: formData.markets,
          experience_years: parseInt(formData.experience_years) || 0,
          bio: formData.bio,
          investor_friendly: true,
          brokerage: profileToUpdate.agent?.brokerage || ''
        }
      };
      
      console.log('[AgentOnboarding] Saving profile ID:', profileToUpdate.id);
      console.log('[AgentOnboarding] Update data:', JSON.stringify(updateData, null, 2));
      
      const result = await base44.entities.Profile.update(profileToUpdate.id, updateData);
      console.log('[AgentOnboarding] Profile saved successfully:', result);

      toast.success("Profile saved! Welcome to Investor Konnect!");
      
      // Force a full page reload to refresh all state
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = createPageUrl("Dashboard");
    } catch (error) {
      console.error('[AgentOnboarding] Error saving profile:', error);
      toast.error("Failed to save: " + (error.message || "Please try again."));
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin" />
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
          <Label htmlFor="phone" className="text-[#FAFAFA] text-[19px] font-medium">Phone Number *</Label>
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
          <Label htmlFor="experience_years" className="text-[#FAFAFA] text-[19px] font-medium">Years of Experience</Label>
          <Input 
            id="experience_years" 
            type="number"
            min="0"
            value={formData.experience_years} 
            onChange={(e) => updateField('experience_years', e.target.value)} 
            placeholder="e.g., 5" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">License & Markets</h3>
      <p className="text-[18px] text-[#808080] mb-10">Your license info and service areas</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="license_number" className="text-[#FAFAFA] text-[19px] font-medium">License Number *</Label>
          <Input 
            id="license_number" 
            value={formData.license_number} 
            onChange={(e) => updateField('license_number', e.target.value)} 
            placeholder="e.g., TX-123456" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
        <div>
          <Label htmlFor="license_state" className="text-[#FAFAFA] text-[19px] font-medium">License State *</Label>
          <select 
            id="license_state" 
            value={formData.license_state} 
            onChange={(e) => updateField('license_state', e.target.value)} 
            className="h-16 w-full rounded-lg border border-[#1F1F1F] px-5 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
          >
            <option value="">Select state</option>
            {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium">Markets You Serve *</Label>
          <div className="grid grid-cols-3 gap-3 mt-3 max-h-60 overflow-y-auto p-4 border border-[#1F1F1F] rounded-lg bg-[#0A0A0A]">
            {US_STATES.map((state) => (
              <div key={state} className="flex items-center gap-3">
                <Checkbox 
                  id={`market-${state}`} 
                  checked={formData.markets.includes(state)} 
                  onCheckedChange={() => toggleMarket(state)} 
                  className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5"
                />
                <Label htmlFor={`market-${state}`} className="text-[17px] font-normal cursor-pointer text-[#FAFAFA]">{state}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Your Bio</h3>
      <p className="text-[18px] text-[#808080] mb-10">Tell investors about yourself</p>
      
      <div className="space-y-7">
        <div>
          <Label htmlFor="bio" className="text-[#FAFAFA] text-[19px] font-medium">Professional Bio</Label>
          <Textarea 
            id="bio" 
            value={formData.bio} 
            onChange={(e) => updateField('bio', e.target.value)} 
            placeholder="Introduce yourself and highlight your experience working with investor clients..." 
            rows={7}
            className="text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" 
          />
          <p className="text-[16px] text-[#808080] mt-2">This will appear on your public profile</p>
        </div>

        <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#E3C567]">
            After completing this, you can add more details from your dashboard to improve your profile and get matched with more investors.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      <header className="h-20 flex items-center justify-center border-b border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#E3C567] rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-black" />
          </div>
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
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && (!formData.license_number || !formData.license_state || formData.markets.length === 0))}
              className="h-12 px-8 rounded-lg bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold transition-all duration-200 disabled:bg-[#1F1F1F] disabled:text-[#666666]"
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