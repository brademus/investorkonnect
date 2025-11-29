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
    <div className="space-y-6 lg:space-y-8">
      {/* Page header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Your Investor Konnect dashboard
          </h1>
          <p className="text-sm text-[#6B7280]">
            See your buy box, suggested agents, and deal tools in one place.
          </p>
        </div>
        <Link to={createPageUrl("Admin")} className="ik-btn-outline hidden text-xs sm:inline-flex">
          Admin panel
        </Link>
      </header>

      {/* Upgrade banner */}
      <section className="ik-card flex flex-col gap-3 border border-[#FCD34D] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD34D] text-[#92400E]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">
              Upgrade to unlock full platform access
            </h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Get unlimited deal rooms, advanced analytics, and priority support.
            </p>
          </div>
        </div>
        <Link to={createPageUrl("Pricing")} className="ik-btn-primary text-xs">
          View plans →
        </Link>
      </section>

      {/* Main grid */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)]">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Suggested agents */}
          <section className="ik-card p-5 sm:p-6">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">
                  Suggested agents
                  <span className="ml-1 text-[0.7rem] font-normal text-[#6B7280]">
                    AI powered
                  </span>
                </h2>
                <p className="text-xs text-[#6B7280]">
                  AI-powered matches based on your investment goals.
                </p>
              </div>
              <Link to={createPageUrl("AgentDirectory")} className="ik-link text-xs">
                View all
              </Link>
            </header>

            <p className="text-xs text-[#6B7280]">
              No AI matches yet. Complete your profile for better matching.
            </p>
          </section>

          {/* Documents */}
          <section className="ik-card p-5 sm:p-6">
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

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Buy box */}
          <section className="ik-card p-5 sm:p-6">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Buy box</h2>
                <p className="text-xs text-[#6B7280]">
                  Snapshot of what you're looking to buy.
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
          </section>

          {/* Quick links */}
          <section className="ik-card p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold text-[#111827]">
              Quick links
            </h2>
            <ul className="space-y-2 text-sm text-[#374151]">
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