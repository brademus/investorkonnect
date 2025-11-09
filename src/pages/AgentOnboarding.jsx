
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

const SPECIALTIES = [
  "Residential",
  "Multi-Family",
  "Commercial",
  "Industrial",
  "Land",
  "REO/Foreclosure",
  "Short Sales",
  "Investment Properties",
  "New Construction",
  "Luxury"
];

/**
 * STEP 4B: AGENT ONBOARDING
 * 
 * 5-step wizard: Name/Phone → License → Markets → Specialties → Bio
 * No top nav. Linear flow only.
 */
function AgentOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    licenseNumber: '',
    licenseState: '',
    markets: [],
    specialties: [],
    bio: ''
  });

  const TOTAL_STEPS = 5;

  useEffect(() => {
    document.title = "Agent Onboarding - AgentVault";

    // Load existing profile data
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        licenseNumber: profile.licenseNumber || '',
        licenseState: profile.licenseState || '',
        markets: profile.markets || [],
        specialties: profile.agent?.specialties || [],
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

  const handleNext = async () => {
    // Validation
    if (step === 1 && !formData.full_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (step === 2 && (!formData.licenseNumber || !formData.licenseState)) {
      toast.error("Please enter your license information");
      return;
    }
    if (step === 3 && formData.markets.length === 0) {
      toast.error("Please select at least one market");
      return;
    }
    if (step === 4 && formData.specialties.length === 0) {
      toast.error("Please select at least one specialty");
      return;
    }

    if (step === TOTAL_STEPS) {
      await handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      if (profile) {
        console.log('[AgentOnboarding] 🎯 Final submit - setting v2 completion flags...');
        
        await base44.entities.Profile.update(profile.id, {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          licenseNumber: formData.licenseNumber.trim(),
          licenseState: formData.licenseState,
          markets: formData.markets,
          agent: {
            ...profile.agent,
            specialties: formData.specialties,
            bio: formData.bio.trim(),
            verification_status: 'pending'
          },
          // CRITICAL: Set v2 onboarding flags
          user_role: 'agent',
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: 'v2'
        });
        
        console.log('[AgentOnboarding] ✅ v2 flags set');
      }

      await refresh();
      toast.success("Profile completed!");
      
      // Navigate to verification
      navigate(createPageUrl("Verify"));

    } catch (error) {
      console.error('[AgentOnboarding] Save error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
      {/* NO TOP NAV */}
      
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
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">What's your name?</h2>
                <p className="text-slate-600">As you're known professionally</p>
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

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Your real estate license</h2>
                <p className="text-slate-600">We'll verify this information</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="license">License Number *</Label>
                <Input
                  id="license"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                  placeholder="ABC123456"
                  className="text-lg py-6"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">License State *</Label>
                <select
                  id="state"
                  value={formData.licenseState}
                  onChange={(e) => setFormData({...formData, licenseState: e.target.value})}
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

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Which markets do you cover?</h2>
                <p className="text-slate-600">Select all states where you operate</p>
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

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Your specialties</h2>
                <p className="text-slate-600">What types of properties do you focus on?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SPECIALTIES.map(specialty => (
                  <button
                    key={specialty}
                    type="button"
                    onClick={() => toggleSpecialty(specialty)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.specialties.includes(specialty)
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 hover:border-emerald-300 text-slate-700'
                    }`}
                  >
                    {specialty}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Tell investors about yourself</h2>
                <p className="text-slate-600">How do you work with investors? (Optional)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Your Approach</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="e.g., 'I specialize in helping out-of-state investors find cash-flowing multi-family properties...'"
                  className="min-h-32"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : <div />}
            
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
    </div>
  );
}

export default function AgentOnboarding() {
  return (
    <StepGuard requiredStep={3}> {/* Requires AUTH + ROLE */}
      <AgentOnboardingContent />
    </StepGuard>
  );
}
