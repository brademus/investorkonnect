import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

// State-to-template URL mapping
const STATE_TEMPLATES = {
  'AL': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Alabama%20contract%20.pdf',
  'AK': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Alaska.pdf',
  'AZ': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Arizona%20.pdf',
  'AR': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Arkansas%20.pdf',
  'CA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/California%20.pdf',
  'CO': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Colorado%20.pdf',
  'CT': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Connecticut%20.pdf',
  'DE': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Delaware%20.pdf',
  'FL': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Florida.pdf',
  'GA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Georgia.pdf',
  'HI': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Hawaii%20.pdf',
  'ID': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Idaho%20.pdf',
  'IL': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Illinois.pdf',
  'IN': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Indiana.pdf',
  'IA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Iowa%20.pdf',
  'KS': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Kansas%20.pdf',
  'KY': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Kentucky.pdf',
  'LA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Louisiana.pdf',
  'ME': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Maine%20.pdf',
  'MD': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Maryland%20.pdf',
  'MA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Massachusetts%20.pdf',
  'MI': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Michigan%20.pdf',
  'MN': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Minnesota%20.pdf',
  'MS': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Mississippi.pdf',
  'MO': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Missouri%20.pdf',
  'MT': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Montana.pdf',
  'NE': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Nebraska%20.pdf',
  'NV': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Nevada%20.pdf',
  'NH': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/New%20Hampshire.pdf',
  'NJ': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/New%20Jersey%20.pdf',
  'NM': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/New%20Mexico%20.pdf',
  'NY': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/New%20York.pdf',
  'NC': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/North%20Carolina%20.pdf',
  'ND': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/North%20Dakota%20.pdf',
  'OH': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Ohio.pdf',
  'OK': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Oklahoma.pdf',
  'OR': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Oregon.pdf',
  'PA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Penssylvania.pdf',
  'RI': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Rhode%20Island.pdf',
  'SC': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/South%20Carolina%20.pdf',
  'SD': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/South%20Dakota%20.pdf',
  'TN': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Tennessee%20.pdf',
  'TX': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Texas.pdf',
  'UT': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Utah%20.pdf',
  'VT': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Vermont%20.pdf',
  'VA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Virginia.pdf',
  'WA': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Washington.pdf',
  'WV': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/West%20Virginia.pdf',
  'WI': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Wisconsin%20.pdf',
  'WY': 'https://msrkgurqbldpnvwqvyzf.supabase.co/storage/v1/object/public/Contracts/Wyoming.pdf'
};

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

    // If no agent_id on deal, look for any room with this deal
    if (!agentProfile) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal_id });
      console.log('Rooms for deal:', rooms.length);
      const dealRoom = rooms.find(r => r.agentId);
      console.log('Deal room:', dealRoom ? dealRoom.id : 'none', 'agentId:', dealRoom?.agentId, 'status:', dealRoom?.request_status);

      if (!dealRoom || !dealRoom.agentId) {
        return Response.json({ 
          error: 'No agent selected for this deal. Please select an agent to work with.',
          debug: {
            deal_id,
            deal_agent_id: deal.agent_id,
            rooms_count: rooms.length,
            rooms: rooms.map(r => ({ id: r.id, agentId: r.agentId, status: r.request_status }))
          }
        }, { status: 400 });
      }

      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: dealRoom.agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
    }

    // Get template URL for this state
    const stateCode = (deal.state || '').toUpperCase();
    const templateUrl = STATE_TEMPLATES[stateCode];
    if (!templateUrl) {
      return Response.json({ error: `No template available for state: ${deal.state}` }, { status: 400 });
    }

    // Fetch template PDF
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      return Response.json({ error: 'Failed to fetch template PDF' }, { status: 500 });
    }
    const templateBytes = await templateResponse.arrayBuffer();

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Prepare replacement values
    const effectiveDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const replacements = {
      'DEAL_ID': deal.id || '',
      'EFFECTIVE_DATE': effectiveDate,
      'INVESTOR_LEGAL_NAME': profile.full_name || user.email || '',
      'INVESTOR_ENTITY_TYPE': 'Individual',
      'INVESTOR_EMAIL': user.email || '',
      'INVESTOR_PHONE': profile.phone || '',
      'AGENT_LEGAL_NAME': agentProfile.full_name || agentProfile.email || '',
      'LICENSE_NUMBER': agentProfile.agent?.license_number || agentProfile.license_number || '',
      'BROKERAGE_NAME': agentProfile.agent?.brokerage || agentProfile.broker || '',
      'AGENT_EMAIL': agentProfile.email || '',
      'AGENT_PHONE': agentProfile.phone || '',
      'PROPERTY_ADDRESS': deal.property_address || '',
      'CITY': deal.city || '',
      'STATE': deal.state || '',
      'ZIP': deal.zip || '',
      'COUNTY': deal.county || '',
      'TRANSACTION_TYPE': exhibit_a.transaction_type || 'ASSIGNMENT',
      'COMPENSATION_MODEL': exhibit_a.compensation_model || 'FLAT_FEE',
      'FLAT_FEE_AMOUNT': exhibit_a.flat_fee_amount ? `$${exhibit_a.flat_fee_amount.toLocaleString()}` : '$5,000',
      'COMMISSION_PERCENTAGE': exhibit_a.commission_percentage ? `${exhibit_a.commission_percentage}%` : '',
      'AGREEMENT_LENGTH_DAYS': (exhibit_a.agreement_length_days || 180).toString(),
      'TERMINATION_NOTICE_DAYS': (exhibit_a.termination_notice_days || 30).toString()
    };

    // Check if PDF has form fields
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length > 0) {
      console.log(`Found ${fields.length} form fields in template`);

      // Fill form fields
      fields.forEach(field => {
        const fieldName = field.getName();
        console.log(`Field: ${fieldName}`);

        // Try exact match
        if (replacements[fieldName]) {
          try {
            const textField = form.getTextField(fieldName);
            textField.setText(replacements[fieldName]);
            console.log(`Filled field: ${fieldName}`);
          } catch (e) {
            console.log(`Could not fill field ${fieldName}:`, e.message);
          }
        }
      });

      // Flatten the form
      form.flatten();
    } else {
      console.log('No form fields found - PDF has text placeholders. Adding overlay text.');

      // Get first page and add text overlays at approximate locations
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { height } = firstPage.getSize();

      // Add text overlays for key fields (coordinates may need adjustment per template)
      const overlays = [
        { text: replacements.DEAL_ID, x: 255, y: height - 203 },
        { text: replacements.EFFECTIVE_DATE, x: 310, y: height - 234 },
        { text: replacements.INVESTOR_LEGAL_NAME, x: 285, y: height - 337 },
        { text: replacements.INVESTOR_EMAIL, x: 240, y: height - 359 },
        { text: replacements.BROKERAGE_NAME, x: 465, y: height - 390 },
        { text: replacements.AGENT_LEGAL_NAME, x: 355, y: height - 412 },
        { text: replacements.LICENSE_NUMBER, x: 185, y: height - 433 },
        { text: replacements.CITY, x: 480, y: height - 433 },
        { text: replacements.STATE, x: 550, y: height - 433 }
      ];

      overlays.forEach(({ text, x, y }) => {
        if (text) {
          firstPage.drawText(text, {
            x,
            y,
            size: 11,
            color: rgb(0, 0, 0)
          });
        }
      });
    }

    // Save modified PDF
    const pdfBytes = await pdfDoc.save();
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
      agreement_version: '2.0.0',
      status: 'draft',
      selected_rule_id: deal.state + '_TEMPLATE',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: `Template-based agreement for ${deal.state}`,
      pdf_file_url: upload.file_url,
      pdf_sha256: 'generated',
      agreement_inputs_sha256: 'hash',
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_from_template',
        details: `Generated from ${deal.state} template`
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