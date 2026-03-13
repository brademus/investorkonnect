import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
const DOCUSIGN_CLIENT_SECRET = Deno.env.get('DOCUSIGN_CLIENT_SECRET');
const DOCUSIGN_ENV = Deno.env.get('DOCUSIGN_ENV') || 'demo';
const DOCUSIGN_REDIRECT_URI = Deno.env.get('DOCUSIGN_REDIRECT_URI');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return Response.json({ error: 'Authorization code required' }, { status: 400 });
    }

    const authHost = DOCUSIGN_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
    const redirectUri = DOCUSIGN_REDIRECT_URI || `${Deno.env.get('PUBLIC_APP_URL') || 'https://investorkonnect.com'}/DocuSignCallback`;

    // Exchange authorization code for tokens
    const tokenResp = await fetch(`https://${authHost}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: DOCUSIGN_INTEGRATION_KEY,
        client_secret: DOCUSIGN_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error('[docusignCallback] Token exchange failed:', errText);
      return Response.json({ error: 'Token exchange failed: ' + errText }, { status: 400 });
    }

    const tokens = await tokenResp.json();
    console.log('[docusignCallback] Token exchange successful');

    // Get user info to find account ID and base URI
    const userInfoResp = await fetch(`https://${authHost}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResp.ok) {
      return Response.json({ error: 'Failed to get DocuSign user info' }, { status: 500 });
    }

    const userInfo = await userInfoResp.json();
    // Use the default account
    const account = userInfo.accounts?.find(a => a.is_default) || userInfo.accounts?.[0];
    if (!account) {
      return Response.json({ error: 'No DocuSign account found' }, { status: 400 });
    }

    console.log(`[docusignCallback] Account: ${account.account_id}, base_uri: ${account.base_uri}`);

    // Delete any existing connections before creating new one
    const existing = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 10);
    for (const conn of existing) {
      await base44.asServiceRole.entities.DocuSignConnection.delete(conn.id).catch(() => {});
    }

    // Create new connection record
    const connection = await base44.asServiceRole.entities.DocuSignConnection.create({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      account_id: account.account_id,
      base_uri: account.base_uri,
      connected_by: user.id,
    });

    console.log(`[docusignCallback] Connection created: ${connection.id}`);
    return Response.json({ success: true, account_id: account.account_id });
  } catch (error) {
    console.error('[docusignCallback] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});