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

function normalizeSignatureSection(text) {
  console.log('[normalizeSignatureSection] Starting normalization...');
  console.log('[normalizeSignatureSection] Text length:', text.length);
  
  const standardSignatureBlock = `

SIGNATURES

Investor:
Signature: ____________________   [[INVESTOR_SIGN]]
Printed Name: _________________   [[INVESTOR_PRINT]]
Date: ________________________   [[INVESTOR_DATE]]

Agent:
Signature: ____________________   [[AGENT_SIGN]]
Printed Name: _________________   [[AGENT_PRINT]]
License No.: __________________   [[AGENT_LICENSE]]
Brokerage: ____________________   [[AGENT_BROKERAGE]]
Date: ________________________   [[AGENT_DATE]]
`;
  
  // Patterns to find signature sections (case-insensitive, more flexible)
  const signaturePatterns = [
    /^\s*SIGNATURES?\s*$/gim,
    /^\s*\d+\.?\s*SIGNATURES?\s*$/gim,
    /^[\s\d.]*signatures?\s*$/gim
  ];
  
  let signatureIndex = -1;
  
  // Find the LAST occurrence of any signature header
  for (let i = 0; i < signaturePatterns.length; i++) {
    const pattern = signaturePatterns[i];
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      signatureIndex = lastMatch.index;
      console.log(`[normalizeSignatureSection] Found signature at index ${signatureIndex}, replacing with standard block`);
      break;
    }
  }
  
  if (signatureIndex >= 0) {
    // Replace everything from signature section onwards with standard block
    text = text.substring(0, signatureIndex) + standardSignatureBlock;
    console.log('[normalizeSignatureSection] Replaced signature section with standard block');
  } else {
    // No signature found, append to end
    text += standardSignatureBlock;
    console.log('[normalizeSignatureSection] No signature found, appended standard block');
  }
  
  return text;
}

async function sha256(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generatePdfFromText(text, dealId) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fontSize = 10;
  const lineHeight = 13;
  const margin = 60;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - 2 * margin;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Add new page if needed
    if (yPosition < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }
    
    // Skip empty lines but add spacing
    if (!line.trim()) {
      yPosition -= lineHeight * 0.5;
      continue;
    }
    
    // Detect headings (all caps or numbered)
    const isTitle = line.includes('INTERNAL OPERATING AGREEMENT') || line.includes('InvestorKonnect');
    const isHeading = /^[A-Z\s]{15,}$/.test(line.trim()) || /^\d+\)/.test(line.trim()) || /^[A-Z]\)/.test(line.trim());
    const isSubheading = /^\d+\./.test(line.trim());
    
    const currentFont = (isTitle || isHeading) ? boldFont : font;
    const currentSize = isTitle ? 14 : isHeading ? 11 : isSubheading ? 10.5 : fontSize;
    const textColor = rgb(0, 0, 0);
    
    // Word wrap
    const words = line.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = currentFont.widthOfTextAtSize(testLine, currentSize);
      
      if (width > maxWidth && currentLine) {
        // Draw current line
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: currentSize,
          font: currentFont,
          color: textColor
        });
        yPosition -= lineHeight;
        
        // Check if new page needed
        if (yPosition < margin + 30) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }
        
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: currentSize,
        font: currentFont,
        color: textColor
      });
      yPosition -= lineHeight;
    }
    
    // Extra spacing after headings
    if (isHeading || isTitle) {
      yPosition -= lineHeight * 0.5;
    }
  }
  
  // Add footer to all pages
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    pg.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: pageWidth / 2 - 30,
      y: 30,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
  
  return await pdfDoc.save();
}

function buildRenderContext(deal, profile, agentProfile, exhibit_a) {
  const effectiveDate = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Build venue - ensure it's never empty
  let venue = deal.state || 'N/A';
  if (deal.county && deal.state) {
    venue = `${deal.county} County, ${deal.state}`;
  }
  
  // ROFR settings
  const rofrEnabled = deal.rofr_enabled || false;
  const rofrDays = deal.rofr_days || 0;
  
  // Compensation
  const compensationModel = exhibit_a.compensation_model || 'FLAT_FEE';
  let sellerCompType = 'Flat Fee';
  let sellerCompValue = `$${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}`;
  
  if (compensationModel === 'COMMISSION_PCT') {
    sellerCompType = 'Commission Percentage';
    sellerCompValue = `${exhibit_a.commission_percentage || 3}%`;
  } else if (compensationModel === 'NET_SPREAD') {
    sellerCompType = 'Net Listing';
    sellerCompValue = `Net: $${(exhibit_a.net_target || 0).toLocaleString()}`;
  }
  
  // Buyer compensation
  let buyerCompType = 'Commission Percentage';
  let buyerCompValue = '3%';
  if (exhibit_a.buyer_commission_type === 'flat') {
    buyerCompType = 'Flat Fee';
    buyerCompValue = `$${(exhibit_a.buyer_commission_amount || 5000).toLocaleString()}`;
  } else if (exhibit_a.buyer_commission_type === 'percentage') {
    buyerCompType = 'Commission Percentage';
    buyerCompValue = `${exhibit_a.buyer_commission_amount || 3}%`;
  }
  
  return {
    AGREEMENT_VERSION: 'InvestorKonnect v2.0',
    DEAL_ID: deal.id || 'N/A',
    EFFECTIVE_DATE: effectiveDate,
    INVESTOR_LEGAL_NAME: profile.full_name || profile.email || 'N/A',
    INVESTOR_ENTITY_TYPE: 'Individual',
    INVESTOR_EMAIL: profile.email || 'N/A',
    INVESTOR_PHONE: profile.phone || 'N/A',
    AGENT_LEGAL_NAME: agentProfile.full_name || agentProfile.email || 'N/A',
    LICENSE_NUMBER: agentProfile.agent?.license_number || agentProfile.license_number || 'N/A',
    BROKERAGE_NAME: agentProfile.agent?.brokerage || agentProfile.broker || 'N/A',
    AGENT_EMAIL: agentProfile.email || 'N/A',
    AGENT_PHONE: agentProfile.phone || 'N/A',
    PROPERTY_ADDRESS: deal.property_address || 'TBD',
    CITY: deal.city || 'TBD',
    STATE: deal.state || 'N/A',
    ZIP: deal.zip || 'N/A',
    COUNTY: deal.county || 'N/A',
    VENUE: venue,
    TRANSACTION_TYPE: exhibit_a.transaction_type || 'ASSIGNMENT',
    COMPENSATION_MODEL: compensationModel,
    FLAT_FEE_AMOUNT: `$${(exhibit_a.flat_fee_amount || 5000).toLocaleString()}`,
    COMMISSION_PERCENTAGE: `${exhibit_a.commission_percentage || 3}%`,
    SELLER_COMP_TYPE: sellerCompType,
    SELLER_COMP_VALUE: sellerCompValue,
    BUYER_COMP_TYPE: buyerCompType,
    BUYER_COMP_VALUE: buyerCompValue,
    AGREEMENT_LENGTH_DAYS: (exhibit_a.agreement_length_days || 180).toString(),
    TERM_DAYS: (exhibit_a.agreement_length_days || 180).toString(),
    TERMINATION_NOTICE_DAYS: (exhibit_a.termination_notice_days || 30).toString(),
    EXCLUSIVITY_ON_OFF: exhibit_a.exclusive_agreement ? 'ON' : 'OFF',
    ROFR_ON_OFF: rofrEnabled ? 'ON' : 'OFF',
    ROFR_PERIOD_DAYS: rofrDays.toString()
  };
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
    
    // Validate required fields with detailed info
    const missing = [];
    const details = [];
    
    if (!deal.state) {
      missing.push('deal.state');
      details.push('Property state is required');
    }
    
    const investorName = profile.full_name || profile.email;
    if (!investorName) {
      missing.push('investor.full_name');
      details.push('Investor legal name is required');
    }
    
    const agentName = agentProfile.full_name || agentProfile.email;
    if (!agentName) {
      missing.push('agent.full_name');
      details.push('Agent legal name is required');
    }
    
    const licenseNumber = agentProfile.agent?.license_number || agentProfile.license_number;
    if (!licenseNumber) {
      missing.push('agent.license_number');
      details.push('Agent license number is required');
    }
    
    const brokerage = agentProfile.agent?.brokerage || agentProfile.broker;
    if (!brokerage) {
      missing.push('agent.brokerage');
      details.push('Agent brokerage name is required');
    }
    
    if (missing.length > 0) {
      console.log('Validation failed. Missing:', missing);
      console.log('Deal state:', deal.state);
      console.log('Investor name:', investorName);
      console.log('Agent name:', agentName);
      console.log('License:', licenseNumber);
      console.log('Brokerage:', brokerage);
      
      return Response.json({ 
        error: `Missing required fields: ${details.join(', ')}`,
        missing_fields: missing,
        details: details
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
      version: '2.1-normalized-signatures'
    });
    const renderInputHash = await sha256(inputData);
    
    // Check for existing agreement with same hash
    const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal_id });
    if (existing.length > 0) {
      const existingAgreement = existing[0];
      // Force regeneration if version changed (signature normalization update)
      if (existingAgreement.render_input_hash === renderInputHash && 
          existingAgreement.final_pdf_url && 
          existingAgreement.agreement_version === '2.1-normalized-signatures') {
        console.log('Returning existing agreement (unchanged inputs)');
        return Response.json({ 
          success: true, 
          agreement: existingAgreement, 
          regenerated: false 
        });
      }
      console.log('Regenerating due to version update or input changes');
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
    const pdfData = await pdfParse(new Uint8Array(templateBytes));
    let templateText = pdfData.text;
    console.log(`Extracted ${templateText.length} characters`);
    
    // Log first 500 chars to debug
    console.log('Template text preview:', templateText.substring(0, 500));
    
    // Log all available context keys
    console.log('Available render context keys:', Object.keys(renderContext));

    // Replace all placeholders
    const missingTokens = new Set();
    const foundTokens = new Set();

    templateText = templateText.replace(/\{([A-Z0-9_]+)\}/g, (match, token) => {
      if (renderContext[token] !== undefined && renderContext[token] !== null && renderContext[token] !== '' && renderContext[token] !== 'N/A' && renderContext[token] !== 'TBD') {
        console.log(`✓ Replacing ${token} with: ${renderContext[token]}`);
        foundTokens.add(token);
        return String(renderContext[token]);
      } else {
        console.log(`✗ Missing token: ${token} (value: ${renderContext[token]})`);
        missingTokens.add(token);
        return match;
      }
    });

    console.log(`Processed ${foundTokens.size} placeholders successfully`);
    console.log(`Missing ${missingTokens.size} placeholders:`, Array.from(missingTokens));

    if (missingTokens.size > 0) {
      const missingList = Array.from(missingTokens).map(token => {
        const value = renderContext[token];
        return `${token} (current: ${value || 'empty'})`;
      });

      return Response.json({
        error: `Missing required fields for contract: ${Array.from(missingTokens).join(', ')}`,
        missing_placeholders: Array.from(missingTokens),
        missing_details: missingList,
        message: 'Please complete these fields in the deal/profile to generate the agreement.'
      }, { status: 400 });
    }
    
    console.log('All placeholders replaced successfully');
    
    // Normalize signature section BEFORE generating PDF
    templateText = normalizeSignatureSection(templateText);
    
    // Generate new PDF from filled text
    console.log('Generating final PDF from filled text...');
    const finalPdfBytes = await generatePdfFromText(templateText, deal.id);
    
    // Upload final PDF
    const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}_filled.pdf`);
    const upload = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    console.log('Final PDF uploaded:', upload.file_url);
    
    // Compute PDF hash for DocuSign envelope tracking
    const hashBuffer = await crypto.subtle.digest('SHA-256', finalPdfBytes);
    const pdfSha256 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('PDF SHA-256:', pdfSha256);
    
    // Save agreement - clear DocuSign data to force new envelope with updated PDF
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
      agreement_version: '2.1-normalized-signatures',
      status: 'draft',
      template_url: templateUrl,
      final_pdf_url: upload.file_url,
      signing_pdf_url: upload.file_url,
      pdf_file_url: upload.file_url,
      pdf_sha256: pdfSha256,
      render_context_json: renderContext,
      render_input_hash: renderInputHash,
      selected_rule_id: stateCode + '_TEMPLATE',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: templateText.substring(0, 10000),
      missing_placeholders: [],
      docusign_envelope_id: null,
      docusign_status: null,
      docusign_envelope_pdf_hash: null,
      investor_recipient_id: null,
      agent_recipient_id: null,
      investor_client_user_id: null,
      agent_client_user_id: null,
      investor_signing_url: null,
      agent_signing_url: null,
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'generated_filled_agreement',
        details: `Generated from ${stateCode} template with standardized signatures - PDF hash: ${pdfSha256.substring(0, 16)}... - DocuSign envelope cleared for fresh signing`
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