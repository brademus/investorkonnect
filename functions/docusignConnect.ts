import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
const DOCUSIGN_CLIENT_SECRET = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
const DOCUSIGN_REDIRECT_URI = Deno.env.get('DOCUSIGN_REDIRECT_URI');
const DOCUSIGN_ENV = Deno.env.get('DOCUSIGN_ENV') || 'demo';
const DOCUSIGN_SCOPES = Deno.env.get('DOCUSIGN_SCOPES') || 'signature impersonation';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_CLIENT_SECRET) {
      return Response.json({ error: 'DocuSign credentials not configured (DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_CLIENT_SECRET)' }, { status: 500 });
    }

    const body = await req.json();
    const { returnTo, force } = body;

    // Check if already connected (unless forcing reconnect)
    if (!force) {
      const existing = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
      if (existing?.length) {
        const conn = existing[0];
        // Check if token is still valid
        if (!conn.expires_at || new Date(conn.expires_at) > new Date()) {
          return Response.json({ connected: true, account_id: conn.account_id });
        }
        // Try refresh
        if (conn.refresh_token) {
          const authHost = DOCUSIGN_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
          const tokenResp = await fetch(`https://${authHost}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: conn.refresh_token,
              client_id: DOCUSIGN_INTEGRATION_KEY,
              client_secret: DOCUSIGN_CLIENT_SECRET,
            }),
          });
          if (tokenResp.ok) {
            const tokens = await tokenResp.json();
            await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || conn.refresh_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            });
            return Response.json({ connected: true, account_id: conn.account_id });
          }
          // Refresh failed — fall through to re-auth
        }
      }
    }

    // Build OAuth authorization URL
    const authHost = DOCUSIGN_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
    
    // IMPORTANT: The redirect URI must point to the frontend page (not the API function)
    // because DocuSign redirects the browser there with the auth code.
    // The frontend page then calls docusignCallback to exchange the code.
    // If DOCUSIGN_REDIRECT_URI points to an API endpoint, override it with the frontend page URL.
    const publicUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://investorkonnect.com';
    const configuredRedirect = DOCUSIGN_REDIRECT_URI || '';
    const redirectUri = configuredRedirect.includes('/api/') 
      ? `${publicUrl}/DocuSignCallback`
      : (configuredRedirect || `${publicUrl}/DocuSignCallback`);

    // Store returnTo in state param so callback knows where to redirect
    const statePayload = JSON.stringify({ returnTo: returnTo || '/Admin' });
    const state = btoa(statePayload);

    const authUrl = new URL(`https://${authHost}/oauth/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', DOCUSIGN_SCOPES);
    authUrl.searchParams.set('client_id', DOCUSIGN_INTEGRATION_KEY);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    console.log(`[docusignConnect] Auth URL generated, redirect_uri=${redirectUri}`);
    return Response.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('[docusignConnect] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});