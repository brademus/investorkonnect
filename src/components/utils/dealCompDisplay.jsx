// Deal price and compensation display helper (UI-only)

const formatUsd = (val) => {
  if (val == null || isNaN(Number(val))) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(val));
};

function extractCompFromTerms(terms) {
  if (!terms) return null;
  // Deal/Room proposed_terms shape
  if (terms.buyer_commission_type === 'percentage' && terms.buyer_commission_percentage != null) {
    return `${terms.buyer_commission_percentage}%`;
  }
  if (terms.buyer_commission_type === 'flat' && terms.buyer_flat_fee != null) {
    const usd = formatUsd(terms.buyer_flat_fee);
    return usd || null;
  }
  // Negotiation shape
  if (terms.buyer_comp_type === 'percentage' && terms.buyer_comp_amount != null) {
    return `${terms.buyer_comp_amount}%`;
  }
  if (terms.buyer_comp_type === 'flat' && terms.buyer_comp_amount != null) {
    const usd = formatUsd(terms.buyer_comp_amount);
    return usd || null;
  }
  return null;
}

export function getPriceAndComp({ deal, room, negotiation } = {}) {
  const price = (deal?.purchase_price ?? deal?.budget ?? room?.budget);
  const priceLabel = price != null ? formatUsd(price) : null;

  let comp = null;
  comp = comp || extractCompFromTerms(deal?.proposed_terms);
  comp = comp || extractCompFromTerms(room?.proposed_terms);
  comp = comp || extractCompFromTerms(negotiation?.current_terms);
  comp = comp || extractCompFromTerms(negotiation?.last_proposed_terms);

  return { priceLabel, compLabel: comp };
}

export default { getPriceAndComp };