import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * LEGACY PAGE - DEPRECATED
 * 
 * Matching is now done per-deal after contract upload.
 * Redirects to Dashboard with explanation.
 */
function MatchesContent() {
  const navigate = useNavigate();
  const { loading } = useCurrentProfile();

  useEffect(() => {
    if (loading) return;
    
    toast.info("Matching is now done per-deal after contract upload");
    navigate(createPageUrl("Dashboard"), { replace: true });
  }, [loading, navigate]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin" />
    </div>
  );
}

export default function Matches() {
  // Removed StepGuard for simpler flow
  return <MatchesContent />;
}