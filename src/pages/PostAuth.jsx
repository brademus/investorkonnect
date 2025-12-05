import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

/**
 * POST-AUTH - Central routing hub after login
 * 
 * Routes users based on their state:
 * 1. No user → Home
 * 2. No profile or no role → RoleSelection
 * 3. Has role, no onboarding → Onboarding (investor or agent)
 * 4. Has onboarding → Dashboard
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const route = async () => {
      try {
        // Step 1: Get user
        const user = await base44.auth.me();
        
        if (!user) {
          navigate(createPageUrl("Home"), { replace: true });
          return;
        }

        // Step 2: Get or create profile - USE EMAIL AS PRIMARY KEY
        setStatus("Loading your profile...");
        let profile = null;
        try {
          // First try to find by email (canonical lookup)
          const emailLower = user.email.toLowerCase().trim();
          let profiles = await base44.entities.Profile.filter({ email: emailLower });
          
          // Fallback to user_id if not found by email
          if (!profiles || profiles.length === 0) {
            profiles = await base44.entities.Profile.filter({ user_id: user.id });
          }
          
          profile = profiles[0] || null;
          
          // Create profile if it doesn't exist
          if (!profile) {
            setStatus("Setting up your account...");
            profile = await base44.entities.Profile.create({
              user_id: user.id,
              email: emailLower,
              full_name: user.full_name,
              role: 'member',
              user_role: 'member',
            });
            console.log('[PostAuth] Created new profile for:', emailLower);
          } else if (!profile.user_id || profile.user_id !== user.id) {
            // Update user_id if profile exists but user_id is different (email match)
            await base44.entities.Profile.update(profile.id, { user_id: user.id });
            profile.user_id = user.id;
            console.log('[PostAuth] Updated user_id for existing profile:', emailLower);
          }
        } catch (e) {
          console.error('[PostAuth] Profile error:', e);
        }

        // Step 3: Route based on state
        const role = profile?.user_role;
        const hasRole = role && role !== 'member';
        // Check for basic onboarding completion (onboarding_step) OR full onboarding (onboarding_completed_at)
        const hasBasicOnboarding = ['basic_complete', 'deep_complete', 'simple_complete', 'profile_complete'].includes(profile?.onboarding_step);
        const isOnboarded = hasBasicOnboarding || !!profile?.onboarding_completed_at;

        if (!hasRole) {
          // No role selected - go to RoleSelection
          navigate(createPageUrl("RoleSelection"), { replace: true });
        } else if (!isOnboarded) {
          // Has role but not onboarded
          if (role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            navigate(createPageUrl("RoleSelection"), { replace: true });
          }
        } else {
          // Has completed at least basic onboarding - go to Dashboard
          navigate(createPageUrl("Dashboard"), { replace: true });
        }

      } catch (error) {
        console.error('[PostAuth] Error:', error);
        navigate(createPageUrl("Home"), { replace: true });
      }
    };

    route();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#111827] mb-2">{status}</h2>
        <p className="text-[#6B7280]">Please wait a moment</p>
      </div>
    </div>
  );
}