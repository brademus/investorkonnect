import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { fetchTemplate } from './utils/templateCache.js';
import { getDocuSignConnection, invalidateDocuSignCache } from './utils/docusignCache.js';
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

function buildRenderContext(deal, profile, agentProfile, exhibit_a, fillAgentDetails = true) {
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
  
  // Buyer compensation - normalize from percentage/flat_fee fields
  let buyerCompType = 'Commission Percentage';
  let buyerCompValue = '3%';
  let buyerCompAmount = 0;
  
  if (exhibit_a.buyer_commission_type === 'flat') {
    buyerCompType = 'Flat Fee';
    buyerCompAmount = exhibit_a.buyer_flat_fee || exhibit_a.buyer_commission_amount || 5000;
    buyerCompValue = `$${buyerCompAmount.toLocaleString()}`;
  } else if (exhibit_a.buyer_commission_type === 'percentage') {
    buyerCompType = 'Commission Percentage';
    buyerCompAmount = exhibit_a.buyer_commission_percentage || exhibit_a.buyer_commission_amount || 3;
    buyerCompValue = `${buyerCompAmount}%`;
  }
  
  // Agent details - only fill if fillAgentDetails is true
  const agentName = fillAgentDetails ? (agentProfile.full_name || agentProfile.email || 'TBD') : 'TBD';
  const licenseNumber = fillAgentDetails ? (agentProfile.agent?.license_number || agentProfile.license_number || 'TBD') : 'TBD';
  const brokerageName = fillAgentDetails ? (agentProfile.agent?.brokerage || agentProfile.broker || 'TBD') : 'TBD';
  const agentEmail = fillAgentDetails ? (agentProfile.email || 'TBD') : 'TBD';
  const agentPhone = fillAgentDetails ? (agentProfile.phone || 'TBD') : 'TBD';
  
  return {
    AGREEMENT_VERSION: 'InvestorKonnect v2.0',
    PLATFORM_NAME: 'investor konnect',
    PLATFORM_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    APP_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    PLATFORM_WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    DEAL_ID: deal.id || 'N/A',
    EFFECTIVE_DATE: effectiveDate,
    INVESTOR_LEGAL_NAME: profile.full_name || profile.email || 'N/A',
    INVESTOR_ENTITY_TYPE: 'Individual',
    INVESTOR_EMAIL: profile.email || 'N/A',
    INVESTOR_PHONE: profile.phone || 'N/A',
    AGENT_LEGAL_NAME: agentName,
    LICENSE_NUMBER: licenseNumber,
    BROKERAGE_NAME: brokerageName,
    AGENT_EMAIL: agentEmail,
    AGENT_PHONE: agentPhone,
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
    const draft_id = body.draft_id;
    const deal_id = body.deal_id;
    const room_id = body.room_id || null; // Room-scoped or legacy deal-scoped
    let exhibit_a = body.exhibit_a || {};
    // Only support investor_only (initial) or both (counter-accepted)
    const signer_mode = body.signer_mode || (room_id ? 'both' : 'investor_only');

    if (!deal_id && !draft_id) {
      console.log('[generateLegalAgreement] Missing both deal_id and draft_id');
      return Response.json({ error: 'deal_id or draft_id required' }, { status: 400 });
    }
    console.log('[generateLegalAgreement] Starting with deal_id:', deal_id, 'draft_id:', draft_id);
    
    console.log('[generateLegalAgreement] Mode:', room_id ? 'ROOM-SCOPED' : 'LEGACY (deal-scoped)', 'signer_mode:', signer_mode);

    // Load investor profile - prefer from request body for draft flow
    let profile = null;
    const investorProfileId = body.investor_profile_id;
    
    if (investorProfileId) {
      const profiles = await base44.asServiceRole.entities.Profile.filter({ id: investorProfileId });
      profile = profiles?.[0];
    }
    
    if (!profile) {
      // Fallback to user_id lookup
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      profile = profiles?.[0];
    }
    
    if (!profile) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    // Load deal OR draft
    let deal = null;
    if (deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals || deals.length === 0) {
        return Response.json({ error: 'Deal not found' }, { status: 404 });
      }
      deal = deals[0];
    } else if (draft_id) {
      // For draft-scoped generation (investor-only), use provided params
      // No need to fetch DealDraft - all data should be in request body
      const stateParam = body.state;
      const cityParam = body.city;
      const zipParam = body.zip;
      const countyParam = body.county;
      const addressParam = body.property_address;

      if (!stateParam) {
        return Response.json({ error: 'State required for draft-based generation' }, { status: 400 });
      }

      // Build minimal deal object for rendering
      deal = {
        id: draft_id,
        state: stateParam,
        city: cityParam || 'TBD',
        county: countyParam || 'TBD',
        zip: zipParam || 'TBD',
        property_address: addressParam || 'TBD',
        property_type: body.property_type || 'Single Family',
        transaction_type: 'ASSIGNMENT'
      };
      console.log('[generateLegalAgreement] Using draft-based deal:', deal);
    }

    // Load room (if room_id provided) to get room-scoped terms
    let room = null;
    let agentIdForTerms = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0] || null;

      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
      
      // CRITICAL: Get terms for the specific agent from agent_terms
      // For room-scoped generation, we need to know which agent - get from request body or first agent
      const agentId = body.agent_profile_id || room.agent_ids?.[0];
      if (!agentId) {
        return Response.json({ error: 'Cannot determine agent for room-scoped agreement' }, { status: 400 });
      }
      
      agentIdForTerms = agentId;
      const agentTerms = room.agent_terms?.[agentId];
      
      if (agentTerms) {
        exhibit_a = { ...exhibit_a, ...agentTerms };
        console.log('[generateLegalAgreement] Using agent-specific terms for agent', agentId, ':', exhibit_a);
      } else {
        console.warn('[generateLegalAgreement] Room has no terms for agent', agentId);
      }
    }

    // Resolve agent from Room (if room_id provided) or fallback to Deal.agent_id (legacy)
    let agentProfile = null;

    if (room_id) {
      // ROOM-SCOPED: Get agent from Room (already loaded above)
      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
      
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found for this room' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
      console.log('[generateLegalAgreement] Resolved agent from room:', agentProfile.id);
    } else {
      // LEGACY/DEAL-SCOPED: No room_id means this is the initial investor-generated agreement
      // Agent fields will be left as TBD placeholders (fillAgentDetails = false)
      // Create a minimal agent profile with TBD values for rendering
      agentProfile = {
        id: 'TBD',
        full_name: 'TBD',
        email: 'TBD',
        user_id: 'TBD',
        agent: { license_number: 'TBD', brokerage: 'TBD' }
      };
      console.log('[generateLegalAgreement] Deal-scoped generation: agent details will be TBD placeholders');
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
    
    // Only validate agent fields if generating for a specific room AND fillAgentDetails is true
    // For initial generation (no room_id), agent details are left as TBD placeholders
    const fillAgentDetails = !!room_id;
    if (fillAgentDetails) {
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
    }
    
    if (missing.length > 0) {
      console.log('Validation failed. Missing:', missing);
      console.log('Deal state:', deal.state);
      console.log('Investor name:', investorName);
      
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
    
    // Build render context - only fill agent details if room_id provided (after investor signs)
    // For initial generation (no room_id), leave agent details as TBD
    const renderContext = buildRenderContext(deal, profile, agentProfile, exhibit_a, fillAgentDetails);
    
    // Extract buyer compensation amount for later use
    let buyerCompAmount = 0;
    if (exhibit_a.buyer_commission_type === 'flat') {
      buyerCompAmount = exhibit_a.buyer_flat_fee || exhibit_a.buyer_commission_amount || 5000;
    } else if (exhibit_a.buyer_commission_type === 'percentage') {
      buyerCompAmount = exhibit_a.buyer_commission_percentage || exhibit_a.buyer_commission_amount || 3;
    }
    
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
    
    // Check for existing agreement to void (room-scoped or legacy)
    let toVoidEnvelopeId = null;
    let existingAgreementId = null;

    const existing = room_id
      ? await base44.asServiceRole.entities.LegalAgreement.filter({ room_id: room_id }, '-created_date', 1)
      : deal_id 
        ? await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal_id }, '-created_date', 1)
        : []; // No existing agreement for draft_id flow
    
    if (existing.length > 0) {
      const existingAgreement = existing[0];
      existingAgreementId = existingAgreement.id;
      toVoidEnvelopeId = existingAgreement.docusign_envelope_id || null;
      
      // Check for identical inputs - skip regeneration
      if (existingAgreement.render_input_hash === renderInputHash && 
          existingAgreement.final_pdf_url && 
          existingAgreement.docusign_envelope_id &&
          existingAgreement.status !== 'superseded' &&
          existingAgreement.status !== 'voided') {
        console.log('[generateLegalAgreement] Returning existing agreement (identical inputs)');
        return Response.json({ 
          success: true, 
          agreement: existingAgreement, 
          regenerated: false 
        });
      }
      console.log('[generateLegalAgreement] Regenerating - inputs changed or version updated');
    }
    
    // Fetch template PDF (with caching)
    console.log('Fetching template:', templateUrl);
    const templateBytes = await fetchTemplate(templateUrl);
    
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

    // Pre-seed platform tokens
    const platformDefaults = {
      PLATFORM_NAME: 'investor konnect',
      PLATFORM_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      APP_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      PLATFORM_WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    };
    for (const k of Object.keys(platformDefaults)) { if (!renderContext[k]) renderContext[k] = platformDefaults[k]; }

    templateText = templateText.replace(/\{([A-Z0-9_]+)\}/g, (match, token) => {
      // Allow TBD for agent fields when not filling agent details (initial generation)
      const value = renderContext[token];
      const isTBD = value === 'TBD';
      const isAgentField = ['AGENT_LEGAL_NAME', 'LICENSE_NUMBER', 'BROKERAGE_NAME', 'AGENT_EMAIL', 'AGENT_PHONE'].includes(token);
      const allowTBD = isTBD && isAgentField && !fillAgentDetails;
      
      if (value !== undefined && value !== null && value !== '' && value !== 'N/A' && (value !== 'TBD' || allowTBD)) {
        console.log(`✓ Replacing ${token} with: ${value}`);
        foundTokens.add(token);
        return String(value);
      } else {
        console.log(`✗ Missing token: ${token} (value: ${value})`);
        missingTokens.add(token);
        return match;
      }
    });

    console.log(`Processed ${foundTokens.size} placeholders successfully`);
    console.log(`Missing ${missingTokens.size} placeholders:`, Array.from(missingTokens));

    if (missingTokens.size > 0) {
      const missingList = Array.from(missingTokens).map(token => {
        const value = renderContext[token];
        // auto-fill known platform tokens if missing
        if (token === 'PLATFORM_NAME') return 'PLATFORM_NAME (auto: investor konnect)';
        if (token === 'PLATFORM_URL') return 'PLATFORM_URL (auto: https://agent-vault-da3d088b.base44.app/)';
        if (token === 'WEBSITE_URL') return 'WEBSITE_URL (auto: https://agent-vault-da3d088b.base44.app/)';
        if (token === 'APP_URL') return 'APP_URL (auto: https://agent-vault-da3d088b.base44.app/)';
        if (token === 'PLATFORM_WEBSITE_URL') return 'PLATFORM_WEBSITE_URL (auto: https://agent-vault-da3d088b.base44.app/)';
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
    
    // Generate both PDFs in parallel for speed
    console.log('Generating PDFs in parallel...');
    const [humanPdfBytes, docusignPdfBytes] = await Promise.all([
      generatePdfFromText(templateText, deal.id, false),
      generatePdfFromText(templateText, deal.id, true)
    ]);
    
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
    
    // Upload both PDFs in parallel
    const humanBlob = new Blob([humanPdfBytes], { type: 'application/pdf' });
    const humanFile = new File([humanBlob], `agreement_${deal_id}_human.pdf`);
    const docusignBlob = new Blob([docusignPdfBytes], { type: 'application/pdf' });
    const docusignFile = new File([docusignBlob], `agreement_${deal_id}_docusign_${docusignPdfSha256.substring(0, 8)}.pdf`);
    
    const [humanUpload, docusignUpload] = await Promise.all([
      base44.integrations.Core.UploadFile({ file: humanFile }),
      base44.integrations.Core.UploadFile({ file: docusignFile })
    ]);
    
    console.log('[PDF Uploads]');
    console.log('  Human PDF URL:', humanUpload.file_url);
    console.log('  DocuSign PDF URL:', docusignUpload.file_url);
    
    // Create DocuSign envelope with BOTH recipients
    console.log('[DocuSign] Creating envelope with both investor and agent recipients...');
    
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // OPTIMIZATION: Check envelope status before voiding to avoid unnecessary API calls
    if (toVoidEnvelopeId) {
      try {
        console.log('[DocuSign] Checking prior envelope status:', toVoidEnvelopeId);
        const statusUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${toVoidEnvelopeId}`;
        const statusResp = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          const currentStatus = statusData.status?.toLowerCase();
          
          // Only void if envelope is in voidable state
          if (['sent', 'delivered'].includes(currentStatus)) {
            console.log('[DocuSign] Voiding envelope (status:', currentStatus, ')');
            const voidResp = await fetch(statusUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'voided', voidedReason: `Regenerated with new terms on ${new Date().toISOString()}` })
            });
            if (voidResp.ok) {
              console.log('[DocuSign] ✓ Envelope voided');
            }
          } else {
            console.log('[DocuSign] Envelope already', currentStatus, '- skipping void');
          }
        }
      } catch (e) {
        console.warn('[DocuSign] Warning: envelope check/void failed:', e?.message);
      }
    }
    
    // Generate unique clientUserIds for embedded signing
    const timestamp = Date.now();
    const investorClientUserId = `investor-${deal_id}-${timestamp}`;
    const agentClientUserId = `agent-${deal_id}-${timestamp}`;
    
    // Create envelope definition based on signer_mode
    const docName = `InvestorKonnect Internal Agreement - ${stateCode} - ${deal_id} - v2.3.pdf`;
    
    const signers = [];
    
    // investor_only: Base agreement - investor signs alone (recipientId 1)
    // both: Counter-accepted - investor first (recipientId 1), agent second (recipientId 2)
    
    if (signer_mode === 'investor_only' || signer_mode === 'both') {
      signers.push({
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
      });
    }
    
    // Add agent recipient only in 'both' mode (counter-accepted)
    if (signer_mode === 'both' && agentProfile.email && agentProfile.email !== 'TBD') {
      const agentRecipientId = '2';
      const agentRoutingOrder = '2';
      
      signers.push({
        email: agentProfile.email,
        name: agentProfile.full_name || agentProfile.email,
        recipientId: agentRecipientId,
        routingOrder: agentRoutingOrder,
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
      });
    }
    
    const envelopeDefinition = {
      emailSubject: `Sign Agreement - ${stateCode} Deal`,
      documents: [{
        documentBase64: btoa(String.fromCharCode(...new Uint8Array(docusignPdfBytes))),
        name: docName,
        fileExtension: 'pdf',
        documentId: '1'
      }],
      recipients: { signers },
      status: 'sent'
    };
    
    const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;
    
    // Envelope creation with exponential backoff on rate limit
    let createResponse;
    let retries = 0;
    const maxRetries = 5; // More retries for rate limit resilience
    
    while (retries <= maxRetries) {
      try {
        createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(envelopeDefinition)
        });
        
        // Rate limit - exponential backoff
        if (createResponse.status === 429 && retries < maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, retries), 15000); // 1s, 2s, 4s, 8s, 15s, 15s
          console.log(`[DocuSign] Rate limited (429), retry ${retries + 1}/${maxRetries} after ${waitMs}ms`);
          await new Promise(r => setTimeout(r, waitMs));
          retries++;
          continue;
        }
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('[DocuSign] Envelope creation failed:', errorText);
          // Try to parse JSON error response
          let docuSignError = 'DocuSign envelope creation failed';
          try {
            const errJson = JSON.parse(errorText);
            docuSignError = errJson.message || errJson.errorMessage || errorText;
          } catch (_) {
            docuSignError = errorText || 'Unknown DocuSign error';
          }
          throw new Error(docuSignError);
        }
        
        break; // Success
      } catch (err) {
        if (retries < maxRetries && (err.message.includes('rate') || err.message.includes('429'))) {
          const waitMs = Math.min(1000 * Math.pow(2, retries), 15000);
          console.log(`[DocuSign] Network error retry ${retries + 1}/${maxRetries} after ${waitMs}ms: ${err.message}`);
          await new Promise(r => setTimeout(r, waitMs));
          retries++;
          continue;
        }
        throw err;
      }
    }
    
    if (!createResponse) {
      throw new Error('Failed to create envelope after retries');
    }
    
    const envelope = await createResponse.json();
    const envelopeId = envelope.envelopeId;
    
    console.log('[DocuSign] ✓ Envelope created:', envelopeId);
    console.log('[DocuSign] Recipients: investor (ID=1), agent (ID=2)');
    
    // Save agreement with envelope details
    const agreementData = {
      deal_id: deal_id || draft_id, // Use draft_id as temporary deal_id if no deal exists yet
      room_id: room_id || null, // Room-scoped or legacy null
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
      agreement_version: '2.3-signer-mode',
      signer_mode: signer_mode,
      source_base_agreement_id: body.source_base_agreement_id || null,
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
      exhibit_a_terms: {
        ...exhibit_a,
        buyer_commission_amount: buyerCompAmount // Derived field for compatibility
      },
      rendered_markdown_full: templateText.substring(0, 10000),
      missing_placeholders: [],
      docusign_envelope_id: envelopeId,
      docusign_status: 'sent',
      docusign_envelope_pdf_hash: docusignPdfSha256,
      docusign_last_sent_sha256: docusignPdfSha256,
      investor_recipient_id: (signer_mode === 'investor_only' || signer_mode === 'both') ? '1' : null,
      agent_recipient_id: (signer_mode === 'both') ? '2' : null,
      investor_client_user_id: investorClientUserId,
      agent_client_user_id: agentClientUserId,
      investor_signing_url: null,
      agent_signing_url: null,
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: user.email,
        action: `envelope_created_${signer_mode}`,
        details: `Created DocuSign envelope ${envelopeId} in ${signer_mode} mode - PDF hash ${docusignPdfSha256.substring(0, 8)}...`
      }]
    };
    
    // IMPORTANT: Do NOT mark old agreement as superseded yet
    // It will be marked as superseded AFTER the new agreement is fully signed (via webhook)
    // This preserves the old agreement during signing in case the user navigates away
    
    // Create agreement + update pointer in parallel
    const agreement = await base44.asServiceRole.entities.LegalAgreement.create({
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
      supersedes_agreement_id: existingAgreementId || null
    });
    
    console.log('[generateLegalAgreement] ✓ NEW agreement created:', agreement.id);
    
    // Update pointer asynchronously (don't block response)
    // Skip pointer update for draft flow since no Deal entity exists yet
    if (room_id) {
      base44.asServiceRole.entities.Room.update(room_id, { current_legal_agreement_id: agreement.id })
        .then(() => console.log('[generateLegalAgreement] ✓ Room pointer updated'))
        .catch(e => console.warn('[generateLegalAgreement] Room pointer update failed:', e.message));
    } else if (deal_id) {
      base44.asServiceRole.entities.Deal.update(deal_id, { current_legal_agreement_id: agreement.id })
        .then(() => console.log('[generateLegalAgreement] ✓ Deal pointer updated'))
        .catch(e => console.warn('[generateLegalAgreement] Deal pointer update failed:', e.message));
    } else {
      console.log('[generateLegalAgreement] Draft flow - no pointer to update (Deal will be created on investor signature)');
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