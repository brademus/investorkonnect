import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-side enriched rooms list
 * Returns rooms with counterparty profiles and deal summaries pre-loaded
 * Eliminates client-side N+1 queries
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;

    // Get all rooms for this user
    const rooms = userRole === 'investor'
      ? await base44.asServiceRole.entities.Room.filter({ investorId: profile.id })
      : await base44.asServiceRole.entities.Room.filter({ agentId: profile.id });

    // Get all unique deal IDs
    const dealIds = [...new Set(rooms.map(r => r.deal_id).filter(Boolean))];
    
    // Get all deals at once
    const allDeals = dealIds.length > 0
      ? await base44.asServiceRole.entities.Deal.filter({ id: { $in: dealIds } })
      : [];
    
    const dealMap = new Map(allDeals.map(d => [d.id, d]));

    // Get all unique counterparty profile IDs
    const counterpartyIds = [...new Set(
      rooms.map(r => userRole === 'investor' ? r.agentId : r.investorId).filter(Boolean)
    )];
    
    // Get all counterparty profiles at once
    const counterpartyProfiles = counterpartyIds.length > 0
      ? await base44.asServiceRole.entities.Profile.filter({ id: { $in: counterpartyIds } })
      : [];
    
    const profileMap = new Map(counterpartyProfiles.map(p => [p.id, p]));

    // Collect all room IDs to fetch message-based attachments (mirrors Files tab)
    const roomIds = rooms.map(r => r.id).filter(Boolean);

    // Fetch Message entity attachments (new schema)
    const messages = roomIds.length > 0
      ? await base44.asServiceRole.entities.Message.filter({ room_id: { $in: roomIds } })
      : [];

    // Fetch RoomMessage entity attachments as legacy fallback
    const roomMessages = roomIds.length > 0
      ? await base44.asServiceRole.entities.RoomMessage.filter({ roomId: { $in: roomIds } })
      : [];

    // Build sender profile map for message attachments
    const senderProfileIds = [
      ...new Set([
        ...messages.map(m => m.sender_profile_id).filter(Boolean),
        ...roomMessages.map(m => m.senderUserId || m.sender_profile_id).filter(Boolean)
      ])
    ];

    if (senderProfileIds.length) {
      const senderProfiles = await base44.asServiceRole.entities.Profile.filter({ id: { $in: senderProfileIds } });
      senderProfiles.forEach(p => profileMap.set(p.id, p));
    }

    // Normalize attachments from Message and RoomMessage
    const messageAttachmentsByRoom = new Map();
    const legacyAttachmentsByRoom = new Map();

    const pushByRoom = (map, roomId, item) => {
      if (!roomId) return;
      if (!map.has(roomId)) map.set(roomId, []);
      map.get(roomId).push(item);
    };

    // From Message (metadata.file_url)
    messages.forEach(m => {
      const meta = m.metadata || {};
      if (!meta.file_url) return;
      const uploader = profileMap.get(m.sender_profile_id);
      const name = meta.file_name || (typeof meta.file_url === 'string' ? meta.file_url.split('?')[0].split('/').pop() : 'Document');
      pushByRoom(messageAttachmentsByRoom, m.room_id, {
        name,
        url: meta.file_url,
        uploaded_by: m.sender_profile_id,
        uploaded_by_name: uploader?.full_name || 'Shared',
        uploaded_at: m.created_date,
        size: meta.file_size,
        type: meta.file_type
      });
    });

    // From RoomMessage (legacy kind="file")
    roomMessages.forEach(m => {
      if (m.kind !== 'file' || !m.fileUrl) return;
      const uploader = profileMap.get(m.senderUserId || m.sender_profile_id);
      const name = (m.text && typeof m.text === 'string' ? m.text : null) || m.fileUrl.split('?')[0].split('/').pop() || 'Document';
      pushByRoom(legacyAttachmentsByRoom, m.roomId, {
        name,
        url: m.fileUrl,
        uploaded_by: m.senderUserId || m.sender_profile_id,
        uploaded_by_name: uploader?.full_name || 'Shared',
        uploaded_at: m.created_date,
        size: undefined,
        type: undefined
      });
    });

    // Enrich rooms
    const enrichedRooms = rooms.map(room => {
      const deal = dealMap.get(room.deal_id);
      const counterpartyId = userRole === 'investor' ? room.agentId : room.investorId;
      const counterpartyProfile = profileMap.get(counterpartyId);
      
      const isFullySigned = room.agreement_status === 'fully_signed' || 
                           room.request_status === 'signed';

      // Base room data
      const enriched = {
        id: room.id,
        deal_id: room.deal_id,
        request_status: room.request_status,
        agreement_status: room.agreement_status,
        created_date: room.created_date,
        updated_date: room.updated_date,

        // Mirror Files tab: combine room uploads with message attachments (exactly like Files tab)
        ...(function() {
          const baseFiles = Array.isArray(room.files) ? room.files : [];
          const basePhotos = Array.isArray(room.photos) ? room.photos : [];
          const msgFiles = messageAttachmentsByRoom.get(room.id) || [];
          const legacyFiles = legacyAttachmentsByRoom.get(room.id) || [];
          const all = [...baseFiles, ...msgFiles, ...legacyFiles];
          const isPhoto = (f) => {
            const t = (f?.type || '').toString().toLowerCase();
            if (t.startsWith('image/')) return true;
            const n = (f?.name || '').toString().toLowerCase();
            return /(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/.test(n);
          };
          const files = all.filter(f => !isPhoto(f));
          const photos = [...basePhotos, ...all.filter(isPhoto)];
          // Sort newest first
          const byDateDesc = (a, b) => new Date(b?.uploaded_at || 0) - new Date(a?.uploaded_at || 0);
          files.sort(byDateDesc);
          photos.sort(byDateDesc);
          return { files, photos };
        })(),
        
        // Counterparty info
        counterparty_id: counterpartyId,
        counterparty_name: counterpartyProfile?.full_name || 'Unknown',
        counterparty_role: userRole === 'investor' ? 'agent' : 'investor',
        counterparty_avatar: counterpartyProfile?.headshotUrl,
        
        // Deal summary (redacted for agents if not signed)
        deal_summary: deal ? {
          title: deal.title,
          city: deal.city,
          state: deal.state,
          budget: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage,
          closing_date: deal.key_dates?.closing_date,
          // Sensitive fields only if allowed
          property_address: (userRole === 'investor' || isFullySigned) 
            ? deal.property_address 
            : null,
          seller_name: (userRole === 'investor' || isFullySigned) 
            ? deal.seller_info?.seller_name 
            : null
        } : null,
        
        is_fully_signed: isFullySigned,
        
        // Legacy fields for compatibility
        title: deal?.title || room.title,
        property_address: (userRole === 'investor' || isFullySigned) 
          ? (deal?.property_address || room.property_address)
          : null,
        city: deal?.city || room.city,
        state: deal?.state || room.state,
        budget: deal?.purchase_price || room.budget || 0
      };

      return enriched;
    });

    // Filter out orphaned rooms (no valid counterparty)
    const validRooms = enrichedRooms.filter(r => 
      r.counterparty_name && r.counterparty_name !== 'Unknown'
    );

    return Response.json({ 
      rooms: validRooms,
      count: validRooms.length 
    });

  } catch (error) {
    console.error('listMyRoomsEnriched error:', error);
    return Response.json({ 
      error: error.message || 'Failed to list rooms' 
    }, { status: 500 });
  }
});