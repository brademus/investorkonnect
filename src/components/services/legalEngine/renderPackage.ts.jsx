import { loadLegalPack } from './loadPack';
import { evaluateRules, EvaluationInput } from './evaluateRules';
import { assembleAddendum } from './assembleAddendum';
import { assembleMaster } from './assembleMaster';
import { buildExhibitA, ExhibitAInput } from './buildExhibitA';

export interface RenderInput {
  deal: {
    property_address: string;
    city: string;
    state: string;
    zip: string;
    property_type: string;
  };
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
  transaction_type: string;
  exhibit_a: ExhibitAInput;
}

export interface RenderResult {
  success: boolean;
  error?: string;
  full_md?: string;
  master_md?: string;
  addendum_md?: string;
  evaluation?: any;
  exhibit_a_terms?: any;
}

/**
 * Orchestrates full contract package rendering
 * Returns Master + Addendum markdown
 */
export function renderPackage(input: RenderInput): RenderResult {
  try {
    const pack = loadLegalPack();
    
    // Step 1: Evaluate rules
    const evalInput: EvaluationInput = {
      governing_state: input.deal.state,
      property_zip: input.deal.zip,
      transaction_type: input.transaction_type,
      property_type: input.deal.property_type,
      investor_status: input.investor.status,
      deal_count_last_365: input.investor.deal_count_last_365
    };
    
    const evaluation = evaluateRules(evalInput);
    
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
    
    // Step 3: Assemble Master Agreement
    const masterMd = assembleMaster({
      investor_name: input.investor.name,
      investor_email: input.investor.email,
      agent_name: input.agent.name,
      agent_email: input.agent.email,
      agent_license: input.agent.license_number,
      effective_date: new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    });
    
    // Step 4: Assemble State Addendum
    const addendumMd = assembleAddendum({
      evaluation,
      property_address: input.deal.property_address,
      property_city: input.deal.city,
      property_state: input.deal.state,
      property_zip: input.deal.zip,
      exhibit_a_json: JSON.stringify(exhibitResult.terms, null, 2)
    });
    
    // Step 5: Combine
    const fullMd = `${masterMd}\n\n---\n\n${addendumMd}`;
    
    return {
      success: true,
      full_md: fullMd,
      master_md: masterMd,
      addendum_md: addendumMd,
      evaluation,
      exhibit_a_terms: exhibitResult.terms
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to render package'
    };
  }
}