import { loadLegalPack } from './loadPack';

export interface MasterInput {
  agreement_date: string;
  investor_name: string;
  investor_email: string;
  agent_name: string;
  agent_email: string;
  agent_license: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  transaction_type: string;
  agreement_length_days: number;
  termination_notice_days: number;
  governing_state: string;
  investor_signed_date?: string;
  agent_signed_date?: string;
}

export function assembleMaster(input: MasterInput): string {
  const pack = loadLegalPack();
  let master = pack.templates.master_template;
  
  // Replace all placeholders
  Object.entries(input).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    master = master.replace(new RegExp(placeholder, 'g'), String(value || ''));
  });
  
  return master;
}