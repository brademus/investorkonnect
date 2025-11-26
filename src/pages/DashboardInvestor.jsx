import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { 
  Folder, Users, Briefcase, Mail, MessageCircle, User, 
  CreditCard, BookOpen, ArrowRight, Home as HomeIcon, Shield, 
  TrendingUp, CheckSquare
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
      console.error('[InvestorDashboard] Load error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#666666]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';

  // Stat cards data
  const statCards = [
    { icon: Folder, value: stats.activeDeals, label: "Active Deals", trend: "+12% this week", trendPositive: true, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
    { icon: Users, value: stats.newMatches, label: "New Matches", trend: "+8% this week", trendPositive: true, bgColor: "bg-[#D4AF37]/20", iconColor: "text-[#D4AF37]" },
    { icon: Briefcase, value: stats.totalAgents, label: "Total Agents", trend: "+5% this week", trendPositive: true, bgColor: "bg-purple-100", iconColor: "text-purple-600" },
    { icon: Mail, value: stats.unreadMessages, label: "Unread Messages", trend: "0 new", trendPositive: true, bgColor: "bg-emerald-100", iconColor: "text-emerald-600" }
  ];

  // Quick action cards data
  const quickActions = [
    { title: "Messages", description: "View your inbox and connection requests", icon: Mail, bgColor: "bg-blue-100", iconColor: "text-blue-600", href: createPageUrl("Inbox") },
    { title: "Browse Agents", description: "Discover verified investor-friendly agents", icon: Users, bgColor: "bg-amber-100", iconColor: "text-amber-600", href: createPageUrl("AgentDirectory") },
    { title: "Deal Rooms", description: "Manage your active deal rooms", icon: Folder, bgColor: "bg-purple-100", iconColor: "text-purple-600", href: createPageUrl("DealRooms") },
    { title: "Profile Settings", description: "Update your investor profile", icon: User, bgColor: "bg-emerald-100", iconColor: "text-emerald-600", href: createPageUrl("MyProfile") },
    { title: "Billing & Plans", description: "Manage subscription and payments", icon: CreditCard, bgColor: "bg-amber-100", iconColor: "text-amber-700", href: createPageUrl("Billing") },
    { title: "Resources", description: "Access guides and support", icon: BookOpen, bgColor: "bg-gray-100", iconColor: "text-gray-600", href: createPageUrl("Resources") }
  ];

  // Sample recent connections (placeholder)
  const recentConnections = [
    { name: "Sarah Johnson", location: "Phoenix, AZ" },
    { name: "Mike Chen", location: "Dallas, TX" },
    { name: "Emily Davis", location: "Atlanta, GA" }
  ];

  // Sample upcoming tasks (placeholder)
  const upcomingTasks = [
    { text: "Review agent proposal", due: "Today" },
    { text: "Complete verification", due: "Tomorrow" },
    { text: "Schedule call with agent", due: "In 3 days" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="h-20 bg-white border-b border-[#E5E5E5] sticky top-0 z-50" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-xl font-bold text-black">INVESTOR KONNECT</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("AgentDirectory")}>
              <Button variant="ghost" className="rounded-full font-medium text-[#333333]">
                Browse Agents
              </Button>
            </Link>
            <Link to={createPageUrl("MyProfile")}>
              <div className="w-10 h-10 bg-[#E5E5E5] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#D4AF37]/20 transition-colors">
                <User className="w-5 h-5 text-[#666666]" />
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Welcome Section */}
      <section className="bg-white pt-12 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-[32px] font-bold text-black mb-2">Welcome back, {firstName}</h1>
          <p className="text-[16px] text-[#666666]">Here's what's happening with your investments today</p>
        </div>
      </section>

      {/* Key Metrics Row */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-6 transition-all duration-250 ease-out hover:-translate-y-0.5"
                style={{ 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className={`w-8 h-8 ${stat.bgColor} rounded-full flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <p className="text-[36px] font-bold text-black">{stat.value}</p>
                <p className="text-[14px] text-[#666666] mb-1">{stat.label}</p>
                <p className={`text-[12px] ${stat.trendPositive ? 'text-emerald-600' : 'text-red-600'}`}>{stat.trend}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[24px] font-bold text-black mb-6 mt-8">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, idx) => (
              <Link key={idx} to={action.href}>
                <div
                  className="bg-white border border-[#E5E5E5] rounded-[20px] p-8 transition-all duration-250 ease-out cursor-pointer relative group hover:scale-[1.02] hover:-translate-y-1"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                >
                  <div className={`w-14 h-14 ${action.bgColor} rounded-full flex items-center justify-center mb-4`}>
                    <action.icon className={`w-7 h-7 ${action.iconColor}`} />
                  </div>
                  <h3 className="text-[20px] font-bold text-black mb-2">{action.title}</h3>
                  <p className="text-[14px] text-[#666666]">{action.description}</p>
                  <ArrowRight className="w-5 h-5 text-[#999999] absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[24px] font-bold text-black mb-6 mt-12">Recent Activity</h2>
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Recent Connections - 60% */}
            <div className="lg:col-span-3 bg-white border border-[#E5E5E5] rounded-2xl p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 className="text-[18px] font-bold text-black mb-4">Recent Connections</h3>
              <div className="space-y-4">
                {recentConnections.map((connection, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border border-[#E5E5E5] rounded-xl hover:bg-[#F9F9F9] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#E5E5E5] rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-[#666666]" />
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-black">{connection.name}</p>
                        <p className="text-[14px] text-[#666666]">{connection.location}</p>
                      </div>
                    </div>
                    <button className="text-[#D4AF37] font-medium text-[14px] hover:underline">
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Tasks - 40% */}
            <div className="lg:col-span-2 bg-white border border-[#E5E5E5] rounded-2xl p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 className="text-[18px] font-bold text-black mb-4">Upcoming Tasks</h3>
              <div className="space-y-3">
                {upcomingTasks.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-[#F9F9F9] rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#E5E5E5] rounded flex items-center justify-center hover:border-[#D4AF37] transition-colors">
                        {/* Empty checkbox */}
                      </div>
                      <span className="text-[14px] text-[#333333]">{task.text}</span>
                    </div>
                    <span className="text-[12px] text-[#666666]">{task.due}</span>
                  </div>
                ))}
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