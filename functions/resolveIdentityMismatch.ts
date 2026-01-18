import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { verifiedFirstName, verifiedLastName } = await req.json();
    if (!verifiedFirstName || !verifiedLastName) return Response.json({ error: 'Missing verified names' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles?.length) return Response.json({ error: 'Profile not found' }, { status: 404 });
    const profile = profiles[0];

    await base44.entities.Profile.update(profile.id, { full_name: `${verifiedFirstName} ${verifiedLastName}` });

    const recs = await base44.entities.UserIdentity.filter({ user_id: user.id });
    if (recs?.length) {
      await base44.entities.UserIdentity.update(recs[0].id, { nameMatchStatus: 'MATCH' });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});