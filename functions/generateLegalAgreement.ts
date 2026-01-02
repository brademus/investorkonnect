import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';
import { createHash } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { deal_id, exhibit_a } = await req.json();
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });
    
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    
    const deal = await base44.asServiceRole.entities.Deal.get(deal_id);
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });
    if (deal.investor_id !== profile.id) {
      return Response.json({ error: 'Only investor can generate' }, { status: 403 });
    }
    
    const agentProfile = await base44.asServiceRole.entities.Profile.get(deal.agent_id);
    if (!agentProfile) return Response.json({ error: 'Agent not found' }, { status: 404 });
    
    if (!deal.state || !deal.zip) {
      return Response.json({ error: 'Missing state or ZIP' }, { status: 400 });
    }
    
    // Count deals
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: profile.id });
    const recentDeals = investorDeals.filter(d => 
      new Date(d.created_date) > oneYearAgo && d.status !== 'cancelled'
    );
    
    const investor_status = profile.investor?.certification === 'licensed' ? 'LICENSED' : 'UNLICENSED';
    const deal_count = recentDeals.length;
    
    // IL hard block
    if (deal.state === 'IL' && investor_status === 'UNLICENSED' && deal_count > 1) {
      return Response.json({ 
        error: 'Illinois law prohibits unlicensed individuals from more than 1 transaction per year.'
      }, { status: 400 });
    }
    
    // Net policy
    const bannedStates = ['IL', 'NY'];
    let net_policy = 'ALLOWED';
    if (bannedStates.includes(deal.state)) net_policy = 'BANNED';
    
    if (net_policy === 'BANNED' && exhibit_a.compensation_model === 'NET_SPREAD') {
      return Response.json({ 
        error: `NET/SPREAD prohibited in ${deal.state}`
      }, { status: 400 });
    }
    
    // City overlay
    let city_overlay = null;
    const phillyZips = ['19101', '19102', '19103', '19104', '19106', '19107'];
    if (phillyZips.includes(deal.zip) || deal.zip?.startsWith('191')) {
      city_overlay = 'PHILA';
    }
    
    const selected_rule_id = `${deal.state}_${exhibit_a.transaction_type || 'ASSIGNMENT'}${city_overlay ? '_' + city_overlay : ''}`;
    
    // Check existing
    const existingAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    const inputsHash = createHash('sha256').update(JSON.stringify({
      state: deal.state, zip: deal.zip, terms: exhibit_a
    })).digest('hex');
    
    if (existingAgreements.length > 0) {
      const existing = existingAgreements[0];
      if (existing.agreement_inputs_sha256 === inputsHash && existing.pdf_file_url) {
        return Response.json({ success: true, agreement: existing, regenerated: false });
      }
    }
    
    // Generate content
    const masterMd = `# INVESTOR-AGENT OPERATING AGREEMENT

**Effective Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

**PARTIES:**
- **Investor:** ${profile.full_name || user.email} (${profile.email || user.email})
- **Agent:** ${agentProfile.full_name || agentProfile.email} (${agentProfile.email}) - License #${agentProfile.agent?.license_number || 'N/A'}

## 1. ENGAGEMENT
Investor engages Agent to provide real estate services for investment properties.

## 2. COMPENSATION
Agent's compensation shall be as specified in Exhibit A.

## 3. REPRESENTATIONS
Agent holds a valid real estate license. Investor has authority to enter this agreement.

## 4. GOVERNING LAW
This agreement is governed by ${deal.state} law.`;

    let addendumMd = `# STATE ADDENDUM - ${deal.state}

**Property:** ${deal.property_address || deal.city + ', ' + deal.state}
**ZIP:** ${deal.zip}

## Section 1: Scope
This addendum applies to the property and is governed by ${deal.state} law.

## Section 2: Compensation
${net_policy === 'BANNED' ? 'Net listings prohibited. All compensation as flat fee or percentage.' : 'Compensation as specified in Exhibit A.'}

## EXHIBIT A: TERMS
- **Compensation Model:** ${exhibit_a.compensation_model}
- **Transaction Type:** ${exhibit_a.transaction_type}
- **Flat Fee:** $${exhibit_a.flat_fee_amount || 0}
- **Agreement Length:** ${exhibit_a.agreement_length_days || 180} days`;

    // Add state-specific sections
    if (deal.state === 'IL') {
      addendumMd += `\n\n## STATE-SPECIFIC PROVISIONS

### Section 5: Illinois Wholesaling Requirements
Illinois prohibits unlicensed individuals from engaging in a pattern of real estate business (>1 transaction/year).

### Section 6: Illinois Net Listing Prohibition
Net listings are prohibited under Illinois law.`;
    }
    
    if (deal.state === 'PA') {
      addendumMd += `\n\n## STATE-SPECIFIC PROVISIONS

### Section 5: Pennsylvania Wholesaling Notice
Assignment contracts must clearly disclose intent to assign. Good faith deposit required.`;
    }
    
    if (deal.state === 'NJ') {
      addendumMd += `\n\n## STATE-SPECIFIC PROVISIONS

### Section 7: New Jersey Attorney Review Period
This agreement is subject to a three (3) business day attorney review period. Either party may cancel during this period.`;
    }
    
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
    
    // Upload
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    // Save
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
      selected_clause_ids: {},
      deep_dive_module_ids: getDive(deal.state),
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: fullMd,
      pdf_file_url: file_url,
      pdf_sha256,
      agreement_inputs_sha256: inputsHash,
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_draft',
        details: 'Agreement generated'
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
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getDive(state) {
  const m = [];
  if (state === 'IL') m.push('IL_DEEP_DIVE');
  if (state === 'PA') m.push('PA_DEEP_DIVE');
  if (state === 'NJ') m.push('NJ_DEEP_DIVE');
  return m;
}