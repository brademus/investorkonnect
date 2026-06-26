import React, { useState, useRef } from "react";
import { Plus, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import usePullToRefresh from "./usePullToRefresh";
import MobileStageSwitcher from "./MobileStageSwitcher";
import MobileDealCard from "./MobileDealCard";
import MobileNeedsAttention from "./MobileNeedsAttention";
import NotificationBell from "@/components/NotificationBell";
import MessagesBell from "@/components/MessagesBell";
import SetupChecklist from "@/components/SetupChecklist";
import TeamInviteBanner from "@/components/team/TeamInviteBanner";
import { createPageUrl } from "@/components/utils";
import { useNavigate } from "react-router-dom";

const EMPTY_HINTS = {
  connected_deals: "Deals appear here once an agent connects.",
  active_listings: "Deals appear here once they're listed.",
  in_closing: "Deals appear here once they're closing.",
  completed: "Closed and canceled deals will appear here.",
};

export default function MobilePipeline({
  deals, dealsByStage, pipelineStages, profile,
  isAgent, isInvestor, isViewerOnly, wtStatusMap, navigating,
  onDealClick, onStageChange, onNewDeal, onOpenHelp, setupDone, refetchDeals
}) {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState(pipelineStages[0]?.id || "new_deals");
  const stageDeals = dealsByStage.get(activeStage) || [];
  const activeStageObj = pipelineStages.find(s => s.id === activeStage);

  const containerRef = useRef(null);
  const { pullDistance, refreshing } = usePullToRefresh(containerRef, refetchDeals);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen px-4 pt-3 pb-28" style={{ touchAction: 'pan-y' }}>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
          style={{ height: pullDistance }}
        >
          <Loader2
            className={`w-5 h-5 text-[#E3C567] ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(1, pullDistance / 60), transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-[#E3C567]" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Dashboard
        </h1>
        <div className="flex items-center gap-2.5">
          <NotificationBell />
          <MessagesBell />
          {isInvestor && !isViewerOnly && (
            <button
              onClick={onNewDeal}
              aria-label="New Deal"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#E3C567] active:bg-[#EDD89F] shadow-lg shadow-[#E3C567]/20"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
          )}
        </div>
      </div>

      {/* Team invite banner */}
      <TeamInviteBanner />

      {/* Setup checklist */}
      {!setupDone && <div className="mb-4"><SetupChecklist profile={profile} /></div>}

      {/* Sticky stepper — always visible while scrolling the list */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[#0c0c0e]/95 backdrop-blur-sm mb-4">
        <MobileStageSwitcher
          stages={pipelineStages}
          activeStageId={activeStage}
          dealsByStage={dealsByStage}
          onStageSelect={setActiveStage}
        />
      </div>

      {/* Needs Attention — scans all stages, hides itself when empty */}
      <MobileNeedsAttention
        deals={deals}
        profile={profile}
        isAgent={isAgent}
        isInvestor={isInvestor}
        wtStatusMap={wtStatusMap}
        onDealClick={onDealClick}
      />

      {/* Active-stage section label — separates the stage list from the amber tray above */}
      {stageDeals.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(255,255,255,0.5)]">
            {activeStageObj?.label || "Deals"}
          </span>
          <span className="text-[11px] text-[rgba(255,255,255,0.3)]">· {stageDeals.length}</span>
        </div>
      )}

      {/* Deal list */}
      <div className="flex-1 space-y-3">
        {stageDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Inbox className="w-12 h-12 text-[rgba(255,255,255,0.15)] mb-4" />
            <p className="text-base font-semibold text-[rgba(255,255,255,0.55)] mb-1">
              No deals in {activeStageObj?.label || "this stage"}
            </p>
            {activeStage === "new_deals" && isInvestor && !isViewerOnly ? (
              <>
                <p className="text-sm text-[rgba(255,255,255,0.35)] mb-5 max-w-[260px]">
                  Start your first deal to get matched with vetted, investor-friendly agents.
                </p>
                <Button
                  onClick={onNewDeal}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold min-h-[44px] px-6"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create your first deal
                </Button>
              </>
            ) : (
              <p className="text-sm text-[rgba(255,255,255,0.35)] max-w-[260px]">
                {EMPTY_HINTS[activeStage] || "No deals here yet."}
              </p>
            )}
          </div>
        ) : (
          stageDeals.map((deal) => (
            <MobileDealCard
              key={deal.id}
              deal={deal}
              profile={profile}
              isAgent={isAgent}
              isInvestor={isInvestor}
              isViewerOnly={isViewerOnly}
              wtStatusMap={wtStatusMap}
              navigating={navigating}
              onDealClick={onDealClick}
              onStageChange={onStageChange}
              onEditDeal={(d) => {
                sessionStorage.removeItem("newDealDraft");
                navigate(`${createPageUrl("NewDeal")}?dealId=${d.deal_id}`);
              }}
              pipelineStages={pipelineStages}
            />
          ))
        )}
      </div>
    </div>
  );
}