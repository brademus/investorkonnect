import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, ArrowLeft, Shield, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 2: ROLE SELECTION
 * 
 * User chooses Investor or Agent.
 * If not logged in, handles OAuth callback and redirects to auth properly.
 * If logged in, updates profile and continues to onboarding.
 * 
 * FIXES LOGIN LOOP:
 * - Detects OAuth code in URL and routes to AuthCallback if present
 * - Otherwise redirects to login with proper callback URL
 */
function RoleSelectionContent() {
  const navigate = useNavigate();
  const { selectedState, setSelectedRole } = useWizard();
  const { loading, user, profile, onboarded, role, refresh } = useCurrentProfile();
  const [updating, setUpdating] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    document.title = "Choose Your Role - AgentVault";
  }, []);

  // Handle authentication state and routing
  useEffect(() => {
    if (loading) return;

    // Check if user is returning from OAuth with a code
    const params = new URLSearchParams(window.location.search);
    const hasOAuthCode = params.has("code");

    if (!user) {
      // Not logged in
      if (hasOAuthCode) {
        // We have an OAuth code - redirect to AuthCallback to finalize login
        console.log('[RoleSelection] OAuth code detected, redirecting to AuthCallback');
        const authCallbackUrl = createPageUrl("AuthCallback");
        if (authCallbackUrl) {
          navigate(authCallbackUrl + window.location.search, { replace: true });
        } else {
          // Fallback if no AuthCallback page exists
          base44.auth.redirectToLogin(window.location.pathname);
        }
      } else {
        // No OAuth code - start login flow
        console.log('[RoleSelection] Not authenticated, redirecting to login');
        const callbackUrl = createPageUrl("RoleSelection") || window.location.pathname;
        base44.auth.redirectToLogin(callbackUrl);
      }
      return;
    }

    // User is logged in - check if they're already onboarded
    if (onboarded) {
      console.log('[RoleSelection] User already onboarded, redirecting to dashboard');
      // User already completed NEW onboarding - send to dashboard
      if (role === 'investor') {
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else {
        // Unknown role but onboarded - still send to dashboard
        navigate(createPageUrl("Dashboard"), { replace: true });
      }
      return;
    }

    // User is logged in but NOT onboarded
    // If they already have a role selected, send them to onboarding
    if (profile?.user_role && profile.user_role !== 'member') {
      console.log('[RoleSelection] Role already set but not onboarded, redirecting to onboarding');
      if (profile.user_role === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      } else if (profile.user_role === 'agent') {
        navigate(createPageUrl("AgentOnboarding"), { replace: true });
      }
      return;
    }

    // Otherwise stay on RoleSelection to let them choose

  }, [loading, user, profile, onboarded, role, navigate]);

  const handleRoleSelection = async (chosenRole) => {
    setSelectedChoice(chosenRole);
    setUpdating(true);

    try {
      // Save to wizard context
      setSelectedRole(chosenRole);

      if (!user) {
        // Not logged in - redirect to Base44 login
        toast.info("Please sign in to continue");
        base44.auth.redirectToLogin(createPageUrl("RoleSelection"));
        return;
      }

      // Logged in - update profile with role
      if (profile) {
        await base44.entities.Profile.update(profile.id, {
          user_role: chosenRole
        });
      } else {
        // Create profile if doesn't exist
        await base44.entities.Profile.create({
          user_id: user.id,
          email: user.email,
          user_role: chosenRole,
          role: 'member',
          target_state: selectedState || null
        });
      }

      // Refresh profile to get updated role
      await refresh();

      toast.success(`You're now registered as an ${chosenRole}!`);

      // Route to role-specific onboarding
      if (chosenRole === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"));
      } else {
        navigate(createPageUrl("AgentOnboarding"));
      }

    } catch (error) {
      console.error('[RoleSelection] Error:', error);
      toast.error("Failed to save role. Please try again.");
      setUpdating(false);
      setSelectedChoice(null);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      {/* NO TOP NAV */}
      
      <div className="max-w-5xl w-full">
        
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Map
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            How will you use AgentVault?
          </h1>
          <p className="text-xl text-slate-600">
            Choose your role to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Investor Card */}
          <button
            onClick={() => handleRoleSelection('investor')}
            disabled={updating}
            className={`bg-white rounded-3xl p-8 border-3 transition-all group text-left shadow-xl hover:shadow-2xl ${
              selectedChoice === 'investor' ? 'border-blue-600 scale-105' : 'border-slate-200 hover:border-blue-400'
            } ${updating && selectedChoice !== 'investor' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-200 group-hover:scale-110 transition-all">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              I'm an Investor
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed text-lg">
              Looking to find verified, investor-friendly agents to help me identify and close deals
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Browse verified agent profiles</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Get matched with top agents in your market</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Secure deal rooms with NDA protection</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>AI-powered contract drafting (Pro plan)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold text-lg">
              {updating && selectedChoice === 'investor' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Select Investor →'
              )}
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => handleRoleSelection('agent')}
            disabled={updating}
            className={`bg-white rounded-3xl p-8 border-3 transition-all group text-left shadow-xl hover:shadow-2xl ${
              selectedChoice === 'agent' ? 'border-emerald-600 scale-105' : 'border-slate-200 hover:border-emerald-400'
            } ${updating && selectedChoice !== 'agent' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-200 group-hover:scale-110 transition-all">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              I'm an Agent
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed text-lg">
              Join a selective network of investor-focused agents and connect with serious buyers
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Access serious, pre-qualified investors</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Build reputation with verified reviews</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Manage leads in your dashboard</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Free membership (always)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-lg">
              {updating && selectedChoice === 'agent' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Select Agent →'
              )}
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}

export default function RoleSelection() {
  return (
    <StepGuard requiredStep={1}> {/* Requires MAP */}
      <RoleSelectionContent />
    </StepGuard>
  );
}