import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { FileText, ArrowLeft, Clock, MapPin, Home, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMO_PENDING_DEALS = [
  {
    id: 'pending-1',
    title: '4-Unit Multi-Family in Austin',
    property_type: 'Multi-Family',
    location: 'Austin, TX',
    budget: 850000,
    status: 'pending',
    reason: 'Waiting for agent review',
    submitted_at: '2025-01-03T10:30:00Z'
  },
  {
    id: 'pending-2',
    title: 'Commercial Warehouse Opportunity',
    property_type: 'Commercial',
    location: 'Dallas, TX',
    budget: 1200000,
    status: 'pending',
    reason: 'Agent availability check',
    submitted_at: '2025-01-05T14:15:00Z'
  }
];

function PendingDealsContent() {
  const { profile } = useCurrentProfile();

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Link 
            to={createPageUrl("Dashboard")} 
            className="inline-flex items-center gap-2 text-[#A6A6A6] hover:text-[#E5C37F] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#E5C37F] mb-2">Pending Deals</h1>
            <p className="text-[#A6A6A6]">
              {DEMO_PENDING_DEALS.length} deal{DEMO_PENDING_DEALS.length !== 1 ? 's' : ''} awaiting review or agent acceptance
            </p>
          </div>

          {/* Deals Grid */}
          <div className="grid gap-4">
            {DEMO_PENDING_DEALS.map((deal) => (
              <div 
                key={deal.id}
                className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6 hover:border-[#666666] transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#666666]/20 rounded-xl flex items-center justify-center">
                      <Home className="w-6 h-6 text-[#666666]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#FAFAFA]">{deal.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                        <MapPin className="w-4 h-4" />
                        <span>{deal.location}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#666666]/20 text-[#A6A6A6] border border-[#666666]/30">
                    Pending Review
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Property Type</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.property_type}</p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Budget</p>
                    <p className="font-medium text-[#FAFAFA]">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(deal.budget)}
                    </p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Status</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.reason}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#333333]">
                  <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                    <Clock className="w-4 h-4" />
                    <span>Submitted {new Date(deal.submitted_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function PendingDeals() {
  return (
    <AuthGuard requireAuth={true}>
      <PendingDealsContent />
    </AuthGuard>
  );
}