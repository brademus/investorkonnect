import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/docusign/callback
 * Handle OAuth callback and exchange code for tokens
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    const appBaseUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL');
    const fallbackUrl = `${appBaseUrl}/Admin?docusign=error`;
    
    if (error) {
      console.error('[DocuSign Callback] OAuth error:', error);
      return Response.redirect(`${fallbackUrl}&message=${encodeURIComponent(error)}`, 302);
    }
    
    if (!code || !state) {
      return Response.redirect(`${fallbackUrl}&message=Missing%20code%20or%20state`, 302);
    }
    
    const base44 = createClientFromRequest(req);
    
    // Validate state from database
    const stateRecords = await base44.asServiceRole.entities.DocuSignOAuthState.filter({ state });
    
    if (stateRecords.length === 0) {
      console.error('[DocuSign Callback] Invalid state - not found in database');
      return Response.redirect(`${fallbackUrl}&message=Invalid%20or%20expired%20session`, 302);
    }
    
    const stateRecord = stateRecords[0];
    
    // Check expiration
    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error('[DocuSign Callback] State expired');
      await base44.asServiceRole.entities.DocuSignOAuthState.delete(stateRecord.id);
      return Response.redirect(`${fallbackUrl}&message=Session%20expired`, 302);
    }
    
    const user = { id: stateRecord.user_id, email: stateRecord.user_email };
    const returnTo = stateRecord.return_to;
    
    // Get secrets
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const clientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    
    if (!integrationKey || !clientSecret) {
      return Response.redirect(`${fallbackUrl}&message=DocuSign%20not%20configured`, 302);
    }
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    const redirectUri = `${appBaseUrl}/api/functions/docusignCallback`;
    
    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });
    
    const basicAuth = btoa(`${integrationKey}:${clientSecret}`);
    const tokenResponse = await fetch(`${authBase}/oauth/token`, {
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
      return Response.redirect(`${fallbackUrl}&message=Token%20exchange%20failed`, 302);
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userInfoResponse = await fetch(`${authBase}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    if (!userInfoResponse.ok) {
      console.error('[DocuSign Callback] User info failed');
      return Response.redirect(`${fallbackUrl}&message=User%20info%20failed`, 302);
    }
    
    const userInfo = await userInfoResponse.json();
    const account = userInfo.accounts?.[0];
    
    if (!account) {
      return Response.redirect(`${fallbackUrl}&message=No%20DocuSign%20account`, 302);
    }
    
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    // Upsert DocuSignConnection
    const existingConnections = await base44.asServiceRole.entities.DocuSignConnection.filter({ 
      user_id: user.id 
    });
    
    if (existingConnections.length > 0) {
      await base44.asServiceRole.entities.DocuSignConnection.update(existingConnections[0].id, {
        account_id: account.account_id,
        base_uri: account.base_uri,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        env
      });
    } else {
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
    
    // Delete used state
    await base44.asServiceRole.entities.DocuSignOAuthState.delete(stateRecord.id);
    
    console.log('[DocuSign Callback] Success - User:', user.email, 'Account:', account.account_id);
    
    // Redirect to return URL
    const finalUrl = returnTo.includes('?') 
      ? `${returnTo}&docusign=connected`
      : `${returnTo}?docusign=connected`;
    
    return Response.redirect(finalUrl, 302);
  } catch (error) {
    console.error('[DocuSign Callback] Error:', error);
    const appBaseUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL');
    return Response.redirect(`${appBaseUrl}/Admin?docusign=error&message=${encodeURIComponent(error.message)}`, 302);
  }
});