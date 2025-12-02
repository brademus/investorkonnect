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
 * CRITICAL: This handles the complete flow after login:
 * 1. Onboarding (if not complete)
 * 2. Persona/KYC verification (if onboarded but not verified)
 * 3. NDA (if onboarded + verified but no NDA)
 * 4. Dashboard (if all complete)
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
        // Get query params
        const stateParam = searchParams.get('state');
        const intendedRole = searchParams.get('intendedRole');

        // STEP 1: Get authenticated user
        const user = await base44.auth.me();
        
        if (!user) {
          navigate(createPageUrl("Home"), { replace: true });
          setHasRouted(true);
          return;
        }

        // STEP 2: Get profile
        let profile = null;
        
        try {
          const profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
        } catch (err) {
          // Silent fail - will create profile if needed
        }

        // STEP 3: Determine effective role
        let effectiveRole = intendedRole || profile?.user_role || null;

        // STEP 4: Check if NEW onboarding is complete (role-specific versions)
        let hasNewOnboarding = false;
        
        if (effectiveRole === 'investor') {
          // Investor needs v2 onboarding
          hasNewOnboarding = 
            profile?.onboarding_version === 'v2' &&
            !!profile?.onboarding_completed_at &&
            profile?.user_role === 'investor';
        } else if (effectiveRole === 'agent') {
          // CRITICAL: Agent needs EXACTLY "agent-v2-deep" onboarding
          // Old agents with "v2-agent" or null are NOT considered complete
          hasNewOnboarding = 
            profile?.onboarding_version === 'agent-v2-deep' &&
            !!profile?.onboarding_completed_at &&
            profile?.user_role === 'agent';
        }

        // STEP 5: Check if user has simple onboarding (location + role)
        const hasSimpleOnboarding = !!(profile?.target_state && profile?.user_role);
        
        // If no simple onboarding, redirect to SimpleOnboarding
        if (!hasSimpleOnboarding) {
          // Create profile if doesn't exist
          if (!profile && user) {
            try {
              await base44.entities.Profile.create({
                user_id: user.id,
                email: user.email,
                user_role: intendedRole || 'member',
                role: 'member',
                target_state: stateParam || null,
                markets: stateParam ? [stateParam] : []
              });
            } catch (createErr) {
              // Silent fail - will retry on next attempt
            }
          }
          
          navigate(createPageUrl("SimpleOnboarding"), { replace: true });
          setHasRouted(true);
          return;
        }
        
        // If simple onboarding done but full onboarding not done, route to full onboarding
        if (!hasNewOnboarding) {
          // Route to onboarding based on role
          if (effectiveRole === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (effectiveRole === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            navigate(createPageUrl("Dashboard"), { replace: true });
          }
          
          setHasRouted(true);
          return;
        }

        // DEMO MODE: Skip KYC and NDA checks, go straight to Dashboard
        // STEP 6-7: Skipped for demo purposes
        navigate(createPageUrl("Dashboard"), { replace: true });
        setHasRouted(true);

      } catch (error) {
        // On error, don't hang - redirect somewhere safe
        navigate(createPageUrl("Home"), { replace: true });
        setHasRouted(true);
      }
    };

    // Start the flow
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