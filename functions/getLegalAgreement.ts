import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const deal_id = url.searchParams.get('deal_id');
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    
    if (agreements.length === 0) {
      return Response.json({ agreement: null });
    }
    
    const agreement = agreements[0];
    
    // Verify access using user_id (not profile_id)
    if (agreement.investor_user_id !== user.id && agreement.agent_user_id !== user.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Check if NJ attorney review period has expired (auto-approval)
    if (agreement.status === 'attorney_review_pending' && agreement.nj_review_end_at) {
      const now = new Date();
      const reviewEnd = new Date(agreement.nj_review_end_at);
      
      if (now > reviewEnd) {
        // Auto-approve - idempotent update
        const updated = await base44.asServiceRole.entities.LegalAgreement.update(
          agreement.id,
          {
            status: 'fully_signed',
            audit_log: [
              ...agreement.audit_log,
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
        
        return Response.json({ agreement: updated });
      }
    }
    
    return Response.json({ agreement });
    
  } catch (error) {
    console.error('Get agreement error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get agreement' 
    }, { status: 500 });
  }
});