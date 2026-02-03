import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data, old_data } = body;
    
    // Only process update events where status changes to accepted or declined
    if (event?.type !== 'update' || !data || !old_data) {
      return Response.json({ success: true, message: 'No action needed' });
    }
    
    const counterOffer = data;
    const oldCounterOffer = old_data;
    
    // Check if status changed to accepted or declined
    const statusChanged = counterOffer.status !== oldCounterOffer.status;
    const isResolved = counterOffer.status === 'accepted' || counterOffer.status === 'declined';
    
    if (!statusChanged || !isResolved) {
      return Response.json({ success: true, message: 'Counter offer not newly resolved' });
    }
    
    const roomId = counterOffer.room_id;
    if (!roomId) {
      return Response.json({ error: 'No room_id found on counter offer' }, { status: 400 });
    }
    
    // Get the room to identify investor and agent
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    
    const room = rooms[0];
    
    // Determine who sent the counter (from_role) and get their profile
    const senderProfileId = counterOffer.from_role === 'investor' ? room.investorId : room.agentId;
    const senderProfiles = await base44.asServiceRole.entities.Profile.filter({ id: senderProfileId });
    
    if (senderProfiles.length === 0) {
      return Response.json({ error: 'Sender profile not found' }, { status: 404 });
    }
    
    const sender = senderProfiles[0];
    const dealTitle = room.title || 'Your deal';
    const propertyAddress = room.property_address || 'the property';
    const action = counterOffer.status === 'accepted' ? 'accepted' : 'declined';
    
    // Send email to the counter offer sender
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: sender.email,
      subject: `Counter Offer ${action.charAt(0).toUpperCase() + action.slice(1)} - ${dealTitle}`,
      body: `
Hello ${sender.full_name || 'there'},

Your counter offer for ${dealTitle} (${propertyAddress}) has been ${action}.

${counterOffer.status === 'accepted' 
  ? 'The new terms have been applied. Please regenerate the agreement to proceed with signing.' 
  : 'You may submit a new counter offer or proceed with the original terms.'}

Best regards,
Investor Konnect Team
      `.trim()
    });
    
    return Response.json({ 
      success: true, 
      message: `Notification sent to ${counterOffer.from_role} about ${action} counter offer` 
    });
    
  } catch (error) {
    console.error('Error sending counter offer action notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});