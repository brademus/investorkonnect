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
// Helper: route an agent to qualification or onboarding based on their qual status
function routeAgent(profile, navigate) {
  const qs = profile?.qualification_status;
  const qt = profile?.qualification_tier;
  if (!qs || qs !== 'completed' || qt === 'rejected') {
    navigate(createPageUrl("AgentQualification"), { replace: true });
  } else if (qt === 'conditional') {
    navigate(createPageUrl("ConditionalReview"), { replace: true });
  } else {
    navigate(createPageUrl("AgentOnboarding"), { replace: true });
  }
}

export default function PostAuth() {
   const navigate = useNavigate();
   const [status, setStatus] = useState("Signing you in...");
   const [navigated, setNavigated] = useState(false);
   const [error, setError] = useState(null);

   useEffect(() => {
     if (navigated) return;

     let mounted = true;
     const route = async () => {
       try {
         const timeoutId = setTimeout(() => { if (mounted) setError("Taking longer than expected..."); }, 12000);

        const user = await base44.auth.me();
        clearTimeout(timeoutId);
        if (!mounted) return;

        if (!user) {
           setNavigated(true);
           navigate(createPageUrl("Home"), { replace: true });
           return;
         }

        if (mounted) setStatus("Loading your profile...");
        let profile = null;
        try {
          const emailLower = (user.email || '').toLowerCase().trim();

          try {
            const ensure = await base44.functions.invoke('ensureProfile', { email: emailLower });
            profile = ensure.data?.profile || ensure.data || null;
          } catch {}

          if (!profile) {
            let profiles = emailLower ? await base44.entities.Profile.filter({ email: emailLower }) : [];
            if (!profiles?.length) profiles = await base44.entities.Profile.filter({ user_id: user.id });
            profile = profiles[0] || null;
          }

          if (!profile) {
            if (mounted) setStatus("Setting up your account...");
            const selectedRoleParam = (new URLSearchParams(window.location.search).get('selectedRole') || '').toLowerCase();
            const initialRole = (selectedRoleParam === 'investor' || selectedRoleParam === 'agent') ? selectedRoleParam : 'member';
            profile = await base44.entities.Profile.create({
              user_id: user.id, email: emailLower || user.email,
              full_name: user.full_name, role: 'member', user_role: initialRole,
            });
          } else if (!profile.user_id || profile.user_id !== user.id) {
            await base44.entities.Profile.update(profile.id, { user_id: user.id });
            profile.user_id = user.id;
          }
        } catch (e) {
          console.error('[PostAuth] Profile error:', e);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const selectedRole = urlParams.get('selectedRole')?.toLowerCase();

        if ((selectedRole === 'agent' || selectedRole === 'investor') && (!profile?.user_role || profile.user_role === 'member')) {
          try {
            await base44.entities.Profile.update(profile.id, { user_role: selectedRole, user_type: selectedRole });
            profile.user_role = selectedRole;
            profile.user_type = selectedRole;
          } catch {}
        }

         const role = profile?.user_role;
         const hasRole = role && role !== 'member';
         const hasLegacyProfile = !!(profile?.full_name && profile?.phone && (profile?.company || profile?.investor?.company_name) && (profile?.target_state || profile?.location || (profile?.markets?.length > 0)));
         const isOnboarded = !!(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version || hasLegacyProfile);

         if (!mounted) return;
         setNavigated(true);

         const isAdmin = profile?.role === 'admin' || user?.role === 'admin';
         if (isAdmin) { navigate(createPageUrl("Pipeline"), { replace: true }); return; }

         if (!hasRole) {
           if (selectedRole === 'investor') navigate(createPageUrl("InvestorOnboarding"), { replace: true });
           else if (selectedRole === 'agent') routeAgent(profile, navigate);
           else navigate(createPageUrl("InvestorOnboarding"), { replace: true });
         } else if (!isOnboarded) {
           if (role === 'investor') navigate(createPageUrl("InvestorOnboarding"), { replace: true });
           else if (role === 'agent') routeAgent(profile, navigate);
           else navigate(createPageUrl("InvestorOnboarding"), { replace: true });
         } else {
           // Post-Onboarding Gates
           const subStatus = profile?.subscription_status || 'none';
           const isPaid = subStatus === 'active' || subStatus === 'trialing';
           if (role === 'investor' && !isPaid) { navigate(createPageUrl("Pricing"), { replace: true }); return; }

           const kycStatus = profile?.kyc_status || profile?.identity_status || 'unverified';
           const isKycVerified = kycStatus === 'approved' || kycStatus === 'verified' || !!profile?.identity_verified_at;
           if (!isKycVerified) { navigate(createPageUrl("IdentityVerification"), { replace: true }); return; }

           if (!profile?.nda_accepted) { navigate(createPageUrl("NDA"), { replace: true }); return; }

           navigate(createPageUrl("Pipeline"), { replace: true });
         }

      } catch (error) {
        console.error('[PostAuth] Error:', error);
        if (mounted) navigate(createPageUrl("Home"), { replace: true });
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