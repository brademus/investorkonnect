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

export function buildExhibitA(
  input: ExhibitAInput,
  evaluation: EvaluationResult
): ExhibitAResult {
  const pack = loadLegalPack();
  const net_policy = evaluation.net_policy;
  
  let terms = { ...input };
  let converted = false;
  
  // Enforce net policy
  if (net_policy === 'BANNED' && input.compensation_model === 'NET_SPREAD') {
    // Convert to FLAT_FEE
    terms.compensation_model = 'FLAT_FEE';
    terms.flat_fee_amount = input.net_target || input.flat_fee_amount || 0;
    terms.converted_from_net = true;
    converted = true;
    delete terms.net_target;
  }
  
  // Validate against schema (basic validation)
  if (!terms.compensation_model || !terms.transaction_type) {
    return {
      terms,
      converted,
      error: 'Missing required fields: compensation_model and transaction_type'
    };
  }
  
  return {
    terms,
    converted
  };
}