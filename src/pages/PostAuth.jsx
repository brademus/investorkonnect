import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2 } from "lucide-react";

/**
 * POST-AUTH CALLBACK PAGE
 * 
 * After OAuth login completes, users land here.
 * This page:
 * 1. Waits for profile to load
 * 2. Routes based on role and onboarding status:
 *    - No role → RoleSelection
 *    - Has role but not onboarded → Dashboard (which will show completion prompt)
 *    - Onboarded → Dashboard
 * 
 * This ensures clean login flow without loops.
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded } = useCurrentProfile();
  const [hasRouted, setHasRouted] = useState(false);

  useEffect(() => {
    document.title = "Signing you in... - AgentVault";
  }, []);

  useEffect(() => {
    if (loading || hasRouted) return;

    console.log('[PostAuth] 🔄 Routing after login:', { user: !!user, role, onboarded });

    if (!user) {
      // Not authenticated - this shouldn't happen, but redirect to home
      console.log('[PostAuth] ⚠️ No user found, redirecting to home');
      navigate(createPageUrl("Home"), { replace: true });
      setHasRouted(true);
      return;
    }

    // User is authenticated
    if (!role || role === 'member') {
      // No role selected yet - go to role selection
      console.log('[PostAuth] 📍 No role, routing to RoleSelection');
      navigate(createPageUrl("RoleSelection"), { replace: true });
      setHasRouted(true);
      return;
    }

    // Has a role - send to Dashboard
    // Dashboard will handle showing onboarding prompts if needed
    console.log('[PostAuth] ✅ Has role, routing to Dashboard');
    navigate(createPageUrl("Dashboard"), { replace: true });
    setHasRouted(true);

  }, [loading, user, role, onboarded, hasRouted, navigate]);

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