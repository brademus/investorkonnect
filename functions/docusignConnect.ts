import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /api/functions/docusignConnect
 * Initiate DocuSign OAuth flow
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      console.log('[docusignConnect] AUTH_REQUIRED');
      return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { returnTo, force } = body;
    
    // Get origin from request or env
    const url = new URL(req.url);
    const origin = Deno.env.get('PUBLIC_APP_URL') || `${url.protocol}//${url.host}`;
    
    // Validate required secrets
    const clientId = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const clientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    const scopes = Deno.env.get('DOCUSIGN_SCOPES') || 'signature impersonation';
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    
    if (!clientId) {
      return Response.json({ error: 'Missing DOCUSIGN_INTEGRATION_KEY' }, { status: 500 });
    }
    if (!clientSecret) {
      return Response.json({ error: 'Missing DOCUSIGN_CLIENT_SECRET' }, { status: 500 });
    }
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    // Compute redirect URI exactly - MUST match what's registered in DocuSign
    const redirectUri = `${origin}/api/functions/docusignCallback`;
    
    // Check if already connected (unless force=true)
    if (!force) {
      const existingConnections = await base44.asServiceRole.entities.DocuSignConnection.filter({ 
        user_id: user.id 
      });
      
      if (existingConnections.length > 0) {
        console.log('[docusignConnect] Already connected, accountId:', existingConnections[0].account_id);
        return Response.json({ 
          connected: true, 
          message: 'Already connected',
          accountId: existingConnections[0].account_id
        });
      }
    }
    
    // Generate cryptographically-random state token
    const stateBytes = new Uint8Array(32);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Determine return_to URL
    const finalReturnTo = returnTo || `${origin}/Admin`;
    
    // Persist state in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    await base44.asServiceRole.entities.DocuSignOAuthState.create({
      state,
      user_id: user.id,
      user_email: user.email,
      return_to: finalReturnTo,
      expires_at: expiresAt
    });
    
    // Build DocuSign OAuth URL
    const authUrl = new URL(`${authBase}/oauth/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    
    // Structured logging
    console.log('[docusignConnect_called]', {
      user_id: user.id,
      return_to: finalReturnTo,
      state_created: state.substring(0, 8) + '...',
      redirect_uri: redirectUri,
      auth_server: authBase,
      scopes: scopes
    });
    
    return Response.json({ 
      ok: true,
      authUrl: authUrl.toString()
    });
  } catch (error) {
    console.error('[docusignConnect] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});