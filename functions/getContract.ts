import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contracts = await base44.entities.Contract.filter({ id });
    const contract = contracts[0];

    if (!contract) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ contract });
  } catch (error) {
    console.error('[getContract] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});