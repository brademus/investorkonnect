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
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent mx-auto" style={{ borderColor: '#D3A029', borderTopColor: 'transparent' }}></div>
          <p className="mt-4 text-[#6B7280] text-sm">Loading your dashboard...</p>
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
      {/* HEADER */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ik-h1 text-[#111827]">
            Your Investor Konnect dashboard
          </h1>
          <p className="mt-1 text-sm text-[#6B7280] sm:text-[0.95rem]">
            See your buy box, suggested agents, documents, and deal tools in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={createPageUrl("Pricing")} className="ik-btn-outline text-xs sm:text-[0.8rem]">
            View plans
          </Link>
          <Link to={createPageUrl("Admin")} className="ik-btn-outline text-xs sm:text-[0.8rem]">
            Admin panel
          </Link>
        </div>
      </header>

      {/* TODAY STRIP / UPGRADE BANNER */}
      <section className="ik-card ik-card-hover flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="ik-icon-pill">⚡</span>
          <div>
            <p className="ik-section-title">
              Upgrade to unlock full platform access
            </p>
            <p className="ik-section-subtitle mt-1">
              Get unlimited deal rooms, advanced analytics, and priority support.
            </p>
          </div>
        </div>
        <Link to={createPageUrl("Pricing")} className="ik-btn-primary text-xs sm:text-[0.85rem]">
          View plans
        </Link>
      </section>

      {/* MAIN CONTENT GRID */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1.35fr)] lg:gap-5">
        {/* LEFT COLUMN: suggested agents + documents */}
        <div className="space-y-4">
          {/* Suggested agents */}
          <section className="ik-card px-5 py-5 sm:px-6 sm:py-6">
            <header className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="ik-section-title">
                  Suggested agents
                  <span className="ml-1 text-[0.7rem] font-normal text-[#6B7280]">
                    AI powered
                  </span>
                </h2>
                <p className="ik-section-subtitle mt-1">
                  Smart matches based on your investment goals.
                </p>
              </div>
              <Link to={createPageUrl("Matches")} className="ik-link text-xs">
                View all
              </Link>
            </header>

            {/* Example agents for demo */}
            <div className="space-y-3">
              {/* Agent 1 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#D3A029] hover:bg-[#FFFBEB] transition-all cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] flex-shrink-0">
                  <span className="text-sm font-semibold text-[#D3A029]">JD</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#111827] text-sm">John Davis</h3>
                    <span className="text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">98% match</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">Phoenix, AZ • 15 years exp</p>
                  <p className="text-xs text-[#6B7280] mt-1">Specializes in multi-family and fix-and-flip investments</p>
                </div>
              </div>

              {/* Agent 2 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#D3A029] hover:bg-[#FFFBEB] transition-all cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] flex-shrink-0">
                  <span className="text-sm font-semibold text-[#D3A029]">SM</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#111827] text-sm">Sarah Martinez</h3>
                    <span className="text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">95% match</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">Dallas, TX • 12 years exp</p>
                  <p className="text-xs text-[#6B7280] mt-1">Expert in single-family rentals and BRRRR strategy</p>
                </div>
              </div>

              {/* Agent 3 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#D3A029] hover:bg-[#FFFBEB] transition-all cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] flex-shrink-0">
                  <span className="text-sm font-semibold text-[#D3A029]">MC</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#111827] text-sm">Michael Chen</h3>
                    <span className="text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">92% match</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">Atlanta, GA • 10 years exp</p>
                  <p className="text-xs text-[#6B7280] mt-1">Focuses on commercial properties and value-add opportunities</p>
                </div>
              </div>
            </div>
          </section>

          {/* Documents */}
          <section className="ik-card px-5 py-5 sm:px-6 sm:py-6">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="ik-section-title">Documents</h2>
            </header>

            <div className="flex items-center gap-3 text-sm text-[#6B7280]">
              <div className="ik-icon-pill bg-[#F3F4F6] text-[#4B5563]">
                <FileText className="w-4 h-4" />
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

        {/* RIGHT COLUMN: buy box + quick links */}
        <div className="space-y-4">
          {/* Buy box */}
          <section className="ik-card px-5 py-5 sm:px-6 sm:py-6">
            <header className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="ik-section-title">Buy box</h2>
                <p className="ik-section-subtitle mt-1">
                  High-level snapshot of what you&apos;re looking to buy.
                </p>
              </div>
              <Link to={createPageUrl("InvestorBuyBox")} className="ik-link text-xs">
                Edit
              </Link>
            </header>

            <dl className="space-y-3 text-sm text-[#374151]">
              <div>
                <dt className="text-[0.78rem] uppercase tracking-wide text-[#9CA3AF]">
                  Asset types
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  <span className="ik-chip text-[0.75rem]">Single Family</span>
                  <span className="ik-chip text-[0.75rem]">Land</span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.78rem] uppercase tracking-wide text-[#9CA3AF]">
                  Target markets
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  <span className="ik-chip text-[0.75rem]">{profile?.target_state || 'Not set'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.78rem] uppercase tracking-wide text-[#9CA3AF]">
                  Budget range
                </dt>
                <dd className="mt-1 text-[0.95rem] font-semibold text-[#111827]">
                  $100,000 - $500,000
                </dd>
              </div>
            </dl>
          </section>

          {/* Quick links – big, clickable tiles */}
          <section className="ik-card px-5 py-4 sm:px-6 sm:py-5">
            <h3 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Quick links
            </h3>
            <div className="space-y-2">
              <Link to={createPageUrl("Pricing")} className="ik-tile">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">💳</span>
                  <span>Subscription & plans</span>
                </div>
                <span>→</span>
              </Link>

              <Link to={createPageUrl("MyProfile")} className="ik-tile">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">👤</span>
                  <span>My profile</span>
                </div>
                <span>→</span>
              </Link>

              <Link to={createPageUrl("DealRooms")} className="ik-tile">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">💬</span>
                  <span>Deal rooms</span>
                </div>
                <span>→</span>
              </Link>

              <Link to={createPageUrl("Billing")} className="ik-tile">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">📑</span>
                  <span>Billing & payment</span>
                </div>
                <span>→</span>
              </Link>
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