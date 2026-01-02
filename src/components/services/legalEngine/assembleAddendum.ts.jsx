import { loadLegalPack } from './loadPack';
import { EvaluationResult } from './evaluateRules';

export interface AddendumInput {
  evaluation: EvaluationResult;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  exhibit_a_json: string;
}

/**
 * Assembles the State Addendum with proper section injection/replacement
 * Deep dive modules REPLACE or INJECT into specific sections, not append
 */
export function assembleAddendum(input: AddendumInput): string {
  const pack = loadLegalPack();
  let chassis = pack.templates.addendum_chassis;
  
  // Replace property placeholders
  chassis = chassis.replace(/\{\{governing_state\}\}/g, input.property_state);
  chassis = chassis.replace(/\{\{property_address\}\}/g, input.property_address);
  chassis = chassis.replace(/\{\{property_city\}\}/g, input.property_city);
  chassis = chassis.replace(/\{\{property_state\}\}/g, input.property_state);
  chassis = chassis.replace(/\{\{property_zip\}\}/g, input.property_zip);
  chassis = chassis.replace(/\{\{exhibit_a_json\}\}/g, input.exhibit_a_json);
  
  // Build clause text sections
  const categoryA = buildClauseSection(input.evaluation.selected_clause_ids.A || [], pack);
  const categoryBH = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.B || []),
    ...(input.evaluation.selected_clause_ids.H || [])
  ], pack);
  const categoryCG = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.C || []),
    ...(input.evaluation.selected_clause_ids.G || [])
  ], pack);
  const categoryDEJ = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.E || []),
    ...(input.evaluation.selected_clause_ids.J || [])
  ], pack);
  
  // Replace clause placeholders
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_A}}', categoryA);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_B_H}}', categoryBH);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_C_G}}', categoryCG);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_D_E_J}}', categoryDEJ);
  
  // Handle deep dive modules - INJECT/REPLACE specific sections
  let deepDiveText = '';
  
  if (input.evaluation.deep_dive_module_ids.length > 0) {
    const sectionReplacements: Record<string, string> = {};
    
    // Collect all injections by target section
    input.evaluation.deep_dive_module_ids.forEach(moduleId => {
      const module = pack.modules.modules[moduleId];
      if (module) {
        module.injections.forEach(injection => {
          const target = injection.target; // e.g., "section_5"
          if (!sectionReplacements[target]) {
            sectionReplacements[target] = '';
          }
          sectionReplacements[target] += `\n${injection.content}\n`;
        });
      }
    });
    
    // Build deep dive sections
    deepDiveText = '\n---\n\n## STATE-SPECIFIC PROVISIONS\n';
    
    // Section 5 (Wholesaling/IL/PA)
    if (sectionReplacements.section_5) {
      deepDiveText += `\n### Section 5: State-Specific Requirements\n\n${sectionReplacements.section_5}`;
    }
    
    // Section 6 (IL Net/NJ Attorney Review)
    if (sectionReplacements.section_6) {
      deepDiveText += `\n### Section 6: Additional Provisions\n\n${sectionReplacements.section_6}`;
    }
    
    // Section 7 (NJ Attorney Review)
    if (sectionReplacements.section_7) {
      deepDiveText += `\n### Section 7: Attorney Review Period\n\n${sectionReplacements.section_7}`;
    }
  }
  
  chassis = chassis.replace('{{INSERT_DEEP_DIVE_MODULES}}', deepDiveText);
  
  return chassis;
}

function buildClauseSection(clauseIds: string[], pack: any): string {
  return clauseIds
    .map(id => {
      const clause = pack.clauses.clauses[id];
      return clause ? `**${clause.title}:** ${clause.text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}