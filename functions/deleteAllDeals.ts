import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get profile ID from request body
    const body = await req.json();
    const targetProfileId = body?.profileId || profile.id;

    // Only allow users to delete their own data (unless admin)
    const isAdmin = profile.role === 'admin' || profile.user_role === 'admin';
    if (!isAdmin && targetProfileId !== profile.id) {
      return Response.json({ error: 'Forbidden - Can only delete your own deals' }, { status: 403 });
    }

    // Find all deals for this profile
    const isAgent = profile.user_role === 'agent';
    const filterKey = isAgent ? { agent_id: targetProfileId } : { investor_id: targetProfileId };
    const userDeals = await base44.asServiceRole.entities.Deal.filter(filterKey);
    const dealIds = userDeals.map(d => d.id);

    // Find all rooms for this profile's deals
    const userRooms = await base44.asServiceRole.entities.Room.filter({ 
      deal_id: { $in: dealIds }
    });
    const roomIds = userRooms.map(r => r.id);

    // Delete all messages in these rooms
    let deletedMessages = 0;
    for (const roomId of roomIds) {
      const messages = await base44.asServiceRole.entities.Message.filter({ room_id: roomId });
      for (const message of messages) {
        await base44.asServiceRole.entities.Message.delete(message.id);
        deletedMessages++;
      }
    }

    // Delete all rooms
    for (const room of userRooms) {
      await base44.asServiceRole.entities.Room.delete(room.id);
    }

    // Delete all deals
    for (const deal of userDeals) {
      await base44.asServiceRole.entities.Deal.delete(deal.id);
    }

    return Response.json({
      success: true,
      message: `Deleted ${userDeals.length} deals, ${userRooms.length} rooms, and ${deletedMessages} messages`,
      deleted: {
        deals: userDeals.length,
        rooms: userRooms.length,
        messages: deletedMessages
      }
    });

  } catch (error) {
    console.error('Error deleting deals:', error);
    return Response.json({ 
      error: 'Failed to delete deals',
      details: error.message 
    }, { status: 500 });
  }
});