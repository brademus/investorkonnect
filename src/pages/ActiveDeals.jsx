import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Plus, Home, DollarSign, MapPin, Calendar,
  Loader2, FileText, TrendingUp
} from "lucide-react";

function ActiveDealsContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load profile
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const state = await response.json();
        setProfile(state.profile);
      }

      // Load deals from entity
      let allDeals = [];
      try {
        const apiDeals = await base44.entities.Deal.list('-created_date', 50);
        allDeals = apiDeals;
      } catch (err) {
        console.log('Could not load deals from API');
      }

      // Also check sessionStorage
      const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
      const apiIds = new Set(allDeals.map(d => d.id));
      const uniqueStored = storedDeals.filter(d => !apiIds.has(d.id));
      
      setDeals([...allDeals, ...uniqueStored]);
    } catch (err) {
      console.error('Error loading deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBudget = (budget) => {
    if (!budget) return 'Not specified';
    const num = typeof budget === 'string' ? parseFloat(budget.replace(/[^0-9.]/g, '')) : budget;
    if (isNaN(num)) return budget;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const parseNotes = (notes) => {
    if (!notes) return {};
    try {
      return JSON.parse(notes);
    } catch {
      return {};
    }
  };

  if (loading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-[#151311] flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#C9A961] animate-spin" />
        </div>
      </>
    );
  }

  const activeDeals = deals.filter(d => d.status === 'active' || d.status === 'draft');

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#151311]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="w-10 h-10 bg-[#1F1C19] border border-[#38342F] rounded-full flex items-center justify-center hover:bg-[#292521] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#9E9E9E]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#C9A961]">Active Deals</h1>
                <p className="text-sm text-[#9E9E9E]">{activeDeals.length} deal{activeDeals.length !== 1 ? 's' : ''} in progress</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate(createPageUrl("DealWizard"))}
              className="bg-gradient-to-r from-[#C9A961] to-[#B8941F] hover:from-[#D4AF37] hover:to-[#C9A961] text-[#151311] gap-2"
            >
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </div>

          {/* Deals Grid */}
          {activeDeals.length === 0 ? (
            <div className="bg-[#1F1C19] border border-[#38342F] rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-[#C9A961]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#C9A961]" />
              </div>
              <h3 className="text-xl font-semibold text-[#FAFAFA] mb-2">No Active Deals</h3>
              <p className="text-[#9E9E9E] mb-6">Submit your first deal to get matched with investor-friendly agents.</p>
              <Button 
                onClick={() => navigate(createPageUrl("DealWizard"))}
                className="bg-gradient-to-r from-[#C9A961] to-[#B8941F] hover:from-[#D4AF37] hover:to-[#C9A961] text-[#151311] gap-2"
              >
                <Plus className="w-4 h-4" />
                Submit Your First Deal
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeDeals.map((deal) => {
                const notes = parseNotes(deal.notes);
                return (
                  <div 
                    key={deal.id}
                    className="bg-[#1F1C19] border border-[#38342F] rounded-3xl p-6 hover:shadow-[0_10px_25px_rgba(201,169,97,0.2)] hover:border-[#C9A961] transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#C9A961]/20 rounded-xl flex items-center justify-center">
                          <Home className="w-6 h-6 text-[#C9A961]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#FAFAFA]">{deal.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-[#9E9E9E]">
                            <MapPin className="w-4 h-4" />
                            <span>{notes.city ? `${notes.city}, ` : ''}{notes.state || 'Location not specified'}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        deal.status === 'active' 
                          ? 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/30'
                          : 'bg-[#C9A961]/20 text-[#C9A961] border-[#C9A961]/30'
                      }`}>
                        {deal.status === 'active' ? 'Active' : 'Draft'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="bg-[#292521] rounded-lg p-3 border border-[#38342F]">
                        <p className="text-xs text-[#9E9E9E] uppercase tracking-wide mb-1">Property Type</p>
                        <p className="font-medium text-[#FAFAFA]">{deal.property_type || notes.propertyType || 'Not specified'}</p>
                      </div>
                      <div className="bg-[#292521] rounded-lg p-3 border border-[#38342F]">
                        <p className="text-xs text-[#9E9E9E] uppercase tracking-wide mb-1">Budget</p>
                        <p className="font-medium text-[#FAFAFA]">{formatBudget(deal.budget || notes.totalBudget)}</p>
                      </div>
                      <div className="bg-[#292521] rounded-lg p-3 border border-[#38342F]">
                        <p className="text-xs text-[#9E9E9E] uppercase tracking-wide mb-1">Strategy</p>
                        <p className="font-medium text-[#FAFAFA]">{notes.investmentStrategy || 'Not specified'}</p>
                      </div>
                      <div className="bg-[#292521] rounded-lg p-3 border border-[#38342F]">
                        <p className="text-xs text-[#9E9E9E] uppercase tracking-wide mb-1">Timeline</p>
                        <p className="font-medium text-[#FAFAFA]">{notes.timeline || 'Not specified'}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#38342F]">
                      <div className="flex items-center gap-2 text-sm text-[#9E9E9E]">
                        <Calendar className="w-4 h-4" />
                        <span>Submitted {new Date(deal.created_date || notes.submitted_at).toLocaleDateString()}</span>
                      </div>
                      <Link 
                        to={createPageUrl("AgentDirectory")}
                        className="text-sm font-medium text-[#C9A961] hover:underline flex items-center gap-1"
                      >
                        <TrendingUp className="w-4 h-4" />
                        View Matched Agents
                      </Link>
                    </div>
                  </div>
                );
              })}
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