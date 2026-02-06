import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Session endpoint - returns current auth state without redirecting
 * Used for checking session status from client-side
 */
Deno.serve(async (req) => {
  // CORS headers for app origin
  const appOrigin = Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app';
  
  const headers = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      // User not authenticated - this is OK
      console.log('[session] No active session');
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
        issuedAt: new Date().toISOString()
      }, { status: 200, headers });
    } else {
      return Response.json({
        ok: false,
        authenticated: false,
        issuedAt: new Date().toISOString()
      }, { status: 401, headers });
    }
  } catch (error) {
    console.error('[session] Error:', error);
    return Response.json({
      ok: false,
      authenticated: false,
      error: error.message,
      issuedAt: new Date().toISOString()
    }, { status: 401, headers });
  }
});