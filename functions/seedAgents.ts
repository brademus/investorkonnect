import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Margaret", "Anthony", "Betty", "Donald", "Sandra", "Mark", "Ashley", "Paul", "Dorothy", "Steven", "Kimberly", "Andrew", "Emily", "Kenneth", "Donna", "Joshua", "Michelle", "George", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "Edward", "Deborah"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"];
const BROKERAGES = ["Keller Williams", "Coldwell Banker", "RE/MAX", "Century 21", "Sotheby's International", "Compass", "eXp Realty", "Berkshire Hathaway", "Redfin", "Douglas Elliman"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone() {
  return `(${Math.floor(Math.random() * 800) + 200}) ${Math.floor(Math.random() * 800) + 200}-${Math.floor(Math.random() * 8999) + 1000}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin only check (optional, but good practice for seed scripts)
    // if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profilesToCreate = [];
    const reviewsToCreate = [];

    for (const state of STATES) {
      for (let i = 0; i < 3; i++) {
        const firstName = getRandom(FIRST_NAMES);
        const lastName = getRandom(LAST_NAMES);
        const fullName = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${state.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
        const userId = `fake_user_${crypto.randomUUID()}`;
        const profileId = crypto.randomUUID();

        const profile = {
          id: profileId,
          user_id: userId,
          email: email,
          full_name: fullName,
          role: "member",
          user_role: "agent",
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: "agent-v2-deep",
          onboarding_step: "deep_complete",
          company: getRandom(BROKERAGES),
          phone: generatePhone(),
          markets: [state],
          target_state: state,
          location: state,
          bio: `Experienced real estate professional serving the ${state} market. Specializing in investment properties and helping investors find great deals.`,
          status: "approved",
          vetted: true,
          reputationScore: Math.floor(Math.random() * 20) + 80, // 80-100
          nda_accepted: true,
          nda_accepted_at: new Date().toISOString(),
          nda_version: "v1.0",
          kyc_status: "approved",
          headshotUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
          
          agent: {
            brokerage: getRandom(BROKERAGES),
            license_number: `LIC-${Math.floor(Math.random() * 1000000)}`,
            license_state: state,
            licensed_states: [state],
            license_type: "Broker",
            verification_status: "verified",
            markets: [state],
            experience_years: Math.floor(Math.random() * 20) + 2,
            investor_friendly: true,
            investor_experience_years: Math.floor(Math.random() * 10) + 1,
            is_full_time_agent: true,
            active_client_count: Math.floor(Math.random() * 10),
            investment_deals_last_12m: Math.floor(Math.random() * 20),
            client_focus: "both",
            investor_client_percent_bucket: getRandom(["26-50", "51-75", "76-100"]),
            specialties: ["Fix & Flip", "Buy & Hold", "Multi-family"],
            marketing_methods: ["MLS", "Off-market", "Networking"],
            deal_sourcing_methods: ["Direct to seller", "Wholesalers"],
            commission_structure: "Standard 3%",
            bio: `I help investors build wealth through real estate in ${state}.`,

            // Deep Profile Data
            personally_invests: Math.random() > 0.3,
            personal_investing_notes: "I own a portfolio of 3 rental properties and have completed 2 flips in the last 5 years.",
            investment_strategies: ["Buy & Hold", "Fix & Flip"],
            typical_deal_price_range: getRandom(["$200k - $400k", "$300k - $600k", "$150k - $350k"]),
            investor_types_served: ["First-time Investors", "Experienced Pros"],
            metrics_used: ["Cash on Cash Return", "Cap Rate", "IRR"],
            what_sets_you_apart: "I analyze every deal as if I were buying it myself. My background in construction helps me estimate rehab costs accurately.",
            primary_neighborhoods_notes: `Deep expertise in ${state} emerging neighborhoods with high appreciation potential.`,
            investment_philosophy_notes: "Cash flow is king, but I never ignore the fundamentals of location and appreciation potential.",
            why_good_fit_notes: "I am responsive, data-driven, and understand the speed required to secure the best deals.",
            strengths_and_challenges_notes: "Strength: Detailed analysis. Challenge: I'm picky about recommendations.",
            sources_off_market: Math.random() > 0.4,
            off_market_methods_notes: "I have a dedicated team for cold calling and direct mail campaigns.",
            pro_network_types: ["Contractors", "Lenders", "Property Managers"],
            can_refer_professionals: true,
            refer_professionals_notes: "I have a vetted list of contractors and a reliable property management company.",
            can_provide_investor_references: true,
            case_study_best_deal: "Helped a client acquire a duplex for $280k, put $40k into renovations, appraised for $410k. Cash flows $600/month.",
            update_frequency: getRandom(["Weekly", "As needed"]),
            typical_response_time: "Within 4 hours",
            works_in_team: Math.random() > 0.5,
            team_role_notes: "I lead a small team handling strategy and negotiations.",
            preferred_communication_channels: ["Text", "Email"],
            languages_spoken: ["English"],
            investor_certifications: Math.random() > 0.7 ? "Certified Investor Agent Specialist (CIAS)" : "",
            keeps_up_with_trends_notes: "I subscribe to multiple market data services and attend REIA meetings.",
            has_discipline_history: false,
            risk_approach_score: Math.floor(Math.random() * 2) + 3
          }
        };

        profilesToCreate.push(profile);

        // Add 1-3 reviews for each agent
        const numReviews = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < numReviews; j++) {
          reviewsToCreate.push({
            reviewee_profile_id: profileId,
            reviewer_profile_id: "system_seeder", // Placeholder
            reviewer_name: `${getRandom(FIRST_NAMES)} ${getRandom(LAST_NAMES)}`,
            rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
            body: getRandom([
              "Great agent to work with!",
              "Very knowledgeable about the market.",
              "Helped me find a fantastic deal.",
              "Responsive and professional.",
              "Highly recommended for investors."
            ]),
            verified: true,
            market: state,
            deal_type: "Investment"
          });
        }
      }
    }

    // Bulk create profiles (batches of 50 to be safe)
    const batchSize = 50;
    for (let i = 0; i < profilesToCreate.length; i += batchSize) {
      const batch = profilesToCreate.slice(i, i + batchSize);
      await base44.asServiceRole.entities.Profile.bulkCreate(batch);
    }
    
    // Bulk create reviews
    for (let i = 0; i < reviewsToCreate.length; i += batchSize) {
      const batch = reviewsToCreate.slice(i, i + batchSize);
      await base44.asServiceRole.entities.Review.bulkCreate(batch);
    }

    return Response.json({ 
      success: true, 
      message: `Created ${profilesToCreate.length} profiles and ${reviewsToCreate.length} reviews.` 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});