import React, { useMemo } from "react";
import { CreditCard, TrendingUp, Users, AlertTriangle, Clock } from "lucide-react";

export default function AdminRevenueTab({ profiles }) {
  const stats = useMemo(() => {
    const active = profiles.filter(p => p.subscription_status === 'active');
    const trialing = profiles.filter(p => p.subscription_status === 'trialing');
    const pastDue = profiles.filter(p => p.subscription_status === 'past_due');
    const canceled = profiles.filter(p => p.subscription_status === 'canceled');

    const planPrices = { starter: 29, pro: 49, enterprise: 99 };
    const mrr = active.reduce((sum, p) => sum + (planPrices[p.subscription_tier] || 49), 0);

    return { active, trialing, pastDue, canceled, mrr };
  }, [profiles]);

  const StatusBadge = ({ status }) => {
    const colors = {
      active: 'bg-green-500/15 text-green-400 border-green-500/30',
      trialing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      past_due: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      canceled: 'bg-red-500/15 text-red-400 border-red-500/30',
      none: 'bg-[#808080]/15 text-[#808080] border-[#808080]/30',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[status] || colors.none}`}>
        {status || 'none'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Est. MRR', value: `$${stats.mrr.toLocaleString()}`, icon: TrendingUp, color: 'text-[#34D399]' },
          { label: 'Active Subscribers', value: stats.active.length, icon: CreditCard, color: 'text-[#E3C567]' },
          { label: 'On Trial', value: stats.trialing.length, icon: Clock, color: 'text-[#60A5FA]' },
          { label: 'Past Due', value: stats.pastDue.length, icon: AlertTriangle, color: 'text-[#F59E0B]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-[14px] p-4" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
        ))}
      </div>

      {stats.pastDue.length > 0 && (
        <div className="rounded-xl p-4 bg-yellow-500/5 border border-yellow-500/20">
          <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Past Due — Needs Attention ({stats.pastDue.length})
          </h3>
          <div className="space-y-2">
            {stats.pastDue.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-[#FAFAFA]">{p.full_name || p.email}</span>
                <span className="text-[#808080] text-xs">{p.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-[#FAFAFA] mb-3">All Investors — Subscription Status</h3>
        <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="text-left px-4 py-3 text-[#808080] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#808080] font-medium">Email</th>
                <th className="text-left px-4 py-3 text-[#808080] font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-[#808080] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .filter(p => p.user_role === 'investor')
                .sort((a, b) => {
                  const order = { active: 0, trialing: 1, past_due: 2, canceled: 3, none: 4 };
                  return (order[a.subscription_status] ?? 4) - (order[b.subscription_status] ?? 4);
                })
                .map(p => (
                  <tr key={p.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[#FAFAFA]">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-[#808080]">{p.email}</td>
                    <td className="px-4 py-3 text-[#808080]">{p.subscription_tier || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.subscription_status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}