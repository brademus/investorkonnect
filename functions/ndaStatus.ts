import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { ensureProfile } from './ensureProfile.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      // Not authenticated
    }

    if (!user) {
      return Response.json({
        signedIn: false
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    // USE SHARED UPSERT HELPER - Ensures profile exists
    let profile;
    try {
      profile = await ensureProfile(base44, user);
    } catch (ensureError) {
      console.error('ndaStatus: ensureProfile failed', ensureError);
      return Response.json({
        signedIn: true,
        nda: {
          accepted: false,
          acceptedAt: null,
          version: "v1.0"
        }
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    return Response.json({
      signedIn: true,
      nda: {
        accepted: !!profile.nda_accepted,
        acceptedAt: profile.nda_accepted_at || null,
        version: profile.nda_version || "v1.0"
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (error) {
    console.error('NDA status error:', error);
    return Response.json({
      signedIn: false,
      error: error.message
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
});