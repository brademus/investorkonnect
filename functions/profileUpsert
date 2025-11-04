import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { ensureProfile } from './ensureProfile.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    
    console.log('📥 ProfileUpsert request:', {
      user_id: user.id,
      email: user.email,
      complete: body.complete
    });

    // USE SHARED UPSERT HELPER - Ensures profile exists
    let profile;
    try {
      profile = await ensureProfile(base44, user);
      console.log('📋 Profile ensured:', profile.id);
    } catch (ensureError) {
      console.error('❌ ProfileUpsert: ensureProfile failed', ensureError);
      return Response.json({ 
        error: 'Failed to load profile. Please refresh and try again.' 
      }, { status: 500 });
    }

    // Build profile data
    const profileData = {
      full_name: body.full_name || user.full_name || "",
      user_type: body.role || body.user_type || profile.user_type || null,
      company: body.company || null,
      phone: body.phone || null,
      market: body.market || null,
      markets: body.markets || [],
      accreditation: body.accreditation || null,
      goals: body.goals || "",
      subscription_tier: body.plan || body.subscription_tier || profile.subscription_tier || "none",
      stripe_customer_id: body.stripeCustomerId || body.stripe_customer_id || profile.stripe_customer_id || null,
      stripe_subscription_id: body.stripeSubscriptionId || body.stripe_subscription_id || profile.stripe_subscription_id || null,
    };

    // CRITICAL: Only set onboarding_completed_at if requested AND not already set
    if (body.complete && !profile.onboarding_completed_at) {
      profileData.onboarding_completed_at = new Date().toISOString();
      console.log('✅ Setting onboarding_completed_at:', profileData.onboarding_completed_at);
    } else if (body.complete && profile.onboarding_completed_at) {
      // Already completed, NEVER reset
      console.log('ℹ️ Onboarding already completed, keeping existing timestamp');
    }

    // Update profile
    const updatedProfile = await base44.asServiceRole.entities.Profile.update(profile.id, profileData);
    console.log('✅ Profile updated:', {
      id: updatedProfile.id,
      onboarding_completed_at: updatedProfile.onboarding_completed_at
    });

    return Response.json({ 
      ok: true, 
      profile: updatedProfile 
    });

  } catch (error) {
    console.error('❌ Profile upsert error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});