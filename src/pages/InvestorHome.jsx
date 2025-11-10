import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Shield, FileText, Users, CheckCircle,
  AlertCircle, Building, Target, DollarSign, ArrowRight, Star, 
  Loader2, RefreshCw, MapPin, Award
} from "lucide-react";
import { toast } from "sonner";

export default function InvestorHome() {
  const navigate = useNavigate();
  const { 
    user, 
    profile, 
    subscriptionPlan, 
    subscriptionStatus, 
    isPaidSubscriber,
    isInvestorReady,
    loading: profileLoading
  } = useCurrentProfile();
  
  // Matches state
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check if user is admin
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  // Load matches when profile is ready
  useEffect(() => {
    if (!profileLoading && user && profile?.user_role === 'investor' && isInvestorReady) {
      loadMatches();
    }
  }, [profileLoading, user, profile, isInvestorReady]);

  const loadMatches = async () => {
    setMatchesLoading(true);
    setMatchesError(null);
    
    try {
      console.log('[InvestorHome] Loading matches...');
      const response = await base44.functions.invoke('getInvestorMatches');
      
      if (response.data.ok) {
        console.log('[InvestorHome] ✅ Loaded', response.data.matches.length, 'matches');
        setMatches(response.data.matches || []);
      } else {
        console.error('[InvestorHome] ❌ Failed to load matches:', response.data.message);
        setMatchesError(response.data.message || 'Failed to load matches');
      }
    } catch (error) {
      console.error('[InvestorHome] ❌ Error loading matches:', error);
      setMatchesError('Unable to load agent matches. Please try again.');
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleRefreshMatches = async () => {
    setRefreshing(true);
    
    try {
      console.log('[InvestorHome] Refreshing matches...');
      toast.info('Finding your best agent matches...');
      
      // Trigger matching
      const matchResponse = await base44.functions.invoke('matchInvestor');
      
      if (matchResponse.data.ok) {
        console.log('[InvestorHome] ✅ Matching completed');
        toast.success('Matches updated!');
        
        // Reload matches
        await loadMatches();
      } else {
        console.error('[InvestorHome] ❌ Matching failed:', matchResponse.data.message);
        toast.error(matchResponse.data.message || 'Failed to refresh matches');
      }
    } catch (error) {
      console.error('[InvestorHome] ❌ Error refreshing:', error);
      toast.error('Could not refresh matches. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  // Helper to get plan display name
  const getPlanName = (plan) => {
    const names = {
      'starter': 'Starter',
      'pro': 'Pro', 
      'enterprise': 'Enterprise',
      'none': 'Free'
    };
    return names[plan] || 'Free';
  };

  const hasNDA = profile?.nda_accepted;
  const buyBox = profile?.investor?.buy_box || {};
  const docs = profile?.investor?.documents || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header with Admin Button */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back, {user?.full_name || 'Investor'}! 👋
            </h1>
            <p className="text-slate-600">
              Your AgentVault dashboard
            </p>
          </div>
          
          {/* Admin Button - Only visible to admins */}
          {isAdmin && (
            <Button
              onClick={() => navigate(createPageUrl("Admin"))}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </Button>
          )}
        </div>

        {/* Subscription Status Banner */}
        {isPaidSubscriber ? (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900">
                    {getPlanName(subscriptionPlan)} Plan Active
                  </p>
                  <p className="text-sm text-emerald-700">
                    {subscriptionStatus === 'trialing' ? 'Free trial active' : 'Full access to all features'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl("Pricing"))}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              >
                Manage Plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">
                    Upgrade to unlock full platform access
                  </h3>
                  <p className="text-sm text-slate-600">
                    Get unlimited deal rooms, advanced analytics, and priority support
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl("Pricing"))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* NDA Required Banner */}
        {!hasNDA && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Required</h3>
                <p className="text-orange-800 mb-4">
                  You need to accept our Non-Disclosure Agreement to access agent profiles and deal rooms.
                </p>
                <Link to={createPageUrl("NDA")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Shield className="w-4 h-4 mr-2" />
                    Sign NDA
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Suggested Agents - ENHANCED */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">Suggested Agents</h2>
              </div>
              <div className="flex gap-2">
                {matches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshMatches}
                    disabled={refreshing || !isInvestorReady}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Matching...' : 'Refresh'}
                  </Button>
                )}
                <Link to={createPageUrl("Agents")}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </div>
            
            {/* Loading State */}
            {matchesLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Finding your best agent matches...</p>
                <p className="text-sm text-slate-500 mt-2">Analyzing profiles and market fit</p>
              </div>
            )}
            
            {/* Error State */}
            {!matchesLoading && matchesError && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">{matchesError}</p>
                <Button size="sm" onClick={loadMatches} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
            
            {/* Empty State - Not Ready */}
            {!matchesLoading && !matchesError && !isInvestorReady && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">Complete verification to see agent matches</p>
                <Button size="sm" onClick={() => navigate(createPageUrl("Verify"))}>
                  Complete Verification
                </Button>
              </div>
            )}
            
            {/* Empty State - No Matches Yet */}
            {!matchesLoading && !matchesError && isInvestorReady && matches.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-2 font-medium">Analyzing your profile...</p>
                <p className="text-sm text-slate-500 mb-4">
                  We're matching you with agents in your market. Your matches will appear here soon.
                </p>
                <Button size="sm" onClick={handleRefreshMatches} disabled={refreshing}>
                  {refreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finding matches...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Find matches now
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Matches List */}
            {!matchesLoading && !matchesError && matches.length > 0 && (
              <div className="space-y-4">
                {matches.slice(0, 3).map((match) => (
                  <div key={match.match_id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 mb-1">
                          {match.agent.name}
                        </h3>
                        {match.agent.brokerage && (
                          <p className="text-sm text-slate-600">{match.agent.brokerage}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-600">
                          {Math.round(match.score * 100)}% match
                        </div>
                      </div>
                    </div>
                    
                    {/* Markets */}
                    {match.agent.markets && match.agent.markets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {match.agent.markets.slice(0, 3).map((market, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            {market}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Specialties */}
                    {match.agent.specialties && match.agent.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {match.agent.specialties.slice(0, 2).map((spec, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Badges */}
                    {match.agent.badges && match.agent.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {match.agent.badges.map((badge, idx) => (
                          <Badge key={idx} className="text-xs bg-blue-100 text-blue-800">
                            <Award className="w-3 h-3 mr-1" />
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Explanation */}
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {match.explanation}
                    </p>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => {
                        toast.info('Agent profile view coming soon!');
                      }}>
                        View Profile
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        toast.info('Deal room creation coming soon!');
                      }}>
                        Connect
                      </Button>
                    </div>
                  </div>
                ))}
                
                {matches.length > 3 && (
                  <div className="text-center pt-2">
                    <Link to={createPageUrl("Agents")}>
                      <Button variant="ghost" size="sm">
                        View all {matches.length} matches
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Buy Box Summary */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Buy Box</h2>
              </div>
              <Link to={createPageUrl("InvestorBuyBox")}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
            
            {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
              <div className="space-y-4">
                {buyBox.asset_types && buyBox.asset_types.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Asset Types</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.asset_types.map((type, idx) => (
                        <Badge key={idx} variant="secondary">{type}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {buyBox.markets && buyBox.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.markets.map((market, idx) => (
                        <Badge key={idx} variant="secondary">{market}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {(buyBox.min_budget || buyBox.max_budget) && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Budget Range</p>
                    <p className="font-semibold text-slate-900">
                      ${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">No buy box configured yet</p>
                <Link to={createPageUrl("InvestorBuyBox")}>
                  <Button size="sm">Set Up Buy Box</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-900">Documents</h2>
              </div>
              <Link to={createPageUrl("InvestorDocuments")}>
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
            
            {docs.length > 0 ? (
              <div className="space-y-2">
                {docs.slice(0, 3).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{doc.type}</p>
                    </div>
                  </div>
                ))}
                {docs.length > 3 && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    +{docs.length - 3} more documents
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">No documents uploaded yet</p>
                <Link to={createPageUrl("InvestorDocuments")}>
                  <Button size="sm">Upload Documents</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              <Link to={createPageUrl("Pricing")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Star className="w-4 h-4 text-blue-600" />
                  Subscription & Plans
                </Button>
              </Link>
              <Link to={createPageUrl("Profile")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Building className="w-4 h-4 text-slate-600" />
                  My Profile
                </Button>
              </Link>
              <Link to={createPageUrl("DealRooms")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Deal Rooms
                </Button>
              </Link>
              <Link to={createPageUrl("AccountBilling")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Billing & Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}