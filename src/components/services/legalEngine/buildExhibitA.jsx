export function buildExhibitA(input, evaluation, isLegacy = false) {
  const net_policy = evaluation.net_policy;
  
  let terms = { ...input };
  let converted = false;
  
  // STRICT NET POLICY ENFORCEMENT
  if (net_policy === 'BANNED' && input.compensation_model === 'NET_SPREAD') {
    if (!isLegacy) {
      const state = evaluation.selected_rule_id.split('_')[0];
      return {
        terms,
        converted: false,
        error: `NET/SPREAD compensation is prohibited in ${state}. Choose Flat Fee or Percentage.`
      };
    }
    
    // Legacy conversion
    terms.compensation_model = 'FLAT_FEE';
    terms.flat_fee_amount = input.net_target || input.flat_fee_amount || 0;
    terms.converted_from_net = true;
    converted = true;
    delete terms.net_target;
  }
  
  // Validation
  if (!terms.compensation_model || !terms.transaction_type) {
    return {
      terms,
      converted,
      error: 'Missing required fields: compensation_model and transaction_type'
    };
  }
  
  return { terms, converted };
}