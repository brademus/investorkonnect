import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/docusign/connect
 * Redirect admin to DocuSign OAuth consent
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if authenticated
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized - Please log in first' }, { status: 401 });
    }
    
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized - Please log in first' }, { status: 401 });
    }
    
    // Admin only - check both user.role and profile role
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (user.role !== 'admin' && profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const redirectUri = Deno.env.get('DOCUSIGN_REDIRECT_URI');
    const scopes = Deno.env.get('DOCUSIGN_SCOPES') || 'signature';
    
    if (!integrationKey || !redirectUri) {
      return Response.json({ 
        error: 'DocuSign not configured',
        details: 'Missing DOCUSIGN_INTEGRATION_KEY or DOCUSIGN_REDIRECT_URI' 
      }, { status: 500 });
    }
    
    // Generate CSRF state
    const state = crypto.randomUUID();
    
    // Store state in a temporary way (you might want to use a proper session store)
    // For now, we'll include it in the redirect and validate it in callback
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    const authUrl = new URL(`${authBase}/oauth/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('client_id', integrationKey);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    
    console.log('[DocuSign Connect] Redirecting to:', authUrl.toString());
    console.log('[DocuSign Connect] Redirect URI configured:', redirectUri);
    
    return Response.redirect(authUrl.toString(), 302);
  } catch (error) {
    console.error('[DocuSign Connect] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});