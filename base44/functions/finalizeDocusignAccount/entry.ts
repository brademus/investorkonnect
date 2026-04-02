import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { account_id, account_name, base_uri, access_token, refresh_token, expires_at } = await req.json();

    if (!account_id || !access_token) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const DOCUSIGN_ENV = Deno.env.get('DOCUSIGN_ENV') || 'demo';

    // Delete any existing connections
    const existing = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 10);
    for (const conn of existing) {
      await base44.asServiceRole.entities.DocuSignConnection.delete(conn.id);
    }

    // Create new connection with the selected account
    await base44.asServiceRole.entities.DocuSignConnection.create({
      account_id,
      base_uri,
      access_token,
      refresh_token: refresh_token || '',
      expires_at,
      connected_by: user.id,
    });

    console.log(`[finalizeDocusignAccount] Connected to account: ${account_id} (${account_name})`);
    return Response.json({ ok: true, account_id, account_name });
  } catch (error) {
    console.error('[finalizeDocusignAccount] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});