import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 4A: INVESTOR ONBOARDING
 * 
 * 3-step wizard: Name → Phone → Company (optional)
 * No top nav. Linear flow only.
 */
function InvestorOnboardingContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company: ''
  });

  const TOTAL_STEPS = 3;

  useEffect(() => {
    document.title = "Investor Onboarding - AgentVault";

    // Load existing profile data if available
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company || ''
      });
    }
  }, [profile]);

  const handleNext = async () => {
    // Validation
    if (step === 1 && !formData.full_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (step === 2 && !formData.phone.trim()) {
      toast.error("Please enter your phone number");
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
      // Update profile
      if (profile) {
        await base44.entities.Profile.update(profile.id, {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          company: formData.company.trim() || null,
          onboarding_completed_at: new Date().toISOString()
        });
      }

      await refresh();
      toast.success("Profile completed!");
      
      // Navigate to verification
      navigate(createPageUrl("Verify"));

    } catch (error) {
      console.error('[InvestorOnboarding] Save error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      {/* NO TOP NAV */}
      
      <div className="max-w-xl w-full">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-sm font-medium text-blue-600">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
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
          
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">What's your name?</h2>
                <p className="text-slate-600">We'll use this to personalize your experience</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="John Smith"
                  className="text-lg py-6"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                />
              </div>
            </div>
          )}

          {/* Step 2: Phone */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">How can agents reach you?</h2>
                <p className="text-slate-600">Your contact number for deal coordination</p>
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
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                />
              </div>
            </div>
          )}

          {/* Step 3: Company (Optional) */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Company or investing entity?</h2>
                <p className="text-slate-600">Optional - helps agents understand your structure</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  placeholder="Smith Investment Group LLC"
                  className="text-lg py-6"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                />
              </div>
              
              <p className="text-sm text-slate-500">
                You can skip this and add it later if preferred
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
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
              className="bg-blue-600 hover:bg-blue-700"
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

export default function InvestorOnboarding() {
  return (
    <StepGuard requiredStep={3}> {/* Requires AUTH + ROLE */}
      <InvestorOnboardingContent />
    </StepGuard>
  );
}