import React from "react";
import { Users, FileText, Shield, CheckCircle, AlertTriangle, PenTool, CreditCard } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, color = "text-[#D3A029]" }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      <StatCard icon={Users} label="Total Users" value={profiles.length} />
      <StatCard icon={Shield} label="Investors" value={investors} />
      <StatCard icon={Users} label="Agents" value={agents} />
      <StatCard icon={CheckCircle} label="Onboarded" value={onboarded} color="text-emerald-600" />
      <StatCard icon={PenTool} label="NDA Signed" value={ndaSigned} color="text-emerald-600" />
      <StatCard icon={FileText} label="Active Deals" value={activeDeals} color="text-blue-600" />
      <StatCard icon={CreditCard} label="Agreements" value={signedAgreements} color="text-purple-600" />
    </div>
  );
}