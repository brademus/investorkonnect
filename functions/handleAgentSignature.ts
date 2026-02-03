import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
  * FIRST-TO-SIGN-WINS: Handle agent signature on base agreement
  * Locks deal to winning agent and removes all other agents from the room
  */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agreement_id } = await req.json();

    if (!agreement_id) {
      return Response.json({ error: 'agreement_id required' }, { status: 400 });
    }

    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    if (!agreements?.length) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];

    // Only process base agreements
    if (!agreement.room_id || agreement.signer_mode !== 'investor_only') {
      return Response.json({ success: true, locked: false });
    }

    // Get deal and room
    const [deals, rooms] = await Promise.all([
      base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id }),
      base44.asServiceRole.entities.Room.filter({ id: agreement.room_id })
    ]);

    if (!deals?.length || !rooms?.length) {
      return Response.json({ error: 'Deal or room not found' }, { status: 404 });
    }

    const deal = deals[0];
    const room = rooms[0];

    // Check if already locked
    if (deal.locked_room_id) {
      return Response.json({ success: true, locked: true, already_locked: true });
    }

    // Lock the deal to this agent
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
      locked_room_id: agreement.room_id,
      locked_agent_id: agreement.agent_profile_id,
      agent_id: agreement.agent_profile_id,
      connected_at: now
    });

    // Remove all other agents from the room, keep only the signing agent
    const losingAgentIds = (room.agent_ids || []).filter(id => id !== agreement.agent_profile_id);
    const updatedAgentTerms = room.agent_terms || {};
    const updatedAgentStatus = room.agent_agreement_status || {};

    // Remove losing agents from terms and status tracking
    for (const agentId of losingAgentIds) {
      delete updatedAgentTerms[agentId];
      delete updatedAgentStatus[agentId];
    }

    // Update room with only the winning agent
    await base44.asServiceRole.entities.Room.update(agreement.room_id, {
      agent_ids: [agreement.agent_profile_id],
      locked_agent_id: agreement.agent_profile_id,
      agent_terms: updatedAgentTerms,
      agent_agreement_status: updatedAgentStatus,
      request_status: 'locked',
      locked_at: now
    });

    return Response.json({ 
      success: true, 
      locked: true,
      locked_agent_id: agreement.agent_profile_id,
      removed_agents: losingAgentIds.length
    });

  } catch (error) {
    console.error('[handleAgentSignature] Error:', error);
    return Response.json({ 
      error: error?.message || 'Failed to handle agent signature' 
    }, { status: 500 });
  }
});