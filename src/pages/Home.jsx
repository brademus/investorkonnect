import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import LoadingAnimation from "@/components/LoadingAnimation";

/**
 * Home — routing hub.
 * If user is authenticated, send them to Pipeline (or PostAuth for fresh users).
 * If not authenticated, show the RoleLanding page.
 */
export default function Home() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!mounted) return;
        if (authed) {
          // Authenticated user — skip role selection entirely
          navigate(createPageUrl("Pipeline"), { replace: true });
        } else {
          navigate(createPageUrl("RoleLanding"), { replace: true });
        }
      } catch {
        if (mounted) navigate(createPageUrl("RoleLanding"), { replace: true });
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-32 h-32" />
      </div>
    );
  }
  return null;
}