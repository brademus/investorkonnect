import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id, signature_type } = await req.json();
    
    if (!['investor', 'agent'].includes(signature_type)) {
      return Response.json({ error: 'Invalid signature type' }, { status: 400 });
    }
    
    // Get agreement
    const agreement = await base44.asServiceRole.entities.LegalAgreement.get(agreement_id);
    
    if (!agreement) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    // Verify signer
    if (signature_type === 'investor' && agreement.investor_user_id !== user.id) {
      return Response.json({ error: 'Not authorized to sign as investor' }, { status: 403 });
    }
    
    if (signature_type === 'agent' && agreement.agent_user_id !== user.id) {
      return Response.json({ error: 'Not authorized to sign as agent' }, { status: 403 });
    }
    
    // Get IP address
    const ip = req.headers.get('cf-connecting-ip') || 
                req.headers.get('x-forwarded-for') || 
                'unknown';
    
    const timestamp = new Date().toISOString();
    const updates: any = {
      audit_log: [
        ...agreement.audit_log,
        {
          timestamp,
          actor: user.email,
          action: `${signature_type}_signed`,
          details: `Signed by ${signature_type}`
        }
      ]
    };
    
    // Update signature fields based on type
    if (signature_type === 'investor') {
      if (agreement.investor_signed_at) {
        return Response.json({ error: 'Investor already signed' }, { status: 400 });
      }
      
      updates.investor_signed_at = timestamp;
      updates.investor_ip = ip;
      updates.status = 'investor_signed';
    } else {
      // Agent signing
      if (!agreement.investor_signed_at) {
        return Response.json({ error: 'Investor must sign first' }, { status: 400 });
      }
      
      if (agreement.agent_signed_at) {
        return Response.json({ error: 'Agent already signed' }, { status: 400 });
      }
      
      updates.agent_signed_at = timestamp;
      updates.agent_ip = ip;
      updates.status = 'agent_signed';
      
      // Check if NJ - if so, set attorney review period
      if (agreement.governing_state === 'NJ') {
        const reviewEnd = calculateNJReviewEnd(new Date());
        updates.nj_review_end_at = reviewEnd.toISOString();
        updates.status = 'attorney_review_pending';
        
        updates.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'system',
          action: 'attorney_review_started',
          details: `NJ attorney review period started. Ends at ${reviewEnd.toISOString()}`
        });
      } else {
        // Not NJ - immediately fully signed
        updates.status = 'fully_signed';
        
        updates.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'system',
          action: 'fully_signed_effective',
          details: 'Agreement is fully executed and effective'
        });
        
        updates.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'system',
          action: 'unlock_event',
          details: 'Sensitive data unlocked for agent access'
        });
      }
    }
    
    const updatedAgreement = await base44.asServiceRole.entities.LegalAgreement.update(
      agreement_id,
      updates
    );
    
    return Response.json({ 
      success: true, 
      agreement: updatedAgreement
    });
    
  } catch (error) {
    console.error('Sign agreement error:', error);
    return Response.json({ 
      error: error.message || 'Failed to sign agreement' 
    }, { status: 500 });
  }
});

function calculateNJReviewEnd(startDate: Date): Date {
  let businessDays = 0;
  let currentDate = new Date(startDate);
  
  // Day 0 is delivery day, need to add 3 business days
  while (businessDays < 3) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }
  
  // Set to 11:59 PM
  currentDate.setHours(23, 59, 59, 999);
  
  return currentDate;
}