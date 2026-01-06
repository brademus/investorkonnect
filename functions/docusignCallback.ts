import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/docusign/callback
 * Handle OAuth callback and exchange code for tokens
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
      console.error('[DocuSign Callback] OAuth error:', error);
      return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      return Response.json({ error: 'Missing authorization code' }, { status: 400 });
    }
    
    // TODO: Validate state (CSRF protection) - store in session/db and verify
    
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const clientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    const redirectUri = Deno.env.get('DOCUSIGN_REDIRECT_URI');
    
    if (!integrationKey || !clientSecret || !redirectUri) {
      return Response.json({ 
        error: 'DocuSign not configured',
        details: 'Missing required environment variables' 
      }, { status: 500 });
    }
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    // Exchange code for tokens
    const tokenUrl = `${authBase}/oauth/token`;
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });
    
    const basicAuth = btoa(`${integrationKey}:${clientSecret}`);
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenBody
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[DocuSign Callback] Token exchange failed:', errorText);
      return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=Token%20exchange%20failed`);
    }
    
    const tokens = await tokenResponse.json();
    console.log('[DocuSign Callback] Tokens received');
    
    // Get user info to discover account_id and base_uri
    const userInfoResponse = await fetch(`${authBase}/oauth/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userInfoResponse.ok) {
      console.error('[DocuSign Callback] User info fetch failed');
      return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=User%20info%20failed`);
    }
    
    const userInfo = await userInfoResponse.json();
    const account = userInfo.accounts?.[0];
    
    if (!account) {
      return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=No%20DocuSign%20account%20found`);
    }
    
    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    // Store tokens in database per user
    const existingConnections = await base44.asServiceRole.entities.DocuSignConnection.filter({ 
      user_id: user.id 
    });
    
    if (existingConnections.length > 0) {
      // Update existing connection
      await base44.asServiceRole.entities.DocuSignConnection.update(existingConnections[0].id, {
        account_id: account.account_id,
        base_uri: account.base_uri,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        env
      });
    } else {
      // Create new connection
      await base44.asServiceRole.entities.DocuSignConnection.create({
        user_id: user.id,
        user_email: user.email,
        account_id: account.account_id,
        base_uri: account.base_uri,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        env
      });
    }
    
    console.log('[DocuSign Callback] Connection stored for user:', user.email);
    console.log('[DocuSign Callback] Account ID:', account.account_id);
    console.log('[DocuSign Callback] Base URI:', account.base_uri);
    
    return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=connected&account=${account.account_id}`);
  } catch (error) {
    console.error('[DocuSign Callback] Error:', error);
    return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=${encodeURIComponent(error.message)}`);
  }
});