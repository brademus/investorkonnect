import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data } = body;
    
    // Only process update events where agreement becomes fully_signed
    if (event?.type !== 'update' || !data) {
      return Response.json({ success: true, message: 'No action needed' });
    }
    
    const agreement = data;
    const oldAgreement = body.old_data;
    
    // Check if agreement is now fully_signed (and wasn't before to avoid duplicate notifications)
    if (agreement.status !== 'fully_signed') {
      return Response.json({ success: true, message: 'Agreement not fully signed yet' });
    }
    
    // Skip if it was already fully_signed (idempotency check)
    if (oldAgreement?.status === 'fully_signed') {
      return Response.json({ success: true, message: 'Agreement already was fully signed' });
    }
    
    // Get the room
    const roomId = agreement.room_id;
    if (!roomId) {
      return Response.json({ error: 'No room_id found on agreement' }, { status: 400 });
    }
    
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    
    const room = rooms[0];
    
    // Get investor profile
    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.investorId });
    if (!investorProfiles?.length) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    const investor = investorProfiles[0];

    // Get winning agent (locked_agent_id on room, or first agent_id)
    const winningAgentId = room.locked_agent_id || room.agent_ids?.[0];
    if (!winningAgentId) {
      return Response.json({ error: 'No agent found on room' }, { status: 404 });
    }
    const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: winningAgentId });
    if (!agentProfiles?.length) {
      return Response.json({ error: 'Agent profile not found' }, { status: 404 });
    }
    const agent = agentProfiles[0];
    
    const dealTitle = room.title || 'Your deal';
    const propertyAddress = room.property_address || 'the property';
    
    // Send email to investor
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: investor.email,
      subject: `Agreement Fully Signed - ${dealTitle}`,
      body: `
Hello ${investor.full_name || 'there'},

Great news! The agreement for ${dealTitle} (${propertyAddress}) has been fully signed by both parties.

You can now view the signed agreement and proceed with the next steps in your pipeline.

Best regards,
Investor Konnect Team
      `.trim()
    });
    
    // Send email to agent
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: agent.email,
      subject: `Agreement Fully Signed - ${dealTitle}`,
      body: `
Hello ${agent.full_name || 'there'},

Great news! The agreement for ${dealTitle} (${propertyAddress}) has been fully signed by both parties.

You can now view the signed agreement and proceed with the next steps.

Best regards,
Investor Konnect Team
      `.trim()
    });
    
    return Response.json({ 
      success: true, 
      message: `Notifications sent to investor and agent for room ${roomId}` 
    });
    
  } catch (error) {
    console.error('Error sending full agreement notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});