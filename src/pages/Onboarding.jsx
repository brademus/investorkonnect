
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, CheckCircle, AlertCircle, XCircle, TrendingUp, Users } from "lucide-react";
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
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); // info, success, error
  const checkRan = useRef(false);

  const [formData, setFormData] = useState({
    full_name: "",
    role: "", // This will be 'investor' or 'agent'
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
      setStatusMessage("Loading your profile...");
      
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const state = await response.json();

        if (state.profile) {
          // Load existing data - check both user_role (new) and user_type (old)
          const existingRole = state.profile.user_role || state.profile.user_type || "";
          
          setFormData({
            full_name: state.profile.full_name || "",
            role: existingRole,
            company: state.profile.company || "",
            markets: Array.isArray(state.profile.markets) ? state.profile.markets.join(", ") : "",
            phone: state.profile.phone || "",
            accreditation: state.profile.accreditation || "",
            goals: state.profile.goals || "",
            agree_terms: false
          });
          setStatusMessage("Profile loaded successfully!");
          setStatusType("success");
        } else {
          setStatusMessage("Ready to create your profile");
          setStatusType("info");
        }
      } else {
        setStatusMessage("Could not load profile");
        setStatusType("error");
      }
      
      setLoading(false);

    } catch (error) {
      setStatusMessage("Error loading profile: " + error.message);
      setStatusType("error");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.full_name || !formData.full_name.trim()) {
      toast.error("Please enter your full name");
      setStatusMessage("❌ Missing full name");
      setStatusType("error");
      return;
    }

    if (!formData.role) {
      toast.error("Please select your account type");
      setStatusMessage("❌ Missing account type");
      setStatusType("error");
      return;
    }

    if (!formData.markets || !formData.markets.trim()) {
      toast.error("Please enter at least one target market");
      setStatusMessage("❌ Missing target markets");
      setStatusType("error");
      return;
    }

    if (!formData.goals || !formData.goals.trim()) {
      toast.error("Please tell us about your goals");
      setStatusMessage("❌ Missing goals");
      setStatusType("error");
      return;
    }

    if (!formData.agree_terms) {
      toast.error("Please agree to the Terms and Privacy Policy");
      setStatusMessage("❌ Please agree to terms");
      setStatusType("error");
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setStatusMessage("⏳ Step 1/5: Checking authentication...");
    setStatusType("info");

    try {
      // CRITICAL FIX: Verify user is authenticated first
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        throw new Error("You must be signed in. Please refresh the page and sign in again.");
      }

      // Get current user to verify session
      const currentUser = await base44.auth.me();
      if (!currentUser || !currentUser.email) {
        throw new Error("Session expired. Please refresh the page and sign in again.");
      }

      setStatusMessage(`⏳ Step 2/5: Authenticated as ${currentUser.email}`);
      
      // Build payload - use 'role' field which maps to user_role in backend
      const payload = {
        full_name: formData.full_name.trim(),
        role: formData.role, // 'investor' or 'agent' - backend will save to user_type for now
        company: formData.company.trim(),
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone.trim(),
        accreditation: formData.accreditation.trim(),
        goals: formData.goals.trim(),
        complete: true
      };

      setStatusMessage("⏳ Step 3/5: Preparing data...");
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for effect
      
      setStatusMessage("⏳ Step 4/5: Saving to database...");
      
      // CRITICAL FIX: Use base44.functions.invoke instead of raw fetch
      // This automatically handles authentication headers
      const response = await base44.functions.invoke('onboardingComplete', payload);
      
      // base44.functions.invoke returns axios response, data is in response.data
      const result = response.data;

      // Check if backend reported failure
      if (!result.ok && !result.success) {
        throw new Error(result.message || result.error || 'Save failed');
      }

      // Success!
      setStatusMessage("✅ Step 5/5: Profile saved successfully!");
      setStatusType("success");
      
      toast.success(`Profile saved! Welcome, ${result.profile?.full_name || 'there'}!`, {
        duration: 3000
      });
      
      setStatusMessage("✅ Redirecting to your dashboard...");
      
      // CRITICAL FIX: Redirect directly to role-specific dashboard based on selected role
      // This avoids the race condition where /dashboard checks onboarding status before it's cached
      setTimeout(() => {
        const selectedRole = formData.role; // 'investor' or 'agent'
        
        if (selectedRole === 'investor') {
          console.log('[Onboarding] Redirecting to investor dashboard');
          window.location.href = createPageUrl("DashboardInvestor");
        } else if (selectedRole === 'agent') {
          console.log('[Onboarding] Redirecting to agent dashboard');
          window.location.href = createPageUrl("DashboardAgent");
        } else {
          console.log('[Onboarding] No specific role, redirecting to generic dashboard');
          window.location.href = createPageUrl("Dashboard");
        }
      }, 1500);

    } catch (error) {
      console.error('[Onboarding] Save error:', error);
      
      setStatusMessage("❌ ERROR: " + error.message);
      setStatusType("error");
      
      // Show helpful error messages
      if (error.message?.includes('sign in') || error.message?.includes('auth')) {
        toast.error("Session expired. Please refresh the page and sign in again.", {
          duration: 7000
        });
      } else {
        toast.error(error.message || "Failed to save profile. Please try again.", {
          duration: 5000
        });
      }
      
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

  const isFormValid = formData.full_name && formData.role && formData.markets && formData.goals && formData.agree_terms;

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

        {/* Status Box */}
        <div className={`mb-6 p-4 rounded-xl border-2 ${
          statusType === 'success' ? 'bg-emerald-50 border-emerald-200' :
          statusType === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {statusType === 'success' && <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />}
            {statusType === 'error' && <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />}
            {statusType === 'info' && <Loader2 className="w-6 h-6 text-blue-600 animate-spin flex-shrink-0" />}
            <p className={`font-medium ${
              statusType === 'success' ? 'text-emerald-900' :
              statusType === 'error' ? 'text-red-900' :
              'text-blue-900'
            }`}>
              {statusMessage || "Ready to save your profile"}
            </p>
          </div>
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

            {/* User Role - UPDATED WITH BETTER VISUALS */}
            <div>
              <Label className="mb-3 block">I am a... *</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(value) => setFormData({...formData, role: value})}
                required
                disabled={submitting}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Investor Option */}
                  <div 
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                      formData.role === "investor" 
                        ? "border-blue-600 bg-blue-50 shadow-md" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !submitting && setFormData({...formData, role: 'investor'})}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <RadioGroupItem value="investor" id="investor" />
                      <Label htmlFor="investor" className="cursor-pointer font-bold text-lg">
                        Investor
                      </Label>
                    </div>
                    <div className="ml-7">
                      <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
                      <p className="text-sm text-slate-600 mb-2">
                        Looking to connect with verified agents
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• Browse agent profiles</li>
                        <li>• View verified reviews</li>
                        <li>• Secure deal rooms</li>
                      </ul>
                    </div>
                  </div>

                  {/* Agent Option */}
                  <div 
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                      formData.role === "agent" 
                        ? "border-emerald-600 bg-emerald-50 shadow-md" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !submitting && setFormData({...formData, role: 'agent'})}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <RadioGroupItem value="agent" id="agent" />
                      <Label htmlFor="agent" className="cursor-pointer font-bold text-lg">
                        Agent
                      </Label>
                    </div>
                    <div className="ml-7">
                      <Users className="w-8 h-8 text-emerald-600 mb-2" />
                      <p className="text-sm text-slate-600 mb-2">
                        Connect with serious investors
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• Free membership</li>
                        <li>• Get verified badge</li>
                        <li>• Build reputation</li>
                      </ul>
                    </div>
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

            {/* Form Status Indicator */}
            <div className={`p-4 rounded-lg border-2 ${
              isFormValid ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'
            }`}>
              <p className={`text-sm font-medium ${
                isFormValid ? 'text-emerald-900' : 'text-orange-900'
              }`}>
                {isFormValid ? '✅ Form is complete - ready to save!' : '⚠️ Please fill out all required fields'}
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div className={formData.full_name ? 'text-emerald-700' : 'text-orange-700'}>
                  {formData.full_name ? '✓' : '○'} Full Name
                </div>
                <div className={formData.role ? 'text-emerald-700' : 'text-orange-700'}>
                  {formData.role ? '✓' : '○'} Account Type
                </div>
                <div className={formData.markets ? 'text-emerald-700' : 'text-orange-700'}>
                  {formData.markets ? '✓' : '○'} Target Markets
                </div>
                <div className={formData.goals ? 'text-emerald-700' : 'text-orange-700'}>
                  {formData.goals ? '✓' : '○'} Goals
                </div>
                <div className={formData.agree_terms ? 'text-emerald-700' : 'text-orange-700'}>
                  {formData.agree_terms ? '✓' : '○'} Terms Agreement
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || !isFormValid}
              className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving Your Profile...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Save Profile & Continue
                </>
              )}
            </Button>

            {submitting && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 text-center font-medium">
                  Please wait... Do not close this page
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
