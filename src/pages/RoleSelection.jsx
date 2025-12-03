import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, ArrowLeft, Shield, Loader2, CheckCircle } from "lucide-react";

export default function RoleSelection() {
  const navigate = useNavigate();
  const { selectedState, setSelectedRole } = useWizard();
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    document.title = "Choose Your Role - Investor Konnect";
  }, []);

  // Prevent users from changing their role after it's been set
  useEffect(() => {
    const checkExistingRole = async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const profiles = await base44.entities.Profile.filter({ user_id: user.id });
          const profile = profiles[0];
          
          // If user already has a role set (not 'member'), redirect to dashboard
          // This makes role selection PERMANENT
          if (profile?.user_role && profile.user_role !== 'member') {
            console.log('[RoleSelection] User already has role:', profile.user_role, '- redirecting to dashboard');
            navigate(createPageUrl("Dashboard"), { replace: true });
            return;
          }
        }
      } catch (err) {
        console.error('[RoleSelection] Error checking role:', err);
      }
    };
    
    checkExistingRole();
  }, [navigate]);

  const handleRoleSelection = async (chosenRole) => {
    setSelectedChoice(chosenRole);
    setSelectedRole(chosenRole);

    // Build callback URL with role info
    const params = new URLSearchParams();
    if (selectedState) {
      params.set('state', selectedState);
    }
    params.set('intendedRole', chosenRole);
    const callbackUrl = createPageUrl("PostAuth") + '?' + params.toString();

    try {
      // Check if user is already logged in
      const isAuthenticated = await base44.auth.isAuthenticated();
      
      if (isAuthenticated) {
        // User is logged in - update profile and go to onboarding
        console.log('[RoleSelection] User already logged in, updating profile...');
        
        const user = await base44.auth.me();
        
        // Get or create profile
        let profiles = await base44.entities.Profile.filter({ user_id: user.id });
        let profile = profiles[0];
        
        if (profile) {
          // Update existing profile with role and state
          await base44.entities.Profile.update(profile.id, {
            user_role: chosenRole,
            user_type: chosenRole,
            target_state: selectedState || profile.target_state,
            markets: selectedState ? [selectedState] : profile.markets
          });
        } else {
          // Create new profile
          await base44.entities.Profile.create({
            user_id: user.id,
            email: user.email,
            user_role: chosenRole,
            user_type: chosenRole,
            role: 'member',
            target_state: selectedState || null,
            markets: selectedState ? [selectedState] : []
          });
        }
        
        // Navigate to appropriate onboarding
        console.log('[RoleSelection] Navigating to onboarding for role:', chosenRole);
        if (chosenRole === 'investor') {
          navigate(createPageUrl("InvestorOnboarding"));
        } else if (chosenRole === 'agent') {
          navigate(createPageUrl("AgentOnboarding"));
        }
        
      } else {
        // User is NOT logged in - redirect to login with callback
        console.log('[RoleSelection] User not logged in, redirecting to login...');
        base44.auth.redirectToLogin(callbackUrl);
      }
    } catch (error) {
      console.error('[RoleSelection] Error:', error);
      // On error, try login flow
      base44.auth.redirectToLogin(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="ik-btn-outline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Map
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-[#D3A029] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="ik-h1 text-[#111827] mb-4">
            How will you use Investor Konnect?
          </h1>
          <p className="text-lg text-[#6B7280]">
            Choose your role to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Investor Card */}
          <button
            onClick={() => handleRoleSelection('investor')}
            disabled={selectedChoice !== null}
            className={`ik-card ik-card-hover p-8 text-left transition-all ${
              selectedChoice === 'investor' ? 'border-[#D3A029] border-2 ring-4 ring-[#D3A029]/20' : ''
            } ${selectedChoice && selectedChoice !== 'investor' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="ik-icon-pill w-14 h-14 text-2xl mb-6">📈</div>
            
            <h2 className="text-2xl font-bold text-[#111827] mb-3">
              I'm an Investor
            </h2>
            
            <p className="text-[#6B7280] mb-6 leading-relaxed">
              Looking to find verified, investor-friendly agents to help me identify and close deals
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#D3A029] flex-shrink-0 mt-0.5" />
                <span>Browse verified agent profiles</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#D3A029] flex-shrink-0 mt-0.5" />
                <span>Get matched with top agents in your market</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#D3A029] flex-shrink-0 mt-0.5" />
                <span>Secure deal rooms with NDA protection</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#D3A029] flex-shrink-0 mt-0.5" />
                <span>AI-powered contract drafting (Pro plan)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-[#D3A029] font-semibold text-lg">
              {selectedChoice === 'investor' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting to sign in...
                </>
              ) : (
                'Select Investor →'
              )}
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => handleRoleSelection('agent')}
            disabled={selectedChoice !== null}
            className={`ik-card ik-card-hover p-8 text-left transition-all ${
              selectedChoice === 'agent' ? 'border-[#10B981] border-2 ring-4 ring-[#10B981]/20' : ''
            } ${selectedChoice && selectedChoice !== 'agent' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-14 h-14 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-6 text-2xl">👥</div>
            
            <h2 className="text-2xl font-bold text-[#111827] mb-3">
              I'm an Agent
            </h2>
            
            <p className="text-[#6B7280] mb-6 leading-relaxed">
              Join a selective network of investor-focused agents and connect with serious buyers
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Access serious, pre-qualified investors</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Build reputation with verified reviews</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Manage leads in your dashboard</span>
              </li>
              <li className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Free membership (always)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-[#10B981] font-semibold text-lg">
              {selectedChoice === 'agent' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting to sign in...
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