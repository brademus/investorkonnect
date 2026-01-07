import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /api/functions/docusignHandleReturn
 * Handle DocuSign embedded signing completion
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { token, event } = await req.json();
    
    console.log('[docusignHandleReturn]', { token, event });
    
    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }
    
    // Validate token
    const tokens = await base44.asServiceRole.entities.SigningToken.filter({ token });
    
    if (tokens.length === 0) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    
    const signingToken = tokens[0];
    
    // Check expiration
    if (new Date(signingToken.expires_at) < new Date()) {
      return Response.json({ error: 'Token expired' }, { status: 400 });
    }
    
    // Check if already used
    if (signingToken.used) {
      return Response.json({ error: 'Token already used' }, { status: 400 });
    }
    
    // Mark token as used
    await base44.asServiceRole.entities.SigningToken.update(signingToken.id, { used: true });
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: signingToken.agreement_id });
    
    if (agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    const agreement = agreements[0];
    
    // Update agreement status based on event
    if (event === 'signing_complete') {
      const updates = {
        audit_log: [
          ...(agreement.audit_log || []),
          {
            timestamp: new Date().toISOString(),
            actor: 'DocuSign',
            action: 'signer_completed',
            details: `${signingToken.role} completed signing`
          }
        ]
      };
      
      const now = new Date().toISOString();
      
      // Update signed timestamps and determine status
      if (signingToken.role === 'investor') {
        updates.investor_signed_at = now;
        
        // Check if agent already signed
        if (agreement.agent_signed_at) {
          // Both signed - check if NJ attorney review needed
          if (agreement.governing_state === 'NJ') {
            updates.status = 'attorney_review_pending';
            // Calculate 3 business days from now for NJ review
            const reviewEnd = new Date();
            reviewEnd.setDate(reviewEnd.getDate() + 3);
            updates.nj_review_end_at = reviewEnd.toISOString();
            updates.audit_log.push({
              timestamp: now,
              actor: 'system',
              action: 'nj_review_started',
              details: 'NJ attorney review period started (3 business days)'
            });
          } else {
            updates.status = 'fully_signed';
            updates.audit_log.push({
              timestamp: now,
              actor: 'system',
              action: 'unlock_event',
              details: 'Agreement fully signed - deal unlocked'
            });
          }
        } else {
          updates.status = 'investor_signed';
        }
      } else if (signingToken.role === 'agent') {
        updates.agent_signed_at = now;
        
        // Check if investor already signed
        if (agreement.investor_signed_at) {
          // Both signed - check if NJ attorney review needed
          if (agreement.governing_state === 'NJ') {
            updates.status = 'attorney_review_pending';
            const reviewEnd = new Date();
            reviewEnd.setDate(reviewEnd.getDate() + 3);
            updates.nj_review_end_at = reviewEnd.toISOString();
            updates.audit_log.push({
              timestamp: now,
              actor: 'system',
              action: 'nj_review_started',
              details: 'NJ attorney review period started (3 business days)'
            });
          } else {
            updates.status = 'fully_signed';
            updates.audit_log.push({
              timestamp: now,
              actor: 'system',
              action: 'unlock_event',
              details: 'Agreement fully signed - deal unlocked'
            });
          }
        } else {
          updates.status = 'agent_signed';
        }
      }
      
      await base44.asServiceRole.entities.LegalAgreement.update(signingToken.agreement_id, updates);
      
      console.log('[docusignHandleReturn] Agreement updated:', updates.status);
    }
    
    return Response.json({ 
      success: true,
      returnTo: signingToken.return_to
    });
  } catch (error) {
    console.error('[docusignHandleReturn] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});