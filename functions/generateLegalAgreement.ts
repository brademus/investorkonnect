// =================================================================
// VERSION 2.6.0 - DRAFT FLOW SUPPORT
// CRITICAL: Supports both draft_id (pre-signing) and deal_id flows
// =================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { fetchTemplate } from './utils/templateCache.js';
import { getDocuSignConnection, invalidateDocuSignCache } from './utils/docusignCache.js';
import pdfParse from 'npm:pdf-parse@1.1.1';

const VERSION = '3.1.0-AGENT-SIGN-FIX';

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
  
  const signaturePatterns = [
    /^\s*SIGNATURES?\s*$/gim,
    /^\s*\d+\.?\s*SIGNATURES?\s*$/gim,
    /^[\s\d.]*signatures?\s*$/gim
  ];
  
  let signatureIndex = -1;
  
  for (let i = 0; i < signaturePatterns.length; i++) {
    const pattern = signaturePatterns[i];
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      signatureIndex = lastMatch.index;
      break;
    }
  }
  
  if (signatureIndex >= 0) {
    text = text.substring(0, signatureIndex) + standardSignatureBlock;
  } else {
    text += standardSignatureBlock;
  }
  
  return text;
}

function normalizeWinAnsi(text) {
  const map = {
    '–': '-', '—': '-', '−': '-', '•': '*', '·': '-', '…': '...', '"': '"', '"': '"', ''': "'", ''': "'",
    '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '≤': '<=', '≥': '>=', '©': '(c)', '®': '(r)', '™': 'TM',
    '\u00AD': '', '\u00A0': ' ', '\u2002': ' ', '\u2003': ' ', '\u202F': ' ', '\u2009': ' ', '\u200A': ' ',
    '\u200B': '', '\uFEFF': '', '\u2060': '',
    '\u2610': '[ ]', '\u2611': '[x]', '\u2612': '[x]', '\u25A1': '[ ]', '\u25A0': '[]',
    '\u25CF': '*', '\u25CB': 'o', '\u25AB': '-', '\u25AA': '-',
    '\u2713': '[x]', '\u2714': '[x]', '\u2715': 'x', '\u2717': 'x'
  };
  let out = text.replace(/[\u2013\u2014\u2212\u2022\u00B7\u2026\u201C\u201D\u2018\u2019\u2192\u2190\u2194\u21D2\u2264\u2265\u00A9\u00AE\u2122\u00AD\u00A0\u2002\u2003\u202F\u2009\u200A\u200B\uFEFF\u2060\u2610\u2611\u2612\u25A1\u25A0\u25CF\u25CB\u25AB\u25AA\u2713\u2714\u2715\u2717]/g, ch => map[ch] ?? '');
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
    
    if (yPosition < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }
    
    if (!line.trim()) {
      yPosition -= lineHeight * 0.5;
      continue;
    }
    
    const isTitle = line.includes('INTERNAL OPERATING AGREEMENT') || line.includes('InvestorKonnect');
    const isHeading = /^[A-Z\s]{15,}$/.test(line.trim()) || /^\d+\)/.test(line.trim()) || /^[A-Z]\)/.test(line.trim());
    const isSubheading = /^\d+\./.test(line.trim());
    
    const currentFont = (isTitle || isHeading) ? boldFont : font;
    const currentSize = isTitle ? 14 : isHeading ? 11 : isSubheading ? 10.5 : fontSize;
    const textColor = rgb(0, 0, 0);
    
    const hasAnchors = /\[\[([A-Z_]+)\]\]/.test(line);
    
    if (hasAnchors && isDocuSignVersion) {
      const parts = line.split(/(\[\[[A-Z_]+\]\])/);
      let xPos = margin;
      
      for (const part of parts) {
        if (!part) continue;
        
        const isAnchor = /\[\[[A-Z_]+\]\]/.test(part);
        
        if (isAnchor) {
          page.drawText(part, { x: xPos, y: yPosition, size: 1, font: font, color: rgb(1, 1, 1) });
        } else if (part.trim()) {
          page.drawText(part, { x: xPos, y: yPosition, size: currentSize, font: currentFont, color: textColor });
          xPos += currentFont.widthOfTextAtSize(part, currentSize);
        }
      }
      yPosition -= lineHeight;
    } else if (hasAnchors && !isDocuSignVersion) {
      const cleanLine = line.replace(/\[\[[A-Z_]+\]\]/g, '');
      const words = cleanLine.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = currentFont.widthOfTextAtSize(testLine, currentSize);
        
        if (width > maxWidth && currentLine) {
          page.drawText(currentLine, { x: margin, y: yPosition, size: currentSize, font: currentFont, color: textColor });
          yPosition -= lineHeight;
          if (yPosition < margin + 30) { page = pdfDoc.addPage([pageWidth, pageHeight]); yPosition = pageHeight - margin; }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine.trim()) {
        page.drawText(currentLine, { x: margin, y: yPosition, size: currentSize, font: currentFont, color: textColor });
        yPosition -= lineHeight;
      }
    } else {
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = currentFont.widthOfTextAtSize(testLine, currentSize);
        
        if (width > maxWidth && currentLine) {
          page.drawText(currentLine, { x: margin, y: yPosition, size: currentSize, font: currentFont, color: textColor });
          yPosition -= lineHeight;
          if (yPosition < margin + 30) { page = pdfDoc.addPage([pageWidth, pageHeight]); yPosition = pageHeight - margin; }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, { x: margin, y: yPosition, size: currentSize, font: currentFont, color: textColor });
        yPosition -= lineHeight;
      }
    }
    
    if (isHeading || isTitle) { yPosition -= lineHeight * 0.5; }
  }
  
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    pg.drawText(`Page ${i + 1} of ${pages.length}`, { x: pageWidth / 2 - 30, y: 30, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
  }
  
  return await pdfDoc.save();
}

function buildRenderContext(deal, profile, agentProfile, exhibit_a, fillAgentDetails = true) {
  const effectiveDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  let venue = deal.state || 'N/A';
  if (deal.county && deal.state) { venue = `${deal.county} County, ${deal.state}`; }
  
  const rofrEnabled = deal.rofr_enabled || false;
  const rofrDays = deal.rofr_days || 0;
  
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
  
  let buyerCompType = 'Commission Percentage';
  let buyerCompValue = '3%';
  
  if (exhibit_a.buyer_commission_type === 'flat') {
    buyerCompType = 'Flat Fee';
    const buyerCompAmount = exhibit_a.buyer_flat_fee || exhibit_a.buyer_commission_amount || 5000;
    buyerCompValue = `$${buyerCompAmount.toLocaleString()}`;
  } else if (exhibit_a.buyer_commission_type === 'percentage') {
    buyerCompType = 'Commission Percentage';
    const buyerCompAmount = exhibit_a.buyer_commission_percentage || exhibit_a.buyer_commission_amount || 3;
    buyerCompValue = `${buyerCompAmount}%`;
  }
  
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
  console.log(`[generateLegalAgreement ${VERSION}] ===== NEW REQUEST =====`);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    console.log(`[${VERSION}] Body keys:`, Object.keys(body));
    console.log(`[${VERSION}] draft_id:`, body.draft_id, 'deal_id:', body.deal_id);
    
    const draft_id = body.draft_id || null;
    const deal_id = body.deal_id || null;
    const room_id = body.room_id || null;
    let exhibit_a = body.exhibit_a || {};
    const signer_mode = body.signer_mode || (room_id ? 'both' : 'investor_only');

    console.log(`[${VERSION}] Params:`, { deal_id, draft_id, room_id, signer_mode });

    // CRITICAL: Prioritize draft_id for pre-signing flow (draft_id means we build deal from params)
    const useDraftFlow = !!draft_id;
    const effectiveId = draft_id || deal_id;

    if (!effectiveId) {
      console.error(`[${VERSION}] VALIDATION FAILED - Missing both IDs`);
      return Response.json({ error: 'deal_id or draft_id required' }, { status: 400 });
    }

    console.log(`[${VERSION}] ✓ Proceeding with ${useDraftFlow ? 'DRAFT' : 'DEAL'} flow using ID:`, effectiveId);

    // Load investor profile
    let profile = null;
    const investorProfileId = body.investor_profile_id;

    if (investorProfileId) {
      const profiles = await base44.asServiceRole.entities.Profile.filter({ id: investorProfileId });
      profile = profiles?.[0];
    }

    if (!profile) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      profile = profiles?.[0];
    }

    if (!profile) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    // Load deal OR build from draft params
    let deal = null;
    if (useDraftFlow) {
      // Build minimal deal object from request body params for draft flow
      const stateParam = body.state;
      if (!stateParam) {
        return Response.json({ error: 'State required for draft-based generation' }, { status: 400 });
      }

      deal = {
        id: effectiveId,
        state: stateParam,
        city: body.city || 'TBD',
        county: body.county || 'TBD',
        zip: body.zip || 'TBD',
        property_address: body.property_address || 'TBD',
        property_type: body.property_type || 'Single Family',
        transaction_type: 'ASSIGNMENT'
      };
      console.log(`[${VERSION}] Draft-based deal:`, deal);
    } else {
      // Load existing Deal entity
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: effectiveId });
      if (!deals || deals.length === 0) {
        return Response.json({ error: 'Deal not found' }, { status: 404 });
      }
      deal = deals[0];
    }

    // Load room if room_id provided
    let room = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0] || null;
      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
      
      const agentId = body.agent_profile_id || room.agent_ids?.[0];
      if (!agentId) {
        return Response.json({ error: 'Cannot determine agent for room-scoped agreement' }, { status: 400 });
      }
      
      const agentTerms = room.agent_terms?.[agentId];
      if (agentTerms) {
        exhibit_a = { ...exhibit_a, ...agentTerms };
      }
    }

    // Resolve agent profile - check multiple sources for agent ID
    let agentProfile = null;
    if (room_id && room) {
      const agentId = body.agent_profile_id || room.agentId || (Array.isArray(room.agent_ids) ? room.agent_ids[0] : null);
      console.log(`[${VERSION}] Using agentId:`, agentId, 'from agent_profile_id:', body.agent_profile_id, 'room.agentId:', room.agentId, 'room.agent_ids:', room.agent_ids);
      if (!agentId) {
        return Response.json({ error: 'Cannot determine agent for room-scoped agreement' }, { status: 400 });
      }
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      if (!agentProfiles || agentProfiles.length === 0) {
        return Response.json({ error: 'Agent profile not found for this room' }, { status: 404 });
      }
      agentProfile = agentProfiles[0];
    } else {
      // No room - use TBD placeholders
      agentProfile = {
        id: 'TBD', full_name: 'TBD', email: 'TBD', user_id: 'TBD',
        agent: { license_number: 'TBD', brokerage: 'TBD' }
      };
    }
    
    // Validate required fields
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
    
    const fillAgentDetails = !!room_id;
    if (fillAgentDetails) {
      if (!(agentProfile.full_name || agentProfile.email)) {
        missing.push('agent.full_name');
        details.push('Agent legal name is required');
      }
      if (!(agentProfile.agent?.license_number || agentProfile.license_number)) {
        missing.push('agent.license_number');
        details.push('Agent license number is required');
      }
      if (!(agentProfile.agent?.brokerage || agentProfile.broker)) {
        missing.push('agent.brokerage');
        details.push('Agent brokerage name is required');
      }
    }
    
    if (missing.length > 0) {
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
    
    const renderContext = buildRenderContext(deal, profile, agentProfile, exhibit_a, fillAgentDetails);
    
    let buyerCompAmount = 0;
    if (exhibit_a.buyer_commission_type === 'flat') {
      buyerCompAmount = exhibit_a.buyer_flat_fee || exhibit_a.buyer_commission_amount || 5000;
    } else if (exhibit_a.buyer_commission_type === 'percentage') {
      buyerCompAmount = exhibit_a.buyer_commission_percentage || exhibit_a.buyer_commission_amount || 3;
    }
    
    const inputData = JSON.stringify({
      state_code: stateCode,
      template_url: templateUrl,
      deal_fields: { id: deal.id, state: deal.state, city: deal.city, county: deal.county, zip: deal.zip, property_address: deal.property_address },
      investor_fields: { full_name: profile.full_name, email: profile.email },
      agent_fields: { full_name: agentProfile.full_name, license_number: agentProfile.agent?.license_number || agentProfile.license_number, brokerage: agentProfile.agent?.brokerage || agentProfile.broker },
      exhibit_a: exhibit_a,
      signer_mode: signer_mode,
      version: '2.5-draft-flow-v2'
    });
    const renderInputHash = await sha256(inputData);
    
    // Check for existing agreement
    let toVoidEnvelopeId = null;
    let existingAgreementId = null;

    // CRITICAL: When looking for existing agreements, filter by signer_mode too
    // to avoid returning an investor_only agreement when we need agent_only
    let existing = [];
    if (room_id) {
      const allForRoom = await base44.asServiceRole.entities.LegalAgreement.filter({ room_id: room_id }, '-created_date', 5);
      // Prefer exact signer_mode match first
      const exactMatch = allForRoom.filter(a => a.signer_mode === signer_mode);
      existing = exactMatch.length > 0 ? [exactMatch[0]] : (allForRoom.length > 0 ? [allForRoom[0]] : []);
      console.log(`[${VERSION}] Found ${allForRoom.length} agreements for room, ${exactMatch.length} with matching signer_mode=${signer_mode}`);
    } else if (!useDraftFlow && effectiveId) {
      existing = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: effectiveId }, '-created_date', 1);
    }
    
    if (existing.length > 0) {
      const existingAgreement = existing[0];
      existingAgreementId = existingAgreement.id;
      toVoidEnvelopeId = existingAgreement.docusign_envelope_id || null;
      
      // CRITICAL: Only return cached agreement if signer_mode ALSO matches
      // Otherwise agent_only request would return investor_only agreement from cache
      const signerModeMatches = existingAgreement.signer_mode === signer_mode;
      
      if (signerModeMatches &&
          existingAgreement.render_input_hash === renderInputHash && 
          existingAgreement.final_pdf_url && 
          existingAgreement.docusign_envelope_id &&
          existingAgreement.status !== 'superseded' &&
          existingAgreement.status !== 'voided') {
        console.log(`[${VERSION}] Returning existing agreement (signer_mode=${existingAgreement.signer_mode})`);
        return Response.json({ success: true, agreement: existingAgreement, regenerated: false });
      }
      
      console.log(`[${VERSION}] Existing agreement signer_mode=${existingAgreement.signer_mode} vs requested=${signer_mode}, hash match=${existingAgreement.render_input_hash === renderInputHash}, will regenerate`);
      
      // Don't void the investor's envelope when creating agent_only agreement
      if (existingAgreement.signer_mode !== signer_mode) {
        toVoidEnvelopeId = null;
      }
    }
    
    // Fetch template
    console.log('[generateLegalAgreement v2.5] Fetching template:', templateUrl);
    const templateBytes = await fetchTemplate(templateUrl);
    
    // Extract text
    const pdfData = await pdfParse(new Uint8Array(templateBytes));
    let templateText = pdfData.text;
    
    // Replace placeholders
    const missingTokens = new Set();
    const foundTokens = new Set();
    
    const platformDefaults = {
      PLATFORM_NAME: 'investor konnect',
      PLATFORM_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      APP_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
      PLATFORM_WEBSITE_URL: (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app/'),
    };
    for (const k of Object.keys(platformDefaults)) { if (!renderContext[k]) renderContext[k] = platformDefaults[k]; }

    templateText = templateText.replace(/\{([A-Z0-9_]+)\}/g, (match, token) => {
      const value = renderContext[token];
      const isTBD = value === 'TBD';
      const isAgentField = ['AGENT_LEGAL_NAME', 'LICENSE_NUMBER', 'BROKERAGE_NAME', 'AGENT_EMAIL', 'AGENT_PHONE'].includes(token);
      const allowTBD = isTBD && isAgentField && !fillAgentDetails;
      
      if (value !== undefined && value !== null && value !== '' && value !== 'N/A' && (value !== 'TBD' || allowTBD)) {
        foundTokens.add(token);
        return String(value);
      } else {
        missingTokens.add(token);
        return match;
      }
    });

    if (missingTokens.size > 0) {
      return Response.json({
        error: `Missing required fields for contract: ${Array.from(missingTokens).join(', ')}`,
        missing_placeholders: Array.from(missingTokens)
      }, { status: 400 });
    }
    
    templateText = normalizeWinAnsi(templateText);
    templateText = normalizeSignatureSection(templateText);
    
    // Verify anchors
    const requiredAnchors = ['INVESTOR_SIGN', 'INVESTOR_PRINT', 'INVESTOR_DATE', 'AGENT_SIGN', 'AGENT_PRINT', 'AGENT_LICENSE', 'AGENT_BROKERAGE', 'AGENT_DATE'];
    const missingAnchors = [];
    for (const anchor of requiredAnchors) {
      const anchorString = `[[${anchor}]]`;
      if (!templateText.includes(anchorString)) {
        missingAnchors.push(anchor);
      }
    }
    
    if (missingAnchors.length > 0) {
      return Response.json({ error: `DocuSign anchor verification failed: Missing: ${missingAnchors.join(', ')}` }, { status: 500 });
    }
    
    // Generate PDFs
    console.log('[generateLegalAgreement v2.5] Generating PDFs...');
    const [humanPdfBytes, docusignPdfBytes] = await Promise.all([
      generatePdfFromText(templateText, deal.id, false),
      generatePdfFromText(templateText, deal.id, true)
    ]);
    
    const humanHashBuffer = await crypto.subtle.digest('SHA-256', humanPdfBytes);
    const humanPdfSha256 = Array.from(new Uint8Array(humanHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const docusignHashBuffer = await crypto.subtle.digest('SHA-256', docusignPdfBytes);
    const docusignPdfSha256 = Array.from(new Uint8Array(docusignHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Upload PDFs
    const humanBlob = new Blob([humanPdfBytes], { type: 'application/pdf' });
    const humanFile = new File([humanBlob], `agreement_${deal.id}_human.pdf`);
    const docusignBlob = new Blob([docusignPdfBytes], { type: 'application/pdf' });
    const docusignFile = new File([docusignBlob], `agreement_${deal.id}_docusign_${docusignPdfSha256.substring(0, 8)}.pdf`);
    
    const [humanUpload, docusignUpload] = await Promise.all([
      base44.integrations.Core.UploadFile({ file: humanFile }),
      base44.integrations.Core.UploadFile({ file: docusignFile })
    ]);
    
    console.log('[generateLegalAgreement v2.5] PDFs uploaded');
    
    // Create DocuSign envelope
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Void old envelope if exists
    if (toVoidEnvelopeId) {
      try {
        const statusUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${toVoidEnvelopeId}`;
        const statusResp = await fetch(statusUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` } });
        
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          const currentStatus = statusData.status?.toLowerCase();
          
          if (['sent', 'delivered'].includes(currentStatus)) {
            await fetch(statusUrl, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'voided', voidedReason: `Regenerated on ${new Date().toISOString()}` })
            });
          }
        }
      } catch (e) {
        console.warn('[generateLegalAgreement v2.5] Void failed:', e?.message);
      }
    }
    
    const timestamp = Date.now();
    const investorClientUserId = `investor-${deal.id}-${timestamp}`;
    const agentClientUserId = `agent-${deal.id}-${timestamp}`;
    
    const docName = `InvestorKonnect Internal Agreement - ${stateCode} - ${deal.id} - v2.5.pdf`;
    const signers = [];
    
    if (signer_mode === 'investor_only' || signer_mode === 'both') {
      signers.push({
        email: profile.email,
        name: profile.full_name || profile.email,
        recipientId: '1',
        routingOrder: '1',
        clientUserId: investorClientUserId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[INVESTOR_SIGN]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[INVESTOR_DATE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[INVESTOR_PRINT]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true, name: 'Investor Full Name', value: profile.full_name || profile.email, locked: true, required: true, tabLabel: 'investorFullName' }]
        }
      });
    }
    
    console.log(`[${VERSION}] Signer mode: ${signer_mode}, agentProfile.email: ${agentProfile.email}, agentProfile.id: ${agentProfile.id}, signers so far: ${signers.length}`);
    if ((signer_mode === 'both' || signer_mode === 'agent_only') && agentProfile.email && agentProfile.email !== 'TBD') {
      signers.push({
        email: agentProfile.email,
        name: agentProfile.full_name || agentProfile.email,
        recipientId: signer_mode === 'agent_only' ? '1' : '2',
        routingOrder: signer_mode === 'agent_only' ? '1' : '2',
        clientUserId: agentClientUserId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[AGENT_SIGN]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[AGENT_DATE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[AGENT_PRINT]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true, name: 'Agent Full Name', value: agentProfile.full_name || agentProfile.email, locked: true, required: true, tabLabel: 'agentFullName' }],
          textTabs: [
            { documentId: '1', anchorString: '[[AGENT_LICENSE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true, name: 'License Number', value: agentProfile.agent?.license_number || agentProfile.license_number || '', locked: false, required: true, tabLabel: 'agentLicense' },
            { documentId: '1', anchorString: '[[AGENT_BROKERAGE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', anchorIgnoreIfNotPresent: false, anchorCaseSensitive: false, anchorMatchWholeWord: true, name: 'Brokerage', value: agentProfile.agent?.brokerage || agentProfile.broker || '', locked: false, required: true, tabLabel: 'agentBrokerage' }
          ]
        }
      });
    }
    
    console.log(`[${VERSION}] Final signers count: ${signers.length}, signers:`, JSON.stringify(signers.map(s => ({ email: s.email, name: s.name, recipientId: s.recipientId }))));
    
    if (signers.length === 0) {
      return Response.json({ error: `No signers resolved for signer_mode=${signer_mode}. Agent email: ${agentProfile.email}, Agent ID: ${agentProfile.id}` }, { status: 400 });
    }

    const envelopeDefinition = {
      emailSubject: `Sign Agreement - ${stateCode} Deal`,
      documents: [{ documentBase64: btoa(String.fromCharCode(...new Uint8Array(docusignPdfBytes))), name: docName, fileExtension: 'pdf', documentId: '1' }],
      recipients: { signers },
      status: 'sent'
    };
    
    const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;
    
    let createResponse;
    let retries = 0;
    const maxRetries = 5;
    
    while (retries <= maxRetries) {
      try {
        createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(envelopeDefinition)
        });
        
        if (createResponse.status === 429 && retries < maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, retries), 15000);
          await new Promise(r => setTimeout(r, waitMs));
          retries++;
          continue;
        }
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(errorText || 'DocuSign envelope creation failed');
        }
        
        break;
      } catch (err) {
        if (retries < maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, retries), 15000);
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
    
    console.log('[generateLegalAgreement v2.5] Envelope created:', envelopeId);
    
    // Save agreement
    const agreementData = {
      deal_id: effectiveId,
      room_id: room_id || null,
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
      agreement_version: VERSION,
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
      exhibit_a_terms: { ...exhibit_a, buyer_commission_amount: buyerCompAmount },
      rendered_markdown_full: templateText.substring(0, 10000),
      missing_placeholders: [],
      docusign_envelope_id: envelopeId,
      docusign_status: 'sent',
      docusign_envelope_pdf_hash: docusignPdfSha256,
      docusign_last_sent_sha256: docusignPdfSha256,
      investor_recipient_id: (signer_mode === 'investor_only' || signer_mode === 'both') ? '1' : null,
      agent_recipient_id: (signer_mode === 'agent_only') ? '1' : (signer_mode === 'both') ? '2' : null,
      investor_client_user_id: investorClientUserId,
      agent_client_user_id: agentClientUserId,
      investor_signing_url: null,
      agent_signing_url: null,
      audit_log: [{ timestamp: new Date().toISOString(), actor: user.email, action: `envelope_created_${signer_mode}`, details: `Created DocuSign envelope ${envelopeId}` }]
    };
    
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
    
    console.log('[generateLegalAgreement v2.5] Agreement created:', agreement.id);
    
    // Update pointer (don't block)
    if (room_id) {
      base44.asServiceRole.entities.Room.update(room_id, { current_legal_agreement_id: agreement.id }).catch(() => {});
    } else if (!useDraftFlow && effectiveId) {
      base44.asServiceRole.entities.Deal.update(effectiveId, { current_legal_agreement_id: agreement.id }).catch(() => {});
    }
    
    return Response.json({ success: true, agreement: agreement, regenerated: true });
  } catch (error) {
    console.error('[generateLegalAgreement v2.5] Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});