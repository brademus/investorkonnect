import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sign IOA (Internal Operating Agreement)
 * Records signature and updates IOA status
 * 
 * Payload:
 * - dealId: string
 * - action: 'investor_sign' | 'agent_sign'
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId, action } = await req.json();

    if (!dealId || !action) {
      return Response.json({ error: 'Missing dealId or action' }, { status: 400 });
    }

    // Get current user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch deal
    const deal = await base44.entities.Deal.filter({ id: dealId });
    if (!deal || deal.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    const currentDeal = deal[0];
    const now = new Date().toISOString();

    let updateData = {};
    let newStatus = currentDeal.ioa_status || 'not_started';

    // Record signature based on action
    if (action === 'investor_sign') {
      // Verify user is the investor
      if (currentDeal.investor_id !== profile.id) {
        return Response.json({ error: 'Not authorized as investor' }, { status: 403 });
      }

      updateData = {
        ioa_investor_signed_at: now,
        ioa_investor_signed_by: profile.id
      };

      // Check if agent already signed
      if (currentDeal.ioa_agent_signed_at) {
        newStatus = 'fully_signed';
      } else {
        newStatus = 'awaiting_agent';
      }
    } else if (action === 'agent_sign') {
      // Verify user is the agent
      if (currentDeal.agent_id !== profile.id) {
        return Response.json({ error: 'Not authorized as agent' }, { status: 403 });
      }

      updateData = {
        ioa_agent_signed_at: now,
        ioa_agent_signed_by: profile.id
      };

      // Check if investor already signed
      if (currentDeal.ioa_investor_signed_at) {
        newStatus = 'fully_signed';
      } else {
        newStatus = 'awaiting_investor';
      }
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    updateData.ioa_status = newStatus;

    // Update deal
    await base44.entities.Deal.update(dealId, updateData);

    // Log activity
    await base44.entities.Activity.create({
      type: 'deal_stage_changed',
      deal_id: dealId,
      actor_id: profile.id,
      actor_name: profile.full_name || profile.email,
      message: `${profile.full_name || profile.email} signed the IOA`,
      metadata: {
        action,
        ioa_status: newStatus
      }
    });

    // Check if fully signed (both signatures present)
    const isFullySigned = 
      (action === 'investor_sign' && currentDeal.ioa_agent_signed_at) ||
      (action === 'agent_sign' && currentDeal.ioa_investor_signed_at) ||
      newStatus === 'fully_signed';

    return Response.json({
      success: true,
      ioa_status: newStatus,
      is_fully_signed: isFullySigned,
      info_unlocked: isFullySigned
    });

  } catch (error) {
    console.error('IOA signing error:', error);
    return Response.json({ 
      error: error.message || 'Failed to sign IOA' 
    }, { status: 500 });
  }
});