import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { updateInvestorEmbedding } from './matchingEngine.js';

// ... keep existing code (imports) ...

Deno.serve(async (req) => {
  try {
    console.log('=== Upsert Investor Onboarding ===');
    
    // ... keep existing code (auth check, payload parsing, validation) ...
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('❌ Not authenticated');
      return Response.json({ 
        ok: false, 
        reason: 'AUTH_REQUIRED',
        message: 'Please sign in to save your onboarding' 
      }, { status: 401 });
    }
    
    console.log('👤 User:', user.email);
    
    const payload = await req.json();
    console.log('📦 Payload received');
    
    // ... keep existing validation ...
    
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      console.log('❌ Profile not found');
      return Response.json({ 
        ok: false, 
        reason: 'PROFILE_NOT_FOUND',
        message: 'Profile not found' 
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    console.log('📋 Found profile:', profile.email);
    
    // ... keep existing code (build metadata sections) ...
    
    // Update profile
    await base44.entities.Profile.update(profile.id, {
      markets: [payload.primary_state],
      target_state: payload.primary_state,
      user_role: 'investor',
      onboarding_version: 'v2',
      onboarding_completed_at: new Date().toISOString(),
      metadata: {
        ...profile.metadata,
        // ... existing metadata sections ...
      },
    });
    
    console.log('✅ v2 flags set');
    
    // NEW: Generate embedding after onboarding completes
    console.log('🧠 Generating investor embedding...');
    try {
      await updateInvestorEmbedding(base44, user.id);
      console.log('✅ Investor embedding generated');
    } catch (embErr) {
      console.error('⚠️ Failed to generate embedding:', embErr);
      // Don't fail the whole onboarding if embedding fails
    }
    
    return Response.json({
      ok: true,
      message: 'Investor onboarding saved successfully'
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Upsert investor onboarding error:', error);
    return Response.json({ 
      ok: false, 
      reason: 'SERVER_ERROR',
      message: error.message 
    }, { status: 500 });
  }
});