import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/functions/docusignCallback
 * OAuth callback - receives code from DocuSign, exchanges for tokens, redirects back to app
 */
Deno.serve(async (req) => {
  // Get origin from request
  const reqUrl = new URL(req.url);
  const origin = Deno.env.get('PUBLIC_APP_URL') || `${reqUrl.protocol}//${reqUrl.host}`;
  const fallbackUrl = `${origin}/Admin?docusign=error`;
  
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    console.log('[docusignCallback_received]', {
      has_code: !!code,
      has_state: !!state,
      has_error: !!error
    });
    
    if (error) {
      console.error('[docusignCallback] OAuth error from DocuSign:', error);
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=${encodeURIComponent(error)}"></head><body><h3>❌ OAuth Error</h3><p>${error}</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    if (!code || !state) {
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=Missing%20parameters"></head><body><h3>❌ Missing Parameters</h3><p>Missing code or state</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    const base44 = createClientFromRequest(req);
    
    // Validate state from database
    const stateRecords = await base44.asServiceRole.entities.DocuSignOAuthState.filter({ state });
    
    if (stateRecords.length === 0) {
      console.error('[docusignCallback] Invalid state - not found in database');
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=Invalid%20session"></head><body><h3>❌ Invalid Session</h3><p>State not found or expired</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    const stateRecord = stateRecords[0];
    
    // Check expiration
    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error('[docusignCallback] State expired');
      await base44.asServiceRole.entities.DocuSignOAuthState.delete(stateRecord.id);
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=Session%20expired"></head><body><h3>⏱️ Session Expired</h3><p>Please try connecting again</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    console.log('[docusignCallback_state_validated]', {
      user_id: stateRecord.user_id
    });
    
    const user = { id: stateRecord.user_id, email: stateRecord.user_email };
    const returnTo = stateRecord.return_to;
    
    // Get secrets
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const clientId = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const clientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=Configuration%20missing"></head><body><h3>⚙️ Configuration Error</h3><p>DocuSign credentials not configured</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    const authBase = env === 'production' 
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
    
    const redirectUri = `${origin}/api/functions/docusignCallback`;
    
    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });
    
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
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
      console.error('[docusignCallback] Token exchange failed:', tokenResponse.status, errorText);
      console.log('[docusignCallback_token_exchanged]', { success: false });
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3;url=${fallbackUrl}&message=Token%20exchange%20failed"></head><body><h3>❌ Token Exchange Failed</h3><p>Status: ${tokenResponse.status}</p><p>${errorText.substring(0, 200)}</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    const tokens = await tokenResponse.json();
    console.log('[docusignCallback_token_exchanged]', { success: true });
    
    // Get user info to discover account_id and base_uri
    const userInfoResponse = await fetch(`${authBase}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    if (!userInfoResponse.ok) {
      console.error('[docusignCallback] User info fetch failed');
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=User%20info%20failed"></head><body><h3>❌ User Info Failed</h3><p>Could not fetch account details</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    const userInfo = await userInfoResponse.json();
    const account = userInfo.accounts?.[0];
    
    if (!account) {
      console.log('[docusignCallback_userinfo_fetched]', { account_id_found: false });
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=${fallbackUrl}&message=No%20account"></head><body><h3>❌ No DocuSign Account</h3><p>No accounts found for this user</p><p>Redirecting...</p></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    
    console.log('[docusignCallback_userinfo_fetched]', {
      account_id_found: true,
      account_id: account.account_id,
      base_uri: account.base_uri
    });
    
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    // Store credentials in database
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
    
    // Mark state as used
    await base44.asServiceRole.entities.DocuSignOAuthState.delete(stateRecord.id);
    
    // Build final redirect URL
    const finalUrl = returnTo.includes('?') 
      ? `${returnTo}&docusign=connected`
      : `${returnTo}?docusign=connected`;
    
    console.log('[docusignCallback_redirecting]', {
      return_to: finalUrl,
      account_id: account.account_id
    });
    
    // Redirect back to app with success indicator
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${finalUrl}">
  <script>window.location.href="${finalUrl}";</script>
</head>
<body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
  <h2 style="color: #059669;">✅ DocuSign Connected!</h2>
  <p>Account: <strong>${account.account_id}</strong></p>
  <p>Environment: <strong>${env}</strong></p>
  <p style="color: #6b7280; margin-top: 20px;">Redirecting to admin panel...</p>
</body>
</html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('[docusignCallback] Unexpected error:', error);
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3;url=${fallbackUrl}&message=${encodeURIComponent(error.message)}"></head><body><h3>❌ Unexpected Error</h3><p>${error.message}</p><p>Redirecting...</p></body></html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
});