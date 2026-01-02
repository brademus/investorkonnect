import { loadLegalPack } from './loadPack';
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

/**
 * Deterministic rule evaluation following strict precedence:
 * 1. Input validation
 * 2. Deep Dive Checks (IL hard block, etc.)
 * 3. Local Overlays (ZIP → City)
 * 4. State Defaults
 */
export function evaluateRules(input: EvaluationInput): EvaluationResult {
  const pack = loadLegalPack();
  const validation_errors: string[] = [];
  
  // STEP 1: Input Validation
  if (!input.governing_state) {
    validation_errors.push('Cannot generate agreement: missing property state');
  }
  if (!input.property_zip) {
    validation_errors.push('Cannot generate agreement: missing property ZIP code');
  }
  if (!input.transaction_type) {
    validation_errors.push('Cannot generate agreement: missing transaction type');
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
  
  // STEP 2: Deep Dive Checks (Hard Blocks)
  // IL hard block: unlicensed + pattern of business
  if (input.governing_state === 'IL' && 
      input.investor_status === 'UNLICENSED' && 
      input.deal_count_last_365 > 1) {
    return {
      success: false,
      error: pack.config.hard_blocks.IL_UNLICENSED_PATTERN.message,
      selected_rule_id: '',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      city_overlay,
      net_policy
    };
  }
  
  // STEP 3: Determine Deep Dive Modules (by trigger conditions)
  const deep_dive_module_ids: string[] = [];
  
  Object.entries(pack.modules.modules).forEach(([moduleId, module]) => {
    if (module.trigger.type === 'state' && module.trigger.value === input.governing_state) {
      deep_dive_module_ids.push(moduleId);
    }
    // Future: add other trigger types (city, property_type, etc.)
  });
  
  // STEP 4: Build deterministic rule_id
  // Format: STATE_TRANSTYPE_OVERLAY (if overlay exists)
  let selected_rule_id = `${input.governing_state}_${input.transaction_type}`;
  if (city_overlay) {
    selected_rule_id += `_${city_overlay}`;
  }
  
  // STEP 5: Select Clauses by Category
  const selected_clause_ids: Record<string, string[]> = {
    A: [],
    B: [],
    C: [],
    E: [],
    G: [],
    H: [],
    J: []
  };
  
  // Evaluate each clause's dependencies
  Object.entries(pack.clauses.clauses).forEach(([clauseId, clause]) => {
    let include = true;
    
    // Check dependencies
    for (const dep of clause.dependencies) {
      if (dep.type === 'state' && dep.value !== input.governing_state) {
        include = false;
      }
      if (dep.type === 'city' && dep.value !== city_overlay) {
        include = false;
      }
    }
    
    if (include) {
      const category = clause.category;
      if (!selected_clause_ids[category]) {
        selected_clause_ids[category] = [];
      }
      selected_clause_ids[category].push(clauseId);
    }
  });
  
  // Add mandatory base clauses
  if (!selected_clause_ids.A.includes('A_AGENCY_STD')) {
    selected_clause_ids.A.push('A_AGENCY_STD');
  }
  if (!selected_clause_ids.A.includes('A_TRANS_BROKER')) {
    selected_clause_ids.A.push('A_TRANS_BROKER');
  }
  
  // Add appropriate net policy clause
  if (net_policy === 'BANNED') {
    selected_clause_ids.B.push('B_NET_BANNED');
  } else if (net_policy === 'RESTRICTED') {
    selected_clause_ids.B.push('B_NET_RESTR');
  } else {
    selected_clause_ids.B.push('B_NET_STD');
  }
  
  // Add standard clauses
  if (!selected_clause_ids.C.includes('C_EQ_INT_STD')) {
    selected_clause_ids.C.push('C_EQ_INT_STD');
  }
  if (!selected_clause_ids.E.includes('E_LIST_REQ')) {
    selected_clause_ids.E.push('E_LIST_REQ');
  }
  if (!selected_clause_ids.E.includes('E_BROKER_ACK')) {
    selected_clause_ids.E.push('E_BROKER_ACK');
  }
  if (!selected_clause_ids.G.includes('G_NO_SELLER')) {
    selected_clause_ids.G.push('G_NO_SELLER');
  }
  if (!selected_clause_ids.H.includes('H_PAY_BROKER')) {
    selected_clause_ids.H.push('H_PAY_BROKER');
  }
  
  return {
    success: true,
    selected_rule_id,
    selected_clause_ids,
    deep_dive_module_ids,
    city_overlay,
    net_policy
  };
}