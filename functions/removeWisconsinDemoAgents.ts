import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Require auth
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const myProfile = profiles?.[0] || null;
    const isAdmin = user.role === 'admin' || myProfile?.role === 'admin' || myProfile?.user_role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch candidate WI agents
    // Limit to a large enough batch; adjust if needed
    const candidates = await base44.asServiceRole.entities.Profile.filter(
      { user_role: 'agent', target_state: 'WI' },
      undefined,
      2000
    );

    const isSeedDemoAgentsEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@investorkonnect.demo');
    const isDemoSeedWisconsinEmail = (email) => typeof email === 'string' && /\.wi\d+@example\.com$/i.test(email);

    const toDelete = (candidates || []).filter((p) => {
      const email = p?.email || '';
      return isSeedDemoAgentsEmail(email) || isDemoSeedWisconsinEmail(email);
    });

    const deleted = [];
    for (const p of toDelete) {
      try {
        await base44.asServiceRole.entities.Profile.delete(p.id);
        deleted.push({ id: p.id, email: p.email, full_name: p.full_name });
      } catch (err) {
        // Continue on individual delete errors
        console.error('[removeWisconsinDemoAgents] Failed to delete', p.id, p.email, err?.message);
      }
    }

    return Response.json({
      success: true,
      scanned: candidates?.length || 0,
      deleted_count: deleted.length,
      deleted,
    });
  } catch (error) {
    console.error('[removeWisconsinDemoAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});