import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';
import { createHash } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id, exhibit_a } = await req.json();
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get deal
    const deal = await base44.asServiceRole.entities.Deal.get(deal_id);
    
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    
    // Check authorization
    if (deal.investor_id !== profile.id) {
      return Response.json({ error: 'Only the investor can generate the agreement' }, { status: 403 });
    }
    
    // Get agent profile
    const agentProfile = await base44.asServiceRole.entities.Profile.get(deal.agent_id);
    
    if (!agentProfile) {
      return Response.json({ error: 'Agent profile not found' }, { status: 404 });
    }
    
    // Input validation
    if (!deal.state) {
      return Response.json({ error: 'Cannot generate agreement: missing property state' }, { status: 400 });
    }
    
    if (!deal.zip) {
      return Response.json({ error: 'Cannot generate agreement: missing property ZIP code' }, { status: 400 });
    }
    
    // Count deals
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const investorDeals = await base44.asServiceRole.entities.Deal.filter({
      investor_id: profile.id
    });
    const recentDeals = investorDeals.filter(d => 
      new Date(d.created_date) > oneYearAgo && d.status !== 'cancelled'
    );
    
    const investor_status = profile.investor?.certification === 'licensed' ? 'LICENSED' : 'UNLICENSED';
    const deal_count = recentDeals.length;
    
    // IL hard block
    if (deal.state === 'IL' && investor_status === 'UNLICENSED' && deal_count > 1) {
      return Response.json({ 
        error: 'Illinois law prohibits unlicensed individuals from engaging in a pattern of real estate business (more than 1 transaction per year). You must obtain a real estate license to proceed.'
      }, { status: 400 });
    }
    
    // Determine net policy
    const bannedStates = ['IL', 'NY'];
    const restrictedStates = ['TX', 'CA'];
    let net_policy = 'ALLOWED';
    if (bannedStates.includes(deal.state)) net_policy = 'BANNED';
    else if (restrictedStates.includes(deal.state)) net_policy = 'RESTRICTED';
    
    // Determine city overlay
    let city_overlay = null;
    const phillyZips = ['19101', '19102', '19103', '19104', '19106', '19107'];
    if (phillyZips.includes(deal.zip) || deal.zip?.startsWith('191')) {
      city_overlay = 'PHILA';
    }
    
    // Check net policy enforcement
    if (net_policy === 'BANNED' && exhibit_a.compensation_model === 'NET_SPREAD') {
      return Response.json({ 
        error: `NET/SPREAD compensation is prohibited in ${deal.state}. Choose Flat Fee or Percentage.`
      }, { status: 400 });
    }
    
    // Build rule ID
    let selected_rule_id = `${deal.state}_${exhibit_a.transaction_type || 'ASSIGNMENT'}`;
    if (city_overlay) selected_rule_id += `_${city_overlay}`;
    
    // Build fingerprint
    const inputsFingerprint = JSON.stringify({
      version: '1.0.1',
      state: deal.state,
      zip: deal.zip,
      city_overlay,
      transaction_type: exhibit_a.transaction_type,
      property_type: deal.property_type,
      investor_status,
      deal_count,
      rule_id: selected_rule_id,
      terms: exhibit_a
    });
    
    const inputsHash = createHash('sha256').update(inputsFingerprint).digest('hex');
    
    // Check for existing agreement with same inputs
    const existingAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    
    if (existingAgreements.length > 0) {
      const existing = existingAgreements[0];
      if (existing.agreement_inputs_sha256 === inputsHash && existing.pdf_file_url) {
        return Response.json({ 
          success: true, 
          agreement: existing,
          regenerated: false
        });
      }
    }
    
    // Generate markdown
    const masterMd = generateMasterAgreement({
      investor_name: profile.full_name || user.full_name || user.email,
      investor_email: profile.email || user.email,
      agent_name: agentProfile.full_name || agentProfile.email,
      agent_email: agentProfile.email,
      agent_license: agentProfile.agent?.license_number || 'N/A',
      effective_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    });
    
    const addendumMd = generateStateAddendum({
      state: deal.state,
      property_address: deal.property_address || '',
      city: deal.city || '',
      zip: deal.zip || '',
      net_policy,
      city_overlay,
      exhibit_a_json: JSON.stringify(exhibit_a, null, 2)
    });
    
    const fullMd = `${masterMd}\n\n---\n\n${addendumMd}`;
    
    // Generate PDF
    const doc = new jsPDF();
    const lines = fullMd.split('\n');
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;
    
    for (const line of lines) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      
      if (line.startsWith('# ')) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(line.substring(2), 20, y);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        y += 10;
      } else if (line.startsWith('## ')) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(line.substring(3), 20, y);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        y += 8;
      } else if (line.trim()) {
        const splitText = doc.splitTextToSize(line, 170);
        doc.text(splitText, 20, y);
        y += splitText.length * 5;
      } else {
        y += 5;
      }
    }
    
    const pdfBytes = doc.output('arraybuffer');
    const pdf_sha256 = createHash('sha256').update(new Uint8Array(pdfBytes)).digest('hex');
    
    // Upload PDF
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    // Create/update agreement
    const agreementData = {
      deal_id,
      investor_user_id: user.id,
      agent_user_id: agentProfile.user_id,
      investor_profile_id: profile.id,
      agent_profile_id: agentProfile.id,
      governing_state: deal.state,
      property_zip: deal.zip,
      city_overlay,
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
      property_type: deal.property_type,
      investor_status,
      deal_count_last_365: deal_count,
      agreement_version: '1.0.1',
      status: 'draft',
      selected_rule_id,
      selected_clause_ids: { A: [], B: [], C: [], E: [], G: [], H: [], J: [] },
      deep_dive_module_ids: getDee pDiveModules(deal.state),
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: fullMd,
      pdf_file_url: file_url,
      pdf_sha256,
      agreement_inputs_sha256: inputsHash,
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_draft',
        details: 'Agreement draft generated'
      }]
    };
    
    let agreement;
    if (existingAgreements.length > 0) {
      agreement = await base44.asServiceRole.entities.LegalAgreement.update(
        existingAgreements[0].id,
        { ...agreementData, audit_log: [...existingAgreements[0].audit_log, ...agreementData.audit_log] }
      );
    } else {
      agreement = await base44.asServiceRole.entities.LegalAgreement.create(agreementData);
    }
    
    return Response.json({ success: true, agreement, regenerated: true });
    
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json({ error: error.message || 'Failed to generate agreement' }, { status: 500 });
  }
});

function getDe epDiveModules(state: string): string[] {
  const modules = [];
  if (state === 'IL') modules.push('IL_DEEP_DIVE');
  if (state === 'PA') modules.push('PA_DEEP_DIVE');
  if (state === 'NJ') modules.push('NJ_DEEP_DIVE');
  return modules;
}

function generateMasterAgreement(input: any): string {
  return `# INVESTOR-AGENT OPERATING AGREEMENT

**Effective Date:** ${input.effective_date}

**PARTIES:**

**Investor:** ${input.investor_name} (${input.investor_email})
**Agent:** ${input.agent_name} (${input.agent_email}) - License #${input.agent_license}

---

## 1. ENGAGEMENT
Investor engages Agent to provide real estate services for investment properties.

## 2. COMPENSATION
Agent's compensation shall be as specified in Exhibit A.

## 3. REPRESENTATIONS
Agent holds a valid real estate license. Investor has authority to enter this agreement.

## 4. GOVERNING LAW
This agreement is governed by the state specified in the State Addendum.`;
}

function generateStateAddendum(input: any): string {
  let addendum = `# STATE ADDENDUM

**Governing State:** ${input.state}
**Property:** ${input.property_address}
**City:** ${input.city}, **State:** ${input.state} **ZIP:** ${input.zip}

---

## Section 1: Scope
This addendum applies to the property and is governed by ${input.state} law.

## Section 2: Compensation
${input.net_policy === 'BANNED' ? 'Net listings are prohibited. All compensation as flat fee or percentage.' : 'Compensation as specified in Exhibit A.'}

## Section 3: Agent Obligations
Agent will obtain valid listing agreements and comply with state licensing requirements.
${input.city_overlay === 'PHILA' ? '\n**Philadelphia License**: Agent warrants active PA license for Philadelphia transactions.' : ''}

## EXHIBIT A: TERMS

\`\`\`json
${input.exhibit_a_json}
\`\`\``;

  // Add deep dive sections
  if (input.state === 'IL') {
    addendum += `\n\n---\n\n## STATE-SPECIFIC PROVISIONS

### Section 5: Illinois Wholesaling Requirements
Illinois prohibits unlicensed individuals from engaging in a pattern of real estate business (>1 transaction/year).

### Section 6: Illinois Net Listing Prohibition
Net listings are prohibited under Illinois law. All compensation as flat fee or percentage only.`;
  }
  
  if (input.state === 'PA') {
    addendum += `\n\n---\n\n## STATE-SPECIFIC PROVISIONS

### Section 5: Pennsylvania Wholesaling Notice
Assignment contracts must clearly disclose intent to assign. Good faith deposit required.`;
  }
  
  if (input.state === 'NJ') {
    addendum += `\n\n---\n\n## STATE-SPECIFIC PROVISIONS

### Section 7: New Jersey Attorney Review Period
This agreement is subject to a three (3) business day attorney review period. Either party may cancel during this period.`;
  }
  
  return addendum;
}