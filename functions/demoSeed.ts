import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0 || profiles[0].role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Demo agents data
    const demoAgents = [
      {
        email: 'agent1@demo.com',
        full_name: 'Sarah Martinez',
        user_type: 'agent',
        company: 'Elite Phoenix Realty',
        markets: ['Phoenix', 'Scottsdale'],
        vetted: true,
        reputationScore: 95,
        bio: 'Specializing in luxury STR investments in Phoenix metro. 15+ years experience helping investors build profitable portfolios.',
        headshotUrl: 'https://i.pravatar.cc/300?img=1',
        licenseNumber: 'AZ-12345',
        licenseState: 'Arizona'
      },
      {
        email: 'agent2@demo.com',
        full_name: 'Marcus Chen',
        user_type: 'agent',
        company: 'Dallas Investment Group',
        markets: ['Dallas', 'Austin'],
        vetted: true,
        reputationScore: 88,
        bio: 'Expert in Texas multifamily and cash-flowing STRs. Investor-focused with deep market knowledge.',
        headshotUrl: 'https://i.pravatar.cc/300?img=2',
        licenseNumber: 'TX-67890',
        licenseState: 'Texas'
      },
      {
        email: 'agent3@demo.com',
        full_name: 'Jennifer Blake',
        user_type: 'agent',
        company: 'Miami Beach Properties',
        markets: ['Miami', 'Fort Lauderdale'],
        vetted: false,
        reputationScore: 72,
        bio: 'South Florida STR specialist. Helping investors maximize returns in prime beach locations.',
        headshotUrl: 'https://i.pravatar.cc/300?img=3',
        licenseNumber: 'FL-11111',
        licenseState: 'Florida'
      },
      {
        email: 'agent4@demo.com',
        full_name: 'David Thompson',
        user_type: 'agent',
        company: 'Nashville STR Experts',
        markets: ['Nashville', 'Gatlinburg'],
        vetted: true,
        reputationScore: 91,
        bio: 'Tennessee market expert specializing in music city and Smoky Mountain vacation rentals.',
        headshotUrl: 'https://i.pravatar.cc/300?img=4',
        licenseNumber: 'TN-22222',
        licenseState: 'Tennessee'
      },
      {
        email: 'agent5@demo.com',
        full_name: 'Rachel Kim',
        user_type: 'agent',
        company: 'Vegas Investment Realty',
        markets: ['Las Vegas', 'Henderson'],
        vetted: true,
        reputationScore: 86,
        bio: 'Las Vegas STR specialist with proven track record helping investors achieve 20%+ returns.',
        headshotUrl: 'https://i.pravatar.cc/300?img=5',
        licenseNumber: 'NV-33333',
        licenseState: 'Nevada'
      },
      {
        email: 'agent6@demo.com',
        full_name: 'Chris Anderson',
        user_type: 'agent',
        company: 'Orlando Vacation Homes',
        markets: ['Orlando', 'Kissimmee'],
        vetted: false,
        reputationScore: 68,
        bio: 'Orlando area specialist focusing on Disney-area vacation rental investments.',
        headshotUrl: 'https://i.pravatar.cc/300?img=6',
        licenseNumber: 'FL-44444',
        licenseState: 'Florida'
      },
      {
        email: 'agent7@demo.com',
        full_name: 'Amanda Rodriguez',
        user_type: 'agent',
        company: 'Denver Mountain Properties',
        markets: ['Denver', 'Boulder'],
        vetted: true,
        reputationScore: 93,
        bio: 'Colorado real estate expert specializing in mountain town STR investments with year-round demand.',
        headshotUrl: 'https://i.pravatar.cc/300?img=7',
        licenseNumber: 'CO-55555',
        licenseState: 'Colorado'
      },
      {
        email: 'agent8@demo.com',
        full_name: 'Brian Walsh',
        user_type: 'agent',
        company: 'San Diego Coastal Realty',
        markets: ['San Diego', 'La Jolla'],
        vetted: true,
        reputationScore: 89,
        bio: 'Southern California beach properties specialist. Helping investors capitalize on high-demand coastal markets.',
        headshotUrl: 'https://i.pravatar.cc/300?img=8',
        licenseNumber: 'CA-66666',
        licenseState: 'California'
      }
    ];

    // Create agents
    let agentsCreated = 0;
    for (const agentData of demoAgents) {
      const existing = await base44.asServiceRole.entities.Profile.filter({ 
        email: agentData.email 
      });
      
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Profile.create(agentData);
        agentsCreated++;
      }
    }

    return Response.json({
      ok: true,
      summary: {
        agentsCreated,
        totalAgents: demoAgents.length,
        message: 'Demo data seeded successfully. Run matchMake to generate matches for investors.'
      }
    });

  } catch (error) {
    console.error('Demo seed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});