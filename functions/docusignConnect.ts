import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /api/docusign/connect
 * Initiate DocuSign OAuth flow
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }
    
    // Admin only - check both user.role and profile role
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (user.role !== 'admin' && profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { returnTo, force } = body;
    
    // Validate required secrets
    const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const clientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    const scopes = Deno.env.get('DOCUSIGN_SCOPES') || 'signature impersonation';
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const appBaseUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL');
    
    if (!integrationKey) {
      return Response.json({ error: 'Missing DOCUSIGN_INTEGRATION_KEY' }, { status: 500 });
    }
    if (!clientSecret) {
      return Response.json({ error: 'Missing DOCUSIGN_CLIENT_SECRET' }, { status: 500 });
    }
    if (!appBaseUrl) {
      return Response.json({ error: 'Missing APP_BASE_URL or PUBLIC_APP_URL' }, { status: 500 });
    }
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    // Compute redirect URI exactly
    const redirectUri = `${appBaseUrl}/api/functions/docusignCallback`;
    
    // Check if already connected (unless force=true)
    if (!force) {
      const existingConnections = await base44.asServiceRole.entities.DocuSignConnection.filter({ 
        user_id: user.id 
      });
      
      if (existingConnections.length > 0) {
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
    
    // Persist state in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    await base44.asServiceRole.entities.DocuSignOAuthState.create({
      state,
      user_id: user.id,
      user_email: user.email,
      return_to: returnTo || `${appBaseUrl}/Admin`,
      expires_at: expiresAt
    });
    
    // Build DocuSign OAuth URL
    const authUrl = new URL(`${authBase}/oauth/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('client_id', integrationKey);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    
    // Log for diagnostics
    console.log('[DocuSign Connect] OAuth initiated');
    console.log('[DocuSign Connect] User:', user.id, user.email);
    console.log('[DocuSign Connect] Redirect URI:', redirectUri);
    console.log('[DocuSign Connect] Auth Base:', authBase);
    console.log('[DocuSign Connect] Scopes:', scopes);
    console.log('[DocuSign Connect] Auth URL hostname:', authUrl.hostname);
    
    return Response.json({ 
      ok: true,
      authUrl: authUrl.toString()
    });
  } catch (error) {
    console.error('[DocuSign Connect] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});