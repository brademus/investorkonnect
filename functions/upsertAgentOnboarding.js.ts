import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * UPSERT AGENT ONBOARDING v2 - EXTENDED
 * 
 * Saves comprehensive agent onboarding data and sets onboarding_version="agent-v2-deep"
 * Handles all new fields for deep agent qualification
 * 
 * VERSION: "agent-v2-deep" is the ONLY version that indicates new onboarding completion
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Upsert Agent Onboarding v2 (Extended) ===');
    
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
    
    console.log('📦 Payload received with', Object.keys(payload).length, 'fields');
    
    // Validate required fields (Step 1)
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
    
    // Validate Step 1 fields
    if (payload.is_full_time_agent === null || payload.is_full_time_agent === undefined) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Full-time status is required' 
      }, { status: 400 });
    }
    
    if (!payload.experience_years && payload.experience_years !== 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Years of experience is required' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(payload.languages_spoken) || payload.languages_spoken.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one language is required' 
      }, { status: 400 });
    }
    
    // Validate Step 3 fields
    if (!Array.isArray(payload.markets) || payload.markets.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one market is required' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(payload.deal_sourcing_methods) || payload.deal_sourcing_methods.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one deal sourcing method is required' 
      }, { status: 400 });
    }
    
    // Validate Step 4 fields
    if (!Array.isArray(payload.specialties) || payload.specialties.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one specialty is required' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(payload.investment_strategies) || payload.investment_strategies.length === 0) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'At least one investment strategy is required' 
      }, { status: 400 });
    }
    
    // Validate Step 5 core fields
    if (payload.investor_friendly === null || payload.investor_friendly === undefined) {
      return Response.json({ 
        ok: false, 
        reason: 'VALIDATION_ERROR',
        message: 'Investor friendly status is required' 
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
    
    // Parse numeric fields
    const parseNum = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const n = parseInt(val);
      return isNaN(n) ? null : n;
    };
    
    // Prepare comprehensive agent data
    const agentData = {
      ...(profile.agent || {}),
      
      // License & jurisdiction
      license_number: payload.license_number?.trim() || null,
      license_state: payload.license_state || null,
      license_type: payload.license_type || null,
      licensed_states: Array.isArray(payload.licensed_states) ? payload.licensed_states : [],
      state_experience_years: payload.state_experience_years || {},
      verification_status: payload.license_number ? 'pending' : 'unverified',
      has_discipline_history: payload.has_discipline_history ?? null,
      
      // Core experience
      markets: payload.markets,
      specialties: payload.specialties,
      experience_years: parseNum(payload.experience_years),
      investor_experience_years: parseNum(payload.investor_experience_years),
      investor_clients_count: parseNum(payload.investor_clients_count),
      investor_friendly: payload.investor_friendly,
      
      // Work style & communication
      is_full_time_agent: payload.is_full_time_agent,
      languages_spoken: Array.isArray(payload.languages_spoken) ? payload.languages_spoken : [],
      preferred_communication_channels: Array.isArray(payload.preferred_communication_channels) ? payload.preferred_communication_channels : [],
      works_in_team: payload.works_in_team ?? null,
      team_role_notes: payload.team_role_notes?.trim() || null,
      
      // Track record
      active_client_count: parseNum(payload.active_client_count),
      investment_deals_last_12m: parseNum(payload.investment_deals_last_12m),
      client_focus: payload.client_focus || null,
      investor_client_percent_bucket: payload.investor_client_percent_bucket || null,
      personally_invests: payload.personally_invests ?? null,
      personal_investing_notes: payload.personal_investing_notes?.trim() || null,
      
      // Strategy & approach
      investment_strategies: Array.isArray(payload.investment_strategies) ? payload.investment_strategies : [],
      typical_deal_price_range: payload.typical_deal_price_range || null,
      investor_types_served: Array.isArray(payload.investor_types_served) ? payload.investor_types_served : [],
      metrics_used: Array.isArray(payload.metrics_used) ? payload.metrics_used : [],
      risk_approach_score: parseNum(payload.risk_approach_score),
      what_sets_you_apart: payload.what_sets_you_apart?.trim() || null,
      
      // Market knowledge & sourcing
      primary_neighborhoods_notes: payload.primary_neighborhoods_notes?.trim() || null,
      sources_off_market: payload.sources_off_market ?? null,
      off_market_methods_notes: payload.off_market_methods_notes?.trim() || null,
      deal_sourcing_methods: Array.isArray(payload.deal_sourcing_methods) ? payload.deal_sourcing_methods : [],
      marketing_methods: Array.isArray(payload.marketing_methods) ? payload.marketing_methods : [],
      
      // Network & resources
      pro_network_types: Array.isArray(payload.pro_network_types) ? payload.pro_network_types : [],
      can_refer_professionals: payload.can_refer_professionals ?? null,
      refer_professionals_notes: payload.refer_professionals_notes?.trim() || null,
      can_provide_investor_references: payload.can_provide_investor_references ?? null,
      case_study_best_deal: payload.case_study_best_deal?.trim() || null,
      
      // Service model
      update_frequency: payload.update_frequency || null,
      typical_response_time: payload.typical_response_time || null,
      
      // Professional credentials
      investor_certifications: payload.investor_certifications?.trim() || null,
      keeps_up_with_trends_notes: payload.keeps_up_with_trends_notes?.trim() || null,
      commission_structure: payload.commission_structure || null,
      
      // Fit & philosophy
      why_good_fit_notes: payload.why_good_fit_notes?.trim() || null,
      investment_philosophy_notes: payload.investment_philosophy_notes?.trim() || null,
      strengths_and_challenges_notes: payload.strengths_and_challenges_notes?.trim() || null,
      bio: payload.bio?.trim() || null
    };
    
    // CRITICAL: Update profile with NEW version flag "agent-v2-deep"
    // This is the ONLY version that indicates new onboarding completion
    await base44.entities.Profile.update(profile.id, {
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      markets: payload.markets, // Also store at top level for easy querying
      user_role: 'agent',
      onboarding_version: 'agent-v2-deep', // NEW VERSION FLAG
      onboarding_completed_at: new Date().toISOString(),
      agent: agentData
    });
    
    console.log('✅ Agent onboarding v2 (extended) saved successfully');
    console.log('📊 Saved', Object.keys(agentData).length, 'agent fields');
    console.log('🏷️  Version set to: agent-v2-deep');
    
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