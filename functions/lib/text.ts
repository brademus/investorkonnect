/**
 * Text Processing Utilities
 * 
 * Functions for normalizing and building profile text for embeddings
 */

export function normalize(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildProfileText(profile, role) {
  // Consolidate onboarding + metadata into one canonical string
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
  
  // Metadata fields (from investor/agent onboarding)
  const metadata = profile?.metadata || {};
  
  // Strategy & deals
  if (metadata.strategyDeals) {
    const sd = metadata.strategyDeals;
    if (sd.primary_strategy) parts.push(`strategy: ${sd.primary_strategy}`);
    if (sd.investment_strategies) {
      const strats = Array.isArray(sd.investment_strategies) 
        ? sd.investment_strategies.join(", ") 
        : sd.investment_strategies;
      parts.push(`strategies: ${strats}`);
    }
  }
  
  // Capital & financing
  if (metadata.capitalFinancing) {
    const cf = metadata.capitalFinancing;
    if (cf.capital_available) parts.push(`capital: ${cf.capital_available}`);
    if (cf.financing_preference) parts.push(`financing: ${cf.financing_preference}`);
  }
  
  // Basic profile
  if (metadata.basicProfile) {
    const bp = metadata.basicProfile;
    if (bp.typical_deal_size) parts.push(`deal_size: ${bp.typical_deal_size}`);
    if (bp.investor_description) parts.push(`description: ${bp.investor_description}`);
  }
  
  // Experience
  if (metadata.experienceAccreditation) {
    const ea = metadata.experienceAccreditation;
    if (ea.experience_level) parts.push(`experience: ${ea.experience_level}`);
    if (ea.accreditation_status) parts.push(`accreditation: ${ea.accreditation_status}`);
  }
  
  // Risk & speed
  if (metadata.riskSpeed) {
    const rs = metadata.riskSpeed;
    if (rs.risk_tolerance) parts.push(`risk: ${rs.risk_tolerance}`);
    if (rs.decision_timeline) parts.push(`timeline: ${rs.decision_timeline}`);
  }
  
  // Agent-specific fields
  if (profile?.agent) {
    const a = profile.agent;
    if (a.brokerage) parts.push(`brokerage: ${a.brokerage}`);
    if (a.experience_years) parts.push(`years_experience: ${a.experience_years}`);
    if (a.investor_friendly) parts.push(`investor_friendly: true`);
    if (a.specialties) {
      const specs = Array.isArray(a.specialties) ? a.specialties.join(", ") : a.specialties;
      parts.push(`specialties: ${specs}`);
    }
    if (a.investment_strategies) {
      const strats = Array.isArray(a.investment_strategies) 
        ? a.investment_strategies.join(", ") 
        : a.investment_strategies;
      parts.push(`agent_strategies: ${strats}`);
    }
  }
  
  // Investor-specific fields
  if (profile?.investor) {
    const i = profile.investor;
    if (i.bio) parts.push(`bio: ${i.bio}`);
    if (i.company_name) parts.push(`company: ${i.company_name}`);
  }
  
  // Legacy fields
  if (profile?.goals) parts.push(`goals: ${profile.goals}`);
  if (profile?.accreditation) parts.push(`accreditation: ${profile.accreditation}`);
  
  return normalize(parts.filter(Boolean).join(" | "));
}