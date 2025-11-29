import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  FileText, TrendingUp, ArrowRight
} from "lucide-react";

function InvestorDashboardContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileCompletion] = useState(85);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
      if (response.ok) {
        const state = await response.json();
        setProfile(state.profile);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto" style={{ borderColor: 'hsl(43 59% 52%)', borderTopColor: 'transparent' }}></div>
          <p className="mt-4 ik-text-muted text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';
  const userData = {
    activeConnections: 3,
    pendingInvites: 2,
    unreadMessages: 2,
    activeDealRooms: 1
  };

  return (
    <div className="space-y-7 lg:space-y-9">
      {/* Header row */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            Your Investor Konnect dashboard
          </h1>
          <p className="text-sm text-[#6B7280]">
            Keep your buy box, suggested agents, and deal tools in one place.
          </p>
        </div>
        <Link to={createPageUrl("Admin")} className="ik-btn-outline text-xs">
          Admin panel
        </Link>
      </header>

      {/* Today strip */}
      <section className="ik-card flex flex-col gap-3 border border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7]">
            <span className="text-lg text-[#D3A029]">⭐</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">
              Today&apos;s overview
            </h2>
            <p className="text-xs text-[#6B7280]">
              Review your buy box, explore suggested agents, or open your existing deal
              rooms.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-[#4B5563]">
          <span className="ik-chip">Profile complete</span>
          <Link to={createPageUrl("DealRooms")} className="ik-chip cursor-pointer hover:border-[#D3A029]">
            View deal rooms →
          </Link>
        </div>
      </section>

      {/* Main grid: 3 big areas */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)] lg:gap-5">
        {/* LEFT COLUMN – suggested agents + documents */}
        <div className="space-y-4">
          {/* Suggested agents */}
          <section className="ik-card border border-[#E5E7EB] p-5 sm:p-6">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">
                  Suggested agents
                  <span className="ml-1 text-[0.7rem] font-normal text-[#6B7280]">
                    AI powered
                  </span>
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Recommendations based on your stated buy box.
                </p>
              </div>
              <Link to={createPageUrl("AgentDirectory")} className="ik-link text-xs">
                View all
              </Link>
            </header>

            <p className="text-xs text-[#6B7280]">
              No matches yet. Complete your profile and buy box for better results.
            </p>
          </section>

          {/* Documents */}
          <section className="ik-card border border-[#E5E7EB] p-5 sm:p-6">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#111827]">Documents</h2>
            </header>

            <div className="flex items-center gap-3 text-xs text-[#6B7280]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F4F6]">
                <FileText className="w-4 h-4 text-[#9CA3AF]" />
              </div>
              <div>
                <p className="font-medium text-[#374151]">
                  No documents uploaded yet
                </p>
                <Link to={createPageUrl("InvestorDocuments")} className="ik-link text-xs">
                  Upload documents
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN – Buy box + quick links in one tall card */}
        <div className="space-y-4">
          <section className="ik-card flex h-full flex-col justify-between border border-[#E5E7EB] p-5 sm:p-6">
            <div className="space-y-4">
              {/* Buy box */}
              <header className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">Buy box</h2>
                  <p className="text-xs text-[#6B7280]">
                    High-level snapshot of what you&apos;re looking to buy.
                  </p>
                </div>
                <Link to={createPageUrl("InvestorBuyBox")} className="ik-link text-xs">
                  Edit
                </Link>
              </header>

              <dl className="space-y-3 text-xs text-[#374151]">
                <div>
                  <dt className="mb-1 text-[#6B7280]">Asset types</dt>
                  <dd className="flex flex-wrap gap-2">
                    <span className="ik-chip">Single Family</span>
                    <span className="ik-chip">Land</span>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[#6B7280]">Target markets</dt>
                  <dd className="flex flex-wrap gap-2">
                    <span className="ik-chip">{profile?.target_state || 'Not set'}</span>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[#6B7280]">Budget range</dt>
                  <dd className="text-sm font-medium text-[#111827]">
                    $100,000 - $500,000
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick links */}
            <div className="mt-6 border-t border-[#F3F4F6] pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Quick links
              </h3>
              <ul className="space-y-1.5 text-sm text-[#374151]">
                <li>
                  <Link to={createPageUrl("Pricing")} className="flex w-full items-center justify-between text-left hover:text-[#D3A029]">
                    <span>Subscription & plans</span>
                    <span>→</span>
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl("MyProfile")} className="flex w-full items-center justify-between text-left hover:text-[#D3A029]">
                    <span>My profile</span>
                    <span>→</span>
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl("DealRooms")} className="flex w-full items-center justify-between text-left hover:text-[#D3A029]">
                    <span>Deal rooms</span>
                    <span>→</span>
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl("Billing")} className="flex w-full items-center justify-between text-left hover:text-[#D3A029]">
                    <span>Billing & payment</span>
                    <span>→</span>
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default function DashboardInvestor() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDashboardContent />
    </AuthGuard>
  );
}