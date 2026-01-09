import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
  }
  
  const connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt) {
    throw new Error('DocuSign token expired');
  }
  
  return connection;
}

/**
 * POST /api/functions/reconcileAllAgreements
 * Reconciles all LegalAgreement records with DocuSign truth
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    console.log('[ReconcileAll] Starting reconciliation of all agreements...');
    
    // Get all agreements with DocuSign envelopes
    const allAgreements = await base44.asServiceRole.entities.LegalAgreement.list();
    const agreementsToReconcile = allAgreements.filter(a => a.docusign_envelope_id);
    
    console.log('[ReconcileAll] Found', agreementsToReconcile.length, 'agreements with DocuSign envelopes');
    
    if (agreementsToReconcile.length === 0) {
      return Response.json({ 
        success: true,
        message: 'No agreements to reconcile',
        reconciled: 0
      });
    }
    
    // Get DocuSign connection
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    let reconciledCount = 0;
    const results = [];
    
    // Process each agreement
    for (const agreement of agreementsToReconcile) {
      try {
        console.log('[ReconcileAll] Processing agreement:', agreement.id);
        
        // Fetch recipients from DocuSign
        const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${agreement.docusign_envelope_id}/recipients`;
        const recipientsResponse = await fetch(recipientsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!recipientsResponse.ok) {
          console.warn('[ReconcileAll] Failed to fetch recipients for envelope:', agreement.docusign_envelope_id);
          results.push({
            agreement_id: agreement.id,
            status: 'error',
            error: 'Failed to fetch recipients from DocuSign'
          });
          continue;
        }
        
        const recipients = await recipientsResponse.json();
        const signers = recipients.signers || [];
        
        // Find investor and agent signers
        let investorSigner = signers.find(s => s.recipientId === agreement.investor_recipient_id);
        let agentSigner = signers.find(s => s.recipientId === agreement.agent_recipient_id);
        
        // Fallback to email match
        if (!investorSigner && agreement.investor_profile_id) {
          const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.investor_profile_id });
          if (investorProfiles.length > 0) {
            investorSigner = signers.find(s => s.email.toLowerCase() === investorProfiles[0].email.toLowerCase());
          }
        }
        
        if (!agentSigner && agreement.agent_profile_id) {
          const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.agent_profile_id });
          if (agentProfiles.length > 0) {
            agentSigner = signers.find(s => s.email.toLowerCase() === agentProfiles[0].email.toLowerCase());
          }
        }
        
        const investorCompleted = investorSigner?.status === 'completed' || investorSigner?.status === 'signed';
        const agentCompleted = agentSigner?.status === 'completed' || agentSigner?.status === 'signed';
        
        const now = new Date().toISOString();
        const updates = {
          docusign_status: recipients.envelopeStatus || 'sent'
        };
        let changed = false;
        
        // Update investor signature
        if (investorCompleted && !agreement.investor_signed_at) {
          updates.investor_signed_at = investorSigner.signedDateTime || now;
          changed = true;
        }
        
        // Update agent signature
        if (agentCompleted && !agreement.agent_signed_at) {
          updates.agent_signed_at = agentSigner.signedDateTime || now;
          changed = true;
        }
        
        // Update status
        if (investorCompleted && agentCompleted) {
          if (agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
            if (agreement.governing_state === 'NJ') {
              updates.status = 'attorney_review_pending';
              if (!agreement.nj_review_end_at) {
                const reviewEnd = new Date();
                reviewEnd.setDate(reviewEnd.getDate() + 3);
                updates.nj_review_end_at = reviewEnd.toISOString();
              }
            } else {
              updates.status = 'fully_signed';
            }
            changed = true;
          }
        } else if (investorCompleted && !agentCompleted) {
          if (agreement.status !== 'investor_signed' && agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
            updates.status = 'investor_signed';
            changed = true;
          }
        } else if (agentCompleted && !investorCompleted) {
          if (agreement.status !== 'agent_signed' && agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
            updates.status = 'agent_signed';
            changed = true;
          }
        }
        
        if (changed) {
          await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
          
          // Sync to Room and Deal
          if (agreement.deal_id) {
            const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agreement.deal_id });
            if (rooms.length > 0) {
              const room = rooms[0];
              const roomUpdates = {
                agreement_status: updates.status || agreement.status
              };
              
              if (updates.status === 'fully_signed' || updates.status === 'attorney_review_pending') {
                roomUpdates.request_status = 'signed';
                roomUpdates.signed_at = now;
                roomUpdates.is_fully_signed = true;
              }
              
              await base44.asServiceRole.entities.Room.update(room.id, roomUpdates);
            }
            
            if (updates.status === 'fully_signed' || updates.status === 'attorney_review_pending') {
              await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
                is_fully_signed: true
              });
            }
          }
          
          reconciledCount++;
          results.push({
            agreement_id: agreement.id,
            status: 'reconciled',
            changes: updates
          });
          
          console.log('[ReconcileAll] ✓ Reconciled:', agreement.id, updates);
        } else {
          results.push({
            agreement_id: agreement.id,
            status: 'no_changes_needed'
          });
        }
      } catch (error) {
        console.error('[ReconcileAll] Error processing agreement:', agreement.id, error);
        results.push({
          agreement_id: agreement.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('[ReconcileAll] ✅ Reconciliation complete:', reconciledCount, 'agreements updated');
    
    return Response.json({
      success: true,
      message: `Reconciled ${reconciledCount} agreements`,
      reconciled: reconciledCount,
      total: agreementsToReconcile.length,
      results
    });
  } catch (error) {
    console.error('[ReconcileAll] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});