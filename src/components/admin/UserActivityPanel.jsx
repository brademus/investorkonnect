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
  deal_created: "bg-[#60A5FA]/15 text-[#60A5FA]",
  agent_locked_in: "bg-[#34D399]/15 text-[#34D399]",
  agent_accepted: "bg-[#34D399]/15 text-[#34D399]",
  agent_rejected: "bg-red-500/15 text-red-400",
  message_sent: "bg-[#A78BFA]/15 text-[#A78BFA]",
  file_uploaded: "bg-[#60A5FA]/15 text-[#60A5FA]",
  signed: "bg-[#34D399]/15 text-[#34D399]",
  create: "bg-[#60A5FA]/15 text-[#60A5FA]",
  update: "bg-[#F59E0B]/15 text-[#F59E0B]",
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

    if (profile.created_date) {
      events.push({ type: "account_created", label: "Account Created", detail: `Signed up as ${profile.user_role || profile.user_type || "member"}`, date: profile.created_date, icon: User, color: "bg-[#60A5FA]/15 text-[#60A5FA]" });
    }
    if (profile.onboarding_completed_at) {
      events.push({ type: "onboarding_completed", label: "Onboarding Completed", detail: `Completed ${profile.user_role || "user"} onboarding`, date: profile.onboarding_completed_at, icon: CheckCircle, color: "bg-[#34D399]/15 text-[#34D399]" });
    }
    if (profile.nda_accepted_at) {
      events.push({ type: "nda_signed", label: "NDA Signed", detail: `Accepted NDA v${profile.nda_version || "1.0"}`, date: profile.nda_accepted_at, icon: PenTool, color: "bg-[#34D399]/15 text-[#34D399]" });
    }
    if (profile.identity_verified_at) {
      events.push({ type: "identity_verified", label: "Identity Verified", detail: `Verified via ${profile.identity_provider || "Stripe Identity"}`, date: profile.identity_verified_at, icon: Shield, color: "bg-[#34D399]/15 text-[#34D399]" });
    }

    const [activities, auditLogs, deals, agreements, messages] = await Promise.all([
      base44.entities.Activity.filter({ actor_id: profile.id }).catch(() => []),
      base44.entities.AuditLog.filter({ actor_id: profile.user_id }).catch(() => []),
      fetchUserDeals(profile),
      fetchUserAgreements(profile),
      fetchUserMessages(profile),
    ]);

    for (const a of activities) {
      events.push({ type: a.type, label: formatActivityType(a.type), detail: a.message || `Deal activity`, date: a.created_date, icon: EVENT_ICONS[a.type] || FileText, color: EVENT_COLORS[a.type] || "bg-[rgba(255,255,255,0.04)] text-[#808080]", meta: a.metadata });
    }
    for (const log of auditLogs) {
      events.push({ type: `audit_${log.action}`, label: `${capitalize(log.action)} ${log.entity_type || ""}`.trim(), detail: log.details || `${log.action} on ${log.entity_type}`, date: log.timestamp || log.created_date, icon: EVENT_ICONS[log.action] || PenTool, color: EVENT_COLORS[log.action] || "bg-[rgba(255,255,255,0.04)] text-[#808080]" });
    }
    for (const deal of deals) {
      events.push({ type: "deal_created", label: "Deal Created", detail: `${deal.title || deal.property_address || "Untitled"} — ${deal.pipeline_stage || deal.status}`, date: deal.created_date, icon: FileText, color: "bg-[#60A5FA]/15 text-[#60A5FA]" });
    }
    for (const ag of agreements) {
      if (ag.investor_signed_at && ag.investor_profile_id === profile.id) {
        events.push({ type: "agreement_investor_signed", label: "Agreement Signed (Investor)", detail: `Agreement for deal`, date: ag.investor_signed_at, icon: PenTool, color: "bg-[#34D399]/15 text-[#34D399]" });
      }
      if (ag.agent_signed_at && ag.agent_profile_id === profile.id) {
        events.push({ type: "agreement_agent_signed", label: "Agreement Signed (Agent)", detail: `Agreement for deal`, date: ag.agent_signed_at, icon: PenTool, color: "bg-[#34D399]/15 text-[#34D399]" });
      }
    }
    if (messages.length > 0) {
      events.push({ type: "messages_summary", label: `${messages.length} Messages Sent`, detail: `Last: "${(messages[0]?.body || "").substring(0, 80)}${(messages[0]?.body || "").length > 80 ? "..." : ""}"`, date: messages[0]?.created_date, icon: MessageSquare, color: "bg-[#A78BFA]/15 text-[#A78BFA]" });
    }

    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTimeline(events);
    setLoading(false);
  };

  const fetchUserDeals = async (p) => {
    if (p.user_role === "investor" || p.user_type === "investor") {
      return base44.entities.Deal.filter({ investor_id: p.id }).catch(() => []);
    }
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
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-slide-in"
        style={{ background: 'linear-gradient(180deg, #111114 0%, #0D0D0D 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-5 flex items-center justify-between" style={{ background: '#111114', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-lg font-bold text-[#FAFAFA]">{profile.full_name || profile.email}</h2>
            <p className="text-sm text-[#808080]">{profile.email}</p>
            <div className="flex gap-2 mt-1">
              <Badge className="capitalize bg-[rgba(255,255,255,0.06)] text-[#FAFAFA] border border-[rgba(255,255,255,0.08)]">{profile.user_role || profile.user_type || "member"}</Badge>
              {profile.role === "admin" && <Badge className="bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">Admin</Badge>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-[#808080] hover:text-[#FAFAFA] hover:bg-transparent">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-center">
            <div className="text-xs text-[#808080]">Status</div>
            <div className="text-sm font-semibold capitalize text-[#FAFAFA]">{profile.status || "pending"}</div>
          </div>

          <div className="text-center">
            <div className="text-xs text-[#808080]">Subscription</div>
            <div className="text-sm font-semibold capitalize text-[#FAFAFA]">{profile.subscription_tier || "none"}</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5">
          <h3 className="text-sm font-semibold text-[#808080] mb-4">Activity Timeline</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" />
              <span className="ml-2 text-sm text-[#808080]">Loading activity...</span>
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-[#808080] text-center py-8">No activity recorded yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-[#1F1F1F]" />
              <div className="space-y-4">
                {timeline.map((event, idx) => {
                  const Icon = event.icon || Clock;
                  return (
                    <div key={idx} className="relative flex gap-3 pl-2">
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${event.color || "bg-[rgba(255,255,255,0.04)] text-[#808080]"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-[#FAFAFA]">{event.label}</span>
                          <span className="text-xs text-[#808080] whitespace-nowrap">
                            {event.date ? moment(event.date).fromNow() : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-[#808080] mt-0.5 break-words">{event.detail}</p>
                        {event.date && (
                          <p className="text-[10px] text-[#808080]/40 mt-0.5">
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
  return (type || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}