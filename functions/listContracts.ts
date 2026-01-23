import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");

    if (!room_id) {
      return Response.json({ error: "room_id required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contracts = await base44.entities.Contract.filter({ room_id });

    return Response.json({ items: contracts || [] });
  } catch (error) {
    console.error('[listContracts] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});