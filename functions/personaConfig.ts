import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Returns Persona configuration (template ID, environment ID) for the embedded SDK
 * This allows the frontend to use the embedded flow with the correct credentials
 */
Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        error: 'Unauthorized' 
      }, { status: 401, headers });
    }

    // Get Persona configuration from secrets
    const templateId = Deno.env.get('PERSONA_TEMPLATE_ID');
    const environmentId = Deno.env.get('PERSONA_ENV_ID');

    console.log('[personaConfig] Returning config:', {
      hasTemplateId: !!templateId,
      hasEnvironmentId: !!environmentId
    });

    if (!templateId || !environmentId) {
      return Response.json({ 
        error: 'Persona not configured. Please set PERSONA_TEMPLATE_ID and PERSONA_ENV_ID secrets.' 
      }, { status: 500, headers });
    }

    return Response.json({ 
      templateId,
      environmentId,
      success: true
    }, { status: 200, headers });

  } catch (error) {
    console.error('[personaConfig] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500, headers });
  }
});