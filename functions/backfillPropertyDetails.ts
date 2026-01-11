import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only safeguard
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const me = profiles?.[0];
    const isAdmin = user.role === 'admin' || me?.role === 'admin' || me?.user_role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const result = {
      processed: 0,
      updatedFromRoom: 0,
      updatedFromContract: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    // Fetch all deals (assuming manageable volume). If large volume, this can be paginated later.
    const deals = await base44.asServiceRole.entities.Deal.filter({});

    for (const deal of deals) {
      result.processed += 1;
      try {
        const hasPD = !!(deal.property_details && Object.keys(deal.property_details || {}).length > 0);
        const hasType = !!deal.property_type;

        // Nothing to do
        if (hasPD && hasType) {
          result.skipped += 1;
          continue;
        }

        // 1) Try to pull from Room if present
        let updated = false;
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
        const room = rooms?.[0];

        const roomPD = room?.property_details && Object.keys(room.property_details || {}).length > 0 ? room.property_details : null;
        const roomType = room?.property_type || null;

        const updates = {};
        if (!hasPD && roomPD) updates.property_details = roomPD;
        if (!hasType && roomType) updates.property_type = roomType;

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Deal.update(deal.id, updates);
          result.updatedFromRoom += 1;
          result.details.push({ id: deal.id, source: 'room', updates });
          updated = true;
        }

        // 2) If still missing, try to extract from seller contract
        const stillMissingPD = !(updates.property_details || hasPD);
        const stillMissingType = !(updates.property_type || hasType);

        const sellerUrl = deal?.documents?.purchase_contract?.file_url ||
                          deal?.documents?.purchase_contract?.url ||
                          deal?.contract_document?.url ||
                          deal?.contract_url;

        if ((stillMissingPD || stillMissingType) && sellerUrl) {
          try {
            const { data: extraction } = await base44.asServiceRole.functions.invoke('extractContractData', { fileUrl: sellerUrl });
            const d = extraction?.data || extraction;
            if (d) {
              const updates2 = {};
              if (stillMissingType && d.property_type) updates2.property_type = d.property_type;
              const pd = {};
              if (stillMissingPD) {
                if (d.property_details?.beds != null) pd.beds = d.property_details.beds;
                if (d.property_details?.baths != null) pd.baths = d.property_details.baths;
                if (d.property_details?.sqft != null) pd.sqft = d.property_details.sqft;
                if (d.property_details?.year_built != null) pd.year_built = d.property_details.year_built;
                if (d.property_details?.number_of_stories) pd.number_of_stories = d.property_details.number_of_stories;
                if (typeof d.property_details?.has_basement === 'boolean') pd.has_basement = d.property_details.has_basement;
                if (Object.keys(pd).length) updates2.property_details = pd;
              }
              if (Object.keys(updates2).length) {
                await base44.asServiceRole.entities.Deal.update(deal.id, updates2);
                result.updatedFromContract += 1;
                result.details.push({ id: deal.id, source: 'contract', updates: updates2 });
                updated = true;
              }
            }
          } catch (e) {
            // ignore extraction errors per-deal
          }
        }

        if (!updated) {
          result.skipped += 1;
        }
      } catch (e) {
        result.errors += 1;
        result.details.push({ id: deal.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});