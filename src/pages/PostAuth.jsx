import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

/**
 * POST-AUTH CALLBACK PAGE
 * 
 * After OAuth login, users land here with optional query params:
 * - ?state=CO&intendedRole=investor
 * 
 * FLOW:
 * 1. No profile or no role → RoleSelection
 * 2. Has role but no onboarding → Onboarding
 * 3. Has onboarding → Dashboard
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hasRouted, setHasRouted] = useState(false);

  useEffect(() => {
    document.title = "Signing you in... - Investor Konnect";
  }, []);

  useEffect(() => {
    if (hasRouted) return;

    const handlePostAuth = async () => {
      try {
        // Get query params passed from RoleSelection
        const stateParam = searchParams.get('state');
        const intendedRole = searchParams.get('intendedRole');

        // STEP 1: Check if user is authenticated
        const user = await base44.auth.me();
        
        if (!user) {
          // Not logged in - send to Home
          navigate(createPageUrl("Home"), { replace: true });
          setHasRouted(true);
          return;
        }

        // STEP 2: Get or create profile
        let profile = null;
        
        try {
          const profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
        } catch (err) {
          // Silent fail
        }

        // STEP 3: If no profile exists, create one
        if (!profile) {
          const newRole = intendedRole || 'member';
          try {
            profile = await base44.entities.Profile.create({
              user_id: user.id,
              email: user.email,
              user_role: newRole,
              role: 'member',
              target_state: stateParam || null,
              markets: stateParam ? [stateParam] : []
            });
          } catch (createErr) {
            // Profile might already exist (race condition) - try to fetch again
            const profiles = await base44.entities.Profile.filter({ user_id: user.id });
            profile = profiles[0] || null;
          }
        }
        
        // STEP 4: If profile exists but has no role, and we have intendedRole, update it
        if (profile && (!profile.user_role || profile.user_role === 'member') && intendedRole) {
          try {
            await base44.entities.Profile.update(profile.id, {
              user_role: intendedRole,
              user_type: intendedRole,
              target_state: stateParam || profile.target_state,
              markets: stateParam ? [stateParam] : profile.markets
            });
            profile.user_role = intendedRole;
          } catch (updateErr) {
            // Silent fail
          }
        }

        // STEP 5: Route based on profile state
        const hasRole = profile?.user_role && profile.user_role !== 'member';
        const isOnboarded = !!profile?.onboarding_completed_at;

        if (!hasRole) {
          // No role - go to RoleSelection
          navigate(createPageUrl("RoleSelection"), { replace: true });
        } else if (!isOnboarded) {
          // Has role but not onboarded - go to onboarding
          if (profile.user_role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (profile.user_role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            navigate(createPageUrl("RoleSelection"), { replace: true });
          }
        } else {
          // Fully onboarded - go to Dashboard
          navigate(createPageUrl("Dashboard"), { replace: true });
        }
        
        setHasRouted(true);

      } catch (error) {
        console.error('[PostAuth] Error:', error);
        // On any error, try to go to Dashboard (AuthGuard will handle redirect if needed)
        navigate(createPageUrl("Dashboard"), { replace: true });
        setHasRouted(true);
      }
    };

    handlePostAuth();
  }, [searchParams, navigate, hasRouted]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#111827] mb-2">Signing you in...</h2>
        <p className="text-[#6B7280]">Please wait a moment</p>
      </div>
    </div>
  );
}