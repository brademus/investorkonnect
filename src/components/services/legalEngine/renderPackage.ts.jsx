import { evaluateRules, EvaluationInput } from './evaluateRules';
import { assembleMaster, MasterInput } from './assembleMaster';
import { assembleAddendum, AddendumInput } from './assembleAddendum';
import { buildExhibitA, ExhibitAInput } from './buildExhibitA';

export interface RenderPackageInput {
  // Deal info
  deal: {
    property_address: string;
    city: string;
    state: string;
    zip: string;
    property_type: string;
  };
  // Parties
  investor: {
    name: string;
    email: string;
    status: 'LICENSED' | 'UNLICENSED';
    deal_count_last_365: number;
  };
  agent: {
    name: string;
    email: string;
    license_number: string;
  };
  // Terms
  transaction_type: 'ASSIGNMENT' | 'DOUBLE_CLOSE';
  exhibit_a: ExhibitAInput;
}

export interface RenderPackageResult {
  success: boolean;
  error?: string;
  master_md?: string;
  addendum_md?: string;
  full_md?: string;
  evaluation?: any;
  exhibit_a_terms?: any;
}

export function renderPackage(input: RenderPackageInput): RenderPackageResult {
  try {
    // Step 1: Evaluate rules
    const evaluationInput: EvaluationInput = {
      governing_state: input.deal.state,
      property_zip: input.deal.zip,
      transaction_type: input.transaction_type,
      investor_status: input.investor.status,
      deal_count_last_365: input.investor.deal_count_last_365
    };
    
    const evaluation = evaluateRules(evaluationInput);
    
    if (!evaluation.success) {
      return {
        success: false,
        error: evaluation.error
      };
    }
    
    // Step 2: Build Exhibit A
    const exhibitResult = buildExhibitA(input.exhibit_a, evaluation);
    
    if (exhibitResult.error) {
      return {
        success: false,
        error: exhibitResult.error
      };
    }
    
    const exhibit_a_json = JSON.stringify(exhibitResult.terms, null, 2);
    
    // Step 3: Assemble Master
    const masterInput: MasterInput = {
      agreement_date: new Date().toLocaleDateString(),
      investor_name: input.investor.name,
      investor_email: input.investor.email,
      agent_name: input.agent.name,
      agent_email: input.agent.email,
      agent_license: input.agent.license_number,
      property_address: input.deal.property_address,
      property_city: input.deal.city,
      property_state: input.deal.state,
      property_zip: input.deal.zip,
      transaction_type: input.transaction_type,
      agreement_length_days: input.exhibit_a.agreement_length_days,
      termination_notice_days: input.exhibit_a.termination_notice_days,
      governing_state: input.deal.state
    };
    
    const master_md = assembleMaster(masterInput);
    
    // Step 4: Assemble Addendum
    const addendumInput: AddendumInput = {
      evaluation,
      property_address: input.deal.property_address,
      property_city: input.deal.city,
      property_state: input.deal.state,
      property_zip: input.deal.zip,
      exhibit_a_json
    };
    
    const addendum_md = assembleAddendum(addendumInput);
    
    // Step 5: Combine
    const full_md = `${master_md}\n\n---\n\n${addendum_md}`;
    
    return {
      success: true,
      master_md,
      addendum_md,
      full_md,
      evaluation,
      exhibit_a_terms: exhibitResult.terms
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}