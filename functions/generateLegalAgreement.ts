import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const deal_id = body.deal_id;
    const exhibit_a = body.exhibit_a || {};
    
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });
    
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Find agent from Room (new flow) or deal.agent_id (legacy)
    let agentProfile = null;
    
    if (deal.agent_id) {
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.agent_id });
      if (agentProfiles && agentProfiles.length > 0) {
        agentProfile = agentProfiles[0];
      }
    }
    
    // If no agent_id on deal, look for accepted room
    if (!agentProfile) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal_id });
      const acceptedRoom = rooms.find(r => r.request_status === 'accepted' || r.is_fully_signed);
      
      if (!acceptedRoom || !acceptedRoom.agentId) {
        return Response.json({ error: 'No agent assigned to deal' }, { status: 400 });
      }
      
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: acceptedRoom.agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
    }
    
    // Generate master agreement
    const masterText = `INVESTOR-AGENT OPERATING AGREEMENT

Effective Date: ${new Date().toLocaleDateString()}

PARTIES:
- Investor: ${profile.full_name || user.email}
- Agent: ${agentProfile.full_name || agentProfile.email}

1. ENGAGEMENT
Investor engages Agent for real estate services.

2. COMPENSATION
As specified in Exhibit A.

3. GOVERNING LAW
Governed by ${deal.state} law.`;

    // Generate state addendum
    let stateText = `\n\nSTATE ADDENDUM - ${deal.state}

Property: ${deal.property_address || deal.city + ', ' + deal.state}
ZIP: ${deal.zip}

EXHIBIT A:
- Compensation: ${exhibit_a.compensation_model || 'FLAT_FEE'}
- Amount: $${exhibit_a.flat_fee_amount || 5000}
- Type: ${exhibit_a.transaction_type || 'ASSIGNMENT'}`;

    // Add state-specific sections
    if (deal.state === 'IL') {
      stateText += `\n\nILLINOIS PROVISIONS:
- Wholesaling limited to 1 transaction/year for unlicensed
- Net listings prohibited`;
    }
    
    if (deal.state === 'PA') {
      stateText += `\n\nPENNSYLVANIA PROVISIONS:
- Assignment contracts must disclose intent
- Good faith deposit required`;
    }
    
    if (deal.state === 'NJ') {
      stateText += `\n\nNEW JERSEY PROVISIONS:
- 3 business day attorney review period applies`;
    }
    
    const fullText = masterText + stateText;
    
    // Create PDF
    const doc = new jsPDF();
    const lines = fullText.split('\n');
    let y = 20;
    
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      if (line.trim()) {
        const split = doc.splitTextToSize(line, 170);
        doc.text(split, 20, y);
        y += split.length * 7;
      } else {
        y += 7;
      }
    }
    
    const pdfBytes = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}.pdf`);
    
    const upload = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    // Save agreement
    const agreementData = {
      deal_id: deal_id,
      investor_user_id: user.id,
      agent_user_id: agentProfile.user_id,
      investor_profile_id: profile.id,
      agent_profile_id: agentProfile.id,
      governing_state: deal.state,
      property_zip: deal.zip,
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
      property_type: deal.property_type || 'Single Family',
      investor_status: 'UNLICENSED',
      deal_count_last_365: 0,
      agreement_version: '1.0.1',
      status: 'draft',
      selected_rule_id: deal.state + '_ASSIGNMENT',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: fullText,
      pdf_file_url: upload.file_url,
      pdf_sha256: 'generated',
      agreement_inputs_sha256: 'hash',
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_draft',
        details: 'Generated'
      }]
    };
    
    const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal_id });
    
    let agreement;
    if (existing.length > 0) {
      agreement = await base44.asServiceRole.entities.LegalAgreement.update(existing[0].id, agreementData);
    } else {
      agreement = await base44.asServiceRole.entities.LegalAgreement.create(agreementData);
    }
    
    return Response.json({ success: true, agreement: agreement, regenerated: true });
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});