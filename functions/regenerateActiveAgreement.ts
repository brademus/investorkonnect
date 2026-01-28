import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
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
      throw new Error('DocuSign token expired and refresh failed');
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id, room_id } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    console.log('[regenerateActiveAgreement] Mode:', room_id ? 'ROOM-SCOPED' : 'LEGACY');

    // Verify investor
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.user_role !== 'investor') {
      return Response.json({ error: 'Only investor can regenerate' }, { status: 403 });
    }

    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals?.length) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];

    const terms = deal.proposed_terms || {};
    if (!terms.buyer_commission_type) {
      return Response.json({ error: 'Missing buyer commission terms in deal' }, { status: 400 });
    }

    // Identify current active agreement to void (room-scoped or legacy)
    let currentAgreement = null;
    let room = null;
    
    if (room_id) {
      // ROOM-SCOPED
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0] || null;
      
      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
      
      if (room.current_legal_agreement_id) {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ id: room.current_legal_agreement_id });
        currentAgreement = a?.[0] || null;
      } else {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ room_id }, '-created_date', 1);
        currentAgreement = a?.[0] || null;
      }
      console.log('[regenerateActiveAgreement] Room-scoped current agreement:', currentAgreement?.id);
    } else {
      // LEGACY
      if (deal.current_legal_agreement_id) {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id });
        currentAgreement = a?.[0] || null;
      } else {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 1);
        currentAgreement = a?.[0] || null;
      }
      console.log('[regenerateActiveAgreement] Legacy current agreement:', currentAgreement?.id);
    }

    // Void old DocuSign envelope if exists
    if (currentAgreement?.docusign_envelope_id) {
      try {
        console.log('[regenerateActiveAgreement] Voiding old envelope:', currentAgreement.docusign_envelope_id);
        const connection = await getDocuSignConnection(base44);
        const voidUrl = `${connection.base_uri}/restapi/v2.1/accounts/${connection.account_id}/envelopes/${currentAgreement.docusign_envelope_id}`;
        const voidResp = await fetch(voidUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            status: 'voided', 
            voidedReason: `Regenerated with new terms at ${new Date().toISOString()}` 
          })
        });

        if (voidResp.ok) {
          console.log('[regenerateActiveAgreement] ✓ Old envelope voided');
        } else {
          console.warn('[regenerateActiveAgreement] Failed to void (continuing anyway)');
        }
      } catch (e) {
        console.warn('[regenerateActiveAgreement] Void error (continuing):', e.message);
      }
    }

    // Mark old agreement as superseded
    if (currentAgreement?.id) {
      await base44.asServiceRole.entities.LegalAgreement.update(currentAgreement.id, {
        status: 'superseded',
        docusign_status: 'voided'
      });
      console.log('[regenerateActiveAgreement] Old agreement marked superseded');
    }

    // Generate new agreement with current terms - normalize fields
    console.log('[regenerateActiveAgreement] Generating new agreement with terms:', terms);
    console.log('[regenerateActiveAgreement] Deal state:', deal.state);
    
    let gen;
    try {
      gen = await base44.functions.invoke('generateLegalAgreement', {
        deal_id,
        room_id: room_id || null, // Pass room_id for room-scoped mode
        exhibit_a: {
          buyer_commission_type: terms.buyer_commission_type || 'flat',
          buyer_commission_percentage: terms.buyer_commission_percentage || null,
          buyer_flat_fee: terms.buyer_flat_fee || null,
          agreement_length_days: terms.agreement_length || 180,
          transaction_type: deal.transaction_type || 'ASSIGNMENT'
        }
      });
    } catch (invokeError) {
      console.error('[regenerateActiveAgreement] generateLegalAgreement invoke failed:', invokeError);
      console.error('[regenerateActiveAgreement] Error status:', invokeError?.response?.status);
      console.error('[regenerateActiveAgreement] Error data:', invokeError?.response?.data);
      throw invokeError;
    }

    console.log('[regenerateActiveAgreement] generateLegalAgreement response:', JSON.stringify(gen.data));

    if (gen.data?.error) {
      console.error('[regenerateActiveAgreement] Error from generateLegalAgreement:', gen.data.error);
      console.error('[regenerateActiveAgreement] Full error details:', gen.data);
      return Response.json({ error: gen.data.error, details: gen.data }, { status: 400 });
    }
    
    if (!gen.data) {
      console.error('[regenerateActiveAgreement] No data returned from generateLegalAgreement');
      return Response.json({ error: 'Agreement generation returned no data' }, { status: 500 });
    }

    const newAgreement = gen.data?.agreement;
    if (!newAgreement?.id) {
      return Response.json({ error: 'Agreement generation failed' }, { status: 500 });
    }

    console.log('[regenerateActiveAgreement] ✓ New agreement created:', newAgreement.id);

    // Update pointers and clear regenerate flag (room-scoped or legacy)
    if (room_id && room) {
      await base44.asServiceRole.entities.Room.update(room_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false
      });
      console.log('[regenerateActiveAgreement] ✓ Room updated with new agreement pointer');
    } else {
      await base44.asServiceRole.entities.Deal.update(deal_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false,
        requires_regenerate_reason: null
      });
      console.log('[regenerateActiveAgreement] ✓ Deal updated with new agreement pointer (legacy)');
    }

    return Response.json({ 
      success: true, 
      agreement: newAgreement 
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Fatal error:', error);
    console.error('[regenerateActiveAgreement] Error type:', error?.constructor?.name);
    console.error('[regenerateActiveAgreement] Error response:', error?.response?.data);
    console.error('[regenerateActiveAgreement] Error message:', error?.message);
    
    const errorMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to regenerate agreement';
    return Response.json({ 
      error: errorMsg,
      details: error?.response?.data 
    }, { status: 500 });
  }
});