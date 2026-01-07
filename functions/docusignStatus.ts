import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /api/functions/docusignStatus
 * Check DocuSign connection status for current user
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }
    
    // Check for existing connection
    const connections = await base44.asServiceRole.entities.DocuSignConnection.filter({ 
      user_id: user.id 
    });
    
    if (connections.length === 0) {
      return Response.json({ 
        connected: false,
        message: 'No DocuSign connection found'
      });
    }
    
    const connection = connections[0];
    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    const isExpired = expiresAt < now;
    
    return Response.json({
      connected: true,
      account_id: connection.account_id,
      base_uri: connection.base_uri,
      env: connection.env,
      expires_at: connection.expires_at,
      is_expired: isExpired,
      user_email: connection.user_email
    });
  } catch (error) {
    console.error('[docusignStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});