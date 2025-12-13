import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check admin status
    const profiles = await base44.asServiceRole.entities.Profile.filter({ 
      user_id: user.id 
    });
    const profile = profiles[0];
    
    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete all deals
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    let deletedCount = 0;

    for (const deal of allDeals) {
      await base44.asServiceRole.entities.Deal.delete(deal.id);
      deletedCount++;
    }

    // Also clean up any orphaned rooms (optional)
    const allRooms = await base44.asServiceRole.entities.Room.list();
    let roomsDeleted = 0;
    
    for (const room of allRooms) {
      // Delete rooms that had deal_id references
      if (room.deal_id) {
        await base44.asServiceRole.entities.Room.delete(room.id);
        roomsDeleted++;
      }
    }

    return Response.json({
      success: true,
      deletedDeals: deletedCount,
      deletedRooms: roomsDeleted,
      message: `Deleted ${deletedCount} deals and ${roomsDeleted} associated rooms`
    });

  } catch (error) {
    console.error('Error deleting deals:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});