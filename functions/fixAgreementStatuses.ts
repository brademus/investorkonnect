import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin function to fix agreement statuses for existing signed agreements
 * Syncs LegalAgreement.status with actual signed_at timestamps
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    console.log('[fixAgreementStatuses] Starting status sync...');
    
    // Get all agreements
    const agreements = await base44.asServiceRole.entities.LegalAgreement.list();
    
    console.log(`[fixAgreementStatuses] Found ${agreements.length} agreements`);
    
    const fixes = [];
    
    for (const agreement of agreements) {
      const hasInvestorSig = !!agreement.investor_signed_at;
      const hasAgentSig = !!agreement.agent_signed_at;
      const currentStatus = agreement.status;
      
      let correctStatus = currentStatus;
      let needsUpdate = false;
      
      // Determine correct status based on signatures
      if (hasInvestorSig && hasAgentSig) {
        // Both signed
        if (agreement.governing_state === 'NJ' && currentStatus !== 'attorney_review_pending' && currentStatus !== 'fully_signed') {
          correctStatus = 'attorney_review_pending';
          needsUpdate = true;
        } else if (agreement.governing_state !== 'NJ' && currentStatus !== 'fully_signed') {
          correctStatus = 'fully_signed';
          needsUpdate = true;
        }
      } else if (hasInvestorSig && !hasAgentSig) {
        // Only investor signed
        if (currentStatus !== 'investor_signed' && currentStatus !== 'sent') {
          correctStatus = 'investor_signed';
          needsUpdate = true;
        }
      } else if (!hasInvestorSig && hasAgentSig) {
        // Only agent signed (rare)
        if (currentStatus !== 'agent_signed') {
          correctStatus = 'agent_signed';
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        console.log(`[fixAgreementStatuses] Fixing agreement ${agreement.id}: ${currentStatus} -> ${correctStatus}`);
        
        await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
          status: correctStatus,
          audit_log: [
            ...(agreement.audit_log || []),
            {
              timestamp: new Date().toISOString(),
              actor: 'system',
              action: 'status_sync',
              details: `Auto-fixed status from ${currentStatus} to ${correctStatus} based on signed_at timestamps`
            }
          ]
        });
        
        fixes.push({
          agreement_id: agreement.id,
          deal_id: agreement.deal_id,
          old_status: currentStatus,
          new_status: correctStatus,
          investor_signed: hasInvestorSig,
          agent_signed: hasAgentSig
        });
        
        // Sync Room and Deal if fully signed
        if (correctStatus === 'fully_signed' && agreement.deal_id) {
          const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agreement.deal_id });
          
          if (rooms.length > 0) {
            await base44.asServiceRole.entities.Room.update(rooms[0].id, {
              agreement_status: 'fully_signed',
              request_status: 'signed',
              is_fully_signed: true
            });
            console.log(`[fixAgreementStatuses] ✓ Synced room ${rooms[0].id} to fully_signed`);
          }
          
          await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
            is_fully_signed: true
          });
          console.log(`[fixAgreementStatuses] ✓ Synced deal ${agreement.deal_id} to fully_signed`);
        }
      }
    }
    
    console.log(`[fixAgreementStatuses] ✅ Fixed ${fixes.length} agreements`);
    
    return Response.json({ 
      success: true, 
      fixed_count: fixes.length,
      fixes: fixes
    });
  } catch (error) {
    console.error('[fixAgreementStatuses] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});