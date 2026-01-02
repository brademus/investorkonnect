import { loadLegalPackSync } from './loadPack';

export interface MasterInput {
  investor_name: string;
  investor_email: string;
  agent_name: string;
  agent_email: string;
  agent_license: string;
  effective_date: string;
}

export function assembleMaster(input: MasterInput): string {
  const pack = loadLegalPackSync();
  let template = pack.templates.master_agreement;
  
  template = template.replace(/\{\{investor_name\}\}/g, input.investor_name);
  template = template.replace(/\{\{investor_email\}\}/g, input.investor_email);
  template = template.replace(/\{\{agent_name\}\}/g, input.agent_name);
  template = template.replace(/\{\{agent_email\}\}/g, input.agent_email);
  template = template.replace(/\{\{agent_license\}\}/g, input.agent_license);
  template = template.replace(/\{\{effective_date\}\}/g, input.effective_date);
  
  return template;
}