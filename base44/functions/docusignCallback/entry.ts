import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
const DOCUSIGN_CLIENT_SECRET = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
const DOCUSIGN_ENV = Deno.env.get('DOCUSIGN_ENV') || 'demo';
const DOCUSIGN_REDIRECT_URI = Deno.env.get('DOCUSIGN_REDIRECT_URI');

/**
 * This function handles TWO flows:
 * 1. GET — Browser redirect from DocuSign OAuth with ?code=... (the DOCUSIGN_REDIRECT_URI points here)
 *    Returns an HTML page that redirects the browser to /Admin?docusign=connected
 * 2. POST — Called from frontend to exchange the code (alternative flow)
 */
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const publicUrl = (Deno.env.get('PUBLIC_APP_URL') || 'https://investorkonnect.com').replace(/\/+$/, '');

  // ── GET: Browser redirect from DocuSign OAuth ──
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code) {
      const msg = error || 'No authorization code received';
      return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=error&message=${encodeURIComponent(msg)}";</script></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Parse returnTo and code_verifier from state
    let returnTo = '/Admin';
    let codeVerifier = null;
    if (stateParam) {
      try {
        const parsed = JSON.parse(atob(stateParam));
        if (parsed.returnTo) returnTo = parsed.returnTo;
        if (parsed.cv) codeVerifier = parsed.cv;
      } catch (_) {}
    }

    try {
      const authHost = DOCUSIGN_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
      const redirectUri = DOCUSIGN_REDIRECT_URI || `${publicUrl}/DocuSignCallback`;

      // Exchange authorization code for tokens (with PKCE code_verifier)
      const tokenParams = {
        grant_type: 'authorization_code',
        code,
        client_id: DOCUSIGN_INTEGRATION_KEY,
        client_secret: DOCUSIGN_CLIENT_SECRET,
        redirect_uri: redirectUri,
      };
      if (codeVerifier) {
        tokenParams.code_verifier = codeVerifier;
      }

      const tokenResp = await fetch(`https://${authHost}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        console.error('[docusignCallback] Token exchange failed:', errText);
        return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=error&message=${encodeURIComponent('Token exchange failed')}";</script></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const tokens = await tokenResp.json();
      console.log('[docusignCallback] Token exchange successful');

      // Get user info to find account ID and base URI
      const userInfoResp = await fetch(`https://${authHost}/oauth/userinfo`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResp.ok) {
        return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=error&message=${encodeURIComponent('Failed to get user info')}";</script></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const userInfo = await userInfoResp.json();
      const accounts = userInfo.accounts || [];

      if (!accounts.length) {
        return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=error&message=${encodeURIComponent('No DocuSign account found')}";</script></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // If multiple accounts — redirect to admin with account picker instead of auto-selecting
      if (accounts.length > 1) {
        const accountsParam = encodeURIComponent(JSON.stringify(accounts.map(a => ({
          account_id: a.account_id,
          account_name: a.account_name,
          base_uri: a.base_uri,
          is_default: a.is_default,
        }))));
        const accessTokenParam = encodeURIComponent(tokens.access_token);
        const refreshTokenParam = encodeURIComponent(tokens.refresh_token || '');
        const expiresParam = encodeURIComponent(new Date(Date.now() + tokens.expires_in * 1000).toISOString());
        return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=select_account&accounts=${accountsParam}&access_token=${accessTokenParam}&refresh_token=${refreshTokenParam}&expires_at=${expiresParam}";</script></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Single account — proceed as before
      const account = accounts[0];
      console.log(`[docusignCallback] Single account found: ${account.account_id}, base_uri: ${account.base_uri}`);

      // Use service role to manage connections (GET requests don't have user auth token)
      const base44 = createClientFromRequest(req);

      // Delete any existing connections
      const existing = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 10);
      for (const conn of existing) {
        await base44.asServiceRole.entities.DocuSignConnection.delete(conn.id).catch(() => {});
      }

      // Create new connection
      await base44.asServiceRole.entities.DocuSignConnection.create({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        account_id: account.account_id,
        base_uri: account.base_uri,
        connected_by: 'admin',
      });

      console.log('[docusignCallback] Connection saved successfully');

      // Build redirect URL
      const redirectUrl = new URL(returnTo, publicUrl);
      redirectUrl.searchParams.set('docusign', 'connected');

      return new Response(`<html><body><script>window.location.href="${redirectUrl.toString()}";</script></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (err) {
      console.error('[docusignCallback] Error:', err);
      return new Response(`<html><body><script>window.location.href="${publicUrl}/Admin?docusign=error&message=${encodeURIComponent(err.message)}";</script></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  // ── POST: Called from frontend after DocuSign redirect ──
  // No user auth required — the DocuSign authorization code is the proof.
  // User may not be authenticated because DocuSign redirect loses session.
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { code, code_verifier } = body;

    if (!code) {
      return Response.json({ error: 'Authorization code required' }, { status: 400 });
    }

    const authHost = DOCUSIGN_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
    const redirectUri = DOCUSIGN_REDIRECT_URI || `${publicUrl}/DocuSignCallback`;

    const tokenParams = {
      grant_type: 'authorization_code',
      code,
      client_id: DOCUSIGN_INTEGRATION_KEY,
      client_secret: DOCUSIGN_CLIENT_SECRET,
      redirect_uri: redirectUri,
    };
    if (code_verifier) {
      tokenParams.code_verifier = code_verifier;
    }

    const tokenResp = await fetch(`https://${authHost}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error('[docusignCallback] POST Token exchange failed:', tokenResp.status, errText);
      console.error('[docusignCallback] Token params (sans secret):', { grant_type: tokenParams.grant_type, redirect_uri: tokenParams.redirect_uri, has_code: !!tokenParams.code, has_verifier: !!tokenParams.code_verifier });
      return Response.json({ error: 'Token exchange failed: ' + errText }, { status: 400 });
    }

    const tokens = await tokenResp.json();
    const userInfoResp = await fetch(`https://${authHost}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResp.ok) {
      return Response.json({ error: 'Failed to get DocuSign user info' }, { status: 500 });
    }

    const userInfo = await userInfoResp.json();
    const accounts = userInfo.accounts || [];
    if (!accounts.length) {
      return Response.json({ error: 'No DocuSign account found' }, { status: 400 });
    }

    // If multiple accounts, return them all so the caller can pick
    if (accounts.length > 1) {
      return Response.json({
        select_account: true,
        accounts: accounts.map(a => ({
          account_id: a.account_id,
          account_name: a.account_name,
          base_uri: a.base_uri,
          is_default: a.is_default,
        })),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      });
    }

    const account = accounts[0];

    const existing = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 10);
    for (const conn of existing) {
      await base44.asServiceRole.entities.DocuSignConnection.delete(conn.id).catch(() => {});
    }

    await base44.asServiceRole.entities.DocuSignConnection.create({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      account_id: account.account_id,
      base_uri: account.base_uri,
      connected_by: 'admin',
    });

    return Response.json({ success: true, account_id: account.account_id });
  } catch (error) {
    console.error('[docusignCallback] POST Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});