import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  Folder, Users, Mail, User, ArrowRight, Shield, 
  TrendingUp, CheckSquare, MessageCircle
} from "lucide-react";

function InvestorDashboardContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeDeals: 0,
    newMatches: 0,
    totalAgents: 0,
    unreadMessages: 0
  });

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-[20px] p-8 animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-12 h-12 bg-[#E5E7EB] rounded-full mb-4 mx-auto"></div>
            <div className="h-8 bg-[#E5E7EB] rounded w-48 mb-2 mx-auto"></div>
            <div className="h-4 bg-[#E5E7EB] rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';
  const profileCompletion = 80;

  return (
    <div className="min-h-screen bg-[#FFFFFF]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Navigation Bar */}
      <nav className="h-20 bg-white border-b border-[#E5E7EB] sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-[12px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-[20px] font-bold text-[#1A1A1A]">INVESTOR KONNECT</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("AgentDirectory")}>
              <button className="rounded-full font-medium text-[14px] text-[#666666] hover:text-[#1A1A1A] px-4 py-2 transition-colors">
                Browse Agents
              </button>
            </Link>
            <Link to={createPageUrl("MyProfile")}>
              <div className="w-10 h-10 bg-[#F9FAFB] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#D4AF37]/20 transition-all duration-250">
                <User className="w-5 h-5 text-[#666666]" />
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Welcome Card */}
      <section className="px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="max-w-7xl mx-auto">
          <div 
            className="relative overflow-hidden rounded-[24px] p-8 md:p-12"
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #B8941F 100%)',
              boxShadow: '0 8px 24px rgba(212, 175, 55, 0.25)'
            }}
          >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4"></div>
            
            <div className="relative z-10">
              <h1 className="text-white text-[32px] font-bold mb-2 leading-[1.2]">
                Welcome back, {firstName}! 👋
              </h1>
              <p className="text-white/90 text-[16px] mb-6 leading-[1.5]">
                You're making great progress on your investment journey
              </p>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/90 text-[14px] font-medium">Profile Completion</span>
                  <span className="text-white font-bold text-[14px]">{profileCompletion}%</span>
                </div>
                <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Next Step CTA */}
              <div className="flex items-center gap-3 mt-6">
                <span className="text-white/90 text-[14px]">Next step:</span>
                <Link to={createPageUrl("AgentDirectory")}>
                  <button className="bg-white text-[#B8941F] px-6 py-2.5 rounded-full font-medium text-[14px] hover:bg-white/95 transition-all duration-250 hover:scale-[1.02] flex items-center gap-2">
                    Connect with your first agent
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metrics with Hierarchy */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-6 leading-[1.2]">Your Investment Journey</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* HERO METRIC - Active Deals */}
            <div className="lg:col-span-2">
              <div 
                className="bg-white rounded-[20px] p-8 h-full transition-all duration-250 hover:-translate-y-1 border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center">
                    <Folder className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <span className="text-[14px] font-medium text-[#666666]">ACTIVE DEALS</span>
                </div>
                
                <p className="text-[64px] font-bold text-[#1A1A1A] leading-none mb-4">
                  {stats.activeDeals}
                </p>
                
                {stats.activeDeals === 0 ? (
                  <div>
                    <p className="text-[16px] text-[#666666] mb-4 leading-[1.5]">
                      Ready to start your first investment deal?
                    </p>
                    <Link to={createPageUrl("AgentDirectory")}>
                      <button className="bg-[#D4AF37] text-white px-6 py-3 rounded-full font-medium text-[14px] hover:bg-[#B8941F] transition-all duration-250 hover:scale-[1.02] flex items-center gap-2">
                        Browse Agents
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#10B981]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[14px] font-medium">+{stats.activeDeals} active this month</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* SUPPORTING METRICS */}
            <div className="space-y-6">
              {/* Agents Browsed */}
              <div 
                className="bg-white rounded-[20px] p-6 transition-all duration-250 hover:-translate-y-1 border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <span className="text-[12px] text-[#10B981] font-medium">+2 new</span>
                </div>
                <p className="text-[28px] font-bold text-[#1A1A1A]">3</p>
                <p className="text-[14px] text-[#666666]">Agents Browsed</p>
              </div>
              
              {/* Unread Messages */}
              <div 
                className="bg-white rounded-[20px] p-6 transition-all duration-250 hover:-translate-y-1 border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-[#10B981]/20 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#10B981]" />
                  </div>
                  {stats.unreadMessages > 0 && (
                    <span className="text-[12px] text-[#EF4444] font-medium">{stats.unreadMessages} new</span>
                  )}
                </div>
                <p className="text-[28px] font-bold text-[#1A1A1A]">{stats.unreadMessages}</p>
                <p className="text-[14px] text-[#666666]">Unread Messages</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions - Simplified */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-2 leading-[1.2]">What would you like to do?</h2>
          <p className="text-[14px] text-[#666666] mb-6">Choose your next action</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Messages */}
            <Link to={createPageUrl("Inbox")}>
              <div 
                className="bg-white rounded-[20px] p-8 transition-all duration-250 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 group border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="w-16 h-16 bg-[#3B82F6]/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#3B82F6] transition-colors duration-250">
                  <Mail className="w-8 h-8 text-[#3B82F6] group-hover:text-white transition-colors duration-250" />
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-2 leading-[1.3]">Messages</h3>
                <p className="text-[14px] text-[#666666] mb-3 leading-[1.5]">View your inbox and connection requests</p>
                {stats.unreadMessages > 0 && (
                  <div className="inline-flex items-center gap-2 bg-[#EF4444]/10 text-[#EF4444] px-3 py-1 rounded-full text-[12px] font-medium">
                    <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse"></span>
                    {stats.unreadMessages} unread
                  </div>
                )}
              </div>
            </Link>
            
            {/* Find Agents */}
            <Link to={createPageUrl("AgentDirectory")}>
              <div 
                className="bg-white rounded-[20px] p-8 transition-all duration-250 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 group border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="w-16 h-16 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#D4AF37] transition-colors duration-250">
                  <Users className="w-8 h-8 text-[#D4AF37] group-hover:text-white transition-colors duration-250" />
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-2 leading-[1.3]">Find Agents</h3>
                <p className="text-[14px] text-[#666666] mb-3 leading-[1.5]">Discover 1,200+ verified investor-friendly agents</p>
                <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded-full text-[12px] font-medium">
                  <CheckSquare className="w-3 h-3" />
                  All verified
                </div>
              </div>
            </Link>
            
            {/* My Deals */}
            <Link to={createPageUrl("DealRooms")}>
              <div 
                className="bg-white rounded-[20px] p-8 transition-all duration-250 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 group border border-[#E5E7EB]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#8B5CF6] transition-colors duration-250">
                  <Folder className="w-8 h-8 text-[#8B5CF6] group-hover:text-white transition-colors duration-250" />
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-2 leading-[1.3]">My Deals</h3>
                <p className="text-[14px] text-[#666666] mb-3 leading-[1.5]">Manage your active deal rooms</p>
                <div className="text-[12px] text-[#666666]">
                  {stats.activeDeals === 0 ? 'No active deals yet' : `${stats.activeDeals} active`}
                </div>
              </div>
            </Link>
          </div>
          
          {/* Secondary Actions */}
          <div className="flex flex-wrap items-center gap-4 text-[14px]">
            <span className="text-[#666666]">More actions:</span>
            <Link to={createPageUrl("MyProfile")} className="text-[#D4AF37] hover:underline font-medium">Profile</Link>
            <span className="text-[#E5E7EB]">•</span>
            <Link to={createPageUrl("Billing")} className="text-[#D4AF37] hover:underline font-medium">Billing</Link>
            <span className="text-[#E5E7EB]">•</span>
            <Link to={createPageUrl("Resources")} className="text-[#D4AF37] hover:underline font-medium">Resources</Link>
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-6 leading-[1.2]">Your Activity</h2>
          
          <div className="bg-white rounded-[20px] p-8 border border-[#E5E7EB]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="space-y-6">
              {/* Activity Item 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="w-0.5 h-full bg-[#E5E7EB] mt-2"></div>
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium text-[#1A1A1A]">You viewed Sarah Johnson's profile</span>
                  </div>
                  <p className="text-[12px] text-[#999999] mb-3">Today, 2:30 PM</p>
                  <Link to={createPageUrl("AgentDirectory")}>
                    <button className="text-[#D4AF37] text-[14px] font-medium hover:underline">
                      Connect with Sarah →
                    </button>
                  </Link>
                </div>
              </div>
              
              {/* Activity Item 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-[#10B981]/20 rounded-full flex items-center justify-center">
                    <CheckSquare className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="w-0.5 h-full bg-[#E5E7EB] mt-2"></div>
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium text-[#1A1A1A]">You completed your investment preferences</span>
                    <span className="text-[20px]">🎉</span>
                  </div>
                  <p className="text-[12px] text-[#999999] mb-2">Yesterday</p>
                  <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded-full text-[12px] font-medium">
                    Profile {profileCompletion}% complete
                  </div>
                </div>
              </div>
              
              {/* Activity Item 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-[#D4AF37]/20 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium text-[#1A1A1A]">You joined Investor Konnect</span>
                    <span className="text-[20px]">👋</span>
                  </div>
                  <p className="text-[12px] text-[#999999]">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
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