import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * UPSERT AGENT ONBOARDING (v2-deep)
 * 
 * Saves agent onboarding data and marks onboarding as complete.
 * Returns { ok: true, nextStep: "verify" | "nda" | "dashboard" }
 */
Deno.serve(async (req) => {
  try {
    console.log('[upsertAgentOnboarding] Starting...');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('[upsertAgentOnboarding] User:', user.email);
    
    // Parse request body
    const body = await req.json();
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      return Response.json({
        ok: false,
        message: 'Profile not found',
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    console.log('[upsertAgentOnboarding] Profile found:', profile.id);
    
    // Build agent object from body
    const agentData = {
      // Step 1: Basic Info & Work Style
      full_name: body.full_name,
      is_full_time_agent: body.is_full_time_agent,
      experience_years: body.experience_years,
      investor_experience_years: body.investor_experience_years,
      languages_spoken: body.languages_spoken || [],
      preferred_communication_channels: body.preferred_communication_channels || [],
      works_in_team: body.works_in_team,
      team_role_notes: body.team_role_notes || '',
      
      // Step 2: License & Jurisdiction
      license_number: body.license_number || '',
      license_state: body.license_state || '',
      license_type: body.license_type || '',
      licensed_states: body.licensed_states || [],
      state_experience_years: body.state_experience_years || {},
      has_discipline_history: body.has_discipline_history,
      verification_status: body.license_number ? 'pending' : 'unverified',
      
      // Step 3: Markets & Sourcing
      markets: body.markets || [],
      primary_neighborhoods_notes: body.primary_neighborhoods_notes || '',
      deal_sourcing_methods: body.deal_sourcing_methods || [],
      sources_off_market: body.sources_off_market,
      off_market_methods_notes: body.off_market_methods_notes || '',
      marketing_methods: body.marketing_methods || [],
      
      // Step 4: Specialties, Strategy & Deal Profile
      specialties: body.specialties || [],
      investment_strategies: body.investment_strategies || [],
      typical_deal_price_range: body.typical_deal_price_range || '',
      investor_types_served: body.investor_types_served || [],
      metrics_used: body.metrics_used || [],
      risk_approach_score: body.risk_approach_score,
      what_sets_you_apart: body.what_sets_you_apart || '',
      
      // Step 5: Experience with Investors, Service Model, Bio & Fit
      investor_clients_count: body.investor_clients_count,
      active_client_count: body.active_client_count,
      investment_deals_last_12m: body.investment_deals_last_12m,
      client_focus: body.client_focus || '',
      investor_client_percent_bucket: body.investor_client_percent_bucket || '',
      investor_friendly: body.investor_friendly,
      personally_invests: body.personally_invests,
      personal_investing_notes: body.personal_investing_notes || '',
      update_frequency: body.update_frequency || '',
      typical_response_time: body.typical_response_time || '',
      pro_network_types: body.pro_network_types || [],
      can_refer_professionals: body.can_refer_professionals,
      refer_professionals_notes: body.refer_professionals_notes || '',
      can_provide_investor_references: body.can_provide_investor_references,
      investor_certifications: body.investor_certifications || '',
      keeps_up_with_trends_notes: body.keeps_up_with_trends_notes || '',
      commission_structure: body.commission_structure || '',
      case_study_best_deal: body.case_study_best_deal || '',
      why_good_fit_notes: body.why_good_fit_notes || '',
      investment_philosophy_notes: body.investment_philosophy_notes || '',
      strengths_and_challenges_notes: body.strengths_and_challenges_notes || '',
      bio: body.bio || '',
    };
    
    // Check if KYC is already verified (edge case: admin manually verified)
    const kycAlreadyVerified = profile.kyc_status === 'approved';
    
    // Update profile with agent data AND mark onboarding as complete
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      full_name: body.full_name,
      phone: body.phone,
      user_role: 'agent',
      agent: agentData,
      markets: body.markets || [],
      
      // CRITICAL: Mark new deep agent onboarding as complete
      onboarding_version: 'agent-v2-deep',
      onboarding_completed_at: new Date().toISOString(),
      
      // Legacy license fields for backward compatibility
      license_number: body.license_number || '',
      license_state: body.license_state || '',
    });
    
    console.log('[upsertAgentOnboarding] ✅ Profile updated with agent-v2-deep onboarding');
    
    // Determine next step
    let nextStep = 'verify'; // Default: go to Persona verification
    
    if (kycAlreadyVerified) {
      // KYC already done, check NDA
      if (profile.nda_accepted) {
        nextStep = 'dashboard';
      } else {
        nextStep = 'nda';
      }
    }
    
    console.log('[upsertAgentOnboarding] Next step:', nextStep);
    
    return Response.json({
      ok: true,
      message: 'Agent onboarding saved successfully',
      nextStep,
    });
    
  } catch (error) {
    console.error('[upsertAgentOnboarding] ❌ Error:', error);
    return Response.json({ 
      ok: false, 
      message: error.message 
    }, { status: 500 });
  }
});