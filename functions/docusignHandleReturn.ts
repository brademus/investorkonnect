import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /api/functions/docusignHandleReturn
 * Handles the return from DocuSign embedded signing
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, event } = await req.json();

    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    // Retrieve the signing token from the database
    const tokens = await base44.asServiceRole.entities.SigningToken.filter({ token });
    if (tokens.length === 0) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    const signingToken = tokens[0];

    // Check if token is expired or already used
    if (new Date(signingToken.expires_at) < new Date() || signingToken.used) {
      return Response.json({ error: 'Token expired or already used' }, { status: 400 });
    }

    // Mark token as used
    await base44.asServiceRole.entities.SigningToken.update(signingToken.id, { used: true });

    // Determine agreement status based on DocuSign event
    let agreementStatusUpdate = {};
    let message = 'Signing process completed.';

    if (event === 'signing_complete') {
      // Update LegalAgreement status
      const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: signingToken.agreement_id });
      if (agreements.length > 0) {
        const agreement = agreements[0];
        
        if (signingToken.role === 'investor') {
          agreementStatusUpdate = { 
            status: 'investor_signed', 
            investor_signed_at: new Date().toISOString(),
            audit_log: [
              ...(agreement.audit_log || []),
              {
                timestamp: new Date().toISOString(),
                actor: agreement.investor_user_id,
                action: 'investor_signed',
                details: 'Investor completed DocuSign embedded signing'
              }
            ]
          };
        } else if (signingToken.role === 'agent') {
          agreementStatusUpdate = { 
            status: 'agent_signed', 
            agent_signed_at: new Date().toISOString(),
            audit_log: [
              ...(agreement.audit_log || []),
              {
                timestamp: new Date().toISOString(),
                actor: agreement.agent_user_id,
                action: 'agent_signed',
                details: 'Agent completed DocuSign embedded signing'
              }
            ]
          };
        }

        // Check if both signed, set to fully_signed
        const updatedAgreement = { ...agreement, ...agreementStatusUpdate };
        if (updatedAgreement.investor_signed_at && updatedAgreement.agent_signed_at) {
          agreementStatusUpdate.status = 'fully_signed';
        }

        await base44.asServiceRole.entities.LegalAgreement.update(signingToken.agreement_id, agreementStatusUpdate);
        message = `Agreement signed successfully by ${signingToken.role}.`;
      }
    } else if (event === 'cancel') {
      message = 'Signing was cancelled.';
    } else {
      message = `DocuSign event: ${event || 'Unknown'}.`;
    }

    return Response.json({
      success: true,
      message,
      returnTo: signingToken.return_to,
    });
  } catch (error) {
    console.error('[docusignHandleReturn] Error:', error);
    return Response.json({ error: error.message, returnTo: '/' }, { status: 500 });
  }
});