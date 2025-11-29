/**
 * DEMO DATA FIXTURES
 * 
 * Realistic sample data for demo mode presentations
 */

export const demoAgents = [
  {
    id: 'demo-agent-1',
    full_name: 'Sarah Mitchell',
    email: 'sarah.mitchell@realty.com',
    user_role: 'agent',
    target_state: 'TX',
    markets: ['Texas', 'DFW'],
    broker: 'Premier Realty Group',
    bio: 'Investor-focused agent specializing in off-market multifamily deals in Texas markets. 8+ years helping investors build wealth through real estate.',
    vetted: true,
    reputationScore: 92,
    agent: {
      brokerage: 'Premier Realty Group',
      markets: ['TX', 'DFW'],
      license_number: 'TX-123456',
      license_state: 'TX',
      verification_status: 'verified',
      experience_years: 8,
      investor_experience_years: 6,
      investor_clients_count: 45,
      deals_closed: 127,
      rating: 4.9,
      investment_strategies: ['Buy & Hold', 'Fix & Flip', 'Multifamily'],
      specialties: ['Buy & Hold', 'Fix & Flip', 'Multifamily'],
      bio: 'Investor-focused agent specializing in off-market multifamily deals in Texas markets. 8+ years helping investors build wealth through real estate.',
      sources_off_market: true,
      personally_invests: true,
    },
    headshotUrl: null,
    verified: true,
    kyc_status: 'approved',
  },
  {
    id: 'demo-agent-2',
    full_name: 'Marcus Chen',
    email: 'marcus.chen@investors-edge.com',
    user_role: 'agent',
    target_state: 'CA',
    markets: ['California', 'Los Angeles'],
    broker: 'Investors Edge Realty',
    bio: 'Specializing in commercial and value-add opportunities for serious investors. Former investment banker turned real estate specialist.',
    vetted: true,
    reputationScore: 96,
    agent: {
      brokerage: 'Investors Edge Realty',
      markets: ['CA', 'AZ'],
      license_number: 'CA-789012',
      license_state: 'CA',
      verification_status: 'verified',
      experience_years: 12,
      investor_experience_years: 10,
      investor_clients_count: 78,
      deals_closed: 203,
      rating: 4.9,
      investment_strategies: ['Commercial', 'Value-Add', 'Syndication'],
      specialties: ['Commercial', 'Value-Add', 'Syndication'],
      bio: 'Specializing in commercial and value-add opportunities for serious investors. Former investment banker turned real estate specialist.',
      sources_off_market: true,
      personally_invests: true,
    },
    headshotUrl: null,
    verified: true,
    kyc_status: 'approved',
  },
  {
    id: 'demo-agent-3',
    full_name: 'Jennifer Rodriguez',
    email: 'jen.rodriguez@sunbelt-properties.com',
    user_role: 'agent',
    target_state: 'FL',
    markets: ['Florida', 'Miami'],
    broker: 'Sunbelt Properties',
    bio: 'Helping investors find cash-flowing single-family and small multifamily properties in the Sunbelt region.',
    vetted: true,
    reputationScore: 88,
    agent: {
      brokerage: 'Sunbelt Properties',
      markets: ['FL', 'GA', 'NC'],
      license_number: 'FL-345678',
      license_state: 'FL',
      verification_status: 'verified',
      experience_years: 6,
      investor_experience_years: 5,
      investor_clients_count: 32,
      deals_closed: 89,
      rating: 4.8,
      investment_strategies: ['Single Family', 'Turnkey', 'BRRRR'],
      specialties: ['Single Family', 'Turnkey', 'BRRRR'],
      bio: 'Helping investors find cash-flowing single-family and small multifamily properties in the Sunbelt region.',
      sources_off_market: true,
      personally_invests: true,
    },
    headshotUrl: null,
    verified: true,
    kyc_status: 'approved',
  },
  {
    id: 'demo-agent-4',
    full_name: 'David Thompson',
    email: 'david.t@midwest-investors.com',
    user_role: 'agent',
    target_state: 'OH',
    markets: ['Ohio', 'Midwest'],
    broker: 'Midwest Investors Realty',
    bio: 'Connecting investors with wholesale and distressed property opportunities in the Midwest. Expert in off-market deal sourcing.',
    vetted: true,
    reputationScore: 91,
    agent: {
      brokerage: 'Midwest Investors Realty',
      markets: ['OH', 'IN', 'MI'],
      license_number: 'OH-901234',
      license_state: 'OH',
      verification_status: 'verified',
      experience_years: 10,
      investor_experience_years: 8,
      investor_clients_count: 56,
      deals_closed: 156,
      rating: 4.7,
      investment_strategies: ['Wholesale', 'Distressed', 'Land'],
      specialties: ['Wholesale', 'Distressed', 'Land'],
      bio: 'Connecting investors with wholesale and distressed property opportunities in the Midwest. Expert in off-market deal sourcing.',
      sources_off_market: true,
      personally_invests: true,
    },
    headshotUrl: null,
    verified: true,
    kyc_status: 'approved',
  },
  {
    id: 'demo-agent-5',
    full_name: 'Amanda Foster',
    email: 'amanda@luxury-investment-group.com',
    user_role: 'agent',
    target_state: 'NY',
    markets: ['New York', 'Northeast'],
    broker: 'Luxury Investment Group',
    bio: 'High-end investment properties and development opportunities in the Northeast. Specializing in $1M+ deals.',
    vetted: true,
    reputationScore: 98,
    agent: {
      brokerage: 'Luxury Investment Group',
      markets: ['NY', 'NJ', 'CT'],
      license_number: 'NY-567890',
      license_state: 'NY',
      verification_status: 'verified',
      experience_years: 15,
      investor_experience_years: 12,
      investor_clients_count: 89,
      deals_closed: 241,
      rating: 4.9,
      investment_strategies: ['Luxury', 'Mixed-Use', 'Development'],
      specialties: ['Luxury', 'Mixed-Use', 'Development'],
      bio: 'High-end investment properties and development opportunities in the Northeast. Specializing in $1M+ deals.',
      sources_off_market: true,
      personally_invests: true,
    },
    headshotUrl: null,
    verified: true,
    kyc_status: 'approved',
  },
];

export const demoInvestors = [
  {
    id: 'demo-investor-1',
    full_name: 'Alex Carter',
    email: 'alex.carter@investors.com',
    user_role: 'investor',
    target_state: 'WI',
    markets: ['Wisconsin', 'Midwest'],
    bio: 'Focused on small multifamily buy & hold properties in the Midwest for long-term wealth building.',
    investor: {
      company_name: 'Carter Capital LLC',
      investor_type: 'Active Investor',
      deals_closed_24mo: '3-5',
      typical_deal_size: '$200K - $600K',
      capital_available_12mo: '$200K - $600K',
      primary_strategy: 'Small multifamily buy & hold',
      investment_strategies: ['Buy & Hold', 'BRRRR'],
      buy_box: {
        asset_types: ['Duplex', 'Triplex', '4-plex'],
        budget_range: '$200,000 – $600,000',
      },
    },
    metadata: {
      strategies: ['Buy & Hold', 'BRRRR'],
      property_types: ['Duplex', 'Triplex', '4-plex'],
      experience_level: 'intermediate',
      experience_years: 3,
    },
    verified: true,
    kyc_status: 'approved',
    nda_accepted: true,
  },
  {
    id: 'demo-investor-2',
    full_name: 'Priya Shah',
    email: 'priya.shah@sunbeltinvest.com',
    user_role: 'investor',
    target_state: 'GA',
    markets: ['Atlanta', 'Sunbelt'],
    bio: 'Value-add single family & townhome investor focused on the Atlanta metro and Sunbelt markets.',
    investor: {
      company_name: 'Shah Investments',
      investor_type: 'Experienced Investor',
      deals_closed_24mo: '6-10',
      typical_deal_size: '$150K - $450K',
      capital_available_12mo: '$150K - $450K',
      primary_strategy: 'Value-add single family & townhomes',
      investment_strategies: ['Fix & Flip', 'Value-Add'],
      buy_box: {
        asset_types: ['Single Family', 'Townhome'],
        budget_range: '$150,000 – $450,000',
      },
    },
    metadata: {
      strategies: ['Fix & Flip', 'Value-Add'],
      property_types: ['Single Family', 'Townhome'],
      experience_level: 'experienced',
      experience_years: 5,
    },
    verified: true,
    kyc_status: 'approved',
    nda_accepted: true,
  },
  {
    id: 'demo-investor-3',
    full_name: 'Diego Alvarez',
    email: 'diego.alvarez@phoenixre.com',
    user_role: 'investor',
    target_state: 'AZ',
    markets: ['Phoenix', 'Tucson'],
    bio: 'BRRRR and small multifamily investor in Arizona markets. Looking for value-add opportunities.',
    investor: {
      company_name: 'Alvarez RE Holdings',
      investor_type: 'Active Investor',
      deals_closed_24mo: '4-8',
      typical_deal_size: '$250K - $700K',
      capital_available_12mo: '$250K - $700K',
      primary_strategy: 'BRRRR + small multis',
      investment_strategies: ['BRRRR', 'Buy & Hold'],
      buy_box: {
        asset_types: ['Single Family', 'Small Multifamily'],
        budget_range: '$250,000 – $700,000',
      },
    },
    metadata: {
      strategies: ['BRRRR', 'Buy & Hold'],
      property_types: ['Single Family', 'Small Multifamily'],
      experience_level: 'intermediate',
      experience_years: 4,
    },
    verified: true,
    kyc_status: 'approved',
    nda_accepted: true,
  },
  {
    id: 'demo-investor-4',
    full_name: 'Robert Chen',
    email: 'robert.chen@capitalventures.com',
    user_role: 'investor',
    target_state: 'TX',
    markets: ['Texas', 'California'],
    bio: 'Experienced multifamily investor with a focus on value-add and buy & hold strategies.',
    investor: {
      company_name: 'Capital Ventures LLC',
      investor_type: 'Experienced Investor',
      deals_closed_24mo: '6-10',
      typical_deal_size: '$250K - $500K',
      capital_available_12mo: '$500K - $1M',
      primary_strategy: 'Buy & Hold',
      investment_strategies: ['Buy & Hold', 'Value-Add'],
      buy_box: {
        asset_types: ['Multifamily', 'Commercial'],
        budget_range: '$500,000 – $1,000,000',
      },
    },
    metadata: {
      strategies: ['Buy & Hold', 'Value-Add'],
      property_types: ['Multifamily', 'Commercial'],
      experience_level: 'experienced',
      experience_years: 7,
    },
    verified: true,
    kyc_status: 'approved',
    nda_accepted: true,
  },
  {
    id: 'demo-investor-5',
    full_name: 'Lisa Martinez',
    email: 'lisa.m@smartinvestments.com',
    user_role: 'investor',
    target_state: 'FL',
    markets: ['Florida', 'Georgia'],
    bio: 'Active fix & flip and BRRRR investor in the Southeast. Aggressive growth strategy.',
    investor: {
      company_name: 'Smart Investments Inc',
      investor_type: 'Active Investor',
      deals_closed_24mo: '11-20',
      typical_deal_size: '$100K - $250K',
      capital_available_12mo: '$250K - $500K',
      primary_strategy: 'Fix & Flip',
      investment_strategies: ['Fix & Flip', 'BRRRR'],
      buy_box: {
        asset_types: ['Single Family', 'Condo'],
        budget_range: '$100,000 – $250,000',
      },
    },
    metadata: {
      strategies: ['Fix & Flip', 'BRRRR'],
      property_types: ['Single Family', 'Condo'],
      experience_level: 'active',
      experience_years: 4,
    },
    verified: true,
    kyc_status: 'approved',
    nda_accepted: true,
  },
];

export const demoRooms = [
  {
    id: 'room-1',
    investorId: 'investor-demo',
    agentId: 'demo-agent-1',
    counterparty_name: 'Sarah Mitchell',
    counterparty_role: 'agent',
    counterparty_profile_id: 'demo-agent-1',
    status: 'active',
    created_date: '2024-11-20T10:30:00Z',
    ndaAcceptedInvestor: true,
    ndaAcceptedAgent: true,
  },
  {
    id: 'room-2',
    investorId: 'investor-demo',
    agentId: 'demo-agent-2',
    counterparty_name: 'Marcus Chen',
    counterparty_role: 'agent',
    counterparty_profile_id: 'demo-agent-2',
    status: 'active',
    created_date: '2024-11-18T14:15:00Z',
    ndaAcceptedInvestor: true,
    ndaAcceptedAgent: true,
  },
  {
    id: 'room-3',
    investorId: 'demo-investor-1',
    agentId: 'agent-demo',
    counterparty_name: 'Alex Carter',
    counterparty_role: 'investor',
    counterparty_profile_id: 'demo-investor-1',
    status: 'active',
    created_date: '2024-11-19T09:00:00Z',
    ndaAcceptedInvestor: true,
    ndaAcceptedAgent: true,
  },
];

export const demoMessages = {
  'room-1': [
    {
      id: 'msg-1',
      room_id: 'room-1',
      sender_profile_id: 'demo-agent-1',
      body: 'Hi! Thanks for reaching out. I specialize in multifamily deals in Texas. What are you looking for?',
      created_date: '2024-11-20T10:35:00Z',
    },
    {
      id: 'msg-2',
      room_id: 'room-1',
      sender_profile_id: 'me',
      body: 'Looking for 10-20 unit properties in Austin area, cash flowing, willing to do light value-add.',
      created_date: '2024-11-20T10:42:00Z',
    },
    {
      id: 'msg-3',
      room_id: 'room-1',
      sender_profile_id: 'demo-agent-1',
      body: "Perfect! I have a 16-unit property coming available next week. Off-market deal. Can you do a quick call tomorrow to discuss?",
      created_date: '2024-11-20T10:50:00Z',
    },
    {
      id: 'msg-4',
      room_id: 'room-1',
      sender_profile_id: 'me',
      body: "That sounds great! I'm available tomorrow afternoon. What time works for you?",
      created_date: '2024-11-20T11:05:00Z',
    },
    {
      id: 'msg-5',
      room_id: 'room-1',
      sender_profile_id: 'demo-agent-1',
      body: "Let's do 2pm CST. I'll send over a property summary beforehand. The cap rate is around 7.2% and there's potential to push rents $150/unit after light renovations.",
      created_date: '2024-11-20T11:15:00Z',
    },
  ],
  'room-2': [
    {
      id: 'msg-6',
      room_id: 'room-2',
      sender_profile_id: 'me',
      body: 'Hi Marcus, interested in commercial opportunities in Phoenix.',
      created_date: '2024-11-18T14:20:00Z',
    },
    {
      id: 'msg-7',
      room_id: 'room-2',
      sender_profile_id: 'demo-agent-2',
      body: "Great! I have several retail and office properties in Phoenix metro. What's your target price range?",
      created_date: '2024-11-18T14:35:00Z',
    },
    {
      id: 'msg-8',
      room_id: 'room-2',
      sender_profile_id: 'me',
      body: "Looking in the $500K-$1.5M range. Preferably NNN or low management properties.",
      created_date: '2024-11-18T14:50:00Z',
    },
  ],
  'room-3': [
    {
      id: 'msg-9',
      room_id: 'room-3',
      sender_profile_id: 'me',
      body: 'Hi Robert, I saw your profile and wanted to connect. I have some off-market deals in your target area.',
      created_date: '2024-11-19T09:15:00Z',
    },
    {
      id: 'msg-10',
      room_id: 'room-3',
      sender_profile_id: 'demo-investor-1',
      body: "Thanks for reaching out! I'm actively looking for multifamily in Texas. What do you have available?",
      created_date: '2024-11-19T09:30:00Z',
    },
  ],
};

export const demoMilestones = [
  {
    id: 'milestone-1',
    title: 'Earnest Money Deposit',
    amount: 5000,
    due_date: '2024-12-01',
    status: 'pending',
    description: 'Initial earnest money deposit to secure the property',
  },
  {
    id: 'milestone-2',
    title: 'Inspection Contingency Release',
    amount: 10000,
    due_date: '2024-12-10',
    status: 'pending',
    description: 'Additional deposit after inspection period',
  },
  {
    id: 'milestone-3',
    title: 'Final Closing Payment',
    amount: 235000,
    due_date: '2024-12-20',
    status: 'pending',
    description: 'Remaining balance due at closing',
  },
];

export const demoContract = `
BUYER REPRESENTATION AGREEMENT

This Buyer Representation Agreement ("Agreement") is entered into as of 
November 26, 2024, by and between:

BUYER: Demo Investor ("Buyer")
AGENT: Sarah Mitchell, Premier Realty Group ("Agent")

1. SCOPE OF REPRESENTATION
Agent agrees to represent Buyer in the search, evaluation, and acquisition 
of investment real estate properties in the following markets: Austin, TX 
and surrounding areas.

2. PROPERTY CRITERIA
- Property Type: Multifamily (10-20 units)
- Price Range: $1,000,000 - $2,500,000
- Strategy: Buy & Hold with light value-add potential
- Target Returns: 8%+ cash-on-cash return

3. AGENT DUTIES
Agent agrees to:
- Provide exclusive access to off-market deal flow
- Conduct initial property analysis and due diligence support
- Coordinate property tours and inspections
- Negotiate on behalf of Buyer
- Facilitate transaction through closing

4. COMPENSATION
Buyer agrees to compensate Agent as follows:
- Commission: 3% of purchase price, paid at closing
- If seller pays commission, no additional fee from Buyer
- Retainer: $0 (performance-based only)

5. TERM
This Agreement shall remain in effect for 12 months from the date of 
execution, unless terminated earlier by mutual written agreement.

6. EXCLUSIVITY
Buyer agrees to work exclusively with Agent for properties in the defined 
markets during the term of this Agreement.

7. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary 
information, deal flow, and financial details shared during the course of 
this relationship.

8. TERMINATION
Either party may terminate this Agreement with 30 days written notice.

SIGNATURES:

_________________________    _________________________
Demo Investor (Buyer)        Sarah Mitchell (Agent)
Date: _______________        Date: _______________
                             Premier Realty Group
                             License #: TX-123456
`;

export default {
  demoAgents,
  demoInvestors,
  demoRooms,
  demoMessages,
  demoMilestones,
  demoContract,
};