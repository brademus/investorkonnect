import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AlertCircle } from "lucide-react";
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
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const route = async () => {
      try {
        // Timeout safeguard
        const timeoutId = setTimeout(() => {
          if (mounted) setError("Taking longer than expected...");
        }, 8000);

        // Step 1: Get user
        const user = await base44.auth.me();
        clearTimeout(timeoutId);
        
        if (!mounted) return;

        if (!user) {
          navigate(createPageUrl("Home"), { replace: true });
          return;
        }

        // Step 2: Get or create profile - USE EMAIL AS PRIMARY KEY
        if (mounted) setStatus("Loading your profile...");
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
        if (mounted) {
          // If it's a known error or we want to show it
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
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="text-center">
        <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#E3C567] mb-2">{status}</h2>
        <p className="text-[#808080]">Please wait a moment</p>
      </div>
    </div>
  );
}