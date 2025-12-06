import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DollarSign, ArrowLeft, CheckCircle, MapPin, Home, Calendar } from "lucide-react";

const DEMO_CLOSED_DEALS = [
  {
    id: 'closed-1',
    title: 'Luxury Duplex in Phoenix',
    property_type: 'Multi-Family',
    location: 'Phoenix, AZ',
    purchase_price: 625000,
    closed_date: '2024-12-15T00:00:00Z',
    agent_name: 'Sarah Martinez',
    roi: '14.2%'
  },
  {
    id: 'closed-2',
    title: 'Single-Family Rental',
    property_type: 'Single-Family',
    location: 'Tampa, FL',
    purchase_price: 385000,
    closed_date: '2024-11-28T00:00:00Z',
    agent_name: 'John Davis',
    roi: '11.8%'
  },
  {
    id: 'closed-3',
    title: 'Downtown Mixed-Use Property',
    property_type: 'Commercial',
    location: 'Nashville, TN',
    purchase_price: 1450000,
    closed_date: '2024-10-10T00:00:00Z',
    agent_name: 'Michael Chen',
    roi: '16.5%'
  }
];

function ClosedDealsContent() {
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
            <h1 className="text-3xl font-bold text-[#34D399] mb-2">Closed Deals</h1>
            <p className="text-[#A6A6A6]">
              {DEMO_CLOSED_DEALS.length} successfully completed transaction{DEMO_CLOSED_DEALS.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Deals Grid */}
          <div className="grid gap-4">
            {DEMO_CLOSED_DEALS.map((deal) => (
              <div 
                key={deal.id}
                className="bg-[#1A1A1A] border border-[#34D399]/30 rounded-3xl p-6 hover:border-[#34D399] transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#34D399]/20 rounded-xl flex items-center justify-center">
                      <Home className="w-6 h-6 text-[#34D399]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#FAFAFA]">{deal.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                        <MapPin className="w-4 h-4" />
                        <span>{deal.location}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30 flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" />
                    Closed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Property Type</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.property_type}</p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Purchase Price</p>
                    <p className="font-medium text-[#FAFAFA]">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(deal.purchase_price)}
                    </p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Agent</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.agent_name}</p>
                  </div>
                  <div className="bg-[#34D399]/20 rounded-lg p-3 border border-[#34D399]/30">
                    <p className="text-xs text-[#34D399] uppercase tracking-wide mb-1">Projected ROI</p>
                    <p className="font-medium text-[#34D399]">{deal.roi}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#333333]">
                  <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                    <Calendar className="w-4 h-4" />
                    <span>Closed {new Date(deal.closed_date).toLocaleDateString()}</span>
                  </div>
                  <button className="text-sm font-medium text-[#34D399] hover:underline">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ClosedDeals() {
  return (
    <AuthGuard requireAuth={true}>
      <ClosedDealsContent />
    </AuthGuard>
  );
}