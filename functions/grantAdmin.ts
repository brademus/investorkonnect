import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user's profile by email OR user_id
    let profiles = await base44.asServiceRole.entities.Profile.filter({ 
      email: user.email.toLowerCase().trim() 
    });
    
    if (!profiles || profiles.length === 0) {
      profiles = await base44.asServiceRole.entities.Profile.filter({ 
        user_id: user.id 
      });
    }
    
    if (!profiles || profiles.length === 0) {
      return Response.json({ 
        error: 'Profile not found',
        debug: { email: user.email, user_id: user.id }
      }, { status: 404 });
    }

    const profile = profiles[0];

    // Update to admin
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      role: 'admin'
    });

    return Response.json({
      success: true,
      message: 'Admin access granted',
      email: user.email
    });

  } catch (error) {
    console.error('[grantAdmin] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});