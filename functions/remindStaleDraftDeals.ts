import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    
    // Find all draft deals that are older than 7 days
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    const staleDrafts = allDeals.filter(deal => 
      deal.status === 'draft' && 
      deal.created_date < sevenDaysAgoISO
    );
    
    if (staleDrafts.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No stale draft deals found' 
      });
    }
    
    let remindersSent = 0;
    
    // Send reminder to each investor with stale drafts
    for (const deal of staleDrafts) {
      const investorId = deal.investor_id;
      if (!investorId) continue;
      
      // Get investor profile
      const profiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
      if (profiles.length === 0) continue;
      
      const investor = profiles[0];
      const dealTitle = deal.title || 'Your deal';
      const propertyAddress = deal.property_address || 'the property';
      
      // Send reminder email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: investor.email,
        subject: `Complete Your Deal - ${dealTitle}`,
        body: `
Hello ${investor.full_name || 'there'},

You have an incomplete deal that was created over a week ago:

Deal: ${dealTitle}
Property: ${propertyAddress}
Created: ${new Date(deal.created_date).toLocaleDateString()}

Complete your deal to connect with agents and move forward!

Best regards,
Investor Konnect Team
        `.trim()
      });
      
      remindersSent++;
    }
    
    return Response.json({ 
      success: true, 
      message: `Sent ${remindersSent} reminder(s) for ${staleDrafts.length} stale draft deal(s)` 
    });
    
  } catch (error) {
    console.error('Error reminding stale draft deals:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});