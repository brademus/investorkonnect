import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only safeguard
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    const isAdmin = user?.role === 'admin' || profile?.role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Build exactly two Tampa, FL agent profiles
    const now = Date.now();
    const demoAgents = [
      {
        user_id: `demo-agent-tampa-1-${now}`,
        email: `demo.agent.tampa1@investorkonnect.demo`,
        full_name: 'Ava Turner',
        phone: '(813) 555-1201',
        user_role: 'agent',
        role: 'member',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'deep_complete',
        onboarding_version: 'agent-v2-deep',
        kyc_status: 'approved',
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        target_state: 'FL',
        markets: ['Tampa, FL', 'Florida'],
        agent: {
          brokerage: 'Keller Williams',
          license_number: `FL-${Math.floor(now % 900000) + 100000}`,
          license_state: 'FL',
          license_type: 'Salesperson',
          licensed_states: ['FL'],
          verification_status: 'verified',
          markets: ['Tampa, FL', 'Florida'],
          specialties: ['Single Family', 'Fix & Flip', 'Buy & Hold'],
          experience_years: 6,
          investor_experience_years: 4,
          investor_clients_count: 28,
          investor_friendly: true,
          is_full_time_agent: true,
          active_client_count: 9,
          investment_deals_last_12m: 12,
          personally_invests: true,
          investment_strategies: ['Fix & Flip', 'BRRRR'],
          typical_deal_price_range: '$200K-$500K',
          investor_types_served: ['First-time', 'Experienced'],
          can_provide_investor_references: true,
          bio: 'Investor-friendly Tampa agent focused on cash-flowing SFRs and light rehabs.'
        }
      },
      {
        user_id: `demo-agent-tampa-2-${now}`,
        email: `demo.agent.tampa2@investorkonnect.demo`,
        full_name: 'Noah Ramirez',
        phone: '(813) 555-1202',
        user_role: 'agent',
        role: 'member',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 'deep_complete',
        onboarding_version: 'agent-v2-deep',
        kyc_status: 'approved',
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        target_state: 'FL',
        markets: ['Tampa, FL', 'Florida'],
        agent: {
          brokerage: 'Compass',
          license_number: `FL-${Math.floor((now + 12345) % 900000) + 100000}`,
          license_state: 'FL',
          license_type: 'Broker',
          licensed_states: ['FL'],
          verification_status: 'verified',
          markets: ['Tampa, FL', 'Florida'],
          specialties: ['Multi-Family', 'Value-Add', 'Small Apartments'],
          experience_years: 9,
          investor_experience_years: 7,
          investor_clients_count: 45,
          investor_friendly: true,
          is_full_time_agent: true,
          active_client_count: 12,
          investment_deals_last_12m: 18,
          personally_invests: false,
          investment_strategies: ['Value-Add', 'Buy & Hold'],
          typical_deal_price_range: '$500K-$1M',
          investor_types_served: ['Experienced', 'Institutional'],
          can_provide_investor_references: true,
          bio: 'Tampa multifamily specialist helping investors execute value-add and buy-and-hold plays.'
        }
      }
    ];

    const created = await base44.asServiceRole.entities.Profile.bulkCreate(demoAgents);

    return Response.json({ success: true, created: created.length, ids: created.map(c => c.id) });
  } catch (error) {
    console.error('[seedTampaAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});