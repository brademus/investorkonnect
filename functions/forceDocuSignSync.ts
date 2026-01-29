import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * EMERGENCY SYNC: Manually fetch DocuSign envelope status and update agreement
 * Use when webhook fails or signature status is stuck
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agreementId } = await req.json();
    if (!agreementId) {
      return Response.json({ error: 'agreementId required' }, { status: 400 });
    }

    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
    const agreement = agreements[0];
    if (!agreement) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }

    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) {
      return Response.json({ error: 'No DocuSign envelope ID found' }, { status: 400 });
    }

    // Fetch from DocuSign API
    const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const DOCUSIGN_CLIENT_SECRET = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    const DOCUSIGN_ENV = Deno.env.get('DOCUSIGN_ENV') || 'demo';

    // Get DocuSign connection
    const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
    const conn = connections[0];
    if (!conn) {
      return Response.json({ error: 'No DocuSign connection found' }, { status: 500 });
    }

    // Refresh token if expired
    let accessToken = conn.access_token;
    const expiresAt = new Date(conn.expires_at);
    if (expiresAt < new Date()) {
      const tokenUrl = `https://account-${DOCUSIGN_ENV}.docusign.com/oauth/token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${DOCUSIGN_INTEGRATION_KEY}:${DOCUSIGN_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: conn.refresh_token
        })
      });

      if (!tokenResponse.ok) {
        return Response.json({ error: 'Failed to refresh DocuSign token' }, { status: 500 });
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      });
    }

    // Fetch envelope status
    const envelopeUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}`;
    const envelopeResponse = await fetch(envelopeUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!envelopeResponse.ok) {
      return Response.json({ error: 'Failed to fetch envelope from DocuSign' }, { status: 500 });
    }

    const envelope = await envelopeResponse.json();

    // Get recipients
    const recipientsUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}/recipients`;
    const recipientsResponse = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const recipients = recipientsResponse.ok ? await recipientsResponse.json() : null;

    // Update agreement based on status
    const updates = { docusign_status: envelope.status };

    if (recipients?.signers) {
      for (const signer of recipients.signers) {
        if (signer.recipientId === agreement.investor_recipient_id && signer.status === 'completed') {
          updates.investor_signed_at = signer.signedDateTime || new Date().toISOString();
          updates.investor_ip = signer.clientUserId || null;
        }
        if (signer.recipientId === agreement.agent_recipient_id && signer.status === 'completed') {
          updates.agent_signed_at = signer.signedDateTime || new Date().toISOString();
          updates.agent_ip = signer.clientUserId || null;
        }
      }
    }

    // Update status
    if (updates.investor_signed_at && updates.agent_signed_at) {
      updates.status = 'fully_signed';
    } else if (updates.investor_signed_at) {
      updates.status = 'investor_signed';
    } else if (updates.agent_signed_at) {
      updates.status = 'agent_signed';
    }

    // Download signed PDF if completed
    if (envelope.status === 'completed' && !agreement.signed_pdf_url) {
      const pdfUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}/documents/combined`;
      const pdfResponse = await fetch(pdfUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (pdfResponse.ok) {
        const pdfBlob = await pdfResponse.blob();
        const formData = new FormData();
        formData.append('file', pdfBlob, `agreement_${agreementId}_signed.pdf`);

        const uploadResponse = await fetch(
          `/api/apps/${Deno.env.get('BASE44_APP_ID')}/files/public`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          updates.signed_pdf_url = uploadData.url;
        }
      }
    }

    // Save updates
    await base44.asServiceRole.entities.LegalAgreement.update(agreementId, updates);

    // Update room if applicable
    if (agreement.room_id) {
      await base44.asServiceRole.entities.Room.update(agreement.room_id, {
        agreement_status: updates.status
      });
    }

    return Response.json({
      success: true,
      envelopeStatus: envelope.status,
      updates
    });

  } catch (error) {
    console.error('[forceDocuSignSync] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});