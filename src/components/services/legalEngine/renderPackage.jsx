import { evaluateRules } from './evaluateRules';
import { assembleAddendum } from './assembleAddendum';
import { assembleMaster } from './assembleMaster';
import { buildExhibitA } from './buildExhibitA';

export function renderPackage(input) {
  try {
    const evalInput = {
      governing_state: input.deal.state,
      property_zip: input.deal.zip,
      transaction_type: input.transaction_type,
      property_type: input.deal.property_type,
      investor_status: input.investor.status,
      deal_count_last_365: input.investor.deal_count_last_365
    };
    
    const evaluation = evaluateRules(evalInput);
    
    if (!evaluation.success) {
      return { success: false, error: evaluation.error };
    }
    
    const exhibitResult = buildExhibitA(input.exhibit_a, evaluation);
    
    if (exhibitResult.error) {
      return { success: false, error: exhibitResult.error };
    }
    
    const masterMd = assembleMaster({
      investor_name: input.investor.name,
      investor_email: input.investor.email,
      agent_name: input.agent.name,
      agent_email: input.agent.email,
      agent_license: input.agent.license_number,
      effective_date: new Date().toLocaleDateString('en-US', { 
        month: 'long', day: 'numeric', year: 'numeric' 
      })
    });
    
    const addendumMd = assembleAddendum({
      evaluation,
      property_address: input.deal.property_address,
      property_city: input.deal.city,
      property_state: input.deal.state,
      property_zip: input.deal.zip,
      exhibit_a_json: JSON.stringify(exhibitResult.terms, null, 2)
    });
    
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