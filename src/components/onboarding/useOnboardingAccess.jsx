import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Shared access-check hook for onboarding pages.
 * Returns { checking } — true while auth is being verified.
 * Redirects admins to Pipeline and unauthenticated users to login.
 */
export default function useOnboardingAccess() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const authUser = await base44.auth.me();
        if (!authUser) {
          base44.auth.redirectToLogin(createPageUrl("PostAuth"));
          return;
        }
        if (authUser.role === 'admin') {
          toast.success('Admin access granted');
          navigate(createPageUrl("Pipeline"), { replace: true });
          return;
        }
        if (mounted) setChecking(false);
      } catch {
        base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  return { checking };
}