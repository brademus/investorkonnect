import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/functions/getLegalAgreement?deal_id=<id>
 * Returns the legal agreement for a deal (with access control)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const deal_id = url.searchParams.get('deal_id');
    
    console.log('[getLegalAgreement] Request:', { deal_id, user_id: user.id });
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get agreement using service role
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    
    console.log('[getLegalAgreement] Found agreements:', agreements.length);
    
    if (agreements.length === 0) {
      console.log('[getLegalAgreement] No agreement found for deal:', deal_id);
      return Response.json({ agreement: null });
    }
    
    const agreement = agreements[0];
    
    console.log('[getLegalAgreement] Agreement found:', {
      id: agreement.id,
      status: agreement.status,
      investor_user_id: agreement.investor_user_id,
      agent_user_id: agreement.agent_user_id,
      investor_signed_at: agreement.investor_signed_at,
      agent_signed_at: agreement.agent_signed_at
    });
    
    // Verify access - user must be either investor or agent on this agreement
    if (agreement.investor_user_id !== user.id && agreement.agent_user_id !== user.id) {
      console.log('[getLegalAgreement] Access denied - user not authorized');
      return Response.json({ error: 'Not authorized to view this agreement' }, { status: 403 });
    }
    
    // Check if NJ attorney review period has expired (auto-approval)
    if (agreement.status === 'attorney_review_pending' && agreement.nj_review_end_at) {
      const now = new Date();
      const reviewEnd = new Date(agreement.nj_review_end_at);
      
      if (now > reviewEnd) {
        console.log('[getLegalAgreement] NJ review period expired - auto-approving');
        
        // Auto-approve
        const updated = await base44.asServiceRole.entities.LegalAgreement.update(
          agreement.id,
          {
            status: 'fully_signed',
            audit_log: [
              ...(agreement.audit_log || []),
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                action: 'attorney_review_completed',
                details: 'NJ attorney review period expired without cancellation'
              },
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                action: 'fully_signed_effective',
                details: 'Agreement is fully executed and effective'
              },
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                action: 'unlock_event',
                details: 'Sensitive data unlocked for agent access'
              }
            ]
          }
        );
        
        console.log('[getLegalAgreement] ✓ Auto-approved, returning updated agreement');
        return Response.json({ agreement: updated });
      }
    }
    
    console.log('[getLegalAgreement] ✓ Returning agreement with status:', agreement.status);
    return Response.json({ agreement });
    
  } catch (error) {
    console.error('[getLegalAgreement] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get agreement',
      details: error.toString()
    }, { status: 500 });
  }
});