import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Returns Persona configuration from environment secrets
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateId = (Deno.env.get('PERSONA_TEMPLATE_ID') || '').trim();
    const rawEnv = (Deno.env.get('PERSONA_ENV_ID') || '').trim();
    const environmentId = /prod/i.test(rawEnv) ? 'production' : 'sandbox';

    if (!templateId || !environmentId) {
      return Response.json({ 
        error: 'Persona not configured' 
      }, { status: 500 });
    }

    return Response.json({ 
      templateId,
      environmentId
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});