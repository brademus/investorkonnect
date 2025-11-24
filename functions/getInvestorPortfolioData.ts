import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Investor Portfolio Tracking
 * Aggregates all closed deals and calculates portfolio metrics
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length || profiles[0].user_role !== 'investor') {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    // Get all deals for this investor
    const allDeals = await base44.asServiceRole.entities.Deal.filter({
      investor_id: profile.id
    });

    const closedDeals = allDeals.filter(d => d.status === 'closed');
    const activeDeals = allDeals.filter(d => d.status === 'active');

    // Calculate portfolio metrics
    // Note: These are simplified calculations. Real implementations would need
    // detailed financial data from each deal.
    
    const totalInvested = closedDeals.reduce((sum, deal) => {
      return sum + (deal.budget || 0);
    }, 0);

    // Mock portfolio performance (would come from actual deal financials)
    const portfolioValue = totalInvested * 1.15; // Assume 15% growth
    const totalReturn = portfolioValue - totalInvested;
    const returnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    // Calculate average hold period
    const holdPeriods = closedDeals
      .filter(d => d.created_date && d.updated_date)
      .map(d => {
        const created = new Date(d.created_date);
        const closed = new Date(d.updated_date);
        return (closed - created) / (1000 * 60 * 60 * 24 * 30); // Months
      });

    const avgHoldPeriod = holdPeriods.length > 0
      ? holdPeriods.reduce((a, b) => a + b, 0) / holdPeriods.length
      : 0;

    // Mock cash-on-cash return (would need actual rental income data)
    const mockCashOnCash = 12.5;

    // Mock IRR calculation (would need actual cash flows)
    const mockIRR = 18.3;

    // Group deals by property type
    const dealsByType = closedDeals.reduce((acc, deal) => {
      const type = deal.property_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Group deals by market
    const dealsByMarket = closedDeals.reduce((acc, deal) => {
      const market = deal.property_address?.split(',').pop()?.trim() || 'Unknown';
      acc[market] = (acc[market] || 0) + 1;
      return acc;
    }, {});

    return Response.json({
      ok: true,
      summary: {
        totalDeals: allDeals.length,
        closedDeals: closedDeals.length,
        activeDeals: activeDeals.length,
        totalInvested,
        portfolioValue,
        totalReturn,
        returnPercent: Math.round(returnPercent * 10) / 10,
        avgHoldPeriodMonths: Math.round(avgHoldPeriod)
      },
      performance: {
        cashOnCashReturn: mockCashOnCash,
        irr: mockIRR,
        appreciationRate: 8.2 // Mock
      },
      diversification: {
        byPropertyType: dealsByType,
        byMarket: dealsByMarket
      },
      deals: closedDeals.map(d => ({
        id: d.id,
        title: d.title,
        propertyType: d.property_type,
        address: d.property_address,
        investment: d.budget,
        status: d.status,
        closedDate: d.updated_date
      }))
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});