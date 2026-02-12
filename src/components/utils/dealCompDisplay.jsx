// Deal price and compensation display helper (UI-only)

const formatUsd = (val) => {
  if (val == null || isNaN(Number(val))) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(val));
};

function extractCompFromTerms(terms, side = 'buyer') {
  if (!terms) return null;

  // New schema: terms.compensation { mode: 'FLAT_FEE'|'PERCENTAGE'|'NET_SPREAD', value: number }
  const comp = terms.compensation;
  if (comp && typeof comp === 'object') {
    const mode = String(comp.mode || '').toUpperCase();
    const val = comp.value;
    if (mode === 'PERCENTAGE' && val != null) return `${Number(val)}%`;
    if (mode === 'FLAT_FEE' && val != null) return formatUsd(val);
    if (mode === 'NET_SPREAD' && val != null) return formatUsd(val);
  }

  // Legacy Deal/Room proposed_terms shape
  const commType = terms[`${side}_commission_type`];
  const commPct = terms[`${side}_commission_percentage`];
  const flatFee = terms[`${side}_flat_fee`];

  if ((commType === 'percentage' || commType === 'flat_fee') && commPct != null && commType === 'percentage') {
    return `${commPct}%`;
  }
  if ((commType === 'flat' || commType === 'flat_fee') && flatFee != null) {
    return formatUsd(flatFee) || null;
  }
  // Fallback: percentage without explicit type
  if (commPct != null && !commType) {
    return `${commPct}%`;
  }

  // Negotiation shape
  const compType = terms[`${side}_comp_type`];
  const compAmount = terms[`${side}_comp_amount`];
  if (compType === 'percentage' && compAmount != null) {
    return `${compAmount}%`;
  }
  if (compType === 'flat' && compAmount != null) {
    return formatUsd(compAmount) || null;
  }
  return null;
}

export function getPriceAndComp({ deal, room, negotiation, side = 'buyer', agentId } = {}) {
  const price = (deal?.purchase_price ?? deal?.budget ?? room?.budget);
  const priceLabel = price != null ? formatUsd(price) : null;

  let comp = null;

  // Priority 1: Agent-specific terms from room.agent_terms (set by accepted counter offers)
  if (agentId && room?.agent_terms?.[agentId]) {
    comp = extractCompFromTerms(room.agent_terms[agentId], side);
  }
  // Priority 1b: If only one agent has custom terms, use those
  if (!comp && room?.agent_terms) {
    const agentIds = Object.keys(room.agent_terms);
    if (agentIds.length === 1) {
      comp = extractCompFromTerms(room.agent_terms[agentIds[0]], side);
    }
  }

  comp = comp || extractCompFromTerms(room?.proposed_terms, side);
  comp = comp || extractCompFromTerms(deal?.proposed_terms, side);
  comp = comp || extractCompFromTerms(negotiation?.current_terms, side);
  comp = comp || extractCompFromTerms(negotiation?.last_proposed_terms, side);

  return { priceLabel, compLabel: comp };
}

export default { getPriceAndComp };