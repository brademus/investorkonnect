import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * UPSERT AGENT ONBOARDING v2
 * 
 * Saves agent onboarding data and sets onboarding_version="v2-agent"
 * 
 * Payload:
 * - full_name (required)
 * - phone (required)
 * - license_number (optional)
 * - license_state (optional)
 * - markets (array, required)
 * - specialties (array, required)
 * - experience_years (number, required)
 * - investor_clients_count (number, required)
 * - investor_friendly (boolean, required)
 * - bio (optional)
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Upsert Agent Onboarding v2 ===');
    
    // Get authenticated user
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
    
    // Parse request body
    const payload = await req.json();
    
    console.log('📦 Payload:', payload);
    
    // Validate required fields
    if (!payload.full_name?.trim()) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Full name is required' 
      }, { status: 400 });
    }
    
    if (!payload.phone?.trim()) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Phone is required' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(payload.markets) || payload.markets.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one market is required' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(payload.specialties) || payload.specialties.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one specialty is required' 
      }, { status: 400 });
    }
    
    if (typeof payload.experience_years !== 'number' || payload.experience_years < 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Valid experience years is required' 
      }, { status: 400 });
    }
    
    if (typeof payload.investor_clients_count !== 'number' || payload.investor_clients_count < 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Valid investor clients count is required' 
      }, { status: 400 });
    }
    
    if (typeof payload.investor_friendly !== 'boolean') {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Investor friendly flag is required' 
      }, { status: 400 });
    }
    
    // Get user's profile
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
    
    // Prepare agent data
    const agentData = {
      ...(profile.agent || {}),
      license_number: payload.license_number?.trim() || null,
      license_state: payload.license_state || null,
      verification_status: payload.license_number ? 'pending' : 'unverified',
      markets: payload.markets,
      specialties: payload.specialties,
      experience_years: payload.experience_years,
      investor_clients_count: payload.investor_clients_count,
      investor_friendly: payload.investor_friendly,
      bio: payload.bio?.trim() || null
    };
    
    // Update profile with v2-agent completion
    await base44.entities.Profile.update(profile.id, {
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      markets: payload.markets, // Also store at top level for easy querying
      user_role: 'agent',
      onboarding_version: 'v2-agent',
      onboarding_completed_at: new Date().toISOString(),
      agent: agentData
    });
    
    console.log('✅ Agent onboarding v2 saved successfully');
    
    return Response.json({
      ok: true,
      message: 'Agent onboarding saved successfully'
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Upsert agent onboarding error:', error);
    return Response.json({ 
      ok: false, 
      reason: 'SERVER_ERROR',
      message: error.message 
    }, { status: 500 });
  }
});