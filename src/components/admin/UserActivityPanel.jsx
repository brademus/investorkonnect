import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X, FileText, MessageSquare, Shield, PenTool, Clock, User, CreditCard, CheckCircle, AlertTriangle } from "lucide-react";
import moment from "moment";

const EVENT_ICONS = {
  deal_created: FileText,
  agent_locked_in: Shield,
  agent_accepted: CheckCircle,
  agent_rejected: AlertTriangle,
  message_sent: MessageSquare,
  file_uploaded: FileText,
  photo_uploaded: FileText,
  deal_stage_changed: FileText,
  create: PenTool,
  update: PenTool,
  approve: CheckCircle,
  reject: AlertTriangle,
  signed: PenTool,
  payment: CreditCard,
};

const EVENT_COLORS = {
  deal_created: "bg-blue-100 text-blue-700",
  agent_locked_in: "bg-emerald-100 text-emerald-700",
  agent_accepted: "bg-green-100 text-green-700",
  agent_rejected: "bg-red-100 text-red-700",
  message_sent: "bg-purple-100 text-purple-700",
  file_uploaded: "bg-indigo-100 text-indigo-700",
  signed: "bg-emerald-100 text-emerald-700",
  create: "bg-blue-100 text-blue-700",
  update: "bg-yellow-100 text-yellow-700",
};

export default function UserActivityPanel({ profile, onClose }) {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    if (profile) loadUserActivity();
  }, [profile?.id]);

  const loadUserActivity = async () => {
    setLoading(true);
    const events = [];

    // 1. Profile creation
    if (profile.created_date) {
      events.push({
        type: "account_created",
        label: "Account Created",
        detail: `Signed up as ${profile.user_role || profile.user_type || "member"}`,
        date: profile.created_date,
        icon: User,
        color: "bg-blue-100 text-blue-700",
      });
    }

    // 2. Onboarding completed
    if (profile.onboarding_completed_at) {
      events.push({
        type: "onboarding_completed",
        label: "Onboarding Completed",
        detail: `Completed ${profile.user_role || "user"} onboarding`,
        date: profile.onboarding_completed_at,
        icon: CheckCircle,
        color: "bg-emerald-100 text-emerald-700",
      });
    }

    // 3. NDA signed
    if (profile.nda_accepted_at) {
      events.push({
        type: "nda_signed",
        label: "NDA Signed",
        detail: `Accepted NDA v${profile.nda_version || "1.0"}`,
        date: profile.nda_accepted_at,
        icon: PenTool,
        color: "bg-emerald-100 text-emerald-700",
      });
    }

    // 4. Identity verification
    if (profile.identity_verified_at) {
      events.push({
        type: "identity_verified",
        label: "Identity Verified",
        detail: `Verified via ${profile.identity_provider || "Stripe Identity"}`,
        date: profile.identity_verified_at,
        icon: Shield,
        color: "bg-emerald-100 text-emerald-700",
      });
    }

    // Fetch all async data in parallel
    const [activities, auditLogs, deals, agreements, messages] = await Promise.all([
      base44.entities.Activity.filter({ actor_id: profile.id }).catch(() => []),
      base44.entities.AuditLog.filter({ actor_id: profile.user_id }).catch(() => []),
      fetchUserDeals(profile),
      fetchUserAgreements(profile),
      fetchUserMessages(profile),
    ]);

    // 5. Activity entity events
    for (const a of activities) {
      events.push({
        type: a.type,
        label: formatActivityType(a.type),
        detail: a.message || `Deal activity`,
        date: a.created_date,
        icon: EVENT_ICONS[a.type] || FileText,
        color: EVENT_COLORS[a.type] || "bg-slate-100 text-slate-700",
        meta: a.metadata,
      });
    }

    // 6. Audit log events
    for (const log of auditLogs) {
      events.push({
        type: `audit_${log.action}`,
        label: `${capitalize(log.action)} ${log.entity_type || ""}`.trim(),
        detail: log.details || `${log.action} on ${log.entity_type}`,
        date: log.timestamp || log.created_date,
        icon: EVENT_ICONS[log.action] || PenTool,
        color: EVENT_COLORS[log.action] || "bg-slate-100 text-slate-700",
      });
    }

    // 7. Deals created
    for (const deal of deals) {
      events.push({
        type: "deal_created",
        label: "Deal Created",
        detail: `${deal.title || deal.property_address || "Untitled"} — ${deal.pipeline_stage || deal.status}`,
        date: deal.created_date,
        icon: FileText,
        color: "bg-blue-100 text-blue-700",
      });
    }

    // 8. Agreements signed
    for (const ag of agreements) {
      if (ag.investor_signed_at && ag.investor_profile_id === profile.id) {
        events.push({
          type: "agreement_investor_signed",
          label: "Agreement Signed (Investor)",
          detail: `Agreement for deal`,
          date: ag.investor_signed_at,
          icon: PenTool,
          color: "bg-emerald-100 text-emerald-700",
        });
      }
      if (ag.agent_signed_at && ag.agent_profile_id === profile.id) {
        events.push({
          type: "agreement_agent_signed",
          label: "Agreement Signed (Agent)",
          detail: `Agreement for deal`,
          date: ag.agent_signed_at,
          icon: PenTool,
          color: "bg-emerald-100 text-emerald-700",
        });
      }
    }

    // 9. Messages sent (count + recent)
    if (messages.length > 0) {
      events.push({
        type: "messages_summary",
        label: `${messages.length} Messages Sent`,
        detail: `Last: "${(messages[0]?.body || "").substring(0, 80)}${(messages[0]?.body || "").length > 80 ? "..." : ""}"`,
        date: messages[0]?.created_date,
        icon: MessageSquare,
        color: "bg-purple-100 text-purple-700",
      });
    }

    // Sort all events by date descending
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTimeline(events);
    setLoading(false);
  };

  const fetchUserDeals = async (p) => {
    if (p.user_role === "investor" || p.user_type === "investor") {
      return base44.entities.Deal.filter({ investor_id: p.id }).catch(() => []);
    }
    // For agents, find deals via DealInvite
    const invites = await base44.entities.DealInvite.filter({ agent_profile_id: p.id }).catch(() => []);
    const dealIds = [...new Set(invites.map((i) => i.deal_id))];
    const deals = [];
    for (const did of dealIds.slice(0, 20)) {
      const d = await base44.entities.Deal.filter({ id: did }).catch(() => []);
      if (d?.[0]) deals.push(d[0]);
    }
    return deals;
  };

  const fetchUserAgreements = async (p) => {
    const byInvestor = await base44.entities.LegalAgreement.filter({ investor_profile_id: p.id }).catch(() => []);
    const byAgent = await base44.entities.LegalAgreement.filter({ agent_profile_id: p.id }).catch(() => []);
    const map = new Map();
    [...byInvestor, ...byAgent].forEach((a) => map.set(a.id, a));
    return [...map.values()];
  };

  const fetchUserMessages = async (p) => {
    return base44.entities.Message.filter({ sender_profile_id: p.id }, "-created_date", 50).catch(() => []);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{profile.full_name || profile.email}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <div className="flex gap-2 mt-1">
              <Badge className="capitalize">{profile.user_role || profile.user_type || "member"}</Badge>
              {profile.role === "admin" && <Badge className="bg-orange-100 text-orange-800">Admin</Badge>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-slate-100">
          <div className="text-center">
            <div className="text-xs text-slate-500">Status</div>
            <div className="text-sm font-semibold capitalize">{profile.status || "pending"}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">KYC</div>
            <div className="text-sm font-semibold capitalize">{profile.kyc_status || "unverified"}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Subscription</div>
            <div className="text-sm font-semibold capitalize">{profile.subscription_tier || "none"}</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Activity Timeline</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading activity...</span>
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />
              <div className="space-y-4">
                {timeline.map((event, idx) => {
                  const Icon = event.icon || Clock;
                  return (
                    <div key={idx} className="relative flex gap-3 pl-2">
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${event.color || "bg-slate-100 text-slate-600"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{event.label}</span>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {event.date ? moment(event.date).fromNow() : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 break-words">{event.detail}</p>
                        {event.date && (
                          <p className="text-[10px] text-slate-300 mt-0.5">
                            {moment(event.date).format("MMM D, YYYY h:mm A")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatActivityType(type) {
  return (type || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}