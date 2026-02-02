import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  
  let connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  // Auto-refresh if token expired and refresh_token exists
  if (now >= expiresAt && connection.refresh_token) {
    console.log('[DocuSign] Token expired, refreshing...');
    
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
      const error = await refreshResponse.text();
      console.error('[DocuSign] Token refresh failed:', error);
      throw new Error('DocuSign token expired and refresh failed. Admin must reconnect DocuSign.');
    }
    
    const tokenData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    // Update connection with new tokens
    await base44.asServiceRole.entities.DocuSignConnection.update(connection.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: newExpiresAt
    });
    
    connection.access_token = tokenData.access_token;
    connection.expires_at = newExpiresAt;
    
    console.log('[DocuSign] Token refreshed successfully');
  } else if (now >= expiresAt) {
    throw new Error('DocuSign token expired and no refresh token available. Admin must reconnect DocuSign.');
  }
  
  return connection;
}

async function downloadPdfAsBase64AndHash(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download agreement PDF');
  }
  const buffer = await response.arrayBuffer();
  
  // Compute hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  return { base64, hash };
}

async function voidEnvelope(baseUri, accountId, accessToken, envelopeId, reason) {
  try {
    const voidUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const voidResponse = await fetch(voidUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'voided',
        voidedReason: reason
      })
    });
    
    if (!voidResponse.ok) {
      console.warn('[DocuSign] Failed to void old envelope:', envelopeId);
    } else {
      console.log('[DocuSign] Successfully voided old envelope:', envelopeId);
    }
  } catch (error) {
    console.warn('[DocuSign] Error voiding envelope:', error.message);
  }
}

/**
 * POST /api/functions/docusignCreateSigningSession
 * Creates embedded signing session with hash-based envelope recreation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id, role, redirect_url, room_id } = await req.json();
    
    console.log('[docusignCreateSigningSession] START:', { agreement_id, role, redirect_url, room_id });
    
    if (!agreement_id || !role) {
      return Response.json({ error: 'agreement_id and role required' }, { status: 400 });
    }
    
    if (!['investor', 'agent'].includes(role)) {
      return Response.json({ error: 'role must be investor or agent' }, { status: 400 });
    }
    
    // Load agreement with backwards compatibility
    let agreement = null;
    let agreementType = null;
    
    // 1) Primary path: agreement_id is a LegalAgreement.id
    const legalAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    if (legalAgreements && legalAgreements.length > 0) {
      agreement = legalAgreements[0];
      agreementType = 'LegalAgreement';
      console.log('[DocuSign] Found LegalAgreement by ID:', {
        id: agreement.id,
        investor_signed_at: agreement.investor_signed_at,
        agent_signed_at: agreement.agent_signed_at,
        status: agreement.status
      });
    } else {
      // 2) Back-compat: check if agreement_id is an AgreementVersion (legacy)
      console.log('[DocuSign] Not found as LegalAgreement, checking legacy AgreementVersion...');
      try {
        const avRecords = await base44.asServiceRole.entities.AgreementVersion.filter({ id: agreement_id });
        if (avRecords && avRecords.length > 0) {
          const av = avRecords[0];
          console.log('[DocuSign] Found AgreementVersion, resolving to active LegalAgreement for deal:', av.deal_id);
          
          // Get deal
          const dealRecords = await base44.asServiceRole.entities.Deal.filter({ id: av.deal_id });
          const deal = dealRecords?.[0];
          
          // Resolve to active LegalAgreement for this deal
          if (deal?.current_legal_agreement_id) {
            const currentLA = await base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id });
            const candidate = currentLA?.[0];
            
            if (candidate && (candidate.status === 'superseded' || candidate.status === 'voided')) {
              // Fall back to latest non-superseded
              console.log('[DocuSign] Current pointer is superseded, finding latest active');
              const allLA = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: av.deal_id }, '-created_date', 10);
              agreement = allLA?.find(a => a.status !== 'superseded' && a.status !== 'voided') || null;
            } else {
              agreement = candidate;
            }
          } else {
            // No pointer, find latest non-superseded
            const allLA = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: av.deal_id }, '-created_date', 10);
            agreement = allLA?.find(a => a.status !== 'superseded' && a.status !== 'voided') || null;
          }
          
          if (agreement) {
            agreementType = 'LegalAgreement';
            console.log('[DocuSign] Resolved legacy AgreementVersion to LegalAgreement:', agreement.id);
          }
        }
      } catch (e) {
        console.warn('[DocuSign] Legacy resolution failed:', e?.message);
      }
    }
    
    if (!agreement) {
      console.error('[DocuSign] Agreement not found (tried LegalAgreement and legacy paths)');
      return Response.json({ error: 'Agreement not found. Please regenerate the agreement.' }, { status: 404 });
    }
    
    // Safety: never sign a superseded/voided agreement
    if (agreement.status === 'superseded' || agreement.status === 'voided') {
      return Response.json({ 
        error: 'This agreement has been superseded. Please regenerate the agreement from the Agreement tab.',
        code: 'AGREEMENT_SUPERSEDED'
      }, { status: 400 });
    }

    // CRITICAL: ENFORCE SERVER-SIDE "REGENERATE REQUIRED" BLOCK
    // Determine room context: from request or agreement
    const effectiveRoomId = room_id || agreement.room_id;
    
    if (effectiveRoomId) {
      // Load Room to check requires_regenerate flag
      const roomsCheck = await base44.asServiceRole.entities.Room.filter({ id: effectiveRoomId });
      const roomData = roomsCheck?.[0];

      // CRITICAL: Investor can ALWAYS sign the current agreement (that's their job after regeneration)
      // Only AGENT is blocked until investor has signed the fresh agreement
      const agentMustWaitForInvestor = role === 'agent' && roomData?.requires_regenerate === true && !agreement.investor_signed_at;

      if (agentMustWaitForInvestor) {
        console.error(`[DocuSign] ❌ BLOCKED: Room ${effectiveRoomId} requires_regenerate=true and investor hasn't signed yet`);
        return Response.json({ 
          ok: false,
          code: 'REGENERATE_REQUIRED',
          message: 'Investor must regenerate and re-sign before you can sign.',
          error: 'Agreement terms have changed. Investor must regenerate and sign the new document first before you can sign.'
        }, { status: 400 });
      }
    }

    // CRITICAL: Agent cannot sign if investor hasn't signed yet
    // ALLOW signing if agreement status is 'sent' or 'investor_signed' (DocuSign already has investor signature)
    const agreementReadyForAgent = agreement.status === 'sent' || 
                                    agreement.status === 'investor_signed' || 
                                    agreement.status === 'fully_signed' ||
                                    !!agreement.investor_signed_at ||
                                    liveInvestorSigned;
    
    if (role === 'agent' && !agreementReadyForAgent) {
      console.error('[DocuSign] ❌ Agent cannot sign - investor has not signed yet', {
        agreement_id: agreement.id,
        investor_signed_at: agreement.investor_signed_at,
        status: agreement.status,
        envelope_id: agreement.docusign_envelope_id,
        liveInvestorSigned
      });
      return Response.json({ 
        ok: false,
        code: 'INVESTOR_SIGNATURE_REQUIRED',
        error: 'The investor must sign this agreement first before you can sign it.'
      }, { status: 400 });
    }
    
    console.log('[DocuSign] ✓ Agent signature allowed - agreement ready:', {
      status: agreement.status,
      investor_signed_at: !!agreement.investor_signed_at,
      liveInvestorSigned
    });

    // PHASE 7: Enforce Deal Lock-in
    // If deal is locked to a different room/agent, block signing
    try {
      const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
      const deal = dealArr?.[0];
      
      if (deal?.locked_room_id) {
        const myRoomId = room_id || agreement.room_id;
        
        // If we know the room context
        if (myRoomId && myRoomId !== deal.locked_room_id) {
          console.error(`[DocuSign] ❌ Blocked signing: Deal locked to room ${deal.locked_room_id}, attempting sign for ${myRoomId}`);
          return Response.json({ 
            error: 'This deal has been secured by another agent. You can no longer sign this agreement.',
            code: 'DEAL_LOCKED_TO_OTHER'
          }, { status: 403 });
        }
        
        // If legacy agreement without room_id, check agent profile match
        if (!myRoomId && role === 'agent') {
          const myAgentId = agreement.agent_profile_id;
          if (myAgentId && deal.locked_agent_id && myAgentId !== deal.locked_agent_id) {
            console.error(`[DocuSign] ❌ Blocked signing: Deal locked to agent ${deal.locked_agent_id}, attempting sign for ${myAgentId}`);
            return Response.json({ 
              error: 'This deal has been secured by another agent. You can no longer sign this agreement.',
              code: 'DEAL_LOCKED_TO_OTHER'
            }, { status: 403 });
          }
        }
      }
    } catch (e) {
      console.warn('[DocuSign] Failed to check lock status (continuing):', e.message);
    }

    // Get DocuSign connection and define vars EARLY
    const connection = await getDocuSignConnection(base44);
    const accessToken = connection.access_token;
    const baseUri = connection.base_uri;
    const accountId = connection.account_id;

    // Validate envelope exists
    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) {
      return Response.json({ 
        error: 'Agreement is missing DocuSign envelope id. Please regenerate.' 
      }, { status: 400 });
    }

    // Validate recipient IDs exist
    if (!agreement.investor_recipient_id || !agreement.agent_recipient_id) {
      console.error('[DocuSign] ❌ Missing recipient IDs');
      return Response.json({ 
        error: 'Missing recipient IDs. Please regenerate the agreement.'
      }, { status: 400 });
    }

    // Validate client user IDs exist
    if (!agreement.investor_client_user_id || !agreement.agent_client_user_id) {
      console.error('[DocuSign] ❌ Missing client user IDs');
      return Response.json({ 
        error: 'Missing client user IDs. Please regenerate the agreement.'
      }, { status: 400 });
    }

    // Helper: Sync recipient status from DocuSign to DB
    async function syncRecipientStatusToDb(base44, agreement, baseUri, accountId, accessToken) {
      const envelopeId = agreement.docusign_envelope_id;
      if (!envelopeId) return agreement;

      const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
      const recipientsResponse = await fetch(recipientsUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!recipientsResponse.ok) return agreement;

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
        console.log('[DocuSign] ✓ Syncing investor signature to DB');
      }
      if (agentCompleted && !agreement.agent_signed_at) {
        updates.agent_signed_at = agentSigner.signedDateTime || now;
        console.log('[DocuSign] ✓ Syncing agent signature to DB');
      }

      if (Object.keys(updates).length) {
        const invSigned = !!(updates.investor_signed_at || agreement.investor_signed_at);
        const agSigned = !!(updates.agent_signed_at || agreement.agent_signed_at);

        updates.status = invSigned && agSigned ? 'fully_signed' : invSigned ? 'investor_signed' : 'agent_signed';

        await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
        console.log('[DocuSign] ✓ DB updated with status:', updates.status);
      }

      // Return fresh agreement from DB (authoritative)
      const fresh = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement.id });
      return fresh?.[0] || agreement;
    }

    // SYNC FIRST to ensure DB is up-to-date with DocuSign
    agreement = await syncRecipientStatusToDb(base44, agreement, baseUri, accountId, accessToken);

    // CRITICAL: Check DocuSign directly for live signature status (in case sync missed it)
    let liveInvestorSigned = !!agreement.investor_signed_at;
    let liveAgentSigned = !!agreement.agent_signed_at;
    
    const envelopeCheckUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${agreement.docusign_envelope_id}/recipients`;
    
    try {
      const recipientsCheckResponse = await fetch(envelopeCheckUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (recipientsCheckResponse.ok) {
        const recipients = await recipientsCheckResponse.json();
        const signers = recipients.signers || [];
        const investorSigner = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id));
        const agentSigner = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id));
        
        liveInvestorSigned = investorSigner && (investorSigner.status === 'completed' || investorSigner.status === 'signed');
        liveAgentSigned = agentSigner && (agentSigner.status === 'completed' || agentSigner.status === 'signed');
        
        console.log('[DocuSign] Live signature check - investor:', liveInvestorSigned, 'agent:', liveAgentSigned);
      }
    } catch (e) {
      console.warn('[DocuSign] Failed to check live signatures (using DB):', e.message);
    }

    // Check if already signed - use simple presence of signature date
    const investorAlreadySigned = liveInvestorSigned || !!agreement.investor_signed_at;
    const agentAlreadySigned = liveAgentSigned || !!agreement.agent_signed_at;

    if (role === 'investor' && investorAlreadySigned) {
      console.log('[DocuSign] Investor already signed (status:', agreement.status, ')');
      return Response.json({ 
        already_signed: true,
        message: 'You have already signed this agreement'
      }, { status: 200 });
    }

    if (role === 'agent' && agentAlreadySigned) {
      console.log('[DocuSign] Agent already signed (status:', agreement.status, ')');
      return Response.json({ 
        already_signed: true,
        message: 'You have already signed this agreement'
      }, { status: 200 });
    }

    // GATING: Agent cannot sign until investor has signed
    if (role === 'agent' && !investorAlreadySigned) {
      console.error('[DocuSign] ❌ Agent cannot sign - investor has not signed yet');
      console.error('[DocuSign] investor_signed_at:', agreement.investor_signed_at, 'status:', agreement.status);
      return Response.json({ 
        error: 'The investor must sign this agreement first before you can sign it.',
        investor_signed: false
      }, { status: 403 });
    }

    if (role === 'agent' && investorAlreadySigned) {
      console.log('[DocuSign] ✓ DB confirms investor signed - agent can proceed');
    }

    // Check envelope status for terminal states
    const statusUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (statusResponse.ok) {
      const envStatus = await statusResponse.json();
      console.log('[DocuSign] Envelope status check:', envStatus.status);

      // If envelope is completed, return 200 with already_signed flag
      if (envStatus.status === 'completed') {
        console.log('[DocuSign] Envelope already completed - synced above, signaling UI to refresh');
        return Response.json({
          already_signed: true,
          message: 'Agreement is already completed. Refreshing status.'
        });
      }

      // Only block voided/declined
      if (['voided', 'declined'].includes(envStatus.status)) {
        console.error('[DocuSign] ❌ Envelope is in terminal state:', envStatus.status);
        return Response.json({ 
          error: `This envelope is ${envStatus.status}. Please regenerate the agreement from the Agreement tab.`
        }, { status: 400 });
      }

      console.log('[DocuSign] ✓ Envelope is in active state:', envStatus.status);
    }
    
    // PHASE 7: Validate and enrich redirect_url - always return to deal context
    const reqUrl = new URL(req.url);
    const publicAppUrl = Deno.env.get('PUBLIC_APP_URL');
    const baseAppUrl = publicAppUrl || `${reqUrl.protocol}//${reqUrl.host}`;
    
    let validatedRedirect = redirect_url;
    
    // If no redirect or missing deal context, construct one
    if (!validatedRedirect || (!validatedRedirect.includes('roomId=') && !validatedRedirect.includes('dealId='))) {
      if (room_id) {
        validatedRedirect = `${baseAppUrl}/Room?roomId=${room_id}&dealId=${agreement.deal_id}&tab=agreement&signed=1`;
      } else if (agreement.deal_id) {
        validatedRedirect = `${baseAppUrl}/MyAgreement?dealId=${agreement.deal_id}&tab=agreement&signed=1`;
      } else {
        // Last resort fallback (should never happen)
        validatedRedirect = `${baseAppUrl}/Pipeline?signed=1`;
      }
    }
    
    // Ensure fully qualified URL
    if (validatedRedirect.startsWith('/')) {
      validatedRedirect = `${baseAppUrl}${validatedRedirect}`;
    }
    
    // Ensure signed=1 is present
    const redirectURL = new URL(validatedRedirect);
    if (!redirectURL.searchParams.has('signed')) {
      redirectURL.searchParams.set('signed', '1');
    }
    if (!redirectURL.searchParams.has('dealId') && agreement.deal_id) {
      redirectURL.searchParams.set('dealId', agreement.deal_id);
    }
    if (!redirectURL.searchParams.has('tab')) {
      redirectURL.searchParams.set('tab', 'agreement');
    }
    validatedRedirect = redirectURL.toString();
    
    console.log('[DocuSign] Redirect validation:', { 
      redirect_url, 
      validatedRedirect, 
      publicAppUrl,
      reqOrigin: reqUrl.origin 
    });
    
    // Create signing token
    const tokenValue = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    await base44.asServiceRole.entities.SigningToken.create({
      token: tokenValue,
      deal_id: agreement.deal_id,
      agreement_id: agreement.id,
      role: role,
      return_to: validatedRedirect,
      expires_at: expiresAt,
      used: false
    });
    
    console.log('[DocuSign] Signing token created');
    
    // Build DocuSign return URL with deal context
    const origin = publicAppUrl || `${reqUrl.protocol}//${reqUrl.host}`;
    const returnURL = new URL(`${origin}/DocuSignReturn`);
    returnURL.searchParams.set('token', tokenValue);
    if (agreement.deal_id) returnURL.searchParams.set('dealId', agreement.deal_id);
    if (room_id) returnURL.searchParams.set('roomId', room_id);
    returnURL.searchParams.set('tab', 'agreement');
    returnURL.searchParams.set('role', role);
    const docusignReturnUrl = returnURL.toString();
    
    // Get recipient details based on role
    const recipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;
    
    // Validate recipientId and clientUserId for current role
    if (!recipientId) {
      console.error(`[DocuSign] ❌ Missing ${role}_recipient_id for role ${role}`);
      return Response.json({ 
        error: `Missing recipient ID for ${role}. Please regenerate the agreement.`,
        debug: { role, has_recipient_id: false }
      }, { status: 400 });
    }
    
    if (!clientUserId) {
      console.error(`[DocuSign] ❌ Missing ${role}_client_user_id for role ${role}`);
      return Response.json({ 
        error: `Missing client user ID for ${role}. Please regenerate the agreement.`,
        debug: { role, has_client_user_id: false }
      }, { status: 400 });
    }
    
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
    const profile = profiles[0];
    
    // Create recipient view for embedded signing
    // CRITICAL: Must include recipientId so DocuSign knows which recipient to show
    const recipientViewRequest = {
      returnUrl: docusignReturnUrl,
      authenticationMethod: 'none',
      email: profile?.email || user.email,
      userName: profile?.full_name || profile?.email || user.email,
      recipientId: String(recipientId),
      clientUserId: String(clientUserId),
      frameAncestors: [origin],
      messageOrigins: [origin]
    };
    
    console.log('[DocuSign] Creating recipient view with:', {
      recipientId,
      clientUserId,
      email: profile?.email,
      userName: profile?.full_name,
      role
    });
    
    const viewUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`;
    const viewResponse = await fetch(viewUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(recipientViewRequest)
    });
    
    if (!viewResponse.ok) {
      const errorText = await viewResponse.text();
      let parsedError = null;
      let errorMsg = 'Failed to create signing session';
      
      try {
        parsedError = JSON.parse(errorText);
        errorMsg = parsedError.message || parsedError.errorCode || errorMsg;
      } catch (e) {
        errorMsg = errorText.substring(0, 200);
      }
      
      console.error('[DocuSign] Recipient view failed:', {
        status: viewResponse.status,
        error: parsedError || errorText,
        envelopeId,
        recipientId,
        clientUserId,
        role
      });
      
      // Handle specific DocuSign errors with user-friendly messages
      if (errorMsg.includes('out of sequence') || errorMsg.includes('OUT_OF_SEQUENCE')) {
        return Response.json({ 
          error: 'The investor must sign this agreement first before you can sign it. Please wait for the investor to complete their signature.'
        }, { status: 400 });
      }
      
      if (errorMsg.includes('RECIPIENT_') || errorMsg.includes('recipient')) {
        return Response.json({ 
          error: 'Signing session issue detected. Please regenerate the agreement from the Agreement tab.'
        }, { status: 400 });
      }
      
      return Response.json({ 
        error: errorMsg || 'Failed to create signing session',
        hint: 'If this persists, try regenerating the agreement.'
      }, { status: 500 });
    }
    
    const viewData = await viewResponse.json();
    
    // Log signing session (only update the entity type we found)
    if (agreementType === 'LegalAgreement') {
      try {
        await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
          audit_log: [
            ...(agreement.audit_log || []),
            {
              timestamp: new Date().toISOString(),
              actor: user.email,
              action: 'signing_session_created',
              details: `${role} signing session created for envelope ${envelopeId}`
            }
          ]
        });
      } catch (e) {
        console.warn('[DocuSign] Failed to update LegalAgreement audit log (non-blocking):', e.message);
      }
    } else if (agreementType === 'AgreementVersion') {
      // AgreementVersion doesn't have audit_log field, skip
      console.log('[DocuSign] Skipping audit log for AgreementVersion');
    }
    
    console.log('[DocuSign] Signing session created successfully - returning URL');
    
    return Response.json({ 
      signing_url: viewData.url
    });
  } catch (error) {
    console.error('[docusignCreateSigningSession] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});