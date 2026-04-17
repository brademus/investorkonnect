import { loadLegalPackSync } from './loadPack';
import { EvaluationResult } from './evaluateRules';

export interface AddendumInput {
  evaluation: EvaluationResult;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  exhibit_a_json: string;
}

export function assembleAddendum(input: AddendumInput): string {
  const pack = loadLegalPackSync();
  let chassis = pack.templates.addendum_chassis;
  
  // Replace placeholders
  chassis = chassis.replace(/\{\{governing_state\}\}/g, input.property_state);
  chassis = chassis.replace(/\{\{property_address\}\}/g, input.property_address);
  chassis = chassis.replace(/\{\{property_city\}\}/g, input.property_city);
  chassis = chassis.replace(/\{\{property_state\}\}/g, input.property_state);
  chassis = chassis.replace(/\{\{property_zip\}\}/g, input.property_zip);
  chassis = chassis.replace(/\{\{exhibit_a_json\}\}/g, input.exhibit_a_json);
  
  // Build clause sections
  const catA = buildClauseSection(input.evaluation.selected_clause_ids.A || [], pack);
  const catBH = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.B || []),
    ...(input.evaluation.selected_clause_ids.H || [])
  ], pack);
  const catCG = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.C || []),
    ...(input.evaluation.selected_clause_ids.G || [])
  ], pack);
  const catDEJ = buildClauseSection([
    ...(input.evaluation.selected_clause_ids.E || []),
    ...(input.evaluation.selected_clause_ids.J || [])
  ], pack);
  
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_A}}', catA);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_B_H}}', catBH);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_C_G}}', catCG);
  chassis = chassis.replace('{{INSERT_CLAUSE_CATEGORY_D_E_J}}', catDEJ);
  
  // Deep dive injection
  let deepDiveText = '';
  if (input.evaluation.deep_dive_module_ids.length > 0) {
    const modules = pack.modules?.modules || {};
    const sectionMap: Record<string, string> = {};
    
    input.evaluation.deep_dive_module_ids.forEach(moduleId => {
      const module = modules[moduleId];
      if (module?.injections) {
        module.injections.forEach((inj: any) => {
          if (!sectionMap[inj.target]) sectionMap[inj.target] = '';
          sectionMap[inj.target] += `\n${inj.content}\n`;
        });
      }
    });
    
    deepDiveText = '\n---\n\n## STATE-SPECIFIC PROVISIONS\n';
    if (sectionMap.section_5) {
      deepDiveText += `\n${sectionMap.section_5}`;
    }
    if (sectionMap.section_6) {
      deepDiveText += `\n${sectionMap.section_6}`;
    }
    if (sectionMap.section_7) {
      deepDiveText += `\n${sectionMap.section_7}`;
    }
  }
  
  chassis = chassis.replace('{{INSERT_DEEP_DIVE_MODULES}}', deepDiveText);
  
  return chassis;
}

function buildClauseSection(clauseIds: string[], pack: any): string {
  const clauses = pack.clauses?.clauses || {};
  return clauseIds
    .map(id => {
      const clause = clauses[id];
      return clause ? `**${clause.title}:** ${clause.text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}