import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Returns all approved reviews for a given agent profile.
 * Uses service role so reviews are visible to any authenticated user.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { profileId } = await req.json();
    if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

    const reviews = await base44.asServiceRole.entities.Review.filter({
      reviewee_profile_id: profileId,
      moderation_status: 'approved'
    }, '-created_date', 50);

    return Response.json({ reviews: reviews || [] });
  } catch (error) {
    console.error('[getAgentReviews] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});