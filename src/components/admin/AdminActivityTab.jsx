import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, FileText, PenTool, Shield, CreditCard, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import moment from "moment";

const ACTION_CONFIG = {
  deal_created: { icon: FileText, color: 'text-[#60A5FA]', label: 'Deal Created' },
  milestone_paid: { icon: CreditCard, color: 'text-[#34D399]', label: 'Payment Made' },
  milestone_payment_failed: { icon: CreditCard, color: 'text-red-400', label: 'Payment Failed' },
  nda_accepted: { icon: PenTool, color: 'text-[#34D399]', label: 'NDA Signed' },
  kyc_approved: { icon: Shield, color: 'text-[#34D399]', label: 'Identity Verified' },
  profile_dedup: { icon: User, color: 'text-[#808080]', label: 'Profile Merged' },
  create: { icon: CheckCircle, color: 'text-[#60A5FA]', label: 'Created' },
  update: { icon: CheckCircle, color: 'text-[#E3C567]', label: 'Updated' },
  default: { icon: CheckCircle, color: 'text-[#E3C567]', label: 'Action' },
};

export default function AdminActivityTab({ profiles }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const getProfileName = (actorId) => {
    const p = profiles.find(pr => pr.id === actorId || pr.user_id === actorId);
    return p?.full_name || p?.email || actorId || 'System';
  };

  const loadLogs = async () => {
    setLoading(true);
    const auditLogs = await base44.entities.AuditLog.list('-created_date', 100).catch(() => []);
    setLogs(auditLogs || []);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const config = (action) => ACTION_CONFIG[action] || ACTION_CONFIG.default;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#FAFAFA]">Recent Activity (last 100 events)</h3>
        <Button variant="ghost" size="sm" onClick={loadLogs} className="text-[#808080] hover:text-[#E3C567]">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-[#808080] text-sm">No activity logged yet.</div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const cfg = config(log.action);
            const Icon = cfg.icon;
            return (
              <div key={log.id} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[#FAFAFA] font-medium">{log.details || cfg.label}</span>
                    <span className="text-xs text-[#808080] flex-shrink-0">{moment(log.created_date || log.timestamp).fromNow()}</span>
                  </div>
                  <p className="text-xs text-[#808080] mt-0.5">{getProfileName(log.actor_id)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}