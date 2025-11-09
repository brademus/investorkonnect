import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

const SPECIALTIES = [
  "Residential (SFR)",
  "Multi-Family (2–4)",
  "Multi-Family (5+)",
  "Commercial (retail/office/industrial/mixed-use)",
  "Investment Properties",
  "Vacation/STR",
  "Land / Development",
  "REO / Foreclosure",
  "Short Sales",
  "New Construction",
  "Luxury"
];

/**
 * AGENT ONBOARDING v2 - 5-Step Wizard
 * 
 * Step 1: Basic Info (name, phone)
 * Step 2: License (SKIPPABLE)
 * Step 3: Markets (required)
 * Step 4: Specialties (required)
 * Step 5: Experience & Investor Focus + Bio
 * 
 * Completes with onboarding_version="v2-agent"
 * Routes to Dashboard (not Verify)
 */
function AgentOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    license_state: '',
    markets: [],
    specialties: [],
    experience_years: '',
    investor_clients_count: '',
    investor_friendly: null,
    bio: ''
  });

  const TOTAL_STEPS = 5;

  useEffect(() => {
    document.title = "Agent Onboarding - AgentVault";

    // Load existing profile data if available
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        license_number: profile.agent?.license_number || profile.license_number || '',
        license_state: profile.agent?.license_state || profile.license_state || '',
        markets: profile.agent?.markets || profile.markets || [],
        specialties: profile.agent?.specialties || [],
        experience_years: profile.agent?.experience_years || '',
        investor_clients_count: profile.agent?.investor_clients_count || '',
        investor_friendly: profile.agent?.investor_friendly ?? null,
        bio: profile.agent?.bio || ''
      });
    }
  }, [profile]);

  const toggleMarket = (state) => {
    setFormData(prev => ({
      ...prev,
      markets: prev.markets.includes(state)
        ? prev.markets.filter(s => s !== state)
        : [...prev.markets, state]
    }));
  };

  const toggleSpecialty = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const handleSkipLicense = () => {
    console.log('[AgentOnboarding] Skipping license step');
    toast.info("You can add your license later from your dashboard");
    setStep(3);
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.full_name.trim()) {
          toast.error("Please enter your full name");
          return false;
        }
        if (!formData.phone.trim()) {
          toast.error("Please enter your phone number");
          return false;
        }
        return true;

      case 2:
        // License is optional - user can skip
        return true;

      case 3:
        if (formData.markets.length === 0) {
          toast.error("Please select at least one market");
          return false;
        }
        return true;

      case 4:
        if (formData.specialties.length === 0) {
          toast.error("Please select at least one specialty");
          return false;
        }
        return true;

      case 5:
        if (!formData.experience_years || formData.experience_years < 0) {
          toast.error("Please enter your years of experience");
          return false;
        }
        if (formData.investor_clients_count === '' || formData.investor_clients_count < 0) {
          toast.error("Please enter number of investor clients");
          return false;
        }
        if (formData.investor_friendly === null) {
          toast.error("Please indicate if you work with investor clients");
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
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      console.log('[AgentOnboarding] 🎯 Submitting v2-agent onboarding...');

      // Prepare payload
      const payload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        license_number: formData.license_number.trim() || null,
        license_state: formData.license_state || null,
        markets: formData.markets,
        specialties: formData.specialties,
        experience_years: parseInt(formData.experience_years),
        investor_clients_count: parseInt(formData.investor_clients_count),
        investor_friendly: formData.investor_friendly,
        bio: formData.bio.trim() || null
      };

      console.log('[AgentOnboarding] Payload:', payload);

      // Call backend to save
      const response = await base44.functions.invoke('upsertAgentOnboarding', payload);

      console.log('[AgentOnboarding] Response:', response.data);

      if (response.data?.ok) {
        console.log('[AgentOnboarding] ✅ Onboarding saved with v2-agent version');
        
        await refresh();
        toast.success("Welcome to AgentVault!");
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Navigate to Dashboard (not Verify)
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else {
        throw new Error(response.data?.message || 'Failed to save onboarding');
      }

    } catch (error) {
      console.error('[AgentOnboarding] ❌ Submit error:', error);
      toast.error(error.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-sm font-medium text-emerald-600">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Complete profile • Takes 3-5 minutes</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's get started</h2>
                <p className="text-slate-600">Tell us about yourself</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="Jane Doe"
                  className="text-lg py-6"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+1 (555) 123-4567"
                  className="text-lg py-6"
                />
              </div>
            </div>
          )}

          {/* STEP 2: License (SKIPPABLE) */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Your real estate license</h2>
                <p className="text-slate-600">We'll verify this information (optional for now)</p>
              </div>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    You can skip this step and add your license later from your dashboard. We'll verify it once provided.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">License Number</Label>
                <Input
                  id="license"
                  value={formData.license_number}
                  onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                  placeholder="ABC123456"
                  className="text-lg py-6"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">License State</Label>
                <select
                  id="state"
                  value={formData.license_state}
                  onChange={(e) => setFormData({...formData, license_state: e.target.value})}
                  className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select a state</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: Markets */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Which markets do you cover?</h2>
                <p className="text-slate-600">Select all states where you operate *</p>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                {US_STATES.map(state => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => toggleMarket(state)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.markets.includes(state)
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 hover:border-emerald-300 text-slate-700'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-500">{formData.markets.length} state{formData.markets.length !== 1 ? 's' : ''} selected</p>
            </div>
          )}

          {/* STEP 4: Specialties */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Your specialties</h2>
                <p className="text-slate-600">What types of properties/deals do you focus on? *</p>
              </div>
              <div className="space-y-3">
                {SPECIALTIES.map(specialty => (
                  <div key={specialty} className="flex items-center gap-3">
                    <Checkbox
                      id={`specialty-${specialty}`}
                      checked={formData.specialties.includes(specialty)}
                      onCheckedChange={() => toggleSpecialty(specialty)}
                    />
                    <Label htmlFor={`specialty-${specialty}`} className="cursor-pointer font-normal">
                      {specialty}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500">{formData.specialties.length} selected</p>
            </div>
          )}

          {/* STEP 5: Experience & Investor Focus */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Experience & investor focus</h2>
                <p className="text-slate-600">Help investors understand your background</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">How many years have you been a licensed agent? *</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                  placeholder="e.g., 5"
                  className="text-lg py-6"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="investor_clients">About how many investor clients have you worked with? *</Label>
                <select
                  id="investor_clients"
                  value={formData.investor_clients_count}
                  onChange={(e) => setFormData({...formData, investor_clients_count: e.target.value})}
                  className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select range</option>
                  <option value="0">0 (new to investor clients)</option>
                  <option value="3">1–3</option>
                  <option value="10">4–10</option>
                  <option value="20">10+</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>Do you actively work with and prioritize investor clients? *</Label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, investor_friendly: true})}
                    className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                      formData.investor_friendly === true
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 hover:border-emerald-300 text-slate-700'
                    }`}
                  >
                    <div className="text-lg font-semibold">Yes</div>
                    <div className="text-sm text-slate-600">I focus on investor clients</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, investor_friendly: false})}
                    className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                      formData.investor_friendly === false
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 hover:border-emerald-300 text-slate-700'
                    }`}
                  >
                    <div className="text-lg font-semibold">No</div>
                    <div className="text-sm text-slate-600">Not my primary focus</div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Tell investors how you work with them (optional)</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="e.g., 'I specialize in helping out-of-state investors find cash-flowing properties. I provide detailed market analysis, help with property inspections, and have relationships with local contractors...'"
                  className="min-h-32"
                  rows={4}
                />
                <p className="text-xs text-slate-500">Mention off-market access, underwriting help, speed, connections, etc.</p>
              </div>
            </div>
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
            
            <div className="flex gap-3">
              {step === 2 && (
                <Button
                  variant="outline"
                  onClick={handleSkipLicense}
                  disabled={saving}
                >
                  Skip for now
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : step === TOTAL_STEPS ? (
                  <>
                    Complete
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
        </div>

        {/* Step Indicator Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx + 1 === step ? 'w-8 bg-emerald-600' :
                idx + 1 < step ? 'w-2 bg-emerald-400' :
                'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AgentOnboarding() {
  return <AgentOnboardingContent />;
}