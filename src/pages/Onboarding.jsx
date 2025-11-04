import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AuthGuard } from "@/components/AuthGuard";

export default function Onboarding() {
  return (
    <AuthGuard requireAuth={true}>
      <OnboardingContent />
    </AuthGuard>
  );
}

function OnboardingContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const checkRan = useRef(false);

  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    company: "",
    markets: "",
    phone: "",
    accreditation: "",
    goals: "",
    agree_terms: false
  });

  useEffect(() => {
    if (checkRan.current) return;
    checkRan.current = true;
    
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log('[Onboarding] Loading profile data...');

      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const state = await response.json();
        console.log('[Onboarding] User state loaded:', state);

        if (state.profile) {
          console.log('[Onboarding] Pre-filling form with existing data');
          setFormData({
            full_name: state.profile.full_name || "",
            role: state.profile.user_type || "",
            company: state.profile.company || "",
            markets: Array.isArray(state.profile.markets) ? state.profile.markets.join(", ") : "",
            phone: state.profile.phone || "",
            accreditation: state.profile.accreditation || "",
            goals: state.profile.goals || "",
            agree_terms: false
          });
        }
      } else {
        console.warn('[Onboarding] Failed to load profile data');
      }
      
      setLoading(false);

    } catch (error) {
      console.error('[Onboarding] Load error:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('[Onboarding] 🚀 Form submitted');
    console.log('[Onboarding] Form data:', formData);

    // Validation
    if (!formData.full_name || !formData.full_name.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!formData.role) {
      toast.error("Please select your account type");
      return;
    }

    if (!formData.markets || !formData.markets.trim()) {
      toast.error("Please enter at least one target market");
      return;
    }

    if (!formData.goals || !formData.goals.trim()) {
      toast.error("Please tell us about your goals");
      return;
    }

    if (!formData.agree_terms) {
      toast.error("Please agree to the Terms and Privacy Policy");
      return;
    }

    if (submitting) {
      console.warn('[Onboarding] Already submitting, ignoring duplicate submit');
      return;
    }

    setSubmitting(true);
    console.log('[Onboarding] ✅ Validation passed, submitting to backend...');

    try {
      // Build payload
      const payload = {
        full_name: formData.full_name.trim(),
        role: formData.role,
        company: formData.company.trim(),
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone.trim(),
        accreditation: formData.accreditation.trim(),
        goals: formData.goals.trim(),
        complete: true // Mark onboarding as complete
      };

      console.log('[Onboarding] 📤 Payload:', JSON.stringify(payload, null, 2));

      // Call backend function
      const response = await fetch('/functions/onboardingComplete', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[Onboarding] 📥 Response status:', response.status);
      console.log('[Onboarding] 📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Read response
      const responseText = await response.text();
      console.log('[Onboarding] 📥 Response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('[Onboarding] 📥 Parsed result:', result);
      } catch (parseError) {
        console.error('[Onboarding] ❌ Failed to parse response:', parseError);
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 100)}`);
      }

      // Check if request failed
      if (!response.ok) {
        console.error('[Onboarding] ❌ Request failed with status:', response.status);
        console.error('[Onboarding] Error details:', result);
        throw new Error(result.message || result.error || `Save failed (${response.status})`);
      }

      // Check if backend reported failure
      if (!result.ok && !result.success) {
        console.error('[Onboarding] ❌ Backend reported failure:', result);
        throw new Error(result.message || result.error || 'Save failed');
      }

      // Success!
      console.log('[Onboarding] ✅ Save successful!');
      console.log('[Onboarding] Profile data:', result.profile);
      console.log('[Onboarding] Completed:', result.completed);
      console.log('[Onboarding] Completed at:', result.completedAt);
      
      // Show success with profile details
      toast.success(`Profile saved! Welcome, ${result.profile?.full_name || 'there'}!`, {
        duration: 3000
      });
      
      console.log('[Onboarding] 🎉 Complete! Redirecting to Dashboard in 1 second...');
      
      // Wait a moment then redirect
      setTimeout(() => {
        console.log('[Onboarding] → Redirecting now...');
        window.location.href = createPageUrl("Dashboard");
      }, 1000);

    } catch (error) {
      console.error('[Onboarding] ❌ Error during submit:', error);
      console.error('[Onboarding] Error name:', error.name);
      console.error('[Onboarding] Error message:', error.message);
      console.error('[Onboarding] Error stack:', error.stack);
      
      toast.error(error.message || "Failed to save profile. Please try again.", {
        duration: 5000
      });
      
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Complete Your Profile</h1>
          <p className="text-slate-600">Tell us about yourself to get the most out of AgentVault</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Full Name */}
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="John Doe"
                required
                disabled={submitting}
                autoFocus
              />
            </div>

            {/* User Type */}
            <div>
              <Label className="mb-3 block">I am a... *</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(value) => setFormData({...formData, role: value})}
                required
                disabled={submitting}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.role === "investor" 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300"
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="investor" id="investor" />
                      <Label htmlFor="investor" className="cursor-pointer font-semibold">
                        Investor
                      </Label>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 ml-7">
                      Looking for verified agents
                    </p>
                  </div>
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.role === "agent" 
                      ? "border-emerald-600 bg-emerald-50" 
                      : "border-slate-200 hover:border-slate-300"
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="agent" id="agent" />
                      <Label htmlFor="agent" className="cursor-pointer font-semibold">
                        Agent
                      </Label>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 ml-7">
                      Connect with investors
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Company */}
            <div>
              <Label htmlFor="company">Company (Optional)</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                placeholder="Your Company"
                disabled={submitting}
              />
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets">Target Markets *</Label>
              <Input
                id="markets"
                value={formData.markets}
                onChange={(e) => setFormData({...formData, markets: e.target.value})}
                placeholder="Miami, Phoenix, Dallas"
                required
                disabled={submitting}
              />
              <p className="text-xs text-slate-500 mt-1">Cities or metro areas (comma-separated)</p>
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="(555) 123-4567"
                disabled={submitting}
              />
            </div>

            {/* Accreditation */}
            <div>
              <Label htmlFor="accreditation">Accreditation (Optional)</Label>
              <Input
                id="accreditation"
                value={formData.accreditation}
                onChange={(e) => setFormData({...formData, accreditation: e.target.value})}
                placeholder="e.g., Accredited Investor, Licensed Agent"
                disabled={submitting}
              />
            </div>

            {/* Goals */}
            <div>
              <Label htmlFor="goals">What are your goals? *</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => setFormData({...formData, goals: e.target.value})}
                placeholder="What are you looking to accomplish on AgentVault?"
                rows={4}
                required
                disabled={submitting}
              />
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
              <Checkbox
                id="agree_terms"
                checked={formData.agree_terms}
                onCheckedChange={(checked) => setFormData({...formData, agree_terms: checked})}
                required
                disabled={submitting}
              />
              <Label htmlFor="agree_terms" className="text-sm cursor-pointer">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-slate-100 rounded-lg p-4 text-xs">
                <div className="font-bold mb-2">Debug Info:</div>
                <div>Full Name: {formData.full_name || '(empty)'}</div>
                <div>Role: {formData.role || '(empty)'}</div>
                <div>Markets: {formData.markets || '(empty)'}</div>
                <div>Goals: {formData.goals ? `${formData.goals.substring(0, 30)}...` : '(empty)'}</div>
                <div>Terms Agreed: {formData.agree_terms ? 'Yes' : 'No'}</div>
                <div>Submitting: {submitting ? 'Yes' : 'No'}</div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || !formData.agree_terms || !formData.full_name || !formData.role || !formData.markets || !formData.goals}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Save Profile
                </>
              )}
            </Button>

            {submitting && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Please wait while we save your profile...</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}