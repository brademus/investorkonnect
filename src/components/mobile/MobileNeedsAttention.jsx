import React from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { getDealNextStepLabel } from "@/components/utils/dealNextStepLabel";
import { normalizeStage } from "@/components/pipelineStages";

const STAGE_SHORT = {
  new_deals: "New Deals",
  connected_deals: "Connected",
  active_listings: "Active Listing",
  in_closing: "In Closing",
  completed: "Completed",
  canceled: "Canceled",
};

// A step "needs my action" when its color is gold or amber (not the grey "waiting" state).
function isActionable(step) {
  if (!step) return false;
  const c = step.color || "";
  return c.includes("E3C567") || c.includes("F59E0B");
}

/**
 * Scans ALL stages and surfaces deals that need the current user's action,
 * regardless of which stage is currently selected. Rendered as a single amber
 * "alert tray" of rows — visually distinct from the stage's deal cards below —
 * so it reads as a cross-stage to-do list, not the selected stage's deals.
 * Hidden entirely when nothing needs action.
 */
export default function MobileNeedsAttention({ deals, profile, isAgent, isInvestor, wtStatusMap, onDealClick }) {
  const items = (deals || [])
    .map((deal) => {
      const wtInfo = wtStatusMap?.[deal.deal_id] || null;
      const step = getDealNextStepLabel({
        deal, isAgent, isInvestor,
        wtStatus: wtInfo?.status || wtInfo || null,
        wtProposedByProfileId: wtInfo?.updatedBy || null,
        myProfileId: profile?.id,
        isSigned: deal.is_fully_signed,
      });
      return { deal, step };
    })
    .filter(({ step }) => isActionable(step));

  if (items.length === 0) return null;

  return (
    <div
      className="mb-5 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.05) 100%)",
        border: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      {/* Banner header — explains scope */}
      <div className="px-4 pt-3 pb-2.5 border-b border-[#F59E0B]/15">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#F59E0B]">
            Needs your action
          </span>
          <span className="text-[12px] font-semibold text-[#F59E0B]/70">({items.length})</span>
        </div>
        <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-0.5">
          Across all your deals — tap to jump in.
        </p>
      </div>

      {/* Rows — each shows its own stage so it's clearly cross-stage */}
      <div className="divide-y divide-[#F59E0B]/12">
        {items.map(({ deal, step }) => {
          const stage = normalizeStage(deal.pipeline_stage);
          const addr = isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address;
          return (
            <button
              key={deal.id}
              onClick={() => onDealClick(deal)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[#F59E0B]/10 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#FAFAFA]/90 truncate">{addr}</p>
                <p className={`text-[12px] font-semibold mt-0.5 truncate ${step.color}`}>{step.label}</p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[rgba(255,255,255,0.55)] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-full px-2 py-0.5 whitespace-nowrap">
                {STAGE_SHORT[stage] || stage}
              </span>
              <ChevronRight className="w-4 h-4 text-[#F59E0B]/60 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}