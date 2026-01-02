import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id } = await req.json();
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get agreement
    const agreement = await base44.asServiceRole.entities.LegalAgreement.get(agreement_id);
    
    if (!agreement) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    // Verify sender is investor
    if (agreement.investor_user_id !== user.id) {
      return Response.json({ error: 'Only investor can send agreement' }, { status: 403 });
    }
    
    // Verify status is draft
    if (agreement.status !== 'draft') {
      return Response.json({ error: 'Agreement already sent' }, { status: 400 });
    }
    
    // Update status to sent
    const updatedAgreement = await base44.asServiceRole.entities.LegalAgreement.update(
      agreement_id,
      {
        status: 'sent',
        audit_log: [
          ...agreement.audit_log,
          {
            timestamp: new Date().toISOString(),
            actor: user.email,
            action: 'sent_for_signature',
            details: 'Agreement sent to agent for signature'
          }
        ]
      }
    );
    
    return Response.json({ 
      success: true, 
      agreement: updatedAgreement
    });
    
  } catch (error) {
    console.error('Send agreement error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send agreement' 
    }, { status: 500 });
  }
});