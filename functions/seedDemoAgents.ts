import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can seed profiles
    const profile = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profile[0] || profile[0].role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { count = 150 } = await req.json();

    const markets = [
      'Milwaukee, WI', 'Phoenix, AZ', 'Austin, TX', 'Dallas, TX', 'Houston, TX',
      'Miami, FL', 'Tampa, FL', 'Orlando, FL', 'Atlanta, GA', 'Charlotte, NC',
      'Nashville, TN', 'Denver, CO', 'Las Vegas, NV', 'Portland, OR', 'Seattle, WA',
      'San Diego, CA', 'Sacramento, CA', 'Riverside, CA', 'Columbus, OH', 'Indianapolis, IN',
      'Detroit, MI', 'Memphis, TN', 'Louisville, KY', 'Oklahoma City, OK', 'Tucson, AZ'
    ];

    const brokerages = [
      'RE/MAX', 'Keller Williams', 'Coldwell Banker', 'Century 21', 'Berkshire Hathaway',
      'Sotheby\'s International', 'Compass', 'eXp Realty', 'HomeSmart', 'United Real Estate'
    ];

    const specialties = [
      ['Single Family', 'Multi-Family', 'Fix & Flip'],
      ['Commercial', 'Multi-Family', 'Development'],
      ['Single Family', 'Vacation Rentals', 'STR'],
      ['Multi-Family', 'Buy & Hold', 'Cash Flow'],
      ['Land', 'Development', 'Commercial'],
      ['Single Family', 'Luxury', 'High-End'],
      ['Fix & Flip', 'Wholesale', 'Distressed']
    ];

    const firstNames = [
      'Michael', 'Sarah', 'David', 'Jennifer', 'Robert', 'Lisa', 'James', 'Jessica',
      'John', 'Emily', 'William', 'Amanda', 'Richard', 'Melissa', 'Thomas', 'Michelle',
      'Daniel', 'Kimberly', 'Matthew', 'Amy', 'Christopher', 'Nicole', 'Andrew', 'Angela',
      'Joshua', 'Stephanie', 'Brian', 'Rebecca', 'Kevin', 'Laura'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
      'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King'
    ];

    const profiles = [];

    // Ensure first 5 are Milwaukee agents
    for (let i = 0; i < 5; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const email = `demo.agent.milwaukee${i}@investorkonnect.demo`;
      const fullName = `${firstName} ${lastName}`;
      const specialty = specialties[i % specialties.length];

      profiles.push({
        user_id: `demo-agent-milwaukee-${i}-${Date.now()}`,
        email,
        full_name: fullName,
        phone: `(414) 555-${String(1000 + i).padStart(4, '0')}`,
        user_role: 'agent',
        role: 'member',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'deep_complete',
        onboarding_version: 'agent-v2-deep',
        kyc_status: 'approved',
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        target_state: 'WI',
        agent: {
          brokerage: brokerages[i % brokerages.length],
          license_number: `WI-${100000 + i}`,
          license_state: 'WI',
          license_type: 'Broker',
          licensed_states: ['WI'],
          verification_status: 'verified',
          markets: ['Milwaukee, WI', 'Wisconsin'],
          specialties: specialty,
          experience_years: 5 + (i % 10),
          investor_experience_years: 3 + (i % 8),
          investor_clients_count: 10 + (i * 5),
          investor_friendly: true,
          is_full_time_agent: true,
          active_client_count: 5 + (i % 10),
          investment_deals_last_12m: 8 + (i % 15),
          personally_invests: i % 3 === 0,
          investment_strategies: specialty,
          typical_deal_price_range: '$100K-$500K',
          investor_types_served: ['First-time', 'Experienced', 'Institutional'],
          can_provide_investor_references: true,
          bio: `Experienced Milwaukee real estate agent specializing in ${specialty.join(', ')}. Helping investors build wealth through strategic property acquisitions.`
        }
      });
    }

    // Create remaining agents across different markets
    for (let i = 5; i < count; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[(i + 10) % lastNames.length];
      const email = `demo.agent${i}@investorkonnect.demo`;
      const fullName = `${firstName} ${lastName}`;
      const market = markets[i % markets.length];
      const [city, state] = market.split(', ');
      const specialty = specialties[i % specialties.length];

      profiles.push({
        user_id: `demo-agent-${i}-${Date.now()}`,
        email,
        full_name: fullName,
        phone: `(${String(200 + (i % 800)).padStart(3, '0')}) 555-${String(1000 + i).padStart(4, '0')}`,
        user_role: 'agent',
        role: 'member',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'deep_complete',
        onboarding_version: 'agent-v2-deep',
        kyc_status: 'approved',
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        target_state: state,
        agent: {
          brokerage: brokerages[i % brokerages.length],
          license_number: `${state}-${100000 + i}`,
          license_state: state,
          license_type: i % 4 === 0 ? 'Broker' : 'Salesperson',
          licensed_states: [state],
          verification_status: 'verified',
          markets: [market, state],
          specialties: specialty,
          experience_years: 2 + (i % 15),
          investor_experience_years: 1 + (i % 10),
          investor_clients_count: 5 + (i * 3),
          investor_friendly: true,
          is_full_time_agent: i % 5 !== 0,
          active_client_count: 3 + (i % 12),
          investment_deals_last_12m: 4 + (i % 20),
          personally_invests: i % 4 === 0,
          investment_strategies: specialty,
          typical_deal_price_range: i % 3 === 0 ? '$50K-$200K' : i % 3 === 1 ? '$200K-$500K' : '$500K-$1M',
          investor_types_served: ['First-time', 'Experienced'],
          can_provide_investor_references: true,
          bio: `Dedicated ${city} real estate professional with expertise in ${specialty.join(', ')}. Committed to helping investors achieve their financial goals.`
        }
      });
    }

    // Batch create profiles
    const created = await base44.asServiceRole.entities.Profile.bulkCreate(profiles);

    return Response.json({
      success: true,
      created: created.length,
      message: `Successfully created ${created.length} demo agent profiles`
    });

  } catch (error) {
    console.error('[seedDemoAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});