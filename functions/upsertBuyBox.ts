import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UPSERT BUY BOX
 * 
 * Saves or updates an investor's buy box (deal-level property filters).
 * This is separate from onboarding data - buy box is more specific and can be refined over time.
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Upsert Buy Box ===');
    
    // Get authenticated user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('❌ Not authenticated');
      return Response.json({ 
        ok: false, 
        reason: 'AUTH_REQUIRED',
        message: 'Please sign in to save your buy box' 
      }, { status: 401 });
    }
    
    console.log('👤 User:', user.email);
    
    // Parse request body
    const body = await req.json();
    const buyBox = body.buy_box;
    
    if (!buyBox) {
      return Response.json({ 
        ok: false, 
        reason: 'MISSING_DATA',
        message: 'Missing buy_box in request' 
      }, { status: 400 });
    }
    
    console.log('📦 Buy box data:', buyBox);
    
    // Get user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      console.log('❌ Profile not found');
      return Response.json({ 
        ok: false, 
        reason: 'PROFILE_NOT_FOUND',
        message: 'Profile not found. Please complete onboarding first.' 
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    console.log('📋 Found profile:', profile.email);
    
    // Update profile with new buy_box
    const updatedInvestor = {
      ...(profile.investor || {}),
      buy_box: buyBox
    };
    
    await base44.entities.Profile.update(profile.id, {
      investor: updatedInvestor
    });
    
    console.log('✅ Buy box saved successfully');
    
    return Response.json({
      ok: true,
      buy_box: buyBox,
      message: 'Buy box saved successfully'
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Upsert buy box error:', error);
    return Response.json({ 
      ok: false, 
      reason: 'SERVER_ERROR',
      message: error.message 
    }, { status: 500 });
  }
});