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

        // Step 2: Get or create profile
        setStatus("Loading your profile...");
        let profile = null;
        try {
          const profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
          
          // Create profile if it doesn't exist
          if (!profile) {
            setStatus("Setting up your account...");
            profile = await base44.entities.Profile.create({
              user_id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: 'member',
              user_role: 'member',
            });
          }
        } catch (e) {
          console.error('[PostAuth] Profile error:', e);
        }

        // Step 3: Route based on state
        const role = profile?.user_role;
        const hasRole = role && role !== 'member';
        const isOnboarded = !!profile?.onboarding_completed_at;

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
          // Fully onboarded - go to Dashboard
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