import { loadLegalPack } from './loadPack';
import { resolveOverlay } from './resolveOverlay';

export interface EvaluationInput {
  governing_state: string;
  property_zip: string;
  transaction_type: string;
  investor_status: 'LICENSED' | 'UNLICENSED';
  deal_count_last_365: number;
}

export interface EvaluationResult {
  success: boolean;
  error?: string;
  selected_rule_id: string;
  selected_clause_ids: Record<string, string[]>;
  deep_dive_module_ids: string[];
  city_overlay: string | null;
  net_policy: 'BANNED' | 'RESTRICTED' | 'ALLOWED';
}

export function evaluateRules(input: EvaluationInput): EvaluationResult {
  const pack = loadLegalPack();
  const city_overlay = resolveOverlay(input.property_zip);
  
  // Step 1: Deep Dive Checks (Hard Blocks)
  // Illinois hard block
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
      net_policy: 'BANNED'
    };
  }
  
  // Step 2: Determine Deep Dive Modules
  const deep_dive_module_ids: string[] = [];
  
  Object.entries(pack.modules.modules).forEach(([moduleId, module]) => {
    if (module.trigger.type === 'state' && module.trigger.value === input.governing_state) {
      deep_dive_module_ids.push(moduleId);
    }
  });
  
  // Step 3: Select Clauses
  const selected_clause_ids: Record<string, string[]> = {
    A: [],
    B: [],
    C: [],
    E: [],
    G: [],
    H: [],
    J: []
  };
  
  // Evaluate each clause
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
      selected_clause_ids[clause.category] = selected_clause_ids[clause.category] || [];
      selected_clause_ids[clause.category].push(clauseId);
    }
  });
  
  // Add default clauses
  if (!selected_clause_ids.A.includes('A_AGENCY_STD')) {
    selected_clause_ids.A.push('A_AGENCY_STD');
  }
  if (!selected_clause_ids.A.includes('A_TRANS_BROKER')) {
    selected_clause_ids.A.push('A_TRANS_BROKER');
  }
  
  // Net policy determination
  const net_policy = pack.config.net_policy_by_state[input.governing_state] || 'ALLOWED';
  
  // Add appropriate net clause
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
  selected_clause_ids.E.push('E_LIST_REQ', 'E_BROKER_ACK');
  selected_clause_ids.G.push('G_NO_SELLER');
  selected_clause_ids.H.push('H_PAY_BROKER');
  
  return {
    success: true,
    selected_rule_id: `RULE_${input.governing_state}_${input.transaction_type}`,
    selected_clause_ids,
    deep_dive_module_ids,
    city_overlay,
    net_policy
  };
}