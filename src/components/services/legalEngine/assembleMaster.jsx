import { loadLegalPackSync } from './loadPack';

export function assembleMaster(input) {
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