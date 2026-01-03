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
    
    console.log('Deal:', deal.id, 'agent_id:', deal.agent_id);
    
    // Find agent from Room (new flow) or deal.agent_id (legacy)
    let agentProfile = null;
    
    if (deal.agent_id) {
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.agent_id });
      console.log('Found agent profiles by deal.agent_id:', agentProfiles.length);
      if (agentProfiles && agentProfiles.length > 0) {
        agentProfile = agentProfiles[0];
      }
    }
    
    // If no agent_id on deal, look for accepted room
    if (!agentProfile) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal_id });
      console.log('Rooms for deal:', rooms.length);
      const acceptedRoom = rooms.find(r => r.request_status === 'accepted' || r.is_fully_signed);
      console.log('Accepted room:', acceptedRoom ? acceptedRoom.id : 'none', 'agentId:', acceptedRoom?.agentId);
      
      if (!acceptedRoom || !acceptedRoom.agentId) {
        return Response.json({ 
          error: 'No agent assigned to deal. Please accept a deal request first.',
          debug: {
            deal_id,
            deal_agent_id: deal.agent_id,
            rooms_count: rooms.length,
            accepted_room: !!acceptedRoom,
            agent_in_room: acceptedRoom?.agentId
          }
        }, { status: 400 });
      }
      
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: acceptedRoom.agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
    }
    
    // Build master agreement
    const masterText = `INVESTOR-AGENT OPERATING AGREEMENT

This Agreement is entered into as of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (the "Effective Date") between:

INVESTOR: ${profile.full_name || user.email}
AGENT: ${agentProfile.full_name || agentProfile.email}
Licensed in: ${deal.state}

PROPERTY LOCATION: ${deal.city}, ${deal.state} ${deal.zip}

1. ENGAGEMENT AND SCOPE
   Investor engages Agent to provide real estate brokerage services for investment property transactions in ${deal.state}.

2. COMPENSATION
   Agent's compensation is set forth in Exhibit A attached hereto and incorporated by reference.
   - Model: ${exhibit_a.compensation_model || 'FLAT_FEE'}
   ${exhibit_a.compensation_model === 'FLAT_FEE' ? `- Amount: $${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}` : ''}
   ${exhibit_a.compensation_model === 'COMMISSION_PCT' ? `- Percentage: ${exhibit_a.commission_percentage}%` : ''}
   - Transaction Type: ${exhibit_a.transaction_type || 'ASSIGNMENT'}

3. TERM AND TERMINATION
   This Agreement shall remain in effect for ${exhibit_a.agreement_length_days || 180} days from the Effective Date.
   Either party may terminate with ${exhibit_a.termination_notice_days || 30} days written notice.

4. REPRESENTATIONS
   Agent represents that they hold a valid real estate license in ${deal.state} and will comply with all state laws.
   Investor represents that all information provided is accurate and complete.

5. GOVERNING LAW
   This Agreement shall be governed by and construed in accordance with the laws of the State of ${deal.state}.`;

    // Build state-specific addendum
    let addendumText = `\n\n=== STATE-SPECIFIC ADDENDUM: ${deal.state} ===\n`;
    
    if (deal.state === 'IL') {
      addendumText += `\nILLINOIS ADDENDUM

1. WHOLESALING RESTRICTIONS
   Illinois law restricts unlicensed individuals to no more than one (1) assignment transaction per 365-day period.
   Investor acknowledges this limitation and represents compliance.

2. NET LISTING PROHIBITION
   Net listings are prohibited in Illinois. All compensation must be disclosed and structured as commission or flat fee.

3. DISCLOSURE REQUIREMENTS
   All parties must receive written disclosure of Agent's role and compensation structure prior to contract execution.`;
    } else if (deal.state === 'PA') {
      addendumText += `\nPENNSYLVANIA ADDENDUM

1. ASSIGNMENT DISCLOSURE
   Pennsylvania law requires disclosure of assignment intent to sellers. Agent will ensure proper disclosure is made.

2. GOOD FAITH DEPOSIT
   A good faith deposit is required for all purchase agreements. Amount and terms to be negotiated per transaction.

3. AGENCY DISCLOSURE
   Written agency disclosure must be provided to all parties at first substantive contact.`;
    } else if (deal.state === 'NJ') {
      addendumText += `\nNEW JERSEY ADDENDUM

1. ATTORNEY REVIEW PERIOD
   This Agreement and all contracts are subject to New Jersey's three (3) business day attorney review period.
   Either party may cancel within this period upon attorney's written notice.

2. AGENCY DISCLOSURE
   Agent must provide Consumer Information Statement on Agency at first substantive contact.

3. GOOD FAITH DEPOSIT
   New Jersey requires good faith deposits for all purchase contracts. Terms to be specified per transaction.`;
    } else {
      addendumText += `\n${deal.state} PROVISIONS

This Agreement is subject to all applicable ${deal.state} real estate laws and regulations.
Agent represents compliance with all state-specific licensing and disclosure requirements.`;
    }
    
    addendumText += `\n\n=== EXHIBIT A: COMPENSATION TERMS ===

Transaction Type: ${exhibit_a.transaction_type || 'ASSIGNMENT'}
Compensation Model: ${exhibit_a.compensation_model || 'FLAT_FEE'}
${exhibit_a.compensation_model === 'FLAT_FEE' ? `Flat Fee Amount: $${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}` : ''}
${exhibit_a.compensation_model === 'COMMISSION_PCT' ? `Commission Rate: ${exhibit_a.commission_percentage}%` : ''}
Agreement Duration: ${exhibit_a.agreement_length_days || 180} days
Termination Notice: ${exhibit_a.termination_notice_days || 30} days`;
    
    const fullText = masterText + addendumText;
    
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