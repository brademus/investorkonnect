import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 401 });
    }

    // Get profile
    const profiles = await base44.entities.Profile.filter({ 
      email: user.email 
    });

    const profile = profiles.length > 0 ? profiles[0] : null;
    const exists = !!profile;

    return Response.json({
      exists,
      profile,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    });

  } catch (error) {
    console.error('Profile get error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});