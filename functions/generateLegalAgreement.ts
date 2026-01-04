import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import pdfParse from 'npm:pdf-parse@1.1.1';

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

async function sha256(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildRenderContext(deal, profile, agentProfile, exhibit_a) {
  const effectiveDate = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Build venue
  let venue = deal.state || '';
  if (deal.county) {
    venue = `${deal.county} County, ${deal.state}`;
  }
  
  // ROFR settings
  const rofrEnabled = deal.rofr_enabled || false;
  const rofrDays = deal.rofr_days || 0;
  
  // Compensation
  const compensationModel = exhibit_a.compensation_model || 'FLAT_FEE';
  let sellerCompType = '';
  let sellerCompValue = '';
  
  if (compensationModel === 'FLAT_FEE') {
    sellerCompType = 'Flat Fee';
    sellerCompValue = `$${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}`;
  } else if (compensationModel === 'COMMISSION_PCT') {
    sellerCompType = 'Commission Percentage';
    sellerCompValue = `${exhibit_a.commission_percentage || 0}%`;
  } else if (compensationModel === 'NET_SPREAD') {
    sellerCompType = 'Net Listing';
    sellerCompValue = `Net: $${(exhibit_a.net_target || 0).toLocaleString()}`;
  }
  
  return {
    AGREEMENT_VERSION: 'InvestorKonnect v2.0',
    DEAL_ID: deal.id || '',
    EFFECTIVE_DATE: effectiveDate,
    INVESTOR_LEGAL_NAME: profile.full_name || profile.email || '',
    INVESTOR_ENTITY_TYPE: 'Individual',
    INVESTOR_EMAIL: profile.email || '',
    INVESTOR_PHONE: profile.phone || '',
    AGENT_LEGAL_NAME: agentProfile.full_name || agentProfile.email || '',
    LICENSE_NUMBER: agentProfile.agent?.license_number || agentProfile.license_number || '',
    BROKERAGE_NAME: agentProfile.agent?.brokerage || agentProfile.broker || '',
    AGENT_EMAIL: agentProfile.email || '',
    AGENT_PHONE: agentProfile.phone || '',
    PROPERTY_ADDRESS: deal.property_address || '',
    CITY: deal.city || '',
    STATE: deal.state || '',
    ZIP: deal.zip || '',
    COUNTY: deal.county || '',
    VENUE: venue,
    TRANSACTION_TYPE: exhibit_a.transaction_type || 'ASSIGNMENT',
    COMPENSATION_MODEL: compensationModel,
    FLAT_FEE_AMOUNT: `$${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}`,
    COMMISSION_PERCENTAGE: `${exhibit_a.commission_percentage || 0}%`,
    SELLER_COMP_TYPE: sellerCompType,
    SELLER_COMP_VALUE: sellerCompValue,
    AGREEMENT_LENGTH_DAYS: (exhibit_a.agreement_length_days || 180).toString(),
    TERMINATION_NOTICE_DAYS: (exhibit_a.termination_notice_days || 30).toString(),
    ROFR_ON_OFF: rofrEnabled ? 'ON' : 'OFF',
    ROFR_PERIOD_DAYS: rofrDays.toString()
  };
}

function renderTemplate(templateText, context) {
  let rendered = templateText;
  const missingTokens = new Set();
  
  // Replace all tokens
  rendered = rendered.replace(/\{([A-Z0-9_]+)\}/g, (match, token) => {
    if (context[token] !== undefined && context[token] !== null && context[token] !== '') {
      return String(context[token]);
    } else {
      missingTokens.add(token);
      return match; // Leave unfilled
    }
  });
  
  // Check for remaining tokens
  const remainingTokens = new Set();
  const tokenPattern = /\{([A-Z0-9_]+)\}/g;
  let match;
  while ((match = tokenPattern.exec(rendered)) !== null) {
    remainingTokens.add(match[1]);
  }
  
  return {
    rendered,
    missingTokens: Array.from(remainingTokens)
  };
}

async function generatePdfFromText(text, dealId) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 50;
  const pageWidth = 612; // Letter size
  const pageHeight = 792;
  const maxWidth = pageWidth - 2 * margin;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (yPosition < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }
    
    if (!line.trim()) {
      yPosition -= lineHeight;
      continue;
    }
    
    // Determine if heading (all caps, or starts with number + period)
    const isHeading = /^[A-Z\s]{10,}$/.test(line.trim()) || /^\d+\./.test(line.trim());
    const currentFont = isHeading ? boldFont : font;
    const currentSize = isHeading ? 11 : fontSize;
    
    // Word wrap
    const words = line.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = currentFont.widthOfTextAtSize(testLine, currentSize);
      
      if (width > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: currentSize,
          font: currentFont,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;
        
        if (yPosition < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }
        
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: currentSize,
        font: currentFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;
    }
  }
  
  // Add footer to last page
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(`Generated by InvestorKonnect for Deal ${dealId}`, {
    x: margin,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const deal_id = body.deal_id;
    const exhibit_a = body.exhibit_a || {};
    
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });
    
    // Load investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Find agent
    let agentProfile = null;
    if (deal.agent_id) {
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.agent_id });
      if (agentProfiles && agentProfiles.length > 0) {
        agentProfile = agentProfiles[0];
      }
    }
    
    if (!agentProfile) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal_id });
      const dealRoom = rooms.find(r => r.agentId);
      
      if (!dealRoom || !dealRoom.agentId) {
        return Response.json({ 
          error: 'No agent selected for this deal. Please select an agent to work with.'
        }, { status: 400 });
      }
      
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: dealRoom.agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
    }
    
    // Validate required fields
    const missing = [];
    if (!deal.state) missing.push('deal.state');
    if (!profile.full_name && !profile.email) missing.push('investor.legal_name');
    if (!agentProfile.full_name && !agentProfile.email) missing.push('agent.legal_name');
    if (!agentProfile.agent?.license_number && !agentProfile.license_number) missing.push('agent.license_number');
    if (!agentProfile.agent?.brokerage && !agentProfile.broker) missing.push('agent.brokerage');
    
    if (missing.length > 0) {
      return Response.json({ 
        error: 'Missing required fields',
        missing_fields: missing,
        message: 'Complete these fields in the deal/profile to generate an executable agreement.'
      }, { status: 400 });
    }
    
    // Get template URL
    const stateCode = deal.state.toUpperCase();
    const templateUrl = STATE_TEMPLATES[stateCode];
    if (!templateUrl) {
      return Response.json({ error: `No template available for state: ${deal.state}` }, { status: 400 });
    }
    
    // Build render context
    const renderContext = buildRenderContext(deal, profile, agentProfile, exhibit_a);
    
    // Compute render input hash for regeneration guard
    const inputData = JSON.stringify({
      state_code: stateCode,
      template_url: templateUrl,
      deal_fields: {
        id: deal.id,
        state: deal.state,
        city: deal.city,
        county: deal.county,
        zip: deal.zip,
        property_address: deal.property_address
      },
      investor_fields: {
        full_name: profile.full_name,
        email: profile.email
      },
      agent_fields: {
        full_name: agentProfile.full_name,
        license_number: agentProfile.agent?.license_number || agentProfile.license_number,
        brokerage: agentProfile.agent?.brokerage || agentProfile.broker
      },
      exhibit_a: exhibit_a,
      version: '2.0'
    });
    const renderInputHash = await sha256(inputData);
    
    // Check for existing agreement with same hash
    const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal_id });
    if (existing.length > 0) {
      const existingAgreement = existing[0];
      if (existingAgreement.render_input_hash === renderInputHash && existingAgreement.final_pdf_url) {
        console.log('Returning existing agreement (unchanged inputs)');
        return Response.json({ 
          success: true, 
          agreement: existingAgreement, 
          regenerated: false 
        });
      }
    }
    
    // Fetch template PDF
    console.log('Fetching template:', templateUrl);
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      return Response.json({ error: 'Failed to fetch template PDF' }, { status: 500 });
    }
    const templateBytes = await templateResponse.arrayBuffer();
    
    // Extract text from PDF
    console.log('Extracting text from template...');
    const pdfData = await pdfParse(Buffer.from(templateBytes));
    const templateText = pdfData.text;
    console.log(`Extracted ${templateText.length} characters of text`);
    
    // Render placeholders
    const { rendered, missingTokens } = renderTemplate(templateText, renderContext);
    
    if (missingTokens.length > 0) {
      console.log('Missing tokens:', missingTokens);
      return Response.json({
        error: 'Incomplete template rendering',
        missing_placeholders: missingTokens,
        message: 'Complete these fields in the deal/profile to generate an executable agreement.'
      }, { status: 400 });
    }
    
    console.log('All placeholders filled successfully');
    
    // Generate new PDF from filled text
    console.log('Generating final PDF...');
    const finalPdfBytes = await generatePdfFromText(rendered, deal.id);
    const pdfSha256 = await sha256(new TextDecoder().decode(finalPdfBytes));
    
    // Upload final PDF
    const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}_filled.pdf`);
    const upload = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    console.log('Final PDF uploaded:', upload.file_url);
    
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
      template_url: templateUrl,
      final_pdf_url: upload.file_url,
      pdf_file_url: upload.file_url,
      pdf_sha256: pdfSha256,
      render_context_json: renderContext,
      render_input_hash: renderInputHash,
      selected_rule_id: stateCode + '_TEMPLATE',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: rendered.substring(0, 10000),
      missing_placeholders: [],
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_filled_agreement',
        details: `Generated from ${stateCode} template with all placeholders filled`
      }]
    };
    
    let agreement;
    if (existing.length > 0) {
      agreement = await base44.asServiceRole.entities.LegalAgreement.update(existing[0].id, agreementData);
    } else {
      agreement = await base44.asServiceRole.entities.LegalAgreement.create(agreementData);
    }
    
    return Response.json({ success: true, agreement: agreement, regenerated: true });
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error',
      stack: error.stack 
    }, { status: 500 });
  }
});