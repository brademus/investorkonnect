import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ArrowRight, Pencil, Loader2 } from "lucide-react";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { getSellerCompLabel } from "@/components/utils/dealCompDisplay";
import { getDealNextStepLabel } from "@/components/utils/dealNextStepLabel";
import { normalizeStage, stageOrder } from "@/components/pipelineStages";
import MobileBottomSheet from "./MobileBottomSheet";
import InlineReviewForm from "@/components/room/InlineReviewForm";
import InlineAgentReviewForm from "@/components/room/InlineAgentReviewForm";
import { toast } from "sonner";

function getDaysInPipeline(d) {
  if (!d) return "N/A";
  return `${Math.floor((new Date() - new Date(d)) / 86400000)}d`;
}

export default function MobileDealCard({
  deal, profile, isAgent, isInvestor, isViewerOnly, wtStatusMap, navigating,
  onDealClick, onStageChange, onEditDeal, pipelineStages
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentStage = normalizeStage(deal.pipeline_stage);

  const exhibitTerms = deal.agreement_exhibit_a_terms || deal.agreement?.exhibit_a_terms || null;
  const comp = getSellerCompLabel(exhibitTerms, deal.proposed_terms);
  const badge = getAgreementStatusLabel({
    room: { agreement_status: deal.agreement_status, is_fully_signed: deal.is_fully_signed, investor_signed_at: deal.investor_signed_at, agreement: deal.agreement },
    agreement: deal.agreement || undefined,
    negotiation: deal.pending_counter_offer ? { status: deal.pending_counter_offer.from_role === "agent" ? "COUNTERED_BY_AGENT" : "COUNTERED_BY_INVESTOR", last_actor: deal.pending_counter_offer.from_role } : undefined,
    role: isAgent ? "agent" : "investor"
  });

  const wtInfo = wtStatusMap[deal.deal_id] || null;
  const step = getDealNextStepLabel({
    deal, isAgent, isInvestor,
    wtStatus: wtInfo?.status || wtInfo || null,
    wtProposedByProfileId: wtInfo?.updatedBy || null,
    myProfileId: profile?.id,
    isSigned: deal.is_fully_signed
  });

  // Compute valid stages to move to
  const getValidMoveStages = () => {
    return (pipelineStages || []).filter(s => {
      if (s.id === currentStage) return false;
      if (currentStage !== "new_deals" && s.id === "new_deals") return false;
      if (currentStage === "new_deals" && !deal.is_fully_signed) return false;
      if (!deal.is_fully_signed && stageOrder(s.id) >= stageOrder("connected_deals")) return false;
      return true;
    });
  };

  const handleMove = async (stageId) => {
    setSheetOpen(false);
    await onStageChange(deal.id, stageId);
  };

  const isCompleted = currentStage === "completed" || deal.pipeline_stage === "canceled";

  return (
    <>
      <div
        className="rounded-2xl p-4 min-h-[100px]"
        style={{
          background: "linear-gradient(180deg, #151518 0%, #111114 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.40)"
        }}
        onClick={() => onDealClick(deal)}
      >
        {/* Line 1: Address */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h4 className="font-semibold text-sm text-[#FAFAFA]/90 line-clamp-2">
            {isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address}
          </h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.42)]">
            {getDaysInPipeline(deal.created_date)}
          </span>
        </div>

        {/* Line 2: Price + comp */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {isAgent
            ? deal.estimated_list_price > 0 && <span className="text-xs text-[#2D8A6E] font-semibold">${deal.estimated_list_price.toLocaleString()}</span>
            : deal.budget > 0 && <span className="text-xs text-[#2D8A6E] font-semibold">${deal.budget.toLocaleString()}</span>
          }
          {comp && <span className="text-xs text-[#E3C567] font-semibold">Agent Comp: {comp}</span>}
        </div>

        {/* Line 3: Agreement badge */}
        {badge && <span className={`text-[10px] border px-2 py-0.5 rounded-full inline-block mb-2 ${badge.className}`}>{badge.label}</span>}

        {/* Line 4: Next step */}
        {step && (
          <div className="flex items-center justify-between rounded-lg p-2 mb-3" style={{ background: "rgba(10,10,14,0.60)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-[10px] font-medium text-[rgba(255,255,255,0.42)]">Next Steps</span>
            <span className={`text-xs font-semibold ${step.color}`}>{step.label}</span>
          </div>
        )}

        {/* Footer: buttons */}
        <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} onClick={(e) => e.stopPropagation()}>
          <Button
            onClick={() => onDealClick(deal)}
            size="sm"
            disabled={navigating}
            className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-[12px] text-xs py-2 h-auto"
          >
            {navigating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Open Deal Room
          </Button>
          <button
            onClick={() => setSheetOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1F1F1F] border border-[rgba(255,255,255,0.06)]"
          >
            <MoreHorizontal className="w-4 h-4 text-[#808080]" />
          </button>
        </div>

        {/* Inline review form for completed deals */}
        {isCompleted && isInvestor && (
          <div className="mt-3">
            <InlineReviewForm
              dealId={deal.deal_id}
              agentProfileId={deal.locked_agent_id || deal.room_agent_ids?.[0]}
              reviewerProfileId={profile?.id}
              onSubmitted={() => {}}
              compact={true}
            />
          </div>
        )}
        {isCompleted && isAgent && deal.investor_id && (
          <div className="mt-3">
            <InlineAgentReviewForm
              dealId={deal.deal_id}
              investorProfileId={deal.investor_id}
              reviewerProfileId={profile?.id}
              onSubmitted={() => {}}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Bottom sheet for overflow actions */}
      <MobileBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Deal Actions">
        <div className="space-y-1">
          {getValidMoveStages().map((s) => (
            <button
              key={s.id}
              onClick={() => handleMove(s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-[#E3C567]" />
              Move to {s.label}
            </button>
          ))}
          {isInvestor && !isViewerOnly && currentStage === "new_deals" && (
            <button
              onClick={() => { setSheetOpen(false); onEditDeal(deal); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors"
            >
              <Pencil className="w-4 h-4 text-[#60A5FA]" />
              Edit Deal
            </button>
          )}
          <button
            onClick={() => setSheetOpen(false)}
            className="w-full px-4 py-3 rounded-xl text-sm text-[#808080] hover:bg-[#1F1F1F] transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </MobileBottomSheet>
    </>
  );
}