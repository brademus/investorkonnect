import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * GET /functions/session/get
 * Source of truth for session status - no redirects
 * Returns 200 if authenticated, 401 if not
 */
Deno.serve(async (req) => {
  const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://agent-vault-da3d088b.base44.app';
  
  const headers = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Try to get current user - don't throw on failure
    let user = null;
    let authenticated = false;
    
    try {
      user = await base44.auth.me();
      authenticated = !!user;
    } catch (error) {
      console.log('[sessionGet] No active session:', error.message);
    }

    if (authenticated && user) {
      return Response.json({
        ok: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        ts: Date.now()
      }, { status: 200, headers });
    } else {
      return Response.json({
        ok: false,
        authenticated: false,
        ts: Date.now()
      }, { status: 401, headers });
    }
  } catch (error) {
    console.error('[sessionGet] Error:', error);
    return Response.json({
      ok: false,
      authenticated: false,
      error: error.message,
      ts: Date.now()
    }, { status: 401, headers });
  }
});