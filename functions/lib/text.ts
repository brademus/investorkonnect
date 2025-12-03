/**
 * Text Processing Utilities
 * 
 * Functions for normalizing and building profile text for embeddings
 * Updated to include ALL deep onboarding data and buy box for better AI matching
 */

export function normalize(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildProfileText(profile, role) {
  // Consolidate onboarding + metadata + buy box into one canonical string
  const r = role || profile?.user_role || profile?.user_type || profile?.role;
  const parts = [];
  
  parts.push(`role: ${r}`);
  
  // Location fields
  if (profile?.target_state) parts.push(`state: ${profile.target_state}`);
  if (profile?.primary_state) parts.push(`primary_state: ${profile.primary_state}`);
  if (profile?.markets) {
    const markets = Array.isArray(profile.markets) ? profile.markets.join(", ") : profile.markets;
    parts.push(`markets: ${markets}`);
  }
  
  // ========== INVESTOR BUY BOX (Critical for matching) ==========
  if (profile?.investor?.buy_box) {
    const bb = profile.investor.buy_box;
    if (bb.asset_types?.length) parts.push(`asset_types: ${bb.asset_types.join(", ")}`);
    if (bb.markets?.length) parts.push(`target_markets: ${bb.markets.join(", ")}`);
    if (bb.min_budget) parts.push(`min_budget: ${bb.min_budget}`);
    if (bb.max_budget) parts.push(`max_budget: ${bb.max_budget}`);
    if (bb.cap_rate_min) parts.push(`cap_rate_min: ${bb.cap_rate_min}`);
    if (bb.coc_min) parts.push(`coc_min: ${bb.coc_min}`);
    if (bb.deal_profile?.length) parts.push(`deal_profile: ${bb.deal_profile.join(", ")}`);
    if (bb.deal_stage) parts.push(`deal_stage: ${bb.deal_stage}`);
    if (bb.deployment_timeline) parts.push(`deployment_timeline: ${bb.deployment_timeline}`);
  }
  
  // ========== DEEP ONBOARDING METADATA (8-step onboarding) ==========
  const metadata = profile?.metadata || {};
  
  // Basic Profile section
  if (metadata.basicProfile) {
    const bp = metadata.basicProfile;
    if (bp.investor_description) parts.push(`investor_type: ${bp.investor_description}`);
    if (bp.deals_closed_24mo) parts.push(`deals_closed_24mo: ${bp.deals_closed_24mo}`);
    if (bp.typical_deal_size) parts.push(`typical_deal_size: ${bp.typical_deal_size}`);
  }
  
  // Capital & Financing section
  if (metadata.capitalFinancing) {
    const cf = metadata.capitalFinancing;
    if (cf.capital_available_12mo) parts.push(`capital_available: ${cf.capital_available_12mo}`);
    if (cf.financing_methods?.length) parts.push(`financing_methods: ${cf.financing_methods.join(", ")}`);
    if (cf.financing_lined_up) parts.push(`financing_ready: ${cf.financing_lined_up}`);
    if (cf.pof_verification_intent) parts.push(`pof_willing: ${cf.pof_verification_intent}`);
  }
  
  // Strategy & Deals section
  if (metadata.strategyDeals) {
    const sd = metadata.strategyDeals;
    if (sd.primary_strategy) parts.push(`primary_strategy: ${sd.primary_strategy}`);
    if (sd.investment_strategies?.length) parts.push(`strategies: ${sd.investment_strategies.join(", ")}`);
    if (sd.property_types?.length) parts.push(`property_types: ${sd.property_types.join(", ")}`);
    if (sd.property_condition) parts.push(`property_condition: ${sd.property_condition}`);
  }
  
  // Target Markets section
  if (metadata.targetMarkets) {
    const tm = metadata.targetMarkets;
    if (tm.primary_state) parts.push(`primary_state: ${tm.primary_state}`);
    if (tm.specific_cities_counties) parts.push(`specific_areas: ${tm.specific_cities_counties}`);
    if (tm.market_area_importance) parts.push(`market_preference: ${tm.market_area_importance}`);
    if (tm.state_price_min) parts.push(`price_min: ${tm.state_price_min}`);
    if (tm.state_price_max) parts.push(`price_max: ${tm.state_price_max}`);
  }
  
  // Deal Structure section
  if (metadata.dealStructure) {
    const ds = metadata.dealStructure;
    if (ds.deal_types_open_to?.length) parts.push(`deal_types: ${ds.deal_types_open_to.join(", ")}`);
    if (ds.preferred_deal_structure?.length) parts.push(`deal_structure: ${ds.preferred_deal_structure.join(", ")}`);
    if (ds.most_important_now) parts.push(`priority: ${ds.most_important_now}`);
    if (ds.target_hold_period) parts.push(`hold_period: ${ds.target_hold_period}`);
  }
  
  // Risk & Speed section
  if (metadata.riskSpeed) {
    const rs = metadata.riskSpeed;
    if (rs.decision_speed_on_deal) parts.push(`decision_speed: ${rs.decision_speed_on_deal}`);
    if (rs.typical_earnest_money_pct) parts.push(`earnest_money: ${rs.typical_earnest_money_pct}`);
    if (rs.comfortable_non_refundable_em) parts.push(`non_refundable_em: ${rs.comfortable_non_refundable_em}`);
  }
  
  // Agent Working section
  if (metadata.agentWorking) {
    const aw = metadata.agentWorking;
    if (aw.what_from_agent?.length) parts.push(`agent_needs: ${aw.what_from_agent.join(", ")}`);
    if (aw.communication_preferences?.length) parts.push(`comm_prefs: ${aw.communication_preferences.join(", ")}`);
    if (aw.preferred_agent_response_time) parts.push(`response_time_pref: ${aw.preferred_agent_response_time}`);
    if (aw.agent_deal_breakers) parts.push(`deal_breakers: ${aw.agent_deal_breakers}`);
  }
  
  // Experience & Accreditation section
  if (metadata.experienceAccreditation) {
    const ea = metadata.experienceAccreditation;
    if (ea.accredited_investor) parts.push(`accredited: ${ea.accredited_investor}`);
    if (ea.investment_holding_structures?.length) parts.push(`holding_structures: ${ea.investment_holding_structures.join(", ")}`);
    if (ea.anything_else_for_agent) parts.push(`additional_info: ${ea.anything_else_for_agent}`);
  }
  
  // ========== AGENT-SPECIFIC FIELDS (Deep onboarding) ==========
  if (profile?.agent) {
    const a = profile.agent;
    if (a.brokerage) parts.push(`brokerage: ${a.brokerage}`);
    if (a.license_number) parts.push(`license: ${a.license_number}`);
    if (a.license_state) parts.push(`license_state: ${a.license_state}`);
    if (a.experience_years) parts.push(`years_experience: ${a.experience_years}`);
    if (a.is_full_time_agent) parts.push(`full_time: true`);
    if (a.investor_friendly) parts.push(`investor_friendly: true`);
    if (a.personally_invests) parts.push(`personally_invests: true`);
    
    // Markets and specialties
    if (a.markets?.length) parts.push(`agent_markets: ${a.markets.join(", ")}`);
    if (a.specialties?.length) parts.push(`specialties: ${a.specialties.join(", ")}`);
    
    // Investor experience
    if (a.investor_experience_years) parts.push(`investor_exp_years: ${a.investor_experience_years}`);
    if (a.investor_clients_count) parts.push(`investor_clients: ${a.investor_clients_count}`);
    if (a.investment_deals_last_12m) parts.push(`deals_12m: ${a.investment_deals_last_12m}`);
    
    // Strategies and types
    if (a.investment_strategies?.length) parts.push(`agent_strategies: ${a.investment_strategies.join(", ")}`);
    if (a.investor_types_served?.length) parts.push(`investor_types: ${a.investor_types_served.join(", ")}`);
    if (a.typical_deal_price_range) parts.push(`price_range: ${a.typical_deal_price_range}`);
    
    // Deal sourcing
    if (a.sources_off_market) parts.push(`sources_off_market: true`);
    if (a.deal_sourcing_methods?.length) parts.push(`sourcing_methods: ${a.deal_sourcing_methods.join(", ")}`);
    
    // Network
    if (a.pro_network_types?.length) parts.push(`network: ${a.pro_network_types.join(", ")}`);
    if (a.can_refer_professionals) parts.push(`can_refer: true`);
    if (a.can_provide_investor_references) parts.push(`has_references: true`);
    
    // Communication
    if (a.preferred_communication_channels?.length) parts.push(`agent_comm: ${a.preferred_communication_channels.join(", ")}`);
    if (a.typical_response_time) parts.push(`response_time: ${a.typical_response_time}`);
    if (a.languages_spoken?.length) parts.push(`languages: ${a.languages_spoken.join(", ")}`);
    
    // Bio and differentiators
    if (a.bio) parts.push(`agent_bio: ${a.bio.substring(0, 300)}`);
    if (a.what_sets_you_apart) parts.push(`differentiator: ${a.what_sets_you_apart}`);
    if (a.case_study_best_deal) parts.push(`best_deal: ${a.case_study_best_deal.substring(0, 200)}`);
  }
  
  // ========== INVESTOR-SPECIFIC FIELDS ==========
  if (profile?.investor) {
    const i = profile.investor;
    if (i.bio) parts.push(`investor_bio: ${i.bio}`);
    if (i.company_name) parts.push(`company: ${i.company_name}`);
  }
  
  // Legacy fields
  if (profile?.goals) parts.push(`goals: ${profile.goals}`);
  if (profile?.accreditation) parts.push(`accreditation: ${profile.accreditation}`);
  
  return normalize(parts.filter(Boolean).join(" | "));
}