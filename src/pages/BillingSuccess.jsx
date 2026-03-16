import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading } = useCurrentProfile();
  const searchParams = new URLSearchParams(location.search);
  const isTeam = searchParams.get("team") === "true";

  React.useEffect(() => {
    if (!loading && profile) {
      if (isTeam) {
        navigate(createPageUrl("TeamAccount"), { replace: true });
      } else {
        navigate(createPageUrl("IdentityVerification"), { replace: true });
      }
    }
  }, [loading, profile, navigate, isTeam]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}