import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Generates a Persona hosted verification URL using secrets
 * This ensures the correct template, environment, and redirect URI are used
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

    // Get request body
    const body = await req.json();
    const { profile_id } = body;

    if (!profile_id) {
      return Response.json({ 
        error: 'Missing profile_id' 
      }, { status: 400, headers });
    }

    // Get Persona configuration from secrets
    const personaEnvId = Deno.env.get('PERSONA_ENV_ID');
    const personaTemplateId = Deno.env.get('PERSONA_TEMPLATE_ID');
    const personaRedirectUri = Deno.env.get('PERSONA_REDIRECT_URI');
    const personaHostedBase = Deno.env.get('PERSONA_HOSTED_BASE') || 'https://withpersona.com/verify';

    console.log('[personaStart] Configuration:', {
      hasEnvId: !!personaEnvId,
      hasTemplateId: !!personaTemplateId,
      hasRedirectUri: !!personaRedirectUri,
      hostedBase: personaHostedBase
    });

    // Validate required secrets
    if (!personaEnvId || !personaTemplateId || !personaRedirectUri) {
      console.error('[personaStart] Missing Persona secrets:', {
        env: !!personaEnvId,
        template: !!personaTemplateId,
        redirect: !!personaRedirectUri
      });
      
      return Response.json({ 
        error: 'Persona configuration incomplete. Please contact support.' 
      }, { status: 500, headers });
    }

    // Get profile for prefill
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profile_id });
    if (profiles.length === 0) {
      return Response.json({ 
        error: 'Profile not found' 
      }, { status: 404, headers });
    }

    const profile = profiles[0];

    // Build Persona hosted flow URL
    const url = new URL(personaHostedBase);
    url.searchParams.set('template-id', personaTemplateId);
    const envNorm = /prod/i.test(personaEnvId || '') ? 'production' : 'sandbox';
    url.searchParams.set('environment-id', envNorm);
    url.searchParams.set('reference-id', user.id);
    url.searchParams.set('redirect-uri', personaRedirectUri);
    
    // Prefill fields
    if (user.email) {
      url.searchParams.set('fields[email]', user.email);
    }
    if (profile.user_role || profile.user_type) {
      url.searchParams.set('fields[role]', profile.user_role || profile.user_type);
    }
    if (profile.full_name) {
      const nameParts = profile.full_name.split(' ');
      if (nameParts.length > 0) {
        url.searchParams.set('fields[name-first]', nameParts[0]);
      }
      if (nameParts.length > 1) {
        url.searchParams.set('fields[name-last]', nameParts.slice(1).join(' '));
      }
    }

    console.log('[personaStart] Generated URL for user:', user.email);

    return Response.json({ 
      persona_url: url.toString(),
      success: true
    }, { status: 200, headers });

  } catch (error) {
    console.error('[personaStart] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500, headers });
  }
});