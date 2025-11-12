import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, TrendingUp, MapPin, Building, DollarSign,
  Loader2, AlertCircle, Shield, Search, Filter, CheckCircle, Clock
} from "lucide-react";
import { toast } from "sonner";

/**
 * INVESTOR DIRECTORY - For Agents
 * 
 * Shows ALL investors who have signed up, regardless of onboarding status
 * Requires: agent role + onboarding + KYC + NDA
 */
export default function InvestorDirectory() {
  const navigate = useNavigate();
  const { 
    user, 
    profile, 
    role, 
    loading: profileLoading,
    onboarded,
    kycVerified,
    hasNDA
  } = useCurrentProfile();
  
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Investor Directory - AgentVault";
    
    if (!profileLoading) {
      checkAccessAndLoad();
    }
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    // Not logged in
    if (!user) {
      toast.info("Please sign in to browse investors");
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      return;
    }

    // Not an agent
    if (role !== 'agent') {
      toast.error("Only agents can browse investors");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // Not onboarded
    if (!onboarded) {
      toast.info("Complete onboarding to access investor directory");
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }

    // Not KYC verified
    if (!kycVerified) {
      toast.info("Verify your identity to access investor profiles");
      navigate(createPageUrl("Verify"), { replace: true });
      return;
    }

    // No NDA
    if (!hasNDA) {
      toast.info("Accept NDA to access investor profiles");
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }

    // Load investors
    await loadInvestors();
  };

  const loadInvestors = async () => {
    try {
      console.log('[InvestorDirectory] Loading ALL investors...');
      
      // Get ALL profiles with investor role - no filtering by onboarding status
      const allProfiles = await base44.entities.Profile.filter({});
      
      const investorProfiles = allProfiles.filter(p => 
        p.user_role === 'investor' || p.user_type === 'investor'
      );
      
      console.log('[InvestorDirectory] Found', investorProfiles.length, 'investors (including incomplete profiles)');
      
      setInvestors(investorProfiles);
      setLoading(false);
    } catch (error) {
      console.error('[InvestorDirectory] Error loading investors:', error);
      toast.error("Failed to load investors");
      setLoading(false);
    }
  };

  const filteredInvestors = investors.filter(investor => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const name = investor.full_name?.toLowerCase() || '';
    const markets = investor.markets?.join(' ').toLowerCase() || '';
    const state = investor.target_state?.toLowerCase() || '';
    
    return name.includes(search) || markets.includes(search) || state.includes(search);
  });

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading investor directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Investor Directory
          </h1>
          <p className="text-slate-600">
            Browse {investors.length} verified investors looking for agents in your market
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name or market..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* Investors Grid */}
        {filteredInvestors.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {searchTerm ? 'No Investors Match Your Search' : 'No Investors Yet'}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Be the first to connect with investors when they join'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvestors.map((investor) => {
              const metadata = investor.metadata || {};
              const basic = metadata.basicProfile || {};
              const markets = metadata.targetMarkets || {};
              const strategy = metadata.strategyDeals || {};
              const isFullyOnboarded = investor.onboarding_completed_at && investor.onboarding_version;
              const isVerified = investor.kyc_status === 'approved';
              
              return (
                <div
                  key={investor.id}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    // TODO: Navigate to investor profile page
                    toast.info('Investor profile view coming soon!');
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg mb-1">
                        {investor.full_name || investor.email || 'Investor'}
                      </h3>
                      {basic.investor_description && (
                        <p className="text-sm text-slate-600">{basic.investor_description}</p>
                      )}
                    </div>
                    {isVerified ? (
                      <Shield className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Status Badge */}
                  {!isFullyOnboarded && (
                    <Badge variant="outline" className="mb-3 border-amber-300 text-amber-700">
                      <Clock className="w-3 h-3 mr-1" />
                      Profile In Progress
                    </Badge>
                  )}
                  
                  {isFullyOnboarded && isVerified && (
                    <Badge className="mb-3 bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fully Verified
                    </Badge>
                  )}

                  {/* Target Market */}
                  {investor.target_state && (
                    <div className="mb-3">
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="w-3 h-3" />
                        {investor.target_state}
                      </Badge>
                    </div>
                  )}

                  {/* Key Info */}
                  <div className="space-y-2 text-sm mb-4">
                    {basic.typical_deal_size && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        <span>Typical deal: {basic.typical_deal_size}</span>
                      </div>
                    )}
                    
                    {strategy.primary_strategy && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>{strategy.primary_strategy}</span>
                      </div>
                    )}

                    {!basic.typical_deal_size && !strategy.primary_strategy && (
                      <p className="text-slate-400 text-xs italic">
                        Profile details pending completion
                      </p>
                    )}
                  </div>

                  {/* Strategies */}
                  {strategy.investment_strategies && strategy.investment_strategies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {strategy.investment_strategies.slice(0, 2).map((strat, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {strat}
                        </Badge>
                      ))}
                      {strategy.investment_strategies.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{strategy.investment_strategies.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}