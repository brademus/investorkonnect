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
    
    // Store tokens and account info in Secrets (or a dedicated tokens table)
    // For now, we'll store in environment-specific secrets
    const tokenKey = `DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`;
    const refreshKey = `DOCUSIGN_REFRESH_TOKEN_${env.toUpperCase()}`;
    const accountIdKey = `DOCUSIGN_ACCOUNT_ID_${env.toUpperCase()}`;
    const baseUriKey = `DOCUSIGN_BASE_URI_${env.toUpperCase()}`;
    const expiresKey = `DOCUSIGN_TOKEN_EXPIRES_${env.toUpperCase()}`;
    
    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    // Note: In production, you'd want to store these securely in a database
    // For now, we'll log them and expect admin to set them as secrets
    console.log('[DocuSign Callback] Store these as secrets:');
    console.log(`${tokenKey}=${tokens.access_token}`);
    console.log(`${refreshKey}=${tokens.refresh_token}`);
    console.log(`${accountIdKey}=${account.account_id}`);
    console.log(`${baseUriKey}=${account.base_uri}`);
    console.log(`${expiresKey}=${expiresAt}`);
    
    // For demo purposes, we'll store in a simple JSON file or use the functions to update secrets
    // In a real app, use a proper token storage mechanism
    
    return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=connected&account=${account.account_id}`);
  } catch (error) {
    console.error('[DocuSign Callback] Error:', error);
    return Response.redirect(`${Deno.env.get('PUBLIC_APP_URL')}/Admin?docusign=error&message=${encodeURIComponent(error.message)}`);
  }
});