import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { inboxList, introCreate, matchList, getInvestorMatches, findBestAgents } from "@/components/functions";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { 
  Loader2, MapPin, Star, TrendingUp, Users, 
  ArrowRight, CheckCircle, Shield, Lock, MessageSquare, User
} from "lucide-react";
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
      <LoadingAnimation className="w-64 h-64" />
    </div>
  );
}

export default function Matches() {
  // Removed StepGuard for simpler flow
  return <MatchesContent />;
}