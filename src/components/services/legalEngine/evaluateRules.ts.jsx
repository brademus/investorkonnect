import { loadLegalPackSync } from './loadPack';
import { resolveOverlay } from './resolveOverlay';

export interface EvaluationInput {
  governing_state: string;
  property_zip: string;
  transaction_type: string;
  property_type?: string;
  investor_status: 'LICENSED' | 'UNLICENSED';
  deal_count_last_365: number;
}

export interface EvaluationResult {
  success: boolean;
  error?: string;
  validation_errors?: string[];
  selected_rule_id: string;
  selected_clause_ids: Record<string, string[]>;
  deep_dive_module_ids: string[];
  city_overlay: string | null;
  net_policy: 'BANNED' | 'RESTRICTED' | 'ALLOWED';
}

export function evaluateRules(input: EvaluationInput): EvaluationResult {
  const pack = loadLegalPackSync();
  const validation_errors: string[] = [];
  
  // Input validation
  if (!input.governing_state) {
    validation_errors.push('Cannot generate agreement: missing property state');
  }
  if (!input.property_zip) {
    validation_errors.push('Cannot generate agreement: missing property ZIP code');
  }
  
  if (validation_errors.length > 0) {
    return {
      success: false,
      validation_errors,
      error: validation_errors.join('; '),
      selected_rule_id: '',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      city_overlay: null,
      net_policy: 'BANNED'
    };
  }
  
  const city_overlay = resolveOverlay(input.property_zip);
  const net_policy = pack.config.net_policy_by_state[input.governing_state] || 'ALLOWED';
  
  // IL hard block
  if (input.governing_state === 'IL' && 
      input.investor_status === 'UNLICENSED' && 
      input.deal_count_last_365 > 1) {
    return {
      success: false,
      error: pack.config.hard_blocks?.IL_UNLICENSED_PATTERN?.message || 'IL licensing required',
      selected_rule_id: '',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      city_overlay,
      net_policy
    };
  }
  
  // Determine deep dive modules
  const deep_dive_module_ids: string[] = [];
  if (input.governing_state === 'IL') deep_dive_module_ids.push('IL_DEEP_DIVE');
  if (input.governing_state === 'PA') deep_dive_module_ids.push('PA_DEEP_DIVE');
  if (input.governing_state === 'NJ') deep_dive_module_ids.push('NJ_DEEP_DIVE');
  
  // Build rule ID
  let selected_rule_id = `${input.governing_state}_${input.transaction_type}`;
  if (city_overlay) {
    selected_rule_id += `_${city_overlay}`;
  }
  
  // Select base clauses
  const selected_clause_ids: Record<string, string[]> = {
    A: ['A_AGENCY_STD', 'A_TRANS_BROKER'],
    B: [net_policy === 'BANNED' ? 'B_NET_BANNED' : net_policy === 'RESTRICTED' ? 'B_NET_RESTR' : 'B_NET_STD'],
    C: ['C_EQ_INT_STD'],
    E: ['E_LIST_REQ', 'E_BROKER_ACK'],
    G: ['G_NO_SELLER'],
    H: ['H_PAY_BROKER'],
    J: city_overlay === 'PHILA' ? ['J_PHL_LIC'] : []
  };
  
  return {
    success: true,
    selected_rule_id,
    selected_clause_ids,
    deep_dive_module_ids,
    city_overlay,
    net_policy
  };
}