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
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    
    if (agreements.length === 0) {
      return Response.json({ agreement: null });
    }
    
    const agreement = agreements[0];
    
    // Verify access
    if (agreement.investor_profile_id !== profile.id && agreement.agent_profile_id !== profile.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Check if NJ attorney review period has expired
    if (agreement.status === 'attorney_review_pending' && agreement.nj_review_end_at) {
      const now = new Date();
      const reviewEnd = new Date(agreement.nj_review_end_at);
      
      if (now > reviewEnd) {
        // Auto-approve
        const updated = await base44.asServiceRole.entities.LegalAgreement.update(
          agreement.id,
          {
            status: 'fully_signed',
            audit_log: [
              ...agreement.audit_log,
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                action: 'nj_review_expired',
                details: 'NJ attorney review period expired - auto-approved'
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