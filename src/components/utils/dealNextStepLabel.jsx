import { normalizeStage } from "@/components/pipelineStages";

/**
 * Returns a short next-step label for a deal card based on its progress.
 * Mirrors the logic in DealNextStepCTA but returns just a string + color.
 *
 * @param {object} opts
 * @param {object} opts.deal - merged deal object from pipeline
 * @param {boolean} opts.isAgent
 * @param {boolean} opts.isInvestor
 * @returns {{ label: string, color: string } | null}
 */
export function getDealNextStepLabel({ deal, isAgent, isInvestor }) {
  const stage = normalizeStage(deal?.pipeline_stage);
  const isSigned = deal?.is_fully_signed;

  if (stage === 'new_deals') {
    if (!isSigned) return { label: 'Agreement needs signing', color: 'text-[#F59E0B]' };
    return { label: 'Waiting for counterparty signature', color: 'text-[#808080]' };
  }

  if (stage === 'connected_deals') {
    const wtSlots = (deal?.walkthrough_slots || []).filter(s => s.date && s.date.length >= 8);
    const wtConfirmed = !!deal?.walkthrough_confirmed_slot;
    const effectiveWtStatus = wtConfirmed ? 'SCHEDULED' : (wtSlots.length > 0 ? 'PROPOSED' : 'NOT_SET');

    if (effectiveWtStatus === 'NOT_SET' || effectiveWtStatus === 'CANCELED' || !effectiveWtStatus) {
      if (isInvestor) return { label: 'Schedule walkthrough', color: 'text-[#E3C567]' };
      return { label: 'Waiting for walkthrough to be scheduled', color: 'text-[#808080]' };
    }

    if (effectiveWtStatus === 'PROPOSED') {
      if (isAgent) return { label: 'Confirm walkthrough date & time', color: 'text-[#E3C567]' };
      return { label: 'Waiting for agent to confirm date & time', color: 'text-[#808080]' };
    }

    if (effectiveWtStatus === 'SCHEDULED' || effectiveWtStatus === 'COMPLETED') {
      const hasCma = !!(deal?.documents?.cma?.url);
      if (!hasCma) {
        if (isAgent) return { label: 'Upload CMA', color: 'text-[#E3C567]' };
        return { label: 'Waiting for agent to upload CMA', color: 'text-[#808080]' };
      }
      return { label: 'Confirm property listed', color: 'text-[#E3C567]' };
    }
  }

  if (stage === 'active_listings') {
    const hasBuyerContract = !!(deal?.documents?.buyer_contract?.url);
    if (!hasBuyerContract) {
      if (isAgent) return { label: "Upload buyer's contract", color: 'text-[#E3C567]' };
      return { label: "Waiting for buyer's contract", color: 'text-[#808080]' };
    }
    return { label: 'Move to closing', color: 'text-[#E3C567]' };
  }

  if (stage === 'in_closing') {
    return { label: 'Pending close', color: 'text-[#F59E0B]' };
  }

  if (stage === 'completed') {
    return { label: 'Deal complete', color: 'text-[#10B981]' };
  }

  if (stage === 'canceled') {
    return { label: 'Canceled', color: 'text-red-400' };
  }

  return null;
}