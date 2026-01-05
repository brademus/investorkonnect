import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/docusign/status
 * Check if DocuSign is connected
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
    const accessToken = Deno.env.get(`DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`);
    const accountId = Deno.env.get(`DOCUSIGN_ACCOUNT_ID_${env.toUpperCase()}`);
    
    const connected = !!(integrationKey && accessToken && accountId);
    
    return Response.json({
      connected,
      env,
      accountId: connected ? accountId : null,
      redirectUri: Deno.env.get('DOCUSIGN_REDIRECT_URI')
    });
  } catch (error) {
    console.error('[DocuSign Status] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});