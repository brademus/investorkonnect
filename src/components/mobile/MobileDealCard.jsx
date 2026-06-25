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
        className="rounded-xl p-3"
        style={{
          background: "linear-gradient(180deg, #151518 0%, #111114 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.30)"
        }}
        onClick={() => onDealClick(deal)}
      >
        {/* Line 1: Address + days */}
        <div className="flex justify-between items-start gap-2 mb-1">
          <h4 className="font-semibold text-[13px] leading-tight text-[#FAFAFA]/90 line-clamp-1 flex-1">
            {isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address}
          </h4>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.42)]">
            {getDaysInPipeline(deal.created_date)}
          </span>
        </div>

        {/* Line 2: Price · Comp · Badge (all inline) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-[11px]">
          {isAgent
            ? deal.estimated_list_price > 0 && <span className="text-[#2D8A6E] font-semibold">${deal.estimated_list_price.toLocaleString()}</span>
            : deal.budget > 0 && <span className="text-[#2D8A6E] font-semibold">${deal.budget.toLocaleString()}</span>
          }
          {comp && <span className="text-[#E3C567] font-semibold">· {comp}</span>}
          {badge && <span className={`text-[10px] border px-1.5 py-0 rounded-full leading-[14px] ${badge.className}`}>{badge.label}</span>}
        </div>

        {/* Line 3: Next step (only if present, no extra box) */}
        {step && (
          <div className="flex items-center justify-between mb-2 text-[11px]">
            <span className="text-[rgba(255,255,255,0.42)]">Next:</span>
            <span className={`font-semibold ${step.color} truncate ml-2`}>{step.label}</span>
          </div>
        )}

        {/* Footer: action buttons (44px tall — touch target floor) */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            onClick={() => onDealClick(deal)}
            disabled={navigating}
            className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-lg text-xs font-semibold min-h-[44px] py-0"
          >
            {navigating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Open
          </Button>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="More actions"
            className="w-11 min-h-[44px] flex items-center justify-center rounded-lg bg-[#1F1F1F] border border-[rgba(255,255,255,0.06)] flex-shrink-0"
          >
            <MoreHorizontal className="w-4 h-4 text-[#808080]" />
          </button>
        </div>

        {/* Inline review form for completed deals */}
        {isCompleted && isInvestor && (
          <div className="mt-2">
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
          <div className="mt-2">
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
              className="w-full min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-[#E3C567]" />
              Move to {s.label}
            </button>
          ))}
          {isInvestor && !isViewerOnly && currentStage === "new_deals" && (
            <button
              onClick={() => { setSheetOpen(false); onEditDeal(deal); }}
              className="w-full min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors"
            >
              <Pencil className="w-4 h-4 text-[#60A5FA]" />
              Edit Deal
            </button>
          )}
          <button
            onClick={() => setSheetOpen(false)}
            className="w-full min-h-[44px] px-4 py-3 rounded-xl text-sm text-[#808080] hover:bg-[#1F1F1F] transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </MobileBottomSheet>
    </>
  );
}