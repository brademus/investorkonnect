import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, User, Clock } from "lucide-react";

const QUESTIONS_MAP = {
  wholesale_count: { label: "How many wholesale deals have you participated in?", options: { none: "None", "1-5": "1–5", "6-15": "6–15", "15+": "15+" } },
  creative_types: { label: "Creative deal types worked with", options: { double_close: "Double Close", novation: "Novation", sub2: "Subject-To", seller_financing: "Seller Financing", brrrr: "BRRRR / Value-Add" } },
  investor_pct: { label: "Percentage of business from investor clients", options: { "0-10": "0–10%", "10-25": "10–25%", "25-50": "25–50%", "50+": "50%+" } },
  broker_assignments: { label: "Broker allows assignment of contract transactions?", options: { yes: "Yes", no: "No" } },
  broker_creative: { label: "Broker allows creative finance deals?", options: { yes: "Yes", no: "No" } },
  broker_confirm: { label: "Willing to provide broker confirmation?", options: { yes: "Yes", no: "No" } },
  broker_conflicts: { label: "Broker conflicts related to investor deals?", options: { none: "No issues", minor: "Minor issues", major: "Major past conflict" } },
  metrics_known: { label: "Metrics they can calculate", options: { arv: "ARV", mao: "MAO", cap_rate: "Cap Rate", coc: "Cash-on-Cash Return", repair: "Repair estimate methodology" } },
  comps_speed: { label: "How quickly can they deliver comps?", options: { "2hr": "Under 2 hours", same_day: "Same day", "24hr": "24+ hours" } },
  low_offers: { label: "Comfortable submitting low offers?", options: { yes: "Yes, comfortable", hesitant: "Somewhat hesitant", no: "Not comfortable" } },
  distressed_sellers: { label: "Comfortable working with distressed sellers?", options: { yes: "Yes, comfortable", neutral: "Neutral", no: "Uncomfortable" } },
  no_bypass: { label: "Agrees not to bypass platform?", options: { yes: "Yes", no: "Hesitation / No" } },
  margin_visibility: { label: "Comfortable with investor margin visibility?", options: { yes: "Yes", no: "Uncomfortable" } },
  close_timeline: { label: "Comfortable with 7–14 day close timelines?", options: { yes: "Yes", prefer_30: "Prefer 30+ days" } },
  investor_reference: { label: "Can provide investor client reference?", options: { yes: "Yes", no: "No" } },
};

const CATEGORIES = [
  { label: "Experience With Investor Deals", ids: ["wholesale_count", "creative_types", "investor_pct"] },
  { label: "Broker Approval & Compliance", ids: ["broker_assignments", "broker_creative", "broker_confirm", "broker_conflicts"] },
  { label: "Investor Competency", ids: ["metrics_known", "comps_speed", "low_offers", "distressed_sellers"] },
  { label: "Alignment & Platform Risk", ids: ["no_bypass", "margin_visibility", "close_timeline", "investor_reference"] },
];

function AnswerDisplay({ questionId, answer }) {
  const q = QUESTIONS_MAP[questionId];
  if (!q) return null;

  const formatAnswer = (ans) => {
    if (Array.isArray(ans)) {
      return ans.map(v => q.options[v] || v).join(", ") || "None selected";
    }
    return q.options[ans] || ans || "—";
  };

  const isBad = (questionId === "broker_assignments" && answer === "no") ||
    (questionId === "no_bypass" && answer === "no") ||
    (questionId === "low_offers" && answer === "no") ||
    (questionId === "distressed_sellers" && answer === "no");

  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-[#1F1F1F] last:border-0">
      <span className="text-sm text-[#808080] flex-1">{q.label}</span>
      <span className={`text-sm font-medium text-right ${isBad ? "text-red-400" : "text-[#FAFAFA]"}`}>
        {formatAnswer(answer)}
      </span>
    </div>
  );
}

function AgentReviewCard({ profile, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const answers = profile.metadata?.qualification_answers || {};
  const score = profile.metadata?.qualification_score || "N/A";

  const handleAction = async (action) => {
    setActing(true);
    try {
      if (action === "approve") {
        await base44.entities.Profile.update(profile.id, {
          qualification_tier: "approved",
        });
        toast.success(`${profile.full_name || profile.email} approved — they can now complete onboarding.`);
      } else {
        await base44.entities.Profile.update(profile.id, {
          qualification_tier: "rejected",
        });
        toast.success(`${profile.full_name || profile.email} has been rejected.`);
      }
      onAction();
    } catch (e) {
      toast.error("Failed: " + (e.message || "Unknown error"));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#1F1F1F] bg-[#111114] overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#FAFAFA] font-semibold truncate">{profile.full_name || "Unnamed"}</p>
            <p className="text-xs text-[#808080] truncate">{profile.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30">
            Score: {score}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-[#808080] hover:text-[#E3C567]"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded answers */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <h4 className="text-xs font-semibold text-[#E3C567] uppercase tracking-wider mb-2">{cat.label}</h4>
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                {cat.ids.map((qId) => (
                  <AnswerDisplay key={qId} questionId={qId} answer={answers[qId]} />
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-3">
            <Button
              onClick={() => handleAction("approve")}
              disabled={acting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl h-11"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve Agent
            </Button>
            <Button
              onClick={() => handleAction("reject")}
              disabled={acting}
              variant="outline"
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl h-11"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminVettingReviewTab({ profiles, onReload }) {
  const conditionalAgents = (profiles || []).filter(
    (p) => p.user_role === "agent" && p.qualification_tier === "conditional"
  );

  if (conditionalAgents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">No Pending Reviews</h3>
        <p className="text-sm text-[#808080]">All conditional agents have been reviewed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Clock className="w-5 h-5 text-[#F59E0B]" />
        <h3 className="text-lg font-semibold text-[#FAFAFA]">
          {conditionalAgents.length} Agent{conditionalAgents.length !== 1 ? "s" : ""} Awaiting Review
        </h3>
      </div>
      {conditionalAgents.map((agent) => (
        <AgentReviewCard key={agent.id} profile={agent} onAction={onReload} />
      ))}
    </div>
  );
}