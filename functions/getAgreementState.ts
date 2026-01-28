import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[getAgreementState] Rate limited, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections || connections.length === 0) {
    return null;
  }
  
  let connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt && connection.refresh_token) {
    console.log('[getAgreementState] Token expired, refreshing...');
    
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
      console.error('[getAgreementState] Token refresh failed');
      return null;
    }
    
    const tokenData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    await base44.asServiceRole.entities.DocuSignConnection.update(connection.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: newExpiresAt
    });
    
    connection.access_token = tokenData.access_token;
    connection.expires_at = newExpiresAt;
  } else if (now >= expiresAt) {
    return null;
  }
  
  return connection;
}

async function syncDocuSignStatus(base44, agreement) {
  if (!agreement?.docusign_envelope_id) return agreement;
  
  const connection = await getDocuSignConnection(base44);
  if (!connection) {
    console.log('[getAgreementState] No DocuSign connection, skipping sync');
    return agreement;
  }
  
  try {
    const recipientsUrl = `${connection.base_uri}/restapi/v2.1/accounts/${connection.account_id}/envelopes/${agreement.docusign_envelope_id}/recipients`;
    const recipientsResponse = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${connection.access_token}` }
    });
    
    if (!recipientsResponse.ok) {
      console.log('[getAgreementState] Failed to fetch DocuSign recipients');
      return agreement;
    }
    
    const recipients = await recipientsResponse.json();
    const signers = recipients.signers || [];
    
    const investorSigner = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id));
    const agentSigner = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id));
    
    const now = new Date().toISOString();
    const updates = {};
    
    const investorCompleted = investorSigner && (investorSigner.status === 'completed' || investorSigner.status === 'signed');
    const agentCompleted = agentSigner && (agentSigner.status === 'completed' || agentSigner.status === 'signed');
    
    if (investorCompleted && !agreement.investor_signed_at) {
      updates.investor_signed_at = investorSigner.signedDateTime || now;
      console.log('[getAgreementState] ✓ Syncing investor signature to DB');
    }
    if (agentCompleted && !agreement.agent_signed_at) {
      updates.agent_signed_at = agentSigner.signedDateTime || now;
      console.log('[getAgreementState] ✓ Syncing agent signature to DB');
    }
    
    if (Object.keys(updates).length) {
      const invSigned = !!(updates.investor_signed_at || agreement.investor_signed_at);
      const agSigned = !!(updates.agent_signed_at || agreement.agent_signed_at);
      
      updates.status = invSigned && agSigned ? 'fully_signed' : invSigned ? 'investor_signed' : 'agent_signed';
      
      await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
      console.log('[getAgreementState] ✓ DB updated with status:', updates.status);
      
      // Return fresh data
      const fresh = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement.id });
      return fresh?.[0] || agreement;
    }
    
    return agreement;
  } catch (error) {
    console.error('[getAgreementState] DocuSign sync error:', error.message);
    return agreement;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id, room_id, force_refresh } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }

    console.log('[getAgreementState] Loading for deal:', deal_id, 'room_id:', room_id || 'legacy', 'force_refresh:', force_refresh);
    
    // Load deal
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Get active LegalAgreement (room-scoped or legacy deal-scoped)
    let agreement = null;
    let room = null;
    
    if (room_id) {
      // ROOM-SCOPED MODE
      console.log('[getAgreementState] Room-scoped mode');
      
      // Load room
      const rooms = await withRetry(async () => 
        base44.asServiceRole.entities.Room.filter({ id: room_id })
      );
      room = rooms?.[0] || null;
      
      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
      
      // 1) Use Room.current_legal_agreement_id if set
      if (room.current_legal_agreement_id) {
        const a = await withRetry(async () => 
          base44.asServiceRole.entities.LegalAgreement.filter({ id: room.current_legal_agreement_id })
        );
        const candidate = a?.[0] || null;
        
        // If superseded/voided, fall back to latest non-superseded for this room
        if (candidate && (candidate.status === 'superseded' || candidate.status === 'voided')) {
          console.log('[getAgreementState] Room pointer is superseded, finding latest active for room');
          const allAgreements = await withRetry(async () => 
            base44.asServiceRole.entities.LegalAgreement.filter({ room_id }, '-created_date', 10)
          );
          agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || null;
        } else {
          agreement = candidate;
        }
      }
      
      // 2) Fallback: latest non-superseded for this room
      if (!agreement) {
        const allAgreements = await withRetry(async () => 
          base44.asServiceRole.entities.LegalAgreement.filter({ room_id }, '-created_date', 10)
        );
        agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || allAgreements?.[0] || null;
      }
      
      console.log('[getAgreementState] Room-scoped agreement:', {
        id: agreement?.id,
        status: agreement?.status,
        investor_signed_at: agreement?.investor_signed_at,
        agent_signed_at: agreement?.agent_signed_at
      });
    } else {
      // LEGACY DEAL-SCOPED MODE
      console.log('[getAgreementState] Legacy deal-scoped mode');
      
      // 1) Use deal.current_legal_agreement_id if set and not superseded
      if (deal.current_legal_agreement_id) {
        const a = await withRetry(async () => 
          base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id })
        );
        const candidate = a?.[0] || null;
        
        // If superseded/voided, fall back to latest non-superseded
        if (candidate && (candidate.status === 'superseded' || candidate.status === 'voided')) {
          console.log('[getAgreementState] Current pointer is superseded, finding latest active');
          const allAgreements = await withRetry(async () => 
            base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10)
          );
          agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || null;
        } else {
          agreement = candidate;
        }
        
        console.log('[getAgreementState] Resolved agreement by ID:', {
          id: agreement?.id,
          status: agreement?.status,
          investor_signed_at: agreement?.investor_signed_at,
          agent_signed_at: agreement?.agent_signed_at,
          docusign_status: agreement?.docusign_status
        });
      }
      
      // 2) Fallback: latest non-superseded LegalAgreement for this deal (legacy compatibility)
      if (!agreement) {
        const allAgreements = await withRetry(async () => 
          base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10)
        );
        agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || allAgreements?.[0] || null;
        console.log('[getAgreementState] Fallback to latest non-superseded:', {
          id: agreement?.id,
          status: agreement?.status,
          investor_signed_at: agreement?.investor_signed_at,
          agent_signed_at: agreement?.agent_signed_at
        });
      }
    }

    // SYNC with DocuSign only if agreement exists and force_refresh requested
    if (agreement?.docusign_envelope_id && force_refresh) {
      console.log('[getAgreementState] Force refresh - syncing with DocuSign');
      try {
        agreement = await syncDocuSignStatus(base44, agreement);
      } catch (e) {
        console.error('[getAgreementState] Sync error (non-fatal):', e.message);
      }
    }

    // Get pending counter (room-scoped or legacy)
    let pending_counter = null;
    try {
      const counters = room_id
        ? await withRetry(async () => {
            return await base44.asServiceRole.entities.CounterOffer.filter({
              room_id,
              status: 'pending'
            }, '-created_date', 1);
          })
        : await withRetry(async () => {
            return await base44.asServiceRole.entities.CounterOffer.filter({
              deal_id,
              status: 'pending'
            }, '-created_date', 1);
          });

      pending_counter = counters?.[0] || null;
      
      // Backwards compatibility: if terms_delta is missing but terms exists, treat terms as terms_delta
      if (pending_counter && !pending_counter.terms_delta && pending_counter.terms) {
        console.log('[getAgreementState] Applying legacy terms → terms_delta compatibility');
        pending_counter.terms_delta = pending_counter.terms;
      }
      
      console.log('[getAgreementState] Pending counter:', pending_counter?.id || 'none');
    } catch (e) {
      console.log('[getAgreementState] Counter error:', e.message);
    }

    // Derived stage fields for easier UI consumption
    const investor_signed = !!agreement?.investor_signed_at;
    const agent_signed = !!agreement?.agent_signed_at;
    const fully_signed = investor_signed && agent_signed;
    
    // Determine requires_regenerate: room-scoped or legacy
    const requiresRegenerate = room_id && room
      ? !!room.requires_regenerate
      : !!deal.requires_regenerate;

    return Response.json({
      success: true,
      agreement,
      pending_counter,
      deal_terms: deal.proposed_terms || {},
      requires_regenerate: requiresRegenerate,
      // Helper flags
      investor_signed,
      agent_signed,
      fully_signed
    });
    
  } catch (error) {
    console.error('[getAgreementState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});