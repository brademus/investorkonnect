import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lightweight diagnostics for Persona configuration
// - Does NOT require user auth (no user data accessed)
// - Verifies env vars are present and queries Persona API for the template
// - Returns a concise diagnosis payload
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const personaApiKey = (Deno.env.get('PERSONA_API_KEY') || '').trim();
    const rawTemplateId = (Deno.env.get('PERSONA_TEMPLATE_ID') || '').trim();
    const rawEnv = (Deno.env.get('PERSONA_ENV_ID') || '').trim();

    if (!personaApiKey || !rawTemplateId || !rawEnv) {
      return Response.json({
        ok: false,
        error: 'Missing Persona secrets',
        details: {
          hasApiKey: !!personaApiKey,
          hasTemplateId: !!rawTemplateId,
          hasEnv: !!rawEnv,
        },
      }, { status: 500, headers });
    }

    // Normalize environment for SDK/hosted use (sandbox | production)
    const envNorm = /prod/i.test(rawEnv) ? 'production' : 'sandbox';

    // Call Persona API to fetch inquiry template details
    const url = `https://withpersona.com/api/v1/inquiry-templates/${encodeURIComponent(rawTemplateId)}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${personaApiKey}`,
        Accept: 'application/json',
        'Persona-Version': '2023-01-05',
      },
    });

    const bodyText = await resp.text();
    let bodyJson = null;
    try { bodyJson = JSON.parse(bodyText); } catch {}

    const summary = {
      ok: resp.ok,
      status: resp.status,
      envProvided: rawEnv,
      envNormalized: envNorm,
      templateId: rawTemplateId,
      personaResponse: bodyJson || bodyText,
    };

    if (!resp.ok) {
      return Response.json({ ok: false, error: 'Persona API error', details: summary }, { status: 200, headers });
    }

    return Response.json({ ok: true, details: summary }, { status: 200, headers });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500, headers });
  }
});