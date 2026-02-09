import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import pdfParse from 'npm:pdf-parse@1.1.1';

const VERSION = '4.0.0';

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

// ---- Helpers ----

function normalizeWinAnsi(text) {
  const map = { '\u2013':'-','\u2014':'-','\u2212':'-','\u2022':'*','\u00B7':'-','\u2026':'...','\u201C':'"','\u201D':'"','\u2018':"'",'\u2019':"'",'\u00AD':'','\u00A0':' ','\u200B':'','\uFEFF':'' };
  let out = text.replace(/[\u2013\u2014\u2212\u2022\u00B7\u2026\u201C\u201D\u2018\u2019\u00AD\u00A0\u200B\uFEFF]/g, ch => map[ch] ?? '');
  return out.replace(/[^\x00-\xFF]/g, '');
}

function addSignatureBlock(text) {
  const block = `\n\nSIGNATURES\n\nInvestor:\nSignature: [[INVESTOR_SIGN]]\nPrinted Name: [[INVESTOR_PRINT]]\nDate: [[INVESTOR_DATE]]\n\nAgent:\nSignature: [[AGENT_SIGN]]\nPrinted Name: [[AGENT_PRINT]]\nLicense No.: [[AGENT_LICENSE]]\nBrokerage: [[AGENT_BROKERAGE]]\nDate: [[AGENT_DATE]]\n`;
  const sigIdx = text.search(/^\s*\d*\.?\s*SIGNATURES?\s*$/gim);
  return sigIdx >= 0 ? text.substring(0, sigIdx) + block : text + block;
}

async function sha256Hex(data) {
  const buf = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generatePdf(text, isDocuSign = false) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fs = 10, lh = 13, margin = 60, pw = 612, ph = 792, maxW = pw - 2 * margin;

  let page = pdfDoc.addPage([pw, ph]);
  let y = ph - margin;

  for (const line of text.split('\n')) {
    if (y < margin + 30) { page = pdfDoc.addPage([pw, ph]); y = ph - margin; }
    if (!line.trim()) { y -= lh * 0.5; continue; }

    const isTitle = line.includes('INTERNAL OPERATING AGREEMENT') || line.includes('InvestorKonnect');
    const isHeading = /^[A-Z\s]{15,}$/.test(line.trim()) || /^\d+\)/.test(line.trim());
    const curFont = (isTitle || isHeading) ? boldFont : font;
    const curSize = isTitle ? 14 : isHeading ? 11 : fs;

    const hasAnchors = /\[\[([A-Z_]+)\]\]/.test(line);
    if (hasAnchors && isDocuSign) {
      const parts = line.split(/(\[\[[A-Z_]+\]\])/);
      let xPos = margin;
      for (const part of parts) {
        if (!part) continue;
        if (/\[\[[A-Z_]+\]\]/.test(part)) {
          page.drawText(part, { x: xPos, y, size: 1, font, color: rgb(1, 1, 1) });
        } else if (part.trim()) {
          page.drawText(part, { x: xPos, y, size: curSize, font: curFont, color: rgb(0, 0, 0) });
          xPos += curFont.widthOfTextAtSize(part, curSize);
        }
      }
      y -= lh;
    } else {
      const cleanLine = hasAnchors ? line.replace(/\[\[[A-Z_]+\]\]/g, '') : line;
      let curLine = '';
      for (const word of cleanLine.split(' ')) {
        const test = curLine ? `${curLine} ${word}` : word;
        if (curFont.widthOfTextAtSize(test, curSize) > maxW && curLine) {
          page.drawText(curLine, { x: margin, y, size: curSize, font: curFont, color: rgb(0, 0, 0) });
          y -= lh;
          if (y < margin + 30) { page = pdfDoc.addPage([pw, ph]); y = ph - margin; }
          curLine = word;
        } else { curLine = test; }
      }
      if (curLine) { page.drawText(curLine, { x: margin, y, size: curSize, font: curFont, color: rgb(0, 0, 0) }); y -= lh; }
    }
    if (isHeading || isTitle) y -= lh * 0.5;
  }

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText(`Page ${i + 1} of ${pages.length}`, { x: pw / 2 - 30, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  }
  return await pdfDoc.save();
}

function buildContext(deal, investor, agent, exhibit_a, fillAgent) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const venue = deal.county && deal.state ? `${deal.county} County, ${deal.state}` : deal.state || 'N/A';
  const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://agent-vault-da3d088b.base44.app/';

  let buyerCompValue = '3%';
  if (exhibit_a.buyer_commission_type === 'flat') {
    buyerCompValue = `$${(exhibit_a.buyer_flat_fee || 5000).toLocaleString()}`;
  } else {
    buyerCompValue = `${exhibit_a.buyer_commission_percentage || 3}%`;
  }

  return {
    AGREEMENT_VERSION: 'InvestorKonnect v2.0', PLATFORM_NAME: 'investor konnect',
    PLATFORM_URL: appUrl, WEBSITE_URL: appUrl, APP_URL: appUrl, PLATFORM_WEBSITE_URL: appUrl,
    DEAL_ID: deal.id || 'N/A', EFFECTIVE_DATE: date,
    INVESTOR_LEGAL_NAME: investor.full_name || investor.email || 'N/A',
    INVESTOR_ENTITY_TYPE: 'Individual', INVESTOR_EMAIL: investor.email || 'N/A', INVESTOR_PHONE: investor.phone || 'N/A',
    AGENT_LEGAL_NAME: fillAgent ? (agent.full_name || agent.email || 'TBD') : 'TBD',
    LICENSE_NUMBER: fillAgent ? (agent.agent?.license_number || agent.license_number || 'TBD') : 'TBD',
    BROKERAGE_NAME: fillAgent ? (agent.agent?.brokerage || agent.broker || 'TBD') : 'TBD',
    AGENT_EMAIL: fillAgent ? (agent.email || 'TBD') : 'TBD',
    AGENT_PHONE: fillAgent ? (agent.phone || 'TBD') : 'TBD',
    PROPERTY_ADDRESS: deal.property_address || 'TBD', CITY: deal.city || 'TBD',
    STATE: deal.state || 'N/A', ZIP: deal.zip || 'N/A', COUNTY: deal.county || 'N/A', VENUE: venue,
    TRANSACTION_TYPE: exhibit_a.transaction_type || 'ASSIGNMENT',
    BUYER_COMP_TYPE: exhibit_a.buyer_commission_type === 'flat' ? 'Flat Fee' : 'Commission Percentage',
    BUYER_COMP_VALUE: buyerCompValue,
    AGREEMENT_LENGTH_DAYS: (exhibit_a.agreement_length_days || 180).toString(),
    TERM_DAYS: (exhibit_a.agreement_length_days || 180).toString(),
    TERMINATION_NOTICE_DAYS: '30', EXCLUSIVITY_ON_OFF: 'OFF', ROFR_ON_OFF: 'OFF', ROFR_PERIOD_DAYS: '0',
    COMPENSATION_MODEL: 'FLAT_FEE', FLAT_FEE_AMOUNT: '$5,000', COMMISSION_PERCENTAGE: '3%',
    SELLER_COMP_TYPE: 'Flat Fee', SELLER_COMP_VALUE: '$5,000'
  };
}

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections?.length) throw new Error('DocuSign not connected');
  let conn = connections[0];
  const now = new Date();
  if (conn.expires_at && now >= new Date(conn.expires_at) && conn.refresh_token) {
    const tokenUrl = conn.base_uri.includes('demo') ? 'https://account-d.docusign.com/oauth/token' : 'https://account.docusign.com/oauth/token';
    const resp = await fetch(tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token, client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'), client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET') })
    });
    if (!resp.ok) throw new Error('DocuSign token refresh failed');
    const tokens = await resp.json();
    const newExpires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, { access_token: tokens.access_token, refresh_token: tokens.refresh_token || conn.refresh_token, expires_at: newExpires });
    conn.access_token = tokens.access_token;
    conn.expires_at = newExpires;
  } else if (conn.expires_at && now >= new Date(conn.expires_at)) {
    throw new Error('DocuSign token expired');
  }
  return conn;
}

// ---- Main Handler ----

Deno.serve(async (req) => {
  console.log(`[genAgreement ${VERSION}] START`);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draft_id, deal_id, room_id, signer_mode: requestedMode, investor_profile_id, investor_user_id: explicitInvestorUserId } = body;
    let exhibit_a = body.exhibit_a || {};
    const signer_mode = requestedMode || (room_id ? 'both' : 'investor_only');
    const effectiveId = draft_id || deal_id;

    if (!effectiveId) return Response.json({ error: 'deal_id or draft_id required' }, { status: 400 });
    console.log(`[genAgreement] ids: deal=${deal_id} draft=${draft_id} room=${room_id} mode=${signer_mode}`);

    // Load investor profile — CRITICAL: use investor_profile_id when provided (e.g. agent triggering regen)
    let investor = null;
    if (investor_profile_id) {
      const p = await base44.asServiceRole.entities.Profile.filter({ id: investor_profile_id });
      investor = p?.[0];
    }
    if (!investor) {
      const p = await base44.entities.Profile.filter({ user_id: user.id });
      investor = p?.[0];
    }
    if (!investor) return Response.json({ error: 'Investor profile not found' }, { status: 404 });

    // Resolve the authoritative investor user_id — use explicit if provided, or from the profile
    const resolvedInvestorUserId = explicitInvestorUserId || investor.user_id || user.id;

    // Load deal context
    let deal;
    if (draft_id) {
      if (!body.state) return Response.json({ error: 'State required for draft' }, { status: 400 });
      deal = { id: effectiveId, state: body.state, city: body.city || 'TBD', county: body.county || 'TBD', zip: body.zip || 'TBD', property_address: body.property_address || 'TBD', property_type: 'Single Family' };
    } else {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: effectiveId });
      if (!deals?.length) return Response.json({ error: 'Deal not found' }, { status: 404 });
      deal = deals[0];
    }

    // Load room + agent
    let room = null, agent = { id: 'TBD', full_name: 'TBD', email: 'TBD', user_id: 'TBD', agent: { license_number: 'TBD', brokerage: 'TBD' } };
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0];
      if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });
      // Use explicit agent_profile_id if provided (e.g. regeneration for a specific agent)
      const agentId = body.agent_profile_id || room.agent_ids?.[0];
      if (!agentId) return Response.json({ error: 'No agent in room' }, { status: 400 });
      console.log(`[genAgreement] Resolved agentId: ${agentId} (explicit: ${!!body.agent_profile_id})`);
      // Merge room terms
      const agentTerms = room.agent_terms?.[agentId];
      if (agentTerms) exhibit_a = { ...exhibit_a, ...agentTerms };
      const ap = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      if (ap?.length) agent = ap[0];
    }

    const fillAgent = !!room_id;
    const stateCode = deal.state.toUpperCase();
    const templateUrl = STATE_TEMPLATES[stateCode];
    if (!templateUrl) return Response.json({ error: `No template for state: ${stateCode}` }, { status: 400 });

    // Build input hash for cache
    const inputHash = await sha256Hex(JSON.stringify({ stateCode, deal_id: deal.id, investor_email: investor.email, agent_email: agent.email, exhibit_a, signer_mode, v: VERSION }));

    // CACHE: Check for existing active agreement with EXACT same signer_mode
    if (room_id) {
      const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ room_id }, '-created_date', 10);
      const match = existing.find(a => a.signer_mode === signer_mode && a.status !== 'superseded' && a.status !== 'voided');
      if (match && match.render_input_hash === inputHash && match.final_pdf_url && match.docusign_envelope_id) {
        console.log(`[genAgreement] CACHE HIT: ${match.id} mode=${match.signer_mode}`);
        return Response.json({ success: true, agreement: match, regenerated: false });
      }
      // Void old same-mode agreement if exists
      if (match) {
        await base44.asServiceRole.entities.LegalAgreement.update(match.id, { status: 'superseded' });
      }
    }

    // Generate PDFs
    const ctx = buildContext(deal, investor, agent, exhibit_a, fillAgent);
    const templateBytes = await (await fetch(templateUrl)).arrayBuffer();
    const pdfData = await pdfParse(new Uint8Array(templateBytes));
    let text = pdfData.text;

    // Replace tokens
    const missing = [];
    text = text.replace(/\{([A-Z0-9_]+)\}/g, (match, token) => {
      const val = ctx[token];
      const isAgentField = ['AGENT_LEGAL_NAME', 'LICENSE_NUMBER', 'BROKERAGE_NAME', 'AGENT_EMAIL', 'AGENT_PHONE'].includes(token);
      if (val && val !== 'N/A' && (val !== 'TBD' || (isAgentField && !fillAgent))) return String(val);
      missing.push(token);
      return match;
    });
    if (missing.length) return Response.json({ error: `Missing fields: ${missing.join(', ')}`, missing_placeholders: missing }, { status: 400 });

    text = normalizeWinAnsi(addSignatureBlock(text));
    const [humanPdf, dsPdf] = await Promise.all([generatePdf(text, false), generatePdf(text, true)]);

    // Upload PDFs
    const [humanUpload, dsUpload] = await Promise.all([
      base44.integrations.Core.UploadFile({ file: new File([new Blob([humanPdf], { type: 'application/pdf' })], `agreement_${deal.id}_human.pdf`) }),
      base44.integrations.Core.UploadFile({ file: new File([new Blob([dsPdf], { type: 'application/pdf' })], `agreement_${deal.id}_ds.pdf`) })
    ]);

    // Create DocuSign envelope
    const conn = await getDocuSignConnection(base44);
    const ts = Date.now();
    const investorClientId = `inv-${deal.id}-${ts}`;
    const agentClientId = `ag-${deal.id}-${ts}`;

    // ALWAYS include both signers in the envelope so agent signs the SAME document.
    // investor_only: investor signs first (routingOrder 1), agent placeholder added as routingOrder 2
    // agent_only: used when adding agent to an existing envelope — should NOT happen anymore
    // both: both signers active
    const signers = [];
    
    // Investor signer — always included (routingOrder 1)
    if (signer_mode !== 'agent_only') {
      signers.push({
        email: investor.email, name: investor.full_name || investor.email,
        recipientId: '1', routingOrder: '1', clientUserId: investorClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[INVESTOR_SIGN]]', anchorUnits: 'pixels' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[INVESTOR_DATE]]', anchorUnits: 'pixels' }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[INVESTOR_PRINT]]', anchorUnits: 'pixels', value: investor.full_name || investor.email, locked: true, required: true, tabLabel: 'investorFullName' }]
        }
      });
    }

    // Agent signer — always included as routingOrder 2 so they sign the SAME envelope after investor
    // For investor_only mode with no real agent yet, use a placeholder email that will be updated later
    const hasRealAgent = agent.email && agent.email !== 'TBD';
    if (hasRealAgent) {
      signers.push({
        email: agent.email, name: agent.full_name || agent.email,
        recipientId: '2', routingOrder: '2', clientUserId: agentClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[AGENT_SIGN]]', anchorUnits: 'pixels' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[AGENT_DATE]]', anchorUnits: 'pixels' }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[AGENT_PRINT]]', anchorUnits: 'pixels', value: agent.full_name || agent.email, locked: true, required: true, tabLabel: 'agentFullName' }],
          textTabs: [
            { documentId: '1', anchorString: '[[AGENT_LICENSE]]', anchorUnits: 'pixels', value: agent.agent?.license_number || agent.license_number || '', required: true, tabLabel: 'agentLicense' },
            { documentId: '1', anchorString: '[[AGENT_BROKERAGE]]', anchorUnits: 'pixels', value: agent.agent?.brokerage || agent.broker || '', required: true, tabLabel: 'agentBrokerage' }
          ]
        }
      });
    } else if (signer_mode === 'agent_only') {
      // Legacy agent_only — should not happen in new flow
      signers.push({
        email: investor.email, name: 'Agent Placeholder',
        recipientId: '1', routingOrder: '1', clientUserId: agentClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[AGENT_SIGN]]', anchorUnits: 'pixels' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[AGENT_DATE]]', anchorUnits: 'pixels' }]
        }
      });
    }

    if (!signers.length) return Response.json({ error: `No signers for mode=${signer_mode}` }, { status: 400 });

    const envDef = {
      emailSubject: `Sign Agreement - ${stateCode} Deal`,
      documents: [{ documentBase64: btoa(String.fromCharCode(...new Uint8Array(dsPdf))), name: `Agreement-${stateCode}-${deal.id}.pdf`, fileExtension: 'pdf', documentId: '1' }],
      recipients: { signers },
      status: 'sent'
    };

    const envResp = await fetch(`${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(envDef)
    });
    if (!envResp.ok) throw new Error(await envResp.text());
    const envelope = await envResp.json();
    console.log(`[genAgreement] Envelope: ${envelope.envelopeId}`);

    // Determine actual recipient IDs based on who was included in the envelope
    // If we have a real agent, they were added as recipientId 2 regardless of signer_mode
    const actualAgentRecipientId = hasRealAgent ? '2' : ((signer_mode === 'agent_only') ? '1' : null);
    const actualInvestorRecipientId = (signer_mode !== 'agent_only') ? '1' : null;
    // If real agent was included, the effective mode is 'both' in the envelope even if signer_mode says investor_only
    const effectiveSignerMode = (signer_mode === 'investor_only' && hasRealAgent) ? 'both' : signer_mode;

    console.log(`[genAgreement] Storing: signer_mode=${effectiveSignerMode} inv_recip=${actualInvestorRecipientId} ag_recip=${actualAgentRecipientId} hasRealAgent=${hasRealAgent}`);

    // Save agreement — use resolved investor user_id (not calling user, who may be an agent)
    const agreement = await base44.asServiceRole.entities.LegalAgreement.create({
      deal_id: effectiveId, room_id: room_id || null,
      investor_user_id: resolvedInvestorUserId, agent_user_id: agent.user_id,
      investor_profile_id: investor.id, agent_profile_id: agent.id,
      governing_state: deal.state, property_zip: deal.zip,
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
      property_type: deal.property_type || 'Single Family',
      agreement_version: VERSION, signer_mode: effectiveSignerMode, status: 'sent',
      template_url: templateUrl,
      final_pdf_url: humanUpload.file_url, pdf_file_url: humanUpload.file_url, pdf_sha256: await sha256Hex(humanPdf),
      docusign_pdf_url: dsUpload.file_url, docusign_pdf_sha256: await sha256Hex(dsPdf),
      signing_pdf_url: dsUpload.file_url,
      render_input_hash: inputHash, render_context_json: ctx,
      exhibit_a_terms: exhibit_a,
      docusign_envelope_id: envelope.envelopeId, docusign_status: 'sent',
      investor_recipient_id: actualInvestorRecipientId,
      agent_recipient_id: actualAgentRecipientId,
      investor_client_user_id: investorClientId,
      agent_client_user_id: hasRealAgent ? agentClientId : null,
      audit_log: [{ timestamp: new Date().toISOString(), actor: user.email, action: `created_${effectiveSignerMode}` }]
    });

    // Update pointers
    if (room_id) {
      base44.asServiceRole.entities.Room.update(room_id, { current_legal_agreement_id: agreement.id }).catch(() => {});
    }
    // Always update Deal pointer if deal_id is a real Deal (not a draft)
    if (deal_id) {
      base44.asServiceRole.entities.Deal.update(deal_id, { current_legal_agreement_id: agreement.id }).catch(() => {});
    }

    console.log(`[genAgreement] Created: ${agreement.id}`);
    return Response.json({ success: true, agreement, regenerated: true });
  } catch (error) {
    console.error(`[genAgreement] Error:`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});