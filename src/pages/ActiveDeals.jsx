import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useRooms } from "@/components/useRooms";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Plus, Home, DollarSign, MapPin, Calendar,
  FileText, TrendingUp
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

function ActiveDealsContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const safeRooms = rooms || [];

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const state = await response.json();
        setProfile(state.profile);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const formatBudget = (budget) => {
    if (!budget) return 'Not specified';
    const num = typeof budget === 'string' ? parseFloat(budget.replace(/[^0-9.]/g, '')) : budget;
    if (isNaN(num)) return budget;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };



  // Active = all deals NOT in 'closing' stage
  const activeDeals = safeRooms.filter(r => r.pipeline_stage !== 'closing');

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-black">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(createPageUrl("Pipeline"))}
                className="w-10 h-10 bg-[#0D0D0D] border border-[#1F1F1F] rounded-full flex items-center justify-center hover:bg-[#141414] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#808080]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#E3C567]">Active Deals</h1>
                <p className="text-sm text-[#808080]">{activeDeals.length} deal{activeDeals.length !== 1 ? 's' : ''} in progress</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate(createPageUrl("DealWizard"))}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black gap-2"
            >
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </div>

          {/* Deals Grid */}
          {(roomsLoading && activeDeals.length === 0) ? (
            <div className="grid gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
                  <div className="animate-pulse h-6 w-40 bg-[#1F1F1F] rounded mb-4" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="h-16 bg-[#141414] rounded border border-[#1F1F1F]" />
                    <div className="h-16 bg-[#141414] rounded border border-[#1F1F1F]" />
                    <div className="h-16 bg-[#141414] rounded border border-[#1F1F1F]" />
                    <div className="h-16 bg-[#141414] rounded border border-[#1F1F1F]" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeDeals.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#E3C567]" />
              </div>
              <h3 className="text-xl font-semibold text-[#FAFAFA] mb-2">No Active Deals</h3>
              <p className="text-[#808080] mb-6">Submit your first deal to get matched with investor-friendly agents.</p>
              <Button 
                onClick={() => navigate(createPageUrl("DealWizard"))}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black gap-2"
              >
                <Plus className="w-4 h-4" />
                Submit Your First Deal
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeDeals.map((deal) => (
                <div 
                  key={deal.id}
                  className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 hover:shadow-[0_10px_25px_rgba(227,197,103,0.2)] hover:border-[#E3C567] transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                        <Home className="w-6 h-6 text-[#E3C567]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#FAFAFA]">{deal.property_address || deal.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-[#808080]">
                          <MapPin className="w-4 h-4" />
                          <span>{deal.city ? `${deal.city}, ` : ''}{deal.state || 'Location'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium border bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="bg-[#141414] rounded-lg p-3 border border-[#1F1F1F]">
                      <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Bedrooms</p>
                      <p className="font-medium text-[#FAFAFA]">{deal.bedrooms || 'N/A'}</p>
                    </div>
                    <div className="bg-[#141414] rounded-lg p-3 border border-[#1F1F1F]">
                      <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Budget</p>
                      <p className="font-medium text-[#FAFAFA]">{formatBudget(deal.budget)}</p>
                    </div>
                    <div className="bg-[#141414] rounded-lg p-3 border border-[#1F1F1F]">
                      <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Agent</p>
                      <p className="font-medium text-[#FAFAFA]">{deal.counterparty_name || 'Matched'}</p>
                    </div>
                    <div className="bg-[#141414] rounded-lg p-3 border border-[#1F1F1F]">
                      <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Stage</p>
                      <p className="font-medium text-[#FAFAFA] capitalize">{deal.pipeline_stage?.replace('_', ' ') || 'Active'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#1F1F1F]">
                    <div className="flex items-center gap-2 text-sm text-[#808080]">
                      <Calendar className="w-4 h-4" />
                      <span>Started {new Date(deal.created_date).toLocaleDateString()}</span>
                    </div>
                    <Link 
                      to={`${createPageUrl("Room")}?roomId=${deal.id}`}
                      className="text-sm font-medium text-[#E3C567] hover:underline flex items-center gap-1"
                    >
                      <TrendingUp className="w-4 h-4" />
                      View Deal Room
                    </Link>
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

export default function ActiveDeals() {
  return (
    <AuthGuard requireAuth={true}>
      <ActiveDealsContent />
    </AuthGuard>
  );
}