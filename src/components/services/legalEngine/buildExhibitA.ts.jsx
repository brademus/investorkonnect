import { loadLegalPack } from './loadPack';
import { EvaluationResult } from './evaluateRules';

export interface ExhibitAInput {
  compensation_model: 'FLAT_FEE' | 'COMMISSION_PCT' | 'NET_SPREAD';
  flat_fee_amount?: number;
  commission_percentage?: number;
  net_target?: number;
  transaction_type: string;
  buyer_commission_type?: string;
  buyer_commission_amount?: number;
  seller_commission_type?: string;
  seller_commission_amount?: number;
  agreement_length_days: number;
  termination_notice_days: number;
}

export interface ExhibitAResult {
  terms: any;
  converted: boolean;
  error?: string;
}

/**
 * Builds and validates Exhibit A terms
 * Enforces net policy: BANNED states reject NET_SPREAD (no conversion unless legacy)
 */
export function buildExhibitA(
  input: ExhibitAInput,
  evaluation: EvaluationResult,
  isLegacy = false
): ExhibitAResult {
  const pack = loadLegalPack();
  const net_policy = evaluation.net_policy;
  
  let terms = { ...input };
  let converted = false;
  
  // STRICT NET POLICY ENFORCEMENT
  if (net_policy === 'BANNED' && input.compensation_model === 'NET_SPREAD') {
    // Only allow conversion if this is explicitly legacy data
    if (!isLegacy) {
      return {
        terms,
        converted: false,
        error: `NET/SPREAD compensation is prohibited in ${evaluation.selected_rule_id.split('_')[0]}. Choose Flat Fee or Percentage.`
      };
    }
    
    // Legacy conversion path
    terms.compensation_model = 'FLAT_FEE';
    terms.flat_fee_amount = input.net_target || input.flat_fee_amount || 0;
    terms.converted_from_net = true;
    converted = true;
    delete terms.net_target;
  }
  
  // Validate required fields
  if (!terms.compensation_model || !terms.transaction_type) {
    return {
      terms,
      converted,
      error: 'Missing required fields: compensation_model and transaction_type'
    };
  }
  
  // Validate compensation amounts
  if (terms.compensation_model === 'FLAT_FEE' && !terms.flat_fee_amount) {
    return {
      terms,
      converted,
      error: 'Flat fee amount is required when using FLAT_FEE model'
    };
  }
  
  if (terms.compensation_model === 'COMMISSION_PCT' && !terms.commission_percentage) {
    return {
      terms,
      converted,
      error: 'Commission percentage is required when using COMMISSION_PCT model'
    };
  }
  
  return {
    terms,
    converted
  };
}