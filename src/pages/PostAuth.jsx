import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

/**
 * POST-AUTH CALLBACK PAGE
 * 
 * After OAuth login, users land here with optional query params:
 * - ?state=CO&intendedRole=investor
 * 
 * This page:
 * 1. Loads user + profile
 * 2. Checks if NEW onboarding (v2) is complete
 * 3. Routes appropriately:
 *    - No NEW onboarding → Send to onboarding
 *    - Has NEW onboarding → Send to Dashboard
 * 
 * CRITICAL: This page MUST NEVER hang on "Loading..."
 * Always routes somewhere within 3 seconds max.
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hasRouted, setHasRouted] = useState(false);

  useEffect(() => {
    document.title = "Signing you in... - AgentVault";
  }, []);

  useEffect(() => {
    if (hasRouted) return;

    const handlePostAuth = async () => {
      try {
        console.log('[PostAuth] 🔄 Starting post-auth flow...');
        
        // Get query params
        const stateParam = searchParams.get('state');
        const intendedRole = searchParams.get('intendedRole');
        
        console.log('[PostAuth] Query params:', { stateParam, intendedRole });

        // STEP 1: Get authenticated user
        const user = await base44.auth.me();
        
        if (!user) {
          console.log('[PostAuth] ❌ No user, redirecting to home');
          navigate(createPageUrl("Home"), { replace: true });
          setHasRouted(true);
          return;
        }
        
        console.log('[PostAuth] ✅ User authenticated:', user.email);

        // STEP 2: Get profile
        let profile = null;
        
        try {
          const profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
        } catch (err) {
          console.error('[PostAuth] Failed to fetch profile:', err);
        }

        console.log('[PostAuth] Profile:', profile ? 'found' : 'not found');

        // STEP 3: Determine effective role
        let effectiveRole = intendedRole || profile?.user_role || null;
        
        console.log('[PostAuth] Effective role:', effectiveRole);

        // STEP 4: Check if NEW onboarding (v2) is complete
        const hasNewOnboarding = 
          profile?.onboarding_version === 'v2' &&
          !!profile?.onboarding_completed_at &&
          !!profile?.user_role;
        
        console.log('[PostAuth] Has NEW onboarding (v2):', hasNewOnboarding);

        // STEP 5: Route based on onboarding status
        if (!hasNewOnboarding) {
          // User needs to complete NEW onboarding
          console.log('[PostAuth] 📝 User needs NEW onboarding');
          
          // Update profile with role + state if provided
          if (profile && (intendedRole || stateParam)) {
            console.log('[PostAuth] Updating profile with role/state...');
            const updates = {};
            
            if (intendedRole) {
              updates.user_role = intendedRole;
            }
            
            if (stateParam) {
              updates.target_state = stateParam;
              updates.markets = [stateParam];
            }
            
            try {
              await base44.entities.Profile.update(profile.id, updates);
              console.log('[PostAuth] ✅ Profile updated');
            } catch (updateErr) {
              console.error('[PostAuth] Failed to update profile:', updateErr);
            }
          } else if (!profile && user) {
            // Create profile if doesn't exist
            console.log('[PostAuth] Creating new profile...');
            try {
              await base44.entities.Profile.create({
                user_id: user.id,
                email: user.email,
                user_role: intendedRole || 'member',
                role: 'member',
                target_state: stateParam || null,
                markets: stateParam ? [stateParam] : []
              });
              console.log('[PostAuth] ✅ Profile created');
            } catch (createErr) {
              console.error('[PostAuth] Failed to create profile:', createErr);
            }
          }
          
          // Route to onboarding based on role
          if (effectiveRole === 'investor') {
            console.log('[PostAuth] → InvestorOnboarding');
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (effectiveRole === 'agent') {
            console.log('[PostAuth] → AgentOnboarding');
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            // No role yet - send to RoleSelection
            console.log('[PostAuth] → RoleSelection (no role)');
            navigate(createPageUrl("RoleSelection"), { replace: true });
          }
          
          setHasRouted(true);
          return;
        }

        // Has completed NEW onboarding - send to Dashboard
        console.log('[PostAuth] ✅ NEW onboarding complete → Dashboard');
        navigate(createPageUrl("Dashboard"), { replace: true });
        setHasRouted(true);

      } catch (error) {
        console.error('[PostAuth] ❌ Error in post-auth flow:', error);
        
        // On error, don't hang - redirect somewhere
        console.log('[PostAuth] Recovering from error → Home');
        navigate(createPageUrl("Home"), { replace: true });
        setHasRouted(true);
      }
    };

    // Start the flow
    handlePostAuth();
  }, [searchParams, navigate, hasRouted]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Signing you in...</h2>
        <p className="text-slate-600">Please wait a moment</p>
      </div>
    </div>
  );
}