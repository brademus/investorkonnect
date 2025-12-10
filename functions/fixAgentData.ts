import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const INVESTMENT_STRATEGIES = ["Buy & Hold", "Fix & Flip", "STR / Airbnb", "Multi-family", "BRRRR", "House Hacking", "New Construction"];
const METRICS = ["Cash on Cash Return", "Cap Rate", "IRR", "Gross Rent Multiplier", "Net Operating Income", "After Repair Value (ARV)"];
const INVESTOR_TYPES = ["First-time Investors", "Experienced Pros", "Out-of-state Investors", "Institutional Buyers", "Flippers"];
const PROPERTY_TYPES = ["Single Family", "Duplex/Triplex/Fourplex", "Small Apartment Buildings", "Condos/Townhomes"];
const OFF_MARKET_METHODS = ["Direct Mail", "Driving for Dollars", "Wholesaler Relationships", "Probate Lists", "Networking"];
const PROFESSIONAL_NETWORK = ["Contractors", "Property Managers", "Lenders", "CPAs", "Real Estate Attorneys", "Inspectors"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubset(arr, min = 1, max = 3) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * (max - min + 1)) + min);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Safety check - maybe ensure admin or explicitly allowed
    // if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch all agents
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({ user_role: 'agent' }, '-created_date', 50); // Fetch up to 50 agents to avoid timeouts
    
    // Also fetch profiles that might have agent data but incorrect role (just in case)
    // const mixedProfiles = await base44.asServiceRole.entities.Profile.filter({}); 
    // const potentialAgents = mixedProfiles.filter(p => p.agent && Object.keys(p.agent).length > 0);
    // Combine and deduplicate if needed, but filtering by user_role='agent' is primary.

    let updatedCount = 0;

    for (const profile of allProfiles) {
      // Check if this profile needs backfilling
      // We'll assume if it's missing 'investment_strategies' it needs an update
      if (profile.agent && (!profile.agent.investment_strategies || profile.agent.investment_strategies.length === 0)) {
        
        const agentUpdate = {
          ...profile.agent,
          
          // Basic Stats
          personally_invests: Math.random() > 0.3,
          personal_investing_notes: "I own a portfolio of 3 rental properties and have completed 2 flips in the last 5 years.",
          
          // Strategy & Focus
          investment_strategies: getRandomSubset(INVESTMENT_STRATEGIES, 2, 5),
          typical_deal_price_range: getRandom(["$200k - $400k", "$300k - $600k", "$150k - $350k", "$500k - $1M"]),
          investor_types_served: getRandomSubset(INVESTOR_TYPES, 2, 4),
          metrics_used: getRandomSubset(METRICS, 3, 5),
          specialties: getRandomSubset(PROPERTY_TYPES, 2, 4), // Ensure specialties are populated
          
          // Detailed Notes
          what_sets_you_apart: "I analyze every deal as if I were buying it myself. My background in construction helps me estimate rehab costs accurately during walkthroughs.",
          primary_neighborhoods_notes: `Deep expertise in ${profile.target_state || 'local'} emerging neighborhoods with high appreciation potential.`,
          investment_philosophy_notes: "Cash flow is king, but I never ignore the fundamentals of location and appreciation potential.",
          why_good_fit_notes: "I am responsive, data-driven, and understand the speed required to secure the best deals.",
          strengths_and_challenges_notes: "Strength: Detailed analysis and negotiation. Challenge: I'm very picky about what I recommend, so deal volume might be lower but quality is higher.",
          
          // Off-market
          sources_off_market: Math.random() > 0.4,
          off_market_methods_notes: "I have a dedicated team for cold calling and direct mail campaigns targeting absentee owners.",
          deal_sourcing_methods: getRandomSubset(OFF_MARKET_METHODS, 2, 4),
          marketing_methods: ["MLS", "Investor Network", "Social Media"], // Ensure populated

          // Network & References
          pro_network_types: getRandomSubset(PROFESSIONAL_NETWORK, 3, 6),
          can_refer_professionals: true,
          refer_professionals_notes: "I have a vetted list of contractors and a reliable property management company I recommend.",
          can_provide_investor_references: true,
          
          // Case Study
          case_study_best_deal: "Recently helped a client acquire a duplex for $280k. We put $40k into renovations and it appraised for $410k. It now cash flows $600/month per door.",
          
          // Working Style
          update_frequency: getRandom(["Weekly", "As needed", "Daily during transactions"]),
          typical_response_time: getRandom(["Within 1 hour", "Same day", "Within 4 hours"]),
          works_in_team: Math.random() > 0.5,
          team_role_notes: "I lead a small team of 3 agents. I handle all high-level strategy and negotiations while my team assists with showings and paperwork.",
          preferred_communication_channels: getRandomSubset(["Text", "Email", "Phone Call"], 2, 3),
          languages_spoken: ["English", Math.random() > 0.8 ? "Spanish" : null].filter(Boolean),
          
          // Verification & Risk
          investor_certifications: Math.random() > 0.7 ? "Certified Investor Agent Specialist (CIAS)" : "",
          keeps_up_with_trends_notes: "I subscribe to multiple market data services and attend monthly REIA meetings.",
          has_discipline_history: false,
          risk_approach_score: Math.floor(Math.random() * 2) + 3, // 3-5 conservative to aggressive
          
          // Ensure legacy fields are synced if missing
          license_state: profile.agent.license_state || profile.target_state || "WI",
          markets: profile.agent.markets && profile.agent.markets.length > 0 ? profile.agent.markets : [profile.target_state || "WI"]
        };

        // Update the profile
        await base44.asServiceRole.entities.Profile.update(profile.id, {
          agent: agentUpdate
        });
        
        updatedCount++;
      }
    }

    return Response.json({ 
      success: true, 
      message: `Backfilled ${updatedCount} agent profiles with deep data.`,
      totalScanned: allProfiles.length
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});