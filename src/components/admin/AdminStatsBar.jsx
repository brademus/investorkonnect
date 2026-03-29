import React from "react";
import { Users, FileText, Shield, CheckCircle, PenTool, CreditCard, TrendingUp } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, color = "text-[#E3C567]" }) => (
  <div className="rounded-[14px] p-4" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(227,197,103,0.10)' }}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-[#808080]">{label}</p>
        <p className="text-xl font-bold text-[#FAFAFA]">{value}</p>
      </div>
    </div>
  </div>
);

export default function AdminStatsBar({ profiles, deals, rooms, agreements }) {
  const investors = profiles.filter(p => p.user_role === "investor" || p.user_type === "investor").length;
  const agents = profiles.filter(p => p.user_role === "agent" || p.user_type === "agent").length;
  const onboarded = profiles.filter(p => p.onboarding_completed_at).length;
  const ndaSigned = profiles.filter(p => p.nda_accepted).length;
  const activeDeals = deals.filter(d => d.status === "active").length;
  const signedAgreements = agreements.filter(a => a.status === "fully_signed").length;
  const paidSubscribers = profiles.filter(p => p.subscription_status === 'active').length;
  const kycVerified = profiles.filter(p => p.kyc_status === 'approved' || p.identity_verified_at).length;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dealsThisWeek = deals.filter(d => d.created_date > oneWeekAgo).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3 mb-6">
      <StatCard icon={Users} label="Total Users" value={profiles.length} />
      <StatCard icon={Shield} label="Investors" value={investors} />
      <StatCard icon={Users} label="Agents" value={agents} />
      <StatCard icon={CheckCircle} label="Onboarded" value={onboarded} color="text-[#34D399]" />
      <StatCard icon={PenTool} label="NDA Signed" value={ndaSigned} color="text-[#34D399]" />
      <StatCard icon={FileText} label="Active Deals" value={activeDeals} color="text-[#60A5FA]" />
      <StatCard icon={CreditCard} label="Agreements" value={signedAgreements} color="text-[#A78BFA]" />
      <StatCard icon={CreditCard} label="Paid Subs" value={paidSubscribers} color="text-[#34D399]" />
      <StatCard icon={Shield} label="KYC Verified" value={kycVerified} color="text-[#34D399]" />
      <StatCard icon={TrendingUp} label="Deals This Week" value={dealsThisWeek} color="text-[#F59E0B]" />
    </div>
  );
}