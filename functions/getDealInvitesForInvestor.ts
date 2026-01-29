import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get all DealInvites for a deal with enriched agent profile data
 * Used by investor to show multi-agent board
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get deal and verify ownership
    const deals = await base44.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    if (deal.investor_id !== profile.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Get all invites for this deal
    const invites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id });
    
    // Enrich with agent profile data
    const enrichedInvites = [];
    for (const invite of invites) {
      const agentProfiles = await base44.entities.Profile.filter({ id: invite.agent_profile_id });
      const agentProfile = agentProfiles[0];
      
      if (!agentProfile) continue;
      
      // Get agreement status
      let agreementStatus = 'pending';
      if (invite.legal_agreement_id) {
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
          id: invite.legal_agreement_id 
        });
        const agreement = agreements[0];
        if (agreement) {
          agreementStatus = agreement.status;
        }
      }
      
      // Get agent stats (completed deals count)
      const agentDeals = await base44.entities.Deal.filter({ 
        locked_agent_id: invite.agent_profile_id,
        status: 'closed'
      });
      
      enrichedInvites.push({
        ...invite,
        agent: {
          id: agentProfile.id,
          full_name: agentProfile.full_name,
          email: agentProfile.email,
          brokerage: agentProfile.agent?.brokerage || agentProfile.broker,
          license_number: agentProfile.agent?.license_number || agentProfile.license_number,
          markets: agentProfile.agent?.markets || agentProfile.markets || [],
          completed_deals: agentDeals.length,
          rating: agentProfile.reputationScore || 0
        },
        agreement_status: agreementStatus
      });
    }
    
    // Sort by created_at
    enrichedInvites.sort((a, b) => {
      const aDate = new Date(a.created_at_iso || a.created_date);
      const bDate = new Date(b.created_at_iso || b.created_date);
      return aDate - bDate;
    });
    
    return Response.json({ 
      ok: true, 
      invites: enrichedInvites,
      locked_agent_id: deal.locked_agent_profile_id || null
    });
    
  } catch (error) {
    console.error('[getDealInvitesForInvestor] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});