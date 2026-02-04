// v3.0 - Self-contained draft flow support (2024-02-04)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import pdfParse from 'npm:pdf-parse@1.1.1';

// Inline template cache (no local imports)
const templateCache = new Map();
const CACHE_TTL = 3600000;

async function fetchTemplate(url) {
  const cached = templateCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch template: ' + response.status);
  const data = await response.arrayBuffer();
  templateCache.set(url, { data, timestamp: Date.now() });
  return data;
}

// Inline DocuSign connection (no local imports)
async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.filter({});
  if (!connections || connections.length === 0) throw new Error('DocuSign not connected');
  const conn = connections[0];
  if (new Date(conn.expires_at) < new Date()) {
    // Refresh token
    const refreshRes = await fetch('https://account-d.docusign.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
        client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'),
        client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET')
      })
    });
    if (!refreshRes.ok) throw new Error('Failed to refresh DocuSign token');
    const tokens = await refreshRes.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || conn.refresh_token,
      expires_at: newExpiry
    });
    return { access_token: tokens.access_token, account_id: conn.account_id, base_uri: conn.base_uri };
  }
  return { access_token: conn.access_token, account_id: conn.account_id, base_uri: conn.base_uri };
}

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
  const standardBlock = '\n\nSIGNATURES\n\nInvestor:\nSignature: [[INVESTOR_SIGN]]\nPrinted Name: [[INVESTOR_PRINT]]\nDate: [[INVESTOR_DATE]]\n\nAgent:\nSignature: [[AGENT_SIGN]]\nPrinted Name: [[AGENT_PRINT]]\nLicense No.: [[AGENT_LICENSE]]\nBrokerage: [[AGENT_BROKERAGE]]\nDate: [[AGENT_DATE]]\n';
  const patterns = [/^\s*SIGNATURES?\s*$/gim, /^\s*\d+\.?\s*SIGNATURES?\s*$/gim];
  let idx = -1;
  for (const p of patterns) {
    const m = [...text.matchAll(p)];
    if (m.length > 0) { idx = m[m.length - 1].index; break; }
  }
  return idx >= 0 ? text.substring(0, idx) + standardBlock : text + standardBlock;
}

function normalizeWinAnsi(text) {
  const replacements = [
    [/\u2013/g, '-'], [/\u2014/g, '-'], [/\u2212/g, '-'], [/\u2022/g, '*'], [/\u00B7/g, '-'],
    [/\u2026/g, '...'], [/\u201C/g, '"'], [/\u201D/g, '"'], [/\u2018/g, "'"], [/\u2019/g, "'"],
    [/\u00AD/g, ''], [/\u00A0/g, ' '], [/\u200B/g, ''], [/\uFEFF/g, '']
  ];
  let out = text;
  for (const [p, r] of replacements) out = out.replace(p, r);
  return out.replace(/[^\x00-\xFF]/g, '');
}

async function sha256(data) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generatePdf(text, dealId, isDocuSign = false) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 60, pageW = 612, pageH = 792, maxW = pageW - 2 * margin, lineH = 13, fontSize = 10;
  let page = pdf.addPage([pageW, pageH]), y = pageH - margin;
  
  for (const line of text.split('\n')) {
    if (y < margin + 30) { page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
    if (!line.trim()) { y -= lineH * 0.5; continue; }
    const isHead = /^[A-Z\s]{15,}$/.test(line.trim()) || /^\d+\)/.test(line.trim());
    const f = isHead ? bold : font, sz = isHead ? 11 : fontSize;
    const hasAnchor = /\[\[[A-Z_]+\]\]/.test(line);
    
    if (hasAnchor && isDocuSign) {
      const parts = line.split(/(\[\[[A-Z_]+\]\])/);
      let x = margin;
      for (const part of parts) {
        if (!part) continue;
        if (/\[\[[A-Z_]+\]\]/.test(part)) {
          page.drawText(part, { x, y, size: 1, font, color: rgb(1, 1, 1) });
        } else if (part.trim()) {
          page.drawText(part, { x, y, size: sz, font: f, color: rgb(0, 0, 0) });
          x += f.widthOfTextAtSize(part, sz);
        }
      }
      y -= lineH;
    } else {
      const cleanLine = hasAnchor ? line.replace(/\[\[[A-Z_]+\]\]/g, '') : line;
      const words = cleanLine.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (f.widthOfTextAtSize(test, sz) > maxW && cur) {
          page.drawText(cur, { x: margin, y, size: sz, font: f, color: rgb(0, 0, 0) });
          y -= lineH;
          if (y < margin + 30) { page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
          cur = w;
        } else cur = test;
      }
      if (cur) { page.drawText(cur, { x: margin, y, size: sz, font: f, color: rgb(0, 0, 0) }); y -= lineH; }
    }
    if (isHead) y -= lineH * 0.5;
  }
  
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText('Page ' + (i + 1) + ' of ' + pages.length, { x: pageW / 2 - 30, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  }
  return await pdf.save();
}

function buildRenderContext(deal, profile, agent, exhibit, fillAgent) {
  const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://agent-vault-da3d088b.base44.app/';
  let buyerVal = '3%';
  if (exhibit.buyer_commission_type === 'flat') buyerVal = '$' + (exhibit.buyer_flat_fee || 5000).toLocaleString();
  else if (exhibit.buyer_commission_type === 'percentage') buyerVal = (exhibit.buyer_commission_percentage || 3) + '%';
  
  return {
    PLATFORM_NAME: 'investor konnect', PLATFORM_URL: appUrl, WEBSITE_URL: appUrl, APP_URL: appUrl, PLATFORM_WEBSITE_URL: appUrl,
    DEAL_ID: deal.id || 'N/A', EFFECTIVE_DATE: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    INVESTOR_LEGAL_NAME: profile.full_name || profile.email || 'N/A', INVESTOR_ENTITY_TYPE: 'Individual', INVESTOR_EMAIL: profile.email || 'N/A',
    AGENT_LEGAL_NAME: fillAgent ? (agent.full_name || 'TBD') : 'TBD',
    LICENSE_NUMBER: fillAgent ? (agent.agent?.license_number || agent.license_number || 'TBD') : 'TBD',
    BROKERAGE_NAME: fillAgent ? (agent.agent?.brokerage || agent.broker || 'TBD') : 'TBD',
    PROPERTY_ADDRESS: deal.property_address || 'TBD', CITY: deal.city || 'TBD', STATE: deal.state || 'N/A', ZIP: deal.zip || 'N/A', COUNTY: deal.county || 'N/A',
    VENUE: deal.county && deal.state ? deal.county + ' County, ' + deal.state : deal.state || 'N/A',
    TRANSACTION_TYPE: exhibit.transaction_type || 'ASSIGNMENT', BUYER_COMP_VALUE: buyerVal,
    AGREEMENT_LENGTH_DAYS: (exhibit.agreement_length_days || 180).toString(), TERM_DAYS: (exhibit.agreement_length_days || 180).toString()
  };
}

Deno.serve(async (req) => {
  console.log('[generateLegalAgreement v3.0] Starting...');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    console.log('[generateLegalAgreement v3.0] Body:', JSON.stringify(body).substring(0, 500));
    
    const draft_id = body.draft_id || null;
    const deal_id = body.deal_id || null;
    const room_id = body.room_id || null;
    let exhibit_a = body.exhibit_a || {};
    const signer_mode = body.signer_mode || (room_id ? 'both' : 'investor_only');

    console.log('[generateLegalAgreement v3.0] Params:', { deal_id, draft_id, room_id, signer_mode });

    if (!deal_id && !draft_id) {
      console.log('[generateLegalAgreement v3.0] ERROR: Missing both deal_id and draft_id');
      return Response.json({ error: 'deal_id or draft_id required (v3.0)' }, { status: 400 });
    }
    
    // Load profile
    let profile = null;
    if (body.investor_profile_id) {
      const profiles = await base44.asServiceRole.entities.Profile.filter({ id: body.investor_profile_id });
      profile = profiles?.[0];
    }
    if (!profile) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      profile = profiles?.[0];
    }
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // Load or build deal
    let deal = null;
    if (deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals?.length) return Response.json({ error: 'Deal not found' }, { status: 404 });
      deal = deals[0];
    } else if (draft_id) {
      if (!body.state) return Response.json({ error: 'State required for draft' }, { status: 400 });
      deal = { id: draft_id, state: body.state, city: body.city || 'TBD', county: body.county || 'TBD', zip: body.zip || 'TBD', property_address: body.property_address || 'TBD', property_type: 'Single Family' };
      console.log('[generateLegalAgreement v3.0] Draft deal:', deal);
    }

    // Load room if needed
    let room = null, agentProfile = { id: 'TBD', full_name: 'TBD', email: 'TBD', user_id: 'TBD', agent: { license_number: 'TBD', brokerage: 'TBD' } };
    // Save the explicitly passed exhibit_a terms - these take precedence (e.g. from counter offer)
    const passedExhibitA = { ...exhibit_a };
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0];
      if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });
      const agentId = body.agent_profile_id || room.agent_ids?.[0];
      if (agentId) {
        const agents = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
        if (agents?.length) agentProfile = agents[0];
        // Merge order: room.agent_terms (base) -> passedExhibitA (override)
        // Passed terms take precedence over stored room.agent_terms
        if (room.agent_terms?.[agentId]) {
          exhibit_a = { ...room.agent_terms[agentId], ...passedExhibitA };
        }
      }
    }
    
    const fillAgent = !!room_id;
    if (!deal.state) return Response.json({ error: 'State required' }, { status: 400 });
    
    const stateCode = deal.state.toUpperCase();
    const templateUrl = STATE_TEMPLATES[stateCode];
    if (!templateUrl) return Response.json({ error: 'No template for state: ' + deal.state }, { status: 400 });
    
    const renderContext = buildRenderContext(deal, profile, agentProfile, exhibit_a, fillAgent);
    const inputHash = await sha256(JSON.stringify({ stateCode, deal: deal.id, profile: profile.id, exhibit_a, version: '3.0' }));
    
    // Check existing
    const existing = room_id
      ? await base44.asServiceRole.entities.LegalAgreement.filter({ room_id }, '-created_date', 1)
      : deal_id ? await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 1) : [];
    
    if (existing.length && existing[0].render_input_hash === inputHash && existing[0].final_pdf_url && existing[0].docusign_envelope_id && !['superseded', 'voided'].includes(existing[0].status)) {
      console.log('[generateLegalAgreement v3.0] Returning existing');
      return Response.json({ success: true, agreement: existing[0], regenerated: false });
    }
    
    const toVoidId = existing[0]?.docusign_envelope_id;
    const existingId = existing[0]?.id;
    
    // Fetch and process template
    console.log('[generateLegalAgreement v3.0] Fetching template:', templateUrl);
    const templateBytes = await fetchTemplate(templateUrl);
    const pdfData = await pdfParse(new Uint8Array(templateBytes));
    let text = pdfData.text;
    
    // Replace placeholders
    text = text.replace(/\{([A-Z0-9_]+)\}/g, (m, token) => {
      const val = renderContext[token];
      if (val !== undefined && val !== null && val !== '' && val !== 'N/A' && (val !== 'TBD' || (!fillAgent && ['AGENT_LEGAL_NAME', 'LICENSE_NUMBER', 'BROKERAGE_NAME'].includes(token)))) return String(val);
      return m;
    });
    
    text = normalizeWinAnsi(text);
    text = normalizeSignatureSection(text);
    
    // Verify anchors
    const anchors = ['INVESTOR_SIGN', 'INVESTOR_PRINT', 'INVESTOR_DATE', 'AGENT_SIGN', 'AGENT_PRINT', 'AGENT_LICENSE', 'AGENT_BROKERAGE', 'AGENT_DATE'];
    const missing = anchors.filter(a => !text.includes('[[' + a + ']]'));
    if (missing.length) return Response.json({ error: 'Missing anchors: ' + missing.join(', ') }, { status: 500 });
    
    // Generate PDFs
    console.log('[generateLegalAgreement v3.0] Generating PDFs...');
    const [humanBytes, dsBytes] = await Promise.all([generatePdf(text, deal.id, false), generatePdf(text, deal.id, true)]);
    const humanHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', humanBytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    const dsHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', dsBytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Upload
    const [humanUp, dsUp] = await Promise.all([
      base44.integrations.Core.UploadFile({ file: new File([new Blob([humanBytes], { type: 'application/pdf' })], 'agreement_' + deal.id + '_human.pdf') }),
      base44.integrations.Core.UploadFile({ file: new File([new Blob([dsBytes], { type: 'application/pdf' })], 'agreement_' + deal.id + '_ds.pdf') })
    ]);
    console.log('[generateLegalAgreement v3.0] PDFs uploaded');
    
    // DocuSign
    const conn = await getDocuSignConnection(base44);
    
    // Void old if needed
    if (toVoidId) {
      try {
        const statusRes = await fetch(conn.base_uri + '/restapi/v2.1/accounts/' + conn.account_id + '/envelopes/' + toVoidId, { headers: { 'Authorization': 'Bearer ' + conn.access_token } });
        if (statusRes.ok) {
          const st = (await statusRes.json()).status?.toLowerCase();
          if (['sent', 'delivered'].includes(st)) {
            await fetch(conn.base_uri + '/restapi/v2.1/accounts/' + conn.account_id + '/envelopes/' + toVoidId, {
              method: 'PUT', headers: { 'Authorization': 'Bearer ' + conn.access_token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'voided', voidedReason: 'Regenerated' })
            });
          }
        }
      } catch (e) { console.warn('[generateLegalAgreement v3.0] Void failed:', e?.message); }
    }
    
    const ts = Date.now();
    const invClientId = 'investor-' + deal.id + '-' + ts;
    const agentClientId = 'agent-' + deal.id + '-' + ts;
    
    const signers = [];
    if (signer_mode === 'investor_only' || signer_mode === 'both') {
      signers.push({
        email: profile.email, name: profile.full_name || profile.email, recipientId: '1', routingOrder: '1', clientUserId: invClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[INVESTOR_SIGN]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[INVESTOR_DATE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[INVESTOR_PRINT]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', value: profile.full_name || profile.email, locked: true, required: true }]
        }
      });
    }
    if (signer_mode === 'both' && agentProfile.email && agentProfile.email !== 'TBD') {
      signers.push({
        email: agentProfile.email, name: agentProfile.full_name || agentProfile.email, recipientId: '2', routingOrder: '2', clientUserId: agentClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[AGENT_SIGN]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[AGENT_DATE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[AGENT_PRINT]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', value: agentProfile.full_name || agentProfile.email, locked: true, required: true }],
          textTabs: [
            { documentId: '1', anchorString: '[[AGENT_LICENSE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', value: agentProfile.agent?.license_number || '', required: true },
            { documentId: '1', anchorString: '[[AGENT_BROKERAGE]]', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0', value: agentProfile.agent?.brokerage || '', required: true }
          ]
        }
      });
    }
    
    const envDef = {
      emailSubject: 'Sign Agreement - ' + stateCode,
      documents: [{ documentBase64: btoa(String.fromCharCode(...new Uint8Array(dsBytes))), name: 'Agreement-' + deal.id + '.pdf', fileExtension: 'pdf', documentId: '1' }],
      recipients: { signers }, status: 'sent'
    };
    
    let envRes;
    for (let i = 0; i <= 3; i++) {
      envRes = await fetch(conn.base_uri + '/restapi/v2.1/accounts/' + conn.account_id + '/envelopes', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + conn.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify(envDef)
      });
      if (envRes.status === 429 && i < 3) { await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); continue; }
      if (!envRes.ok) throw new Error(await envRes.text());
      break;
    }
    
    const envelope = await envRes.json();
    console.log('[generateLegalAgreement v3.0] Envelope:', envelope.envelopeId);
    
    // Save agreement
    const agreement = await base44.asServiceRole.entities.LegalAgreement.create({
      deal_id: deal_id || draft_id, room_id: room_id || null, investor_user_id: user.id, agent_user_id: agentProfile.user_id,
      investor_profile_id: profile.id, agent_profile_id: agentProfile.id, governing_state: deal.state, property_zip: deal.zip,
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT', property_type: deal.property_type || 'Single Family',
      agreement_version: '3.0', signer_mode, status: 'sent', template_url: templateUrl,
      final_pdf_url: humanUp.file_url, pdf_file_url: humanUp.file_url, pdf_sha256: humanHash,
      docusign_pdf_url: dsUp.file_url, docusign_pdf_sha256: dsHash, signing_pdf_url: dsUp.file_url,
      render_context_json: renderContext, render_input_hash: inputHash, exhibit_a_terms: exhibit_a,
      docusign_envelope_id: envelope.envelopeId, docusign_status: 'sent', docusign_last_sent_sha256: dsHash,
      investor_recipient_id: (signer_mode === 'investor_only' || signer_mode === 'both') ? '1' : null,
      agent_recipient_id: signer_mode === 'both' ? '2' : null,
      investor_client_user_id: invClientId, agent_client_user_id: agentClientId,
      supersedes_agreement_id: existingId || null,
      audit_log: [{ timestamp: new Date().toISOString(), actor: user.email, action: 'created_' + signer_mode }]
    });
    
    console.log('[generateLegalAgreement v3.0] Agreement created:', agreement.id);
    
    // Update pointers
    if (room_id) base44.asServiceRole.entities.Room.update(room_id, { current_legal_agreement_id: agreement.id }).catch(() => {});
    else if (deal_id) base44.asServiceRole.entities.Deal.update(deal_id, { current_legal_agreement_id: agreement.id }).catch(() => {});
    
    return Response.json({ success: true, agreement, regenerated: true });
  } catch (error) {
    console.error('[generateLegalAgreement v3.0] Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});