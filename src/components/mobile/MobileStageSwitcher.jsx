import React from "react";
import { ChevronRight } from "lucide-react";

/**
 * Mobile pipeline stepper — replaces the old hidden-scroll pill row.
 * Shows all stages as a chained, left-to-right funnel so the user can see:
 *  - which stage they're viewing (filled gold)
 *  - which stages come before / after (chevron connectors)
 *  - which stages actually contain deals (gold dot + non-muted treatment)
 * All segments fit the viewport (abbreviated labels), so nothing is hidden behind scroll.
 */

// Short labels so all 5 fit on a 390px screen
const SHORT_LABELS = {
  new_deals: "New",
  connected_deals: "Connected",
  active_listings: "Listed",
  in_closing: "Closing",
  completed: "Done",
  canceled: "Canceled",
};

export default function MobileStageSwitcher({ stages, activeStageId, dealsByStage, onStageSelect }) {
  const activeIndex = stages.findIndex((s) => s.id === activeStageId);
  const activeStage = stages[activeIndex];
  const activeCount = (dealsByStage.get(activeStageId) || []).length;

  return (
    <div>
      {/* Chained funnel — all segments visible, no scroll */}
      <div className="flex items-stretch">
        {stages.map((stage, idx) => {
          const count = (dealsByStage.get(stage.id) || []).length;
          const isActive = stage.id === activeStageId;
          const isBefore = idx < activeIndex;
          const hasDeals = count > 0;
          const label = SHORT_LABELS[stage.id] || stage.label;

          return (
            <React.Fragment key={stage.id}>
              <button
                onClick={() => onStageSelect(stage.id)}
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 px-0.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#E3C567] text-black"
                    : isBefore
                    ? "bg-[#E3C567]/10 text-[#E3C567]/90"
                    : hasDeals
                    ? "bg-[#1A1A1A] text-[#FAFAFA]/80 border border-[#E3C567]/30"
                    : "bg-[#161616] text-[#808080]"
                }`}
              >
                {/* gold dot advertising a populated, non-active stage */}
                {hasDeals && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                )}
                <span
                  className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[11px] font-bold px-1 ${
                    isActive
                      ? "bg-black/20 text-black"
                      : hasDeals
                      ? "bg-[#E3C567]/20 text-[#E3C567]"
                      : "bg-[#2A2A2A] text-[#808080]"
                  }`}
                >
                  {count}
                </span>
                <span className="text-[10px] font-semibold leading-none truncate max-w-full">
                  {label}
                </span>
              </button>

              {/* connector chevron between segments */}
              {idx < stages.length - 1 && (
                <div className="flex items-center justify-center px-0.5 flex-shrink-0">
                  <ChevronRight
                    className={`w-3 h-3 ${idx < activeIndex ? "text-[#E3C567]/50" : "text-[#3A3A3A]"}`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Context strip — full active stage name + count */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        <span className="text-sm font-semibold text-[#E3C567] truncate">
          {activeStage?.label || "Pipeline"}
        </span>
        <span className="text-[11px] text-[rgba(255,255,255,0.45)] flex-shrink-0 ml-2">
          {activeCount} {activeCount === 1 ? "deal" : "deals"}
        </span>
      </div>
    </div>
  );
}