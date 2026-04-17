import React, { useState } from "react";
import { Plus, HelpCircle, FileText } from "lucide-react";
import MobileStageSwitcher from "./MobileStageSwitcher";
import MobileDealCard from "./MobileDealCard";
import NotificationBell from "@/components/NotificationBell";
import MessagesBell from "@/components/MessagesBell";
import SetupChecklist from "@/components/SetupChecklist";
import TeamInviteBanner from "@/components/team/TeamInviteBanner";
import { createPageUrl } from "@/components/utils";
import { useNavigate } from "react-router-dom";

export default function MobilePipeline({
  deals, dealsByStage, pipelineStages, profile,
  isAgent, isInvestor, isViewerOnly, wtStatusMap, navigating,
  onDealClick, onStageChange, onNewDeal, onOpenHelp, setupDone
}) {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState(pipelineStages[0]?.id || "new_deals");
  const stageDeals = dealsByStage.get(activeStage) || [];
  const activeStageObj = pipelineStages.find(s => s.id === activeStage);

  return (
    <div className="flex flex-col min-h-screen px-3 pt-2 pb-24">
      {/* Top bar — compact */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-base font-bold text-[#E3C567]" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Dashboard
        </h1>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <MessagesBell />
          {isInvestor && !isViewerOnly && (
            <button
              onClick={onNewDeal}
              aria-label="New Deal"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3C567]"
            >
              <Plus className="w-4 h-4 text-black" />
            </button>
          )}
        </div>
      </div>

      {/* Team invite banner */}
      <TeamInviteBanner />

      {/* Setup checklist */}
      {!setupDone && <div className="mb-4"><SetupChecklist profile={profile} /></div>}

      {/* Stage switcher */}
      <div className="mb-3">
        <MobileStageSwitcher
          stages={pipelineStages}
          activeStageId={activeStage}
          dealsByStage={dealsByStage}
          onStageSelect={setActiveStage}
        />
      </div>

      {/* Deal list */}
      <div className="flex-1 space-y-2">
        {stageDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-[rgba(255,255,255,0.15)] mb-3" />
            <p className="text-sm text-[rgba(255,255,255,0.35)]">
              No deals in {activeStageObj?.label || "this stage"}
            </p>
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