import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send email + SMS notification for a deal action.
 * Called from the client after key deal events.
 * 
 * Payload: {
 *   dealId: string,
 *   roomId: string,
 *   action: 'walkthrough_proposed' | 'walkthrough_confirmed' | 'cma_uploaded' | 
 *           'list_price_confirmed' | 'listing_agreement_uploaded' | 'listing_active' |
 *           'buyer_contract_uploaded' | 'moved_to_closing' | 'deal_completed',
 *   actorProfileId: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealId, roomId, action, actorProfileId } = await req.json();
    if (!dealId || !action) return Response.json({ error: 'dealId and action required' }, { status: 400 });

    const [dealArr, roomArr] = await Promise.all([
      base44.asServiceRole.entities.Deal.filter({ id: dealId }),
      roomId ? base44.asServiceRole.entities.Room.filter({ id: roomId }) : Promise.resolve([]),
    ]);
    const deal = dealArr?.[0];
    const room = roomArr?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    const address = (deal.property_address || '').split(',')[0] || 'your deal';

    const investorId = room?.investorId || deal.investor_id;
    const agentId = room?.locked_agent_id || room?.agent_ids?.[0] || deal.locked_agent_id;

    const [investorArr, agentArr] = await Promise.all([
      investorId ? base44.asServiceRole.entities.Profile.filter({ id: investorId }) : Promise.resolve([]),
      agentId ? base44.asServiceRole.entities.Profile.filter({ id: agentId }) : Promise.resolve([]),
    ]);
    const investor = investorArr?.[0];
    const agent = agentArr?.[0];

    const ACTIONS = {
      walkthrough_proposed: {
        target: 'agent',
        subject: `Walkthrough dates proposed — ${address}`,
        body: () => `Walkthrough dates proposed for ${address}. Confirm or propose new dates.`,
        sms: `Walkthrough dates proposed for ${address}. Confirm or propose new dates.`,
      },
      walkthrough_confirmed: {
        target: 'other',
        subject: `Walkthrough confirmed — ${address}`,
        body: () => `Walkthrough confirmed for ${address}.`,
        sms: `Walkthrough confirmed for ${address}.`,
      },
      cma_uploaded: {
        target: 'investor',
        subject: `CMA uploaded — ${address}`,
        body: () => `CMA uploaded for ${address}. Confirm or edit the list price.`,
        sms: `CMA uploaded for ${address}. Confirm or edit the list price.`,
      },
      list_price_confirmed: {
        target: 'agent',
        subject: `List price confirmed — ${address}`,
        body: () => `List price confirmed for ${address}. Upload the listing agreement.`,
        sms: `List price confirmed for ${address}. Upload the listing agreement.`,
      },
      listing_agreement_uploaded: {
        target: 'investor',
        subject: `Listing agreement uploaded — ${address}`,
        body: () => `Listing agreement uploaded for ${address}. Waiting for agent to list on MLS.`,
        sms: `Listing agreement uploaded for ${address}.`,
      },
      listing_active: {
        target: 'investor',
        subject: `Listing is active — ${address}`,
        body: () => `Listing is active for ${address}. Waiting for buyer's contract.`,
        sms: `Listing is active for ${address}.`,
      },
      buyer_contract_uploaded: {
        target: 'investor',
        subject: `Buyer's contract received — ${address}`,
        body: () => `Buyer's contract received for ${address}. Move deal to closing.`,
        sms: `Buyer's contract received for ${address}. Move deal to closing.`,
      },
      moved_to_closing: {
        target: 'agent',
        subject: `Deal moved to closing — ${address}`,
        body: () => `Deal is in closing for ${address}. Waiting for investor to confirm close.`,
        sms: `Deal moved to closing for ${address}.`,
      },
      deal_completed: {
        target: 'agent',
        subject: `Deal closed — ${address}`,
        body: () => `Deal closed for ${address}. Leave a review.`,
        sms: `Deal closed for ${address}. Leave a review.`,
      },
    };

    const config = ACTIONS[action];
    if (!config) return Response.json({ error: 'Unknown action' }, { status: 400 });

    let recipients = [];
    if (config.target === 'investor' && investor) {
      recipients.push(investor);
    } else if (config.target === 'agent' && agent) {
      recipients.push(agent);
    } else if (config.target === 'other') {
      if (actorProfileId === investor?.id && agent) recipients.push(agent);
      else if (actorProfileId === agent?.id && investor) recipients.push(investor);
      else {
        if (investor) recipients.push(investor);
        if (agent) recipients.push(agent);
      }
    } else if (config.target === 'both') {
      if (investor) recipients.push(investor);
      if (agent) recipients.push(agent);
    }

    // Never notify yourself
    recipients = recipients.filter(r => r.id !== actorProfileId);

    let sent = 0;
    for (const recipient of recipients) {
      if (recipient.email && recipient.notification_preferences?.email !== false) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: recipient.email,
            subject: config.subject,
            body: config.body(),
          });
          sent++;
        } catch (e) {
          console.warn(`[notifyDealAction] Email failed for ${recipient.email}:`, e.message);
        }
      }

      if (recipient.notification_preferences?.text && recipient.phone) {
        try {
          await base44.asServiceRole.functions.invoke('sendSms', {
            to: recipient.phone,
            message: config.sms,
          });
        } catch (e) {
          console.warn(`[notifyDealAction] SMS failed for ${recipient.phone}:`, e.message);
        }
      }
    }

    return Response.json({ ok: true, sent, action, recipients: recipients.map(r => r.id) });
  } catch (error) {
    console.error('[notifyDealAction] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});