import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useRooms } from "@/components/useRooms";
import { DollarSign, ArrowLeft, CheckCircle, MapPin, Home, Calendar, Loader2 } from "lucide-react";

function ClosedDealsContent() {
  const { profile } = useCurrentProfile();
  const { data: rooms, isLoading } = useRooms();
  const safeRooms = rooms || [];
  
  // Closed = deals in 'closing' pipeline stage
  const closedDeals = safeRooms.filter(r => r.pipeline_stage === 'closing');



  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Link 
            to={createPageUrl("Pipeline")} 
            className="inline-flex items-center gap-2 text-[#A6A6A6] hover:text-[#E5C37F] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#34D399] mb-2">Closed Deals</h1>
            <p className="text-[#A6A6A6]">
              {closedDeals.length} successfully completed transaction{closedDeals.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Deals Grid */}
          {(isLoading && closedDeals.length === 0) ? (
            <div className="grid gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
                  <div className="animate-pulse h-6 w-40 bg-[#262626] rounded mb-4" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="h-16 bg-[#262626] rounded border border-[#333333]" />
                    <div className="h-16 bg-[#262626] rounded border border-[#333333]" />
                    <div className="h-16 bg-[#262626] rounded border border-[#333333]" />
                  </div>
                </div>
              ))}
            </div>
          ) : closedDeals.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-[#34D399]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#34D399]" />
              </div>
              <h3 className="text-xl font-semibold text-[#FAFAFA] mb-2">No Closed Deals Yet</h3>
              <p className="text-[#A6A6A6]">Your completed deals will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {closedDeals.map((deal) => (
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
                      <h3 className="text-lg font-semibold text-[#FAFAFA]">{deal.property_address || deal.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                        <MapPin className="w-4 h-4" />
                        <span>{deal.city ? `${deal.city}, ` : ''}{deal.state || 'Location'}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30 flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" />
                    Closing
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Bedrooms</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.bedrooms || 'N/A'}</p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Purchase Price</p>
                    <p className="font-medium text-[#FAFAFA]">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(deal.budget)}
                    </p>
                  </div>
                  <div className="bg-[#262626] rounded-lg p-3 border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Agent</p>
                    <p className="font-medium text-[#FAFAFA]">{deal.counterparty_name || 'Agent'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#333333]">
                  <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
                    <Calendar className="w-4 h-4" />
                    <span>Closing {deal.closing_date ? new Date(deal.closing_date).toLocaleDateString() : 'Soon'}</span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
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