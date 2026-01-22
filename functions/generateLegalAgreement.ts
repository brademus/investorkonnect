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
Signature: [[INVESTOR_SIGN]]
Printed Name: [[INVESTOR_PRINT]]
Date: [[INVESTOR_DATE]]

Agent:
Signature: [[AGENT_SIGN]]
Printed Name: [[AGENT_PRINT]]
License No.: [[AGENT_LICENSE]]
Brokerage: [[AGENT_BROKERAGE]]
Date: [[AGENT_DATE]]
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

function normalizeWinAnsi(text) {
  const map = {
    '–': '-', '—': '-', '−': '-', '•': '*', '·': '-', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'",
    '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '≤': '<=', '≥': '>=', '©': '(c)', '®': '(r)', '™': 'TM',
    '\u00AD': '', '\u00A0': ' ', '\u2002': ' ', '\u2003': ' ', '\u202F': ' ', '\u2009': ' ', '\u200A': ' ',
    '\u200B': '', '\uFEFF': '', '\u2060': '',
    // Checkbox and shapes
    '\u2610': '[ ]', // ☐ ballot box
    '\u2611': '[x]', // ☑ ballot box with check
    '\u2612': '[x]', // ☒ ballot box with X
    '\u25A1': '[ ]', // □ white square
    '\u25A0': '[]',  // ■ black square
    '\u25CF': '*',   // ● black circle
    '\u25CB': 'o',   // ○ white circle
    '\u25AB': '-',   // ▫
    '\u25AA': '-',   // ▪
    // Check marks
    '\u2713': '[x]', // ✓ check mark
    '\u2714': '[x]', // ✔ heavy check mark
    '\u2715': 'x',   // ✕
    '\u2717': 'x'    // ✗
  };
  // First, replace known problem characters
  let out = text.replace(/[\u2013\u2014\u2212\u2022\u00B7\u2026\u201C\u201D\u2018\u2019\u2192\u2190\u2194\u21D2\u2264\u2265\u00A9\u00AE\u2122\u00AD\u00A0\u2002\u2003\u202F\u2009\u200A\u200B\uFEFF\u2060\u2610\u2611\u2612\u25A1\u25A0\u25CF\u25CB\u25AB\u25AA\u2713\u2714\u2715\u2717]/g, ch => map[ch] ?? '');
  // Safety: strip any remaining non-WinAnsi characters
  out = out.replace(/[^\x00-\xFF]/g, '');
  return out;
}

async function sha256(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generatePdfFromText(text, dealId, isDocuSignVersion = false) {
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
    let line = lines[i];
    
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
    
    // Check if line contains DocuSign anchors (test without consuming regex)
    const hasAnchors = /\[\[([A-Z_]+)\]\]/.test(line);
    
    if (hasAnchors && isDocuSignVersion) {
      // DocuSign version: render anchors as invisible text
      const parts = line.split(/(\[\[[A-Z_]+\]\])/);
      let xPos = margin;
      
      for (const part of parts) {
        if (!part) continue;
        
        const isAnchor = /\[\[[A-Z_]+\]\]/.test(part);
        
        if (isAnchor) {
          // Draw anchor as WHITE 1px text (invisible but searchable by DocuSign)
          page.drawText(part, {
            x: xPos,
            y: yPosition,
            size: 1,
            font: font,
            color: rgb(1, 1, 1) // Pure white
          });
          // Don't advance xPos - anchor takes no visible space
        } else if (part.trim()) {
          // Draw visible text normally
          page.drawText(part, {
            x: xPos,
            y: yPosition,
            size: currentSize,
            font: currentFont,
            color: textColor
          });
          xPos += currentFont.widthOfTextAtSize(part, currentSize);
        }
      }
      yPosition -= lineHeight;
    } else if (hasAnchors && !isDocuSignVersion) {
      // Human PDF version: strip anchors completely
      const cleanLine = line.replace(/\[\[[A-Z_]+\]\]/g, '');
      const words = cleanLine.split(' ');
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
            color: textColor
          });
          yPosition -= lineHeight;
          
          if (yPosition < margin + 30) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }
          
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine.trim()) {
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: currentSize,
          font: currentFont,
          color: textColor
        });
        yPosition -= lineHeight;
      }
    } else {
      // Normal word wrap for non-anchor lines
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
    let toVoidEnvelopeId = null;
    const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal_id });
    if (existing.length > 0) {
      const existingAgreement = existing[0];
      toVoidEnvelopeId = existingAgreement.docusign_envelope_id || null;
      // Server-side guard: block regeneration once agent has signed
      if (existingAgreement.agent_signed_at) {
        return Response.json({ 
          error: 'Agreement is locked: the agent has already signed. Regeneration is not allowed.',
          code: 'AGENT_ALREADY_SIGNED'
        }, { status: 400 });
      }
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
    
    // Sanitize text to WinAnsi-safe characters
    templateText = normalizeWinAnsi(templateText);
    // Normalize signature section BEFORE generating PDF
    templateText = normalizeSignatureSection(templateText);
    
    // Verify all required anchors exist exactly once
    const requiredAnchors = [
      'INVESTOR_SIGN', 'INVESTOR_PRINT', 'INVESTOR_DATE',
      'AGENT_SIGN', 'AGENT_PRINT', 'AGENT_LICENSE', 'AGENT_BROKERAGE', 'AGENT_DATE'
    ];
    
    const missingAnchors = [];
    const duplicateAnchors = [];
    
    for (const anchor of requiredAnchors) {
      const anchorString = `[[${anchor}]]`;
      const regex = new RegExp(anchorString.replace(/[[\]]/g, '\\$&'), 'g');
      const matches = templateText.match(regex);
      const count = matches ? matches.length : 0;
      
      if (count === 0) {
        missingAnchors.push(anchor);
      } else if (count > 1) {
        duplicateAnchors.push(`${anchor} (${count}x)`);
      }
    }
    
    if (missingAnchors.length > 0 || duplicateAnchors.length > 0) {
      const errors = [];
      if (missingAnchors.length > 0) errors.push(`Missing: ${missingAnchors.join(', ')}`);
      if (duplicateAnchors.length > 0) errors.push(`Duplicates: ${duplicateAnchors.join(', ')}`);
      
      console.error('[Anchor Verification FAILED]', errors.join('; '));
      return Response.json({
        error: 'DocuSign anchor verification failed: ' + errors.join('; '),
        missing_anchors: missingAnchors,
        duplicate_anchors: duplicateAnchors
      }, { status: 500 });
    }
    
    console.log('[Anchor Verification ✓] All 8 anchors found exactly once');
    
    // Generate TWO PDFs: human-readable and DocuSign-specific
    console.log('Generating human-readable PDF (no anchors visible)...');
    const humanPdfBytes = await generatePdfFromText(templateText, deal.id, false);
    
    console.log('Generating DocuSign PDF (invisible anchors)...');
    const docusignPdfBytes = await generatePdfFromText(templateText, deal.id, true);
    
    // Compute hashes for both
    const humanHashBuffer = await crypto.subtle.digest('SHA-256', humanPdfBytes);
    const humanPdfSha256 = Array.from(new Uint8Array(humanHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const docusignHashBuffer = await crypto.subtle.digest('SHA-256', docusignPdfBytes);
    const docusignPdfSha256 = Array.from(new Uint8Array(docusignHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log('[PDF Hashes]');
    console.log('  Human PDF SHA-256:', humanPdfSha256.substring(0, 16) + '...');
    console.log('  DocuSign PDF SHA-256:', docusignPdfSha256.substring(0, 16) + '...');
    
    // Upload human-readable PDF
    const humanBlob = new Blob([humanPdfBytes], { type: 'application/pdf' });
    const humanFile = new File([humanBlob], `agreement_${deal_id}_human.pdf`);
    const humanUpload = await base44.integrations.Core.UploadFile({ file: humanFile });
    
    // Upload DocuSign PDF with hash in filename to prevent caching
    const docusignBlob = new Blob([docusignPdfBytes], { type: 'application/pdf' });
    const docusignFile = new File([docusignBlob], `agreement_${deal_id}_docusign_${docusignPdfSha256.substring(0, 8)}.pdf`);
    const docusignUpload = await base44.integrations.Core.UploadFile({ file: docusignFile });
    
    console.log('[PDF Uploads]');
    console.log('  Human PDF URL:', humanUpload.file_url);
    console.log('  DocuSign PDF URL:', docusignUpload.file_url);
    
    // Create DocuSign envelope with BOTH recipients
    console.log('[DocuSign] Creating envelope with both investor and agent recipients...');
    
    async function getDocuSignConnection() {
      const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
      if (!connections || connections.length === 0) {
        throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
      }
      
      const connection = connections[0];
      const now = new Date();
      const expiresAt = new Date(connection.expires_at);
      
      if (now >= expiresAt && connection.refresh_token) {
        const tokenUrl = connection.base_uri.includes('demo') 
          ? 'https://account-d.docusign.com/oauth/token'
          : 'https://account.docusign.com/oauth/token';
        
        const refreshResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: connection.refresh_token,
            client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'),
            client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET')
          })
        });
        
        if (!refreshResponse.ok) {
          throw new Error('DocuSign token expired and refresh failed. Admin must reconnect DocuSign.');
        }
        
        const tokenData = await refreshResponse.json();
        await base44.asServiceRole.entities.DocuSignConnection.update(connection.id, {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || connection.refresh_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
        });
        
        connection.access_token = tokenData.access_token;
      }
      
      return connection;
    }
    
    const connection = await getDocuSignConnection();
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Attempt to void prior envelope (if any) before creating a new one
    if (toVoidEnvelopeId) {
      try {
        const voidUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${toVoidEnvelopeId}`;
        const voidResp = await fetch(voidUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'voided', voidedReason: `Regenerated on ${new Date().toISOString()}` })
        });
        if (!voidResp.ok) {
          const txt = await voidResp.text();
          console.warn('[DocuSign] Warning: failed to void prior envelope', txt);
        } else {
          console.log('[DocuSign] Prior envelope voided:', toVoidEnvelopeId);
          try {
            await base44.asServiceRole.entities.LegalAgreement.update(existing[0].id, {
              docusign_envelope_id: null,
              investor_recipient_id: null,
              agent_recipient_id: null,
              investor_signing_url: null,
              agent_signing_url: null
            });
          } catch (e) {
            console.warn('[DocuSign] Warning: failed to clear prior envelope fields', e?.message || e);
          }
        }
      } catch (e) {
        console.warn('[DocuSign] Warning: void attempt threw error', e?.message || e);
      }
    }
    
    // Generate unique clientUserIds for embedded signing
    const timestamp = Date.now();
    const investorClientUserId = `investor-${deal_id}-${timestamp}`;
    const agentClientUserId = `agent-${deal_id}-${timestamp}`;
    
    // Create envelope definition with both signers
    const docName = `InvestorKonnect Internal Agreement - ${stateCode} - ${deal_id} - v2.2.pdf`;
    
    const envelopeDefinition = {
      emailSubject: `Sign Agreement - ${stateCode} Deal`,
      documents: [{
        documentBase64: btoa(String.fromCharCode(...new Uint8Array(docusignPdfBytes))),
        name: docName,
        fileExtension: 'pdf',
        documentId: '1'
      }],
      recipients: {
        signers: [
          {
            email: profile.email,
            name: profile.full_name || profile.email,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: investorClientUserId,
            tabs: {
              signHereTabs: [{
                documentId: '1',
                anchorString: '[[INVESTOR_SIGN]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true
              }],
              dateSignedTabs: [{
                documentId: '1',
                anchorString: '[[INVESTOR_DATE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true
              }],
              fullNameTabs: [{
                documentId: '1',
                anchorString: '[[INVESTOR_PRINT]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true,
                name: 'Investor Full Name',
                value: profile.full_name || profile.email,
                locked: true,
                required: true,
                tabLabel: 'investorFullName'
              }]
            }
          },
          {
            email: agentProfile.email,
            name: agentProfile.full_name || agentProfile.email,
            recipientId: '2',
            routingOrder: '2',
            clientUserId: agentClientUserId,
            tabs: {
              signHereTabs: [{
                documentId: '1',
                anchorString: '[[AGENT_SIGN]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true
              }],
              dateSignedTabs: [{
                documentId: '1',
                anchorString: '[[AGENT_DATE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true
              }],
              fullNameTabs: [{
                documentId: '1',
                anchorString: '[[AGENT_PRINT]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorIgnoreIfNotPresent: false,
                anchorCaseSensitive: false,
                anchorMatchWholeWord: true,
                name: 'Agent Full Name',
                value: agentProfile.full_name || agentProfile.email,
                locked: true,
                required: true,
                tabLabel: 'agentFullName'
              }],
              textTabs: [
                {
                  documentId: '1',
                  anchorString: '[[AGENT_LICENSE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true,
                  name: 'License Number',
                  value: agentProfile.agent?.license_number || agentProfile.license_number || '',
                  locked: false,
                  required: true,
                  tabLabel: 'agentLicense'
                },
                {
                  documentId: '1',
                  anchorString: '[[AGENT_BROKERAGE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true,
                  name: 'Brokerage',
                  value: agentProfile.agent?.brokerage || agentProfile.broker || '',
                  locked: false,
                  required: true,
                  tabLabel: 'agentBrokerage'
                }
              ]
            }
          }
        ]
      },
      status: 'sent'
    };
    
    const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envelopeDefinition)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[DocuSign] Envelope creation failed:', errorText);
      throw new Error('Failed to create DocuSign envelope: ' + errorText);
    }
    
    const envelope = await createResponse.json();
    const envelopeId = envelope.envelopeId;
    
    console.log('[DocuSign] ✓ Envelope created:', envelopeId);
    console.log('[DocuSign] Recipients: investor (ID=1), agent (ID=2)');
    
    // Save agreement with envelope details
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
      agreement_version: '2.2-dual-pdf',
      status: 'sent',
      template_url: templateUrl,
      final_pdf_url: humanUpload.file_url,
      pdf_file_url: humanUpload.file_url,
      pdf_sha256: humanPdfSha256,
      docusign_pdf_url: docusignUpload.file_url,
      docusign_pdf_sha256: docusignPdfSha256,
      signing_pdf_url: docusignUpload.file_url,
      render_context_json: renderContext,
      render_input_hash: renderInputHash,
      selected_rule_id: stateCode + '_TEMPLATE',
      selected_clause_ids: {},
      deep_dive_module_ids: [],
      exhibit_a_terms: exhibit_a,
      rendered_markdown_full: templateText.substring(0, 10000),
      missing_placeholders: [],
      docusign_envelope_id: envelopeId,
      docusign_status: 'sent',
      docusign_envelope_pdf_hash: docusignPdfSha256,
      docusign_last_sent_sha256: docusignPdfSha256,
      investor_recipient_id: '1',
      agent_recipient_id: '2',
      investor_client_user_id: investorClientUserId,
      agent_client_user_id: agentClientUserId,
      investor_signing_url: null,
      agent_signing_url: null,
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: 'envelope_created_with_both_recipients',
        details: `Created DocuSign envelope ${envelopeId} with investor (recipientId=1) and agent (recipientId=2) - PDF hash ${docusignPdfSha256.substring(0, 8)}...`
      }]
    };
    
    let agreement;
    if (existing.length > 0) {
      // Regeneration: force re-sign by clearing all signing state and resetting status
      agreement = await base44.asServiceRole.entities.LegalAgreement.update(existing[0].id, {
        ...agreementData,
        investor_signed_at: null,
        agent_signed_at: null,
        investor_signed: false,
        agent_signed: false,
        is_fully_signed: false,
        signed_pdf_url: null,
        signed_pdf_sha256: null,
        investor_ip: null,
        agent_ip: null,
        status: 'sent',
        docusign_status: 'sent'
      });
    } else {
      agreement = await base44.asServiceRole.entities.LegalAgreement.create({
        ...agreementData,
        investor_signed_at: null,
        agent_signed_at: null,
        investor_signed: false,
        agent_signed: false,
        is_fully_signed: false,
        signed_pdf_url: null,
        signed_pdf_sha256: null,
        investor_ip: null,
        agent_ip: null
      });
    }
    
    // Ensure new envelope and recipient IDs are saved and old ones cannot be used
    try {
      await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
        docusign_envelope_id: envelopeId,
        investor_recipient_id: '1',
        agent_recipient_id: '2',
        investor_signing_url: null,
        agent_signing_url: null
      });
    } catch (e) {
      console.warn('[DocuSign] Warning: failed to persist new envelope metadata', e?.message || e);
    }
    
    console.log('[DocuSign] ✓ Agreement saved with envelope ID:', envelopeId);
    
    return Response.json({ success: true, agreement: agreement, regenerated: true });
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error',
      stack: error.stack 
    }, { status: 500 });
  }
});