import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated and is admin
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile || (profile.role !== 'admin' && profile.user_role !== 'admin')) {
      return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Delete all Messages
    const messages = await base44.asServiceRole.entities.Message.filter({});
    for (const message of messages) {
      await base44.asServiceRole.entities.Message.delete(message.id);
    }

    // Delete all Rooms
    const rooms = await base44.asServiceRole.entities.Room.filter({});
    for (const room of rooms) {
      await base44.asServiceRole.entities.Room.delete(room.id);
    }

    // Delete all Deals
    const deals = await base44.asServiceRole.entities.Deal.filter({});
    for (const deal of deals) {
      await base44.asServiceRole.entities.Deal.delete(deal.id);
    }

    return Response.json({
      success: true,
      deleted: {
        messages: messages.length,
        rooms: rooms.length,
        deals: deals.length
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