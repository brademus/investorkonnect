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

    // Fetch negotiations for these deals to surface counter/regen state
    const negotiations = dealIds.length > 0
      ? await base44.asServiceRole.entities.DealNegotiation.filter({ deal_id: { $in: dealIds } })
      : [];

    // Choose latest negotiation per deal
    const negotiationMap = new Map();
    for (const n of negotiations) {
      const prev = negotiationMap.get(n.deal_id);
      if (!prev) {
        negotiationMap.set(n.deal_id, n);
      } else {
        const tA = new Date(n.updated_at || n.updated_date || n.created_date || 0).getTime();
        const tB = new Date(prev.updated_at || prev.updated_date || prev.created_date || 0).getTime();
        if (tA >= tB) negotiationMap.set(n.deal_id, n);
      }
    }

    // Pending CounterOffers (latest per deal)
    const pendingOffers = dealIds.length > 0
      ? await base44.asServiceRole.entities.CounterOffer.filter({ deal_id: { $in: dealIds }, status: 'pending' })
      : [];
    const pendingOfferByDealId = new Map();
    for (const o of pendingOffers) {
      const prev = pendingOfferByDealId.get(o.deal_id);
      if (!prev) {
        pendingOfferByDealId.set(o.deal_id, o);
      } else {
        const tA = new Date(o.updated_date || o.created_date || 0).getTime();
        const tB = new Date(prev.updated_date || prev.created_date || 0).getTime();
        if (tA >= tB) pendingOfferByDealId.set(o.deal_id, o);
      }
    }

    // Get all unique counterparty profile IDs
    const counterpartyIds = [...new Set(
      rooms.map(r => userRole === 'investor' ? r.agentId : r.investorId).filter(Boolean)
    )];
    
    // Get all counterparty profiles at once
    const counterpartyProfiles = counterpartyIds.length > 0
      ? await base44.asServiceRole.entities.Profile.filter({ id: { $in: counterpartyIds } })
      : [];
    
    const profileMap = new Map(counterpartyProfiles.map(p => [p.id, p]));

    // Fetch legal agreements for these deals (to surface Internal Agreement PDFs)
    const legalAgreements = dealIds.length > 0
      ? await base44.asServiceRole.entities.LegalAgreement.filter({ id: { $ne: null }, deal_id: { $in: dealIds } })
      : [];
    const legalMap = new Map(legalAgreements.map(a => [a.deal_id, a]));

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
      const negotiation = negotiationMap.get(room.deal_id);
      const pending = pendingOfferByDealId.get(room.deal_id) || null;
      const derivedNegotiation = negotiation || (pending ? {
        status: pending.from_role === 'agent' ? 'COUNTERED_BY_AGENT' : 'COUNTERED_BY_INVESTOR',
        from_role: pending.from_role,
        last_proposed_terms: { proposed_by_role: pending.from_role }
      } : null);
      const enriched = {
        id: room.id,
        deal_id: room.deal_id,
        request_status: room.request_status,
        agreement_status: room.agreement_status,
        negotiation_status: derivedNegotiation?.status || null,
        negotiation: derivedNegotiation ? {
          status: derivedNegotiation.status,
          last_proposed_terms: derivedNegotiation.last_proposed_terms || null,
          current_terms: derivedNegotiation.current_terms || null
        } : null,
        regen_required: (() => {
          const s = String(derivedNegotiation?.status || '').toUpperCase();
          return Boolean(
            s.includes('REGEN') ||
            negotiation?.requires_regen ||
            negotiation?.needs_regeneration ||
            negotiation?.regeneration_required ||
            negotiation?.last_proposed_terms?.requires_regen
          );
        })(),
        last_counter_by_role: derivedNegotiation?.last_proposed_terms?.proposed_by_role || null,
        pending_counter_offer: pending ? {
          id: pending.id,
          from_role: pending.from_role,
          status: pending.status,
          terms: pending.terms,
          created_at: pending.created_date
        } : null,
        created_date: room.created_date,
        updated_date: room.updated_date,

        // Mirror Files tab: combine room uploads with message attachments and system documents
        ...(function() {
          const baseFiles = Array.isArray(room.files) ? room.files : [];
          const basePhotos = Array.isArray(room.photos) ? room.photos : [];
          const msgFiles = messageAttachmentsByRoom.get(room.id) || [];
          const legacyFiles = legacyAttachmentsByRoom.get(room.id) || [];

          // Helper to normalize a document object to file item
          const normalizeDoc = (doc, fallbackName, uploadedAtKey = 'uploaded_at') => {
            if (!doc || !doc.url) return null;
            return {
              name: doc.name || fallbackName || 'Document',
              url: doc.url,
              uploaded_by: doc.uploaded_by,
              uploaded_by_name: doc.uploaded_by_name || 'System',
              uploaded_at: doc[uploadedAtKey] || doc.generated_at || room.updated_date || room.created_date,
              size: doc.size,
              type: doc.type || 'application/pdf'
            };
          };

          // System docs on Room
          const systemRoomDocs = [
            normalizeDoc(room.contract_document, 'Purchase Contract'),
            normalizeDoc(room.listing_agreement_document, 'Listing Agreement'),
            normalizeDoc(room.internal_agreement_document, 'Internal Agreement', 'generated_at')
          ].filter(Boolean);

          // System docs on Deal (if available)
          const deal = dealMap.get(room.deal_id);
          const systemDealDocs = [];
          if (deal) {
            if (deal.contract_document) systemDealDocs.push(normalizeDoc(deal.contract_document, 'Purchase Contract'));
            const docs = deal.documents || {};
            if (docs.purchase_contract && docs.purchase_contract.url) systemDealDocs.push(normalizeDoc(docs.purchase_contract, 'Purchase Contract'));
            if (docs.listing_agreement && docs.listing_agreement.url) systemDealDocs.push(normalizeDoc(docs.listing_agreement, 'Listing Agreement'));
            if (docs.operating_agreement && docs.operating_agreement.url) systemDealDocs.push(normalizeDoc(docs.operating_agreement, 'Operating Agreement'));
            if (docs.buyer_contract && docs.buyer_contract.url) systemDealDocs.push(normalizeDoc(docs.buyer_contract, 'Buyer Contract'));
          }

          const la = legalMap.get(room.deal_id);
          const legalDocs = [];
          if (la) {
            const laUrl = la.signed_pdf_url || la.final_pdf_url || la.docusign_pdf_url || la.pdf_file_url || la.signing_pdf_url || la.docusign_pdf_url;
            if (laUrl) {
              legalDocs.push({
                name: 'Internal Agreement',
                url: laUrl,
                uploaded_by_name: 'System',
                uploaded_at: la.agent_signed_at || la.investor_signed_at || la.updated_date || la.created_date,
                type: 'application/pdf'
              });
            }
          }

          const all = [
            ...baseFiles,
            ...msgFiles,
            ...legacyFiles,
            ...systemRoomDocs,
            ...systemDealDocs,
            ...legalDocs,
          ];

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
        
        // Include agreement signing status for badges
        agreement: la ? {
          status: la.status,
          investor_signed_at: la.investor_signed_at,
          agent_signed_at: la.agent_signed_at,
          docusign_status: la.docusign_status
        } : null,
        
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