import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

/**
 * ROLE SELECTION - User picks investor or agent
 * 
 * Only accessible to logged-in users without a role.
 * After selection, creates/updates profile and routes to onboarding.
 */
export default function RoleSelection() {
  const navigate = useNavigate();
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = "Choose Your Role - Investor Konnect";
    
    // Check if user should be here
    const checkAccess = async () => {
      try {
        const user = await base44.auth.me();
        
        if (!user) {
          // Not logged in - send to login
          base44.auth.redirectToLogin(createPageUrl("PostAuth"));
          return;
        }

        // Check if user already has a role - USE EMAIL AS PRIMARY KEY
        const emailLower = user.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles || profiles.length === 0) {
          profiles = await base44.entities.Profile.filter({ user_id: user.id });
        }
        const profile = profiles[0];
        
        if (profile?.user_role && profile.user_role !== 'member') {
          // Already has role - route appropriately
          if (profile.onboarding_completed_at) {
            navigate(createPageUrl("Dashboard"), { replace: true });
          } else if (profile.user_role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (profile.user_role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          }
          return;
        }
        
        // User can select role
        setChecking(false);
      } catch (err) {
        console.error('[RoleSelection] Error:', err);
        setChecking(false);
      }
    };

    checkAccess();
  }, [navigate]);

  const handleRoleSelection = async (chosenRole) => {
    setSelectedChoice(chosenRole);

    try {
      const user = await base44.auth.me();
      const emailLower = user.email.toLowerCase().trim();
      
      // Get or create profile - USE EMAIL AS PRIMARY KEY
      let profiles = await base44.entities.Profile.filter({ email: emailLower });
      if (!profiles || profiles.length === 0) {
        profiles = await base44.entities.Profile.filter({ user_id: user.id });
      }
      let profile = profiles[0];

      if (profile) {
        // Update existing profile - ensure user_id is synced
        await base44.entities.Profile.update(profile.id, {
          user_id: user.id,
          user_role: chosenRole,
          user_type: chosenRole
        });
      } else {
        // Create new profile
        await base44.entities.Profile.create({
          user_id: user.id,
          email: emailLower,
          user_role: chosenRole,
          user_type: chosenRole,
          role: 'member'
        });
      }

      // Navigate to onboarding
      if (chosenRole === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      } else if (chosenRole === 'agent') {
        navigate(createPageUrl("AgentOnboarding"), { replace: true });
      }

    } catch (error) {
      console.error('[RoleSelection] Error:', error);
      setSelectedChoice(null);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1F1F1F] bg-[#0D0D0D] text-sm font-medium text-[#FAFAFA] hover:border-[#E3C567]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#E3C567] mb-4">
            How will you use Investor Konnect?
          </h1>
          <p className="text-lg text-[#808080]">
            Choose your role to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Investor Card */}
          <button
            onClick={() => handleRoleSelection('investor')}
            disabled={selectedChoice !== null}
            className={`bg-[#0D0D0D] border rounded-3xl p-8 text-left transition-all hover:shadow-lg ${
              selectedChoice === 'investor' ? 'border-[#E3C567] border-2 ring-4 ring-[#E3C567]/20' : 'border-[#1F1F1F]'
            } ${selectedChoice && selectedChoice !== 'investor' ? 'opacity-50' : ''}`}
          >
            <div className="w-14 h-14 rounded-full bg-[#E3C567]/20 flex items-center justify-center mb-6 text-2xl">📈</div>
            
            <h2 className="text-2xl font-bold text-[#E3C567] mb-3">I'm an Investor</h2>
            
            <p className="text-[#808080] mb-6">
              Looking to find verified, investor-friendly agents to help me identify and close deals
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#E3C567] flex-shrink-0 mt-0.5" />
                <span>Browse verified agent profiles</span>
              </li>
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#E3C567] flex-shrink-0 mt-0.5" />
                <span>Get matched with top agents</span>
              </li>
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#E3C567] flex-shrink-0 mt-0.5" />
                <span>Secure deal rooms with NDA</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-[#E3C567] font-semibold text-lg">
              {selectedChoice === 'investor' ? (
                <>
                  <LoadingAnimation className="w-5 h-5" />
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
            disabled={selectedChoice !== null}
            className={`bg-[#0D0D0D] border rounded-3xl p-8 text-left transition-all hover:shadow-lg ${
              selectedChoice === 'agent' ? 'border-[#34D399] border-2 ring-4 ring-[#34D399]/20' : 'border-[#1F1F1F]'
            } ${selectedChoice && selectedChoice !== 'agent' ? 'opacity-50' : ''}`}
          >
            <div className="w-14 h-14 rounded-full bg-[#34D399]/20 flex items-center justify-center mb-6 text-2xl">👥</div>
            
            <h2 className="text-2xl font-bold text-[#34D399] mb-3">I'm an Agent</h2>
            
            <p className="text-[#808080] mb-6">
              Join a selective network of investor-focused agents and connect with serious buyers
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#34D399] flex-shrink-0 mt-0.5" />
                <span>Access pre-qualified investors</span>
              </li>
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#34D399] flex-shrink-0 mt-0.5" />
                <span>Build verified reputation</span>
              </li>
              <li className="flex items-start gap-3 text-[#FAFAFA]">
                <CheckCircle className="w-5 h-5 text-[#34D399] flex-shrink-0 mt-0.5" />
                <span>Free membership always</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-[#34D399] font-semibold text-lg">
              {selectedChoice === 'agent' ? (
                <>
                  <LoadingAnimation className="w-5 h-5" />
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