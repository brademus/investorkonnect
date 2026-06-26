import React from "react";
import { AlertCircle } from "lucide-react";
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
 * regardless of which stage is currently selected. This is the safety net so
 * no deal gets lost behind a non-active stage. Hidden entirely when nothing needs action.
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
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#F59E0B]">
          Needs your action
        </span>
        <span className="text-[11px] text-[rgba(255,255,255,0.4)]">({items.length})</span>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items.map(({ deal, step }) => {
          const stage = normalizeStage(deal.pipeline_stage);
          const addr = isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address;
          return (
            <button
              key={deal.id}
              onClick={() => onDealClick(deal)}
              className="flex-shrink-0 w-[200px] text-left rounded-xl p-3 bg-[#1A1A1A] border border-[#F59E0B]/25"
            >
              <p className="text-[12px] font-semibold text-[#FAFAFA]/90 truncate">{addr}</p>
              <p className={`text-[12px] font-semibold mt-1 truncate ${step.color}`}>{step.label}</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-1 uppercase tracking-wide">
                {STAGE_SHORT[stage] || stage}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}