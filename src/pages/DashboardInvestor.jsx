import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { base44 } from "@/api/base44Client";
import { getInvestorMatches, inboxList } from "@/components/functions";
import { 
  FileText, TrendingUp, Plus, MessageSquare, Users,
  Target, Loader2, Sparkles, Home, DollarSign, CreditCard, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";

function InvestorDashboardContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [recentMessages, setRecentMessages] = useState([]);
  const [dealStats, setDealStats] = useState({
    active: 0,
    pending: 0,
    closed: 0
  });
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Get current user
      const user = await base44.auth.me();
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Load profile directly from entity for most accurate data
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const directProfile = profiles[0];
      
      console.log('[DashboardInvestor] Profile loaded from entity:', {
        id: directProfile?.id,
        onboarding_completed_at: directProfile?.onboarding_completed_at,
        kyc_status: directProfile?.kyc_status,
        nda_accepted: directProfile?.nda_accepted,
        subscription_status: directProfile?.subscription_status
      });
      
      setProfile(directProfile);
      
      // Load suggested agents
      loadSuggestedAgents();
      
      // Load recent messages
      loadRecentMessages();
      
      // Load deals
      loadDeals();
      
      setLoading(false);
    } catch (error) {
      console.error('[DashboardInvestor] Error loading profile:', error);
      setLoading(false);
    }
  };

  const loadSuggestedAgents = async () => {
    try {
      const response = await getInvestorMatches({ limit: 3 });
      if (response.data?.ok) {
        setSuggestedAgents(response.data.results || []);
      }
    } catch (err) {
      // Use demo data
      setSuggestedAgents([
        { profile: { id: '1', full_name: 'John Davis', agent: { markets: ['Phoenix, AZ'], experience_years: 15 } }, score: 0.98 },
        { profile: { id: '2', full_name: 'Sarah Martinez', agent: { markets: ['Dallas, TX'], experience_years: 12 } }, score: 0.95 },
        { profile: { id: '3', full_name: 'Michael Chen', agent: { markets: ['Atlanta, GA'], experience_years: 10 } }, score: 0.92 }
      ]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadRecentMessages = async () => {
    try {
      const response = await inboxList();
      if (response.data) {
        setRecentMessages(response.data.slice(0, 3));
      }
    } catch (err) {
      // Silent fail
    }
  };

  const loadDeals = async () => {
    try {
      // Load from Deal entity
      const apiDeals = await base44.entities.Deal.list('-created_date', 50);
      
      // Also load from sessionStorage fallback
      const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
      
      // Merge (avoid duplicates)
      const apiIds = new Set(apiDeals.map(d => d.id));
      const uniqueStored = storedDeals.filter(d => !apiIds.has(d.id));
      const allDeals = [...apiDeals, ...uniqueStored];
      
      setDeals(allDeals);
      
      // Calculate stats
      const active = allDeals.filter(d => d.status === 'active' || d.status === 'draft').length;
      const pending = allDeals.filter(d => d.status === 'pending').length;
      const closed = allDeals.filter(d => d.status === 'closed' || d.status === 'archived').length;
      
      setDealStats({ active, pending, closed });
    } catch (err) {
      // Fallback to sessionStorage only
      const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
      setDeals(storedDeals);
      setDealStats({ 
        active: storedDeals.filter(d => d.status === 'active').length,
        pending: 0,
        closed: 0
      });
    }
  };

  if (loading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin mx-auto mb-4" />
            <p className="text-[#808080] text-sm">Loading your dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';
  const buyBox = profile?.investor?.buy_box || {};
  const hasBuyBox = buyBox && Object.keys(buyBox).length > 0 && (buyBox.markets || buyBox.asset_types || buyBox.budget_min);

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6 lg:space-y-8">
      
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#E3C567]">
                  Welcome back, {firstName}!
                </h1>
                <p className="mt-2 text-base text-[#808080]">
                  Your investment dashboard - track deals, connect with agents, and grow your portfolio.
                </p>
              </div>
            </div>

      {/* Setup Checklist */}
      <SetupChecklist profile={profile} onRefresh={loadProfile} />

      {/* 4-Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        
        {/* Box 1: Start New Deal */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 hover:shadow-[0_10px_25px_rgba(227,197,103,0.2)] hover:border-[#E3C567] transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-[#E3C567]" />
            </div>
            <span className="px-3 py-1 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full border border-[#34D399]/30">
              Primary Action
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Start New Deal</h3>
          <p className="text-sm text-[#808080] mb-4">
            Submit a new deal and get matched with investor-friendly agents in your market.
          </p>
          <Button 
            onClick={() => navigate(createPageUrl("DealWizard"))}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Submit Your First Deal
          </Button>
        </div>

        {/* Box 2: Deal Pipeline */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#E5C37F]" />
            </div>
            <Link to={createPageUrl("DealRooms")} className="text-sm text-[#E5C37F] hover:underline">
              View all →
            </Link>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Deal Pipeline</h3>
          
          <div className="space-y-3">
            <button 
              onClick={() => navigate(createPageUrl("ActiveDeals"))}
              className="w-full flex items-center justify-between p-3 bg-[#E5C37F]/20 rounded-lg hover:bg-[#E5C37F]/30 transition-colors cursor-pointer border border-[#E5C37F]/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#E5C37F] rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-[#0F0F0F]" />
                </div>
                <span className="font-medium text-[#FAFAFA]">Active Deals</span>
              </div>
              <span className="text-xl font-bold text-[#E5C37F]">{dealStats.active}</span>
            </button>
            
            <button 
              onClick={() => navigate(createPageUrl("PendingDeals"))}
              className="w-full flex items-center justify-between p-3 bg-[#262626] rounded-lg hover:bg-[#333333] transition-colors cursor-pointer border border-[#333333] hover:border-[#A6A6A6]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#666666] rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#FAFAFA]" />
                </div>
                <span className="font-medium text-[#FAFAFA]">Pending</span>
              </div>
              <span className="text-xl font-bold text-[#A6A6A6]">{dealStats.pending}</span>
            </button>
            
            <button 
              onClick={() => navigate(createPageUrl("ClosedDeals"))}
              className="w-full flex items-center justify-between p-3 bg-[#34D399]/20 rounded-lg hover:bg-[#34D399]/30 transition-colors cursor-pointer border border-[#34D399]/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#34D399] rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#0F0F0F]" />
                </div>
                <span className="font-medium text-[#FAFAFA]">Closed</span>
              </div>
              <span className="text-xl font-bold text-[#34D399]">{dealStats.closed}</span>
            </button>
          </div>
        </div>

        {/* Box 3: Recent Messages */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#DB2777]/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-[#DB2777]" />
            </div>
            <Link to={createPageUrl("DealRooms")} className="text-sm text-[#E5C37F] hover:underline">
              View all →
            </Link>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Recent Messages</h3>
          
          {recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((msg, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#E5C37F] hover:bg-[#262626] transition-all cursor-pointer">
                  <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#E5C37F]">
                      {msg.senderName?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#FAFAFA] truncate">{msg.senderName || 'Agent'}</p>
                    <p className="text-xs text-[#A6A6A6] truncate">{msg.preview || 'New message'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="w-10 h-10 text-[#333333] mx-auto mb-2" />
              <p className="text-sm text-[#A6A6A6]">No messages yet</p>
              <p className="text-xs text-[#666666]">Start a deal to connect with agents</p>
            </div>
          )}
        </div>

        {/* Box 4: Suggested Agents */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-[#34D399]/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-[#34D399]" />
              </div>
              <span className="px-2 py-0.5 bg-[#E5C37F]/20 text-[#E5C37F] text-xs font-medium rounded-full border border-[#E5C37F]/30">
                AI Powered
              </span>
            </div>
            <Link to={createPageUrl("AgentDirectory")} className="text-sm text-[#E5C37F] hover:underline">
              View all →
            </Link>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Suggested Agents</h3>
          
          {loadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#E5C37F] animate-spin" />
            </div>
          ) : suggestedAgents.length > 0 ? (
            <div className="space-y-3">
              {suggestedAgents.slice(0, 3).map((match, idx) => (
                <div 
                  key={match.profile?.id || idx}
                  className="flex items-start gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#34D399] hover:bg-[#262626] transition-all cursor-pointer"
                  onClick={() => navigate(`${createPageUrl("AgentDirectory")}?highlight=${match.profile?.id}`)}
                >
                  <div className="w-10 h-10 bg-[#34D399]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#34D399]">
                      {match.profile?.full_name?.split(' ').map(n => n[0]).join('') || 'AG'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#FAFAFA] truncate">{match.profile?.full_name || 'Agent'}</p>
                      <span className="px-2 py-0.5 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full border border-[#34D399]/30">
                        {Math.round((match.score || 0.9) * 100)}% match
                      </span>
                    </div>
                    <p className="text-xs text-[#A6A6A6]">
                      {match.profile?.agent?.markets?.[0] || 'Your market'} • {match.profile?.agent?.experience_years || '10'}+ years
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-[#333333] mx-auto mb-2" />
              <p className="text-sm text-[#A6A6A6]">No matches yet</p>
              <p className="text-xs text-[#666666]">Complete your buy box for better matches</p>
            </div>
          )}
        </div>
      </div>

      {/* Buy Box Section */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-[#E5C37F]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#FAFAFA]">Your Buy Box</h3>
              <p className="text-sm text-[#A6A6A6]">Investment criteria for agent matching</p>
            </div>
          </div>
          <Link to={createPageUrl("InvestorBuyBox")} className="text-sm text-[#E5C37F] hover:underline">
            Edit →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
            <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Markets</p>
            <p className="font-semibold text-[#FAFAFA]">
              {profile?.target_state || profile?.markets?.[0] || 'Not set'}
            </p>
          </div>
          <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
            <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Property Types</p>
            <p className="font-semibold text-[#FAFAFA]">
              {buyBox?.asset_types?.slice(0, 2).join(', ') || 'Any'}
            </p>
          </div>
          <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
            <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Budget</p>
            <p className="font-semibold text-[#FAFAFA]">
              {buyBox?.budget_min && buyBox?.budget_max 
                ? `$${(buyBox.budget_min/1000).toFixed(0)}K - $${(buyBox.budget_max/1000).toFixed(0)}K`
                : 'Not set'}
            </p>
          </div>
          <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
            <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Strategy</p>
            <p className="font-semibold text-[#FAFAFA]">
              {buyBox?.deal_profiles?.[0] || 'Any'}
            </p>
          </div>
        </div>
      </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Subscription', icon: CreditCard, href: 'Pricing' },
                { label: 'My Profile', icon: Users, href: 'AccountProfile' },
                { label: 'Deal Rooms', icon: MessageSquare, href: 'DealRooms' },
                { label: 'Documents', icon: FileText, href: 'InvestorDocuments' },
                { label: 'AI Assistant', icon: Bot, href: 'AIAssistant' },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.href} 
                    to={createPageUrl(link.href)} 
                    className="bg-[#1A1A1A] border border-[#333333] rounded-xl flex items-center gap-3 p-4 hover:border-[#E5C37F] hover:bg-[#262626] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#E5C37F]" />
                    </div>
                    <span className="font-medium text-[#FAFAFA]">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardInvestor() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDashboardContent />
    </AuthGuard>
  );
}