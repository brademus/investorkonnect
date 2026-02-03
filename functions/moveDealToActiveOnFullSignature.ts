import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data } = body;
    
    // Only process update events where agreement becomes fully_signed
    if (event?.type !== 'update' || !data) {
      return Response.json({ success: true, message: 'No action needed' });
    }
    
    const agreement = data;
    const oldAgreement = body.old_data;
    
    // Check if agreement is now fully_signed (and wasn't before)
    if (agreement.status !== 'fully_signed') {
      return Response.json({ success: true, message: 'Agreement not fully signed yet' });
    }
    
    // Skip if it was already fully_signed (idempotency check)
    if (oldAgreement?.status === 'fully_signed') {
      return Response.json({ success: true, message: 'Agreement already was fully signed' });
    }
    
    // Get the associated deal
    const dealId = agreement.deal_id;
    if (!dealId) {
      return Response.json({ error: 'No deal_id found on agreement' }, { status: 400 });
    }
    
    // Fetch the deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    
    const deal = deals[0];
    
    // Only update if deal is still in draft status
    if (deal.status === 'draft') {
      await base44.asServiceRole.entities.Deal.update(dealId, {
        status: 'active',
        pipeline_stage: 'connected_deals'
      });
      
      return Response.json({ 
        success: true, 
        message: `Deal ${dealId} moved to active/connected_deals` 
      });
    }
    
    return Response.json({ 
      success: true, 
      message: 'Deal already active' 
    });
    
  } catch (error) {
    console.error('Error moving deal to active:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});