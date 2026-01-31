import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/functions/getLegalAgreement?deal_id=<id>
 * POST /api/functions/getLegalAgreement with { deal_id }
 * Returns the legal agreement for a deal (with access control)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Support both GET (query params) and POST (body params)
    let deal_id, room_id;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      deal_id = url.searchParams.get('deal_id');
      room_id = url.searchParams.get('room_id');
    } else {
      const body = await req.json();
      deal_id = body.deal_id;
      room_id = body.room_id;
    }
    
    console.log('[getLegalAgreement] Request:', { method: req.method, deal_id, room_id, user_id: user.id });
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // CRITICAL: If room_id provided, check Room.current_legal_agreement_id first (points to the active agreement)
    let agreement = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      if (rooms?.[0]?.current_legal_agreement_id) {
        const currentAgrId = rooms[0].current_legal_agreement_id;
        console.log('[getLegalAgreement] Room has pointer to agreement:', currentAgrId);
        
        const currentAgrs = await base44.asServiceRole.entities.LegalAgreement.filter({ id: currentAgrId });
        if (currentAgrs?.[0]) {
          agreement = currentAgrs[0];
          console.log('[getLegalAgreement] Using Room-pointed agreement:', agreement.id);
        }
      }
    }
    
    // Fallback if no room pointer or room_id not provided
    if (!agreement) {
      let agreements = [];
      if (room_id) {
        // First try room-scoped (regenerated after counter)
        agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id });
        console.log('[getLegalAgreement] Room-scoped search:', agreements.length, 'found');
        
        // Fallback to deal-level if no room-scoped agreement exists
        if (agreements.length === 0) {
          agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id: null });
          console.log('[getLegalAgreement] Fallback to deal-level:', agreements.length, 'found');
        }
      } else {
        // No room_id: get deal-level agreement
        agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id: null });
        console.log('[getLegalAgreement] Deal-level search:', agreements.length, 'found');
      }
      
      if (agreements.length === 0) {
        console.log('[getLegalAgreement] No agreement found for deal:', deal_id);
        return Response.json({ agreement: null });
      }
    
    console.log('[getLegalAgreement] Found agreements:', agreements.length);
    
    if (agreements.length === 0) {
      console.log('[getLegalAgreement] No agreement found for deal:', deal_id);
      return Response.json({ agreement: null });
    }
    
    // CRITICAL: If multiple agreements exist, find the CURRENT one (not superseded)
    let agreement = agreements[0];
    if (agreements.length > 1) {
      console.log('[getLegalAgreement] Multiple agreements found - checking for supersedes');
      
      // Find which agreements are superseded by others in this set
      const supersedingIds = new Set();
      for (const agr of agreements) {
        if (agr.supersedes_agreement_id) {
          supersedingIds.add(agr.supersedes_agreement_id);
          console.log(`[getLegalAgreement] Agreement ${agr.id} supersedes ${agr.supersedes_agreement_id}`);
        }
      }
      
      // Prefer the one that's NOT superseded by any other
      const current = agreements.find(a => !supersedingIds.has(a.id));
      if (current) {
        agreement = current;
        console.log(`[getLegalAgreement] Selected current agreement (not superseded): ${agreement.id}`);
      } else {
        console.log('[getLegalAgreement] No clear current - using first by creation order');
        agreement = agreements[0];
      }
    }
    
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