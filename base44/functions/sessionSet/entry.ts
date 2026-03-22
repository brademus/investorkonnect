import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * POST /functions/session/set
 * Called after OAuth callback to set session cookie with proper attributes
 * Precondition: user must be authenticated (after exchangeCodeForSession)
 */
Deno.serve(async (req) => {
  const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://agent-vault-da3d088b.base44.app';
  const sessionCookieName = Deno.env.get('SESSION_COOKIE_NAME') || 'av_session';
  const sessionMaxAgeDays = parseInt(Deno.env.get('SESSION_MAX_AGE_DAYS') || '7', 10);
  
  const headers = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        error: 'Not authenticated' 
      }, { 
        status: 401, 
        headers 
      });
    }

    console.log('[sessionSet] Setting session cookie for user:', user.email);

    // Generate opaque session token (use user ID + timestamp)
    const sessionToken = btoa(`${user.id}:${Date.now()}`);
    
    // Calculate max age in seconds
    const maxAgeSeconds = sessionMaxAgeDays * 86400;

    // Set session cookie with proper attributes for Safari/iOS
    const cookieValue = `${sessionCookieName}=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAgeSeconds}; Domain=agent-vault-da3d088b.base44.app`;
    
    const responseHeaders = {
      ...headers,
      'Set-Cookie': cookieValue
    };

    console.log('[sessionSet] Cookie set successfully');

    return new Response(null, { 
      status: 204, 
      headers: responseHeaders 
    });

  } catch (error) {
    console.error('[sessionSet] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { 
      status: 500, 
      headers 
    });
  }
});