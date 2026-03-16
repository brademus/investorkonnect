import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import TeamManagement from "@/components/team/TeamManagement";

function TeamAccountContent() {
  const navigate = useNavigate();
  const { loading: profileLoading, user, profile } = useCurrentProfile();
  const [seatCount, setSeatCount] = useState(0);
  const [loadingSeats, setLoadingSeats] = useState(true);

  const isTeamMember = !!profile?.team_owner_id;

  useEffect(() => {
    if (!profile?.id) return;
    const loadSeats = async () => {
      try {
        const res = await base44.functions.invoke('teamManage', { action: 'list' });
        const activeSeats = (res.data?.seats || []).filter(s => s.status === 'active' || s.status === 'invited');
        setSeatCount(activeSeats.length);
      } catch (_) {}
      setLoadingSeats(false);
    };
    loadSeats();
  }, [profile?.id]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl("Pipeline")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-[#E3C567]" />
            <h1 className="text-3xl font-bold text-[#FAFAFA]">Team Account</h1>
          </div>
          <p className="text-[#808080]">
            {isTeamMember
              ? "View your team membership details"
              : "Add team members to share your deal pipeline"}
          </p>
        </div>

        {/* Billing Info Card — only for owners */}
        {!isTeamMember && (
          <div className="rounded-2xl p-6 mb-8" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#E3C567]/15 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#E3C567]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#FAFAFA]">Team Billing</h3>
                <p className="text-sm text-[#808080]">Each team seat is $10/month, added to your subscription</p>
              </div>
            </div>
            {!loadingSeats && seatCount > 0 && (
              <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-[#0D0D0D] border border-[#1F1F1F]">
                <div>
                  <p className="text-2xl font-bold text-[#E3C567]">{seatCount}</p>
                  <p className="text-xs text-[#808080]">Active Seat{seatCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="w-px h-10 bg-[#1F1F1F]" />
                <div>
                  <p className="text-2xl font-bold text-[#FAFAFA]">${seatCount * 10}</p>
                  <p className="text-xs text-[#808080]">per month</p>
                </div>
              </div>
            )}
            <p className="text-xs text-[#808080] mt-4">
              Team members must use a matching company email domain. They will need to complete their own onboarding (identity verification, NDA, etc.) before accessing the pipeline.
            </p>
          </div>
        )}

        {/* Team Management Component */}
        <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
          <TeamManagement profile={profile} />
        </div>
      </div>
    </div>
  );
}

export default function TeamAccount() {
  return (
    <AuthGuard requireAuth={true}>
      <TeamAccountContent />
    </AuthGuard>
  );
}