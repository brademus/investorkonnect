import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { CheckCircle } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

/**
 * AGENT ONBOARDING - Simple 3-step initial onboarding
 * 
 * Flow: Onboarding -> Identity Verification -> NDA -> Dashboard
 * (Agents skip the subscription step)
 */
export default function AgentOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh, user, onboarded, kycVerified } = useCurrentProfile();
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
    full_name: '',
    phone: '',
    license_number: '',
    brokerage: '',
    license_state: '',
    main_county: '',
    markets: [],
    experience_years: '',
    deals_closed: '',
    investment_strategies: [],
    specialties: [],
    typical_response_time: '',
    bio: ''
  });

  const TOTAL_STEPS = 4;

  const STRATEGY_OPTIONS = [
    'Fix & Flip', 'Buy & Hold', 'BRRRR', 'Wholesale', 
    'Short-Term Rental / Airbnb', 'Commercial', 'Multi-Family', 'New Construction', 'Land'
  ];

  const SPECIALTY_OPTIONS = [
    'Single Family', 'Multi-Family', 'Condos/Townhomes', 'Commercial', 
    'Land/Lots', 'Foreclosures/REO', 'Off-Market Deals', 'New Construction', '1031 Exchange'
  ];

  const RESPONSE_TIME_OPTIONS = [
    'Within 1 hour', 'Within a few hours', 'Same day', 'Within 24 hours'
  ];

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

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
      console.log('[AgentOnboarding] Already onboarded, checking next step...');
      console.log('[AgentOnboarding] kycVerified:', kycVerified);
      console.log('[AgentOnboarding] identity_status:', profile?.identity_status);
      
      // Already onboarded, check next step
      if (!kycVerified) {
        console.log('[AgentOnboarding] Redirecting to IdentityVerification');
        navigate(createPageUrl("IdentityVerification"), { replace: true });
      } else {
        console.log('[AgentOnboarding] Redirecting to Pipeline');
        navigate(createPageUrl("Pipeline"), { replace: true });
      }
    }
  }, [checking, onboarded, kycVerified, navigate, profile?.identity_status]);

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
        brokerage: agent.brokerage || profile.broker || '',
        license_state: agent.license_state || profile.license_state || '',
        main_county: agent.main_county || '',
        markets: agent.markets || profile.markets || [],
        experience_years: agent.experience_years || '',
        deals_closed: agent.investment_deals_last_12m || '',
        investment_strategies: agent.investment_strategies || [],
        specialties: agent.specialties || [],
        typical_response_time: agent.typical_response_time || '',
        bio: agent.bio || ''
      }));
    }
  }, [profile]);

  // Enforce role consistency: agents only
  useEffect(() => {
    if (!profile) return;
    const current = profile.user_role;
    if (!current || current === 'member') {
      base44.entities.Profile.update(profile.id, { user_role: 'agent', user_type: 'agent' }).catch(() => {});
    } else if (current === 'investor') {
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
    }
  }, [profile, navigate]);

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
      const licensedStates = formData.markets.length > 0 ? formData.markets : [formData.license_state];
      
      const updateData = {
          full_name: formData.full_name,
          phone: formData.phone,
          user_role: 'agent',
          user_type: 'agent',
          broker: formData.brokerage,
          license_number: formData.license_number,
          license_state: formData.license_state,
          markets: licensedStates,
          target_state: formData.license_state || formData.markets[0] || '',
          onboarding_step: 'basic_complete',
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: 'agent-v1',
          agent: {
            ...(profileToUpdate.agent || {}),
            license_number: formData.license_number,
            license_state: formData.license_state,
            licensed_states: licensedStates,
            main_county: formData.main_county,
            markets: licensedStates,
            experience_years: parseInt(formData.experience_years) || 0,
            investment_deals_last_12m: parseInt(formData.deals_closed) || 0,
            investment_strategies: formData.investment_strategies,
            specialties: formData.specialties,
            typical_response_time: formData.typical_response_time,
            bio: formData.bio,
            investor_friendly: true,
            brokerage: formData.brokerage
          }
        };
      
      console.log('[AgentOnboarding] Saving profile ID:', profileToUpdate.id);
      console.log('[AgentOnboarding] Update data:', JSON.stringify(updateData, null, 2));
      
      const result = await base44.entities.Profile.update(profileToUpdate.id, updateData);
      console.log('[AgentOnboarding] Profile saved successfully:', result);

      toast.success("Profile saved! Let's verify your identity.");
      
      // Navigate to Identity Verification (next step for agents)
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate(createPageUrl("IdentityVerification"), { replace: true });
    } catch (error) {
      console.error('[AgentOnboarding] Error saving profile:', error);
      toast.error("Failed to save: " + (error.message || "Please try again."));
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
        <div>
          <Label htmlFor="deals_closed" className="text-[#FAFAFA] text-[19px] font-medium">Deals Closed (Last 12 Months)</Label>
          <Input 
            id="deals_closed" 
            type="number"
            min="0"
            value={formData.deals_closed} 
            onChange={(e) => updateField('deals_closed', e.target.value)} 
            placeholder="e.g., 12" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">License & Location</h3>
      <p className="text-[18px] text-[#808080] mb-10">Your license info and main service area</p>
      
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
          <Label htmlFor="brokerage" className="text-[#FAFAFA] text-[19px] font-medium">Brokerage Name *</Label>
          <Input 
            id="brokerage" 
            value={formData.brokerage} 
            onChange={(e) => updateField('brokerage', e.target.value)} 
            placeholder="e.g., Keller Williams, eXp Realty" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
        <div>
          <Label htmlFor="license_state" className="text-[#FAFAFA] text-[19px] font-medium">Licensed State *</Label>
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
          <Label htmlFor="main_county" className="text-[#FAFAFA] text-[19px] font-medium">Main County *</Label>
          <Input 
            id="main_county" 
            value={formData.main_county} 
            onChange={(e) => updateField('main_county', e.target.value)} 
            placeholder="e.g., Maricopa County" 
            className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Investor Experience</h3>
      <p className="text-[18px] text-[#808080] mb-10">Help investors understand what you bring to the table</p>
      
      <div className="space-y-7">
        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium">Investment Strategies You Support</Label>
          <p className="text-sm text-[#808080] mt-1 mb-3">Select all that apply</p>
          <div className="grid grid-cols-2 gap-3">
            {STRATEGY_OPTIONS.map((strategy) => (
              <div key={strategy} className="flex items-center gap-3">
                <Checkbox 
                  id={`strategy-${strategy}`} 
                  checked={formData.investment_strategies.includes(strategy)} 
                  onCheckedChange={() => toggleArrayItem('investment_strategies', strategy)} 
                  className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5"
                />
                <Label htmlFor={`strategy-${strategy}`} className="text-[16px] font-normal cursor-pointer text-[#FAFAFA]">{strategy}</Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium">Property Specialties</Label>
          <p className="text-sm text-[#808080] mt-1 mb-3">Select all that apply</p>
          <div className="grid grid-cols-2 gap-3">
            {SPECIALTY_OPTIONS.map((specialty) => (
              <div key={specialty} className="flex items-center gap-3">
                <Checkbox 
                  id={`specialty-${specialty}`} 
                  checked={formData.specialties.includes(specialty)} 
                  onCheckedChange={() => toggleArrayItem('specialties', specialty)} 
                  className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5"
                />
                <Label htmlFor={`specialty-${specialty}`} className="text-[16px] font-normal cursor-pointer text-[#FAFAFA]">{specialty}</Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium">Typical Response Time</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {RESPONSE_TIME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('typical_response_time', option)}
                className={`px-4 py-3 rounded-lg border text-left text-[16px] transition-all ${
                  formData.typical_response_time === option
                    ? 'border-[#E3C567] bg-[#E3C567]/20 text-[#E3C567]'
                    : 'border-[#1F1F1F] bg-[#141414] text-[#FAFAFA] hover:border-[#E3C567]/50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Markets & Bio</h3>
      <p className="text-[18px] text-[#808080] mb-10">Service areas and professional background</p>
      
      <div className="space-y-7">
        <div>
          <Label className="text-[#FAFAFA] text-[19px] font-medium">All States Where You're Licensed *</Label>
          <p className="text-sm text-[#808080] mt-1 mb-3">Select all states where you hold an active real estate license</p>
          <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto p-4 border border-[#1F1F1F] rounded-lg bg-[#0A0A0A]">
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

        <div>
          <Label htmlFor="bio" className="text-[#FAFAFA] text-[19px] font-medium">Professional Bio</Label>
          <Textarea 
            id="bio" 
            value={formData.bio} 
            onChange={(e) => updateField('bio', e.target.value)} 
            placeholder="Introduce yourself and highlight your experience working with investor clients..." 
            rows={5}
            className="text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" 
          />
          <p className="text-[16px] text-[#808080] mt-2">This will appear on your public profile</p>
        </div>

        <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5">
          <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#E3C567]">
            Next, we'll verify your identity to ensure trust and security on the platform.
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
          {step === 4 && renderStep4()}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F1F]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#808080] hover:text-[#E3C567] font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && (!formData.license_number || !formData.brokerage || !formData.license_state || !formData.main_county)) || (step === 4 && formData.markets.length === 0)}
              className="h-12 px-8 rounded-lg bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold transition-all duration-200 disabled:bg-[#1F1F1F] disabled:text-[#666666]"
            >
              {saving ? (
                <><LoadingAnimation className="w-4 h-4 mr-2 inline" />Saving...</>
              ) : step === TOTAL_STEPS ? (
                'Continue to Verification →'
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