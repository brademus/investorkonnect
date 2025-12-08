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
            bio: `I help investors build wealth through real estate in ${state}.`
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