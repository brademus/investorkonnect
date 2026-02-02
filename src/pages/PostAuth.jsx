import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AlertCircle } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingAnimation from "@/components/LoadingAnimation";

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
   const [navigated, setNavigated] = useState(false);
   const [error, setError] = useState(null);

   useEffect(() => {
     if (navigated) return; // Prevent re-running if already navigated

     let mounted = true;
     const route = async () => {
       try {
         // Timeout safeguard
         const timeoutId = setTimeout(() => {
           if (mounted) setError("Taking longer than expected...");
         }, 12000);

        // Step 1: Get user
        const user = await base44.auth.me();
        clearTimeout(timeoutId);
        
        if (!mounted) return;

        if (!user) {
           if (mounted) {
             setNavigated(true);
             navigate(createPageUrl("Home"), { replace: true });
           }
           return;
         }

        // Step 2: Get or create profile - USE EMAIL AS PRIMARY KEY
        if (mounted) setStatus("Loading your profile...");
        let profile = null;
        try {
          const emailLower = (user.email || '').toLowerCase().trim();

          // Try via lightweight backend function if available (handles race conditions)
          try {
            const ensure = await base44.functions.invoke('ensureProfile', { email: emailLower });
            profile = ensure.data?.profile || ensure.data || null;
          } catch {}

          // Direct entity fallback
          if (!profile) {
            let profiles = [];
            if (emailLower) {
              profiles = await base44.entities.Profile.filter({ email: emailLower });
            }
            if (!profiles || profiles.length === 0) {
              profiles = await base44.entities.Profile.filter({ user_id: user.id });
            }
            profile = profiles[0] || null;
          }

          // Create if still missing
          if (!profile) {
            setStatus("Setting up your account...");
            const selectedRoleParam = (new URLSearchParams(window.location.search).get('selectedRole') || '').toLowerCase();
            const initialRole = (selectedRoleParam === 'investor' || selectedRoleParam === 'agent') ? selectedRoleParam : 'member';
            profile = await base44.entities.Profile.create({
              user_id: user.id,
              email: emailLower || user.email,
              full_name: user.full_name,
              role: 'member',
              user_role: initialRole,
            });
          } else if (!profile.user_id || profile.user_id !== user.id) {
            await base44.entities.Profile.update(profile.id, { user_id: user.id });
            profile.user_id = user.id;
          }
        } catch (e) {
          console.error('[PostAuth] Profile error:', e);
        }

        // Parse selectedRole from URL (preselected on landing)
        const urlParams = new URLSearchParams(window.location.search);
        const selectedRole = urlParams.get('selectedRole')?.toLowerCase();

        // If a role was preselected, only set it when no role exists; NEVER switch roles for existing users
        if (selectedRole === 'agent' || selectedRole === 'investor') {
          if (!profile?.user_role || profile.user_role === 'member') {
            try {
              await base44.entities.Profile.update(profile.id, { user_role: selectedRole, user_type: selectedRole });
              profile.user_role = selectedRole;
              profile.user_type = selectedRole;
            } catch (e) {
              console.warn('[PostAuth] Failed to set preselected role', e);
            }
          } else {
            // Existing users keep their current role; ignore selectedRole
          }
        }

        // Step 3: Route based on state (align with useCurrentProfile logic)
        const role = profile?.user_role;
        const hasRole = role && role !== 'member';

        // Consider onboarding complete if timestamp OR step OR version OR legacy profile completeness
        const hasLegacyProfile = !!(
          profile?.full_name &&
          profile?.phone &&
          (profile?.company || profile?.investor?.company_name) &&
          (profile?.target_state || profile?.location || (profile?.markets && profile?.markets.length > 0))
        );
        const isOnboarded = !!(
          profile?.onboarding_completed_at ||
          profile?.onboarding_step === 'basic_complete' ||
          profile?.onboarding_step === 'deep_complete' ||
          profile?.onboarding_version ||
          hasLegacyProfile
        );

        // Route strictly by existing role state (ignore selectedRole for existing users)
        if (!hasRole) {
          // New user without role: respect selectedRole from landing and go straight to onboarding
          if (selectedRole === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (selectedRole === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            // No selectedRole: default to investor onboarding (never show role picker)
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          }
        } else if (!isOnboarded) {
          // Has role but not onboarded
          if (role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          } else {
            // Fallback: default to investor onboarding
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          }
        } else {
          // 4. Post-Onboarding Gates (Subscription -> KYC -> NDA)
          
          // Skip all gates for admin users
          if (profile?.role === 'admin') {
            console.log('[PostAuth] Admin user, redirecting to Pipeline');
            navigate(createPageUrl("Pipeline"), { replace: true });
            return;
          }

          // Gate A: Subscription (Investors only)
          const subscriptionStatus = profile?.subscription_status || 'none';
          const isPaidSubscriber = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
          if (role === 'investor' && !isPaidSubscriber) {
            console.log('[PostAuth] Investor missing subscription, redirecting to Pricing');
            navigate(createPageUrl("Pricing"), { replace: true });
            return;
          }

          // Gate B: KYC / Identity
          const kycStatus = profile?.kyc_status || profile?.identity_status || 'unverified';
          const isKycVerified = kycStatus === 'approved' || kycStatus === 'verified' || !!profile?.identity_verified || !!profile?.identity_verified_at;
          
          if (!isKycVerified) {
            console.log('[PostAuth] Identity not verified, redirecting to IdentityVerification');
            navigate(createPageUrl("IdentityVerification"), { replace: true });
            return;
          }

          // Gate C: NDA
          const hasNDA = !!profile?.nda_accepted;
          if (!hasNDA) {
            console.log('[PostAuth] NDA not accepted, redirecting to NDA');
            navigate(createPageUrl("NDA"), { replace: true });
            return;
          }

          // Fully cleared - go to Pipeline (main dashboard)
          console.log('[PostAuth] User fully cleared, redirecting to Pipeline');
          navigate(createPageUrl("Pipeline"), { replace: true });
        }

      } catch (error) {
        console.error('[PostAuth] Error:', error);
        if (mounted) {
          // Fallback to Home on error, not Pipeline
          navigate(createPageUrl("Home"), { replace: true });
        }
      }
    };

    route();
    return () => { mounted = false; };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">Something went wrong</h2>
          <p className="text-[#808080] mb-6">{error}</p>
          <button 
            onClick={() => window.location.href = createPageUrl("Home")}
            className="px-6 py-2 bg-[#D3A029] text-white rounded-lg font-medium hover:bg-[#B8902A] transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#E3C567] mb-2">{status}</h2>
          <p className="text-[#808080]">Please wait a moment</p>
        </div>
      </div>
    </ErrorBoundary>
  );
}