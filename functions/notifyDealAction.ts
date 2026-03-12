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
        subject: `Walkthrough proposed — ${address}`,
        body: (name) => `${name}, the investor proposed walkthrough dates for ${address}. Log in to confirm or suggest a new time.\n\nhttps://investorkonnect.com`,
        sms: `Walkthrough dates proposed for ${address}. Confirm at investorkonnect.com`,
      },
      walkthrough_confirmed: {
        target: 'other',
        subject: `Walkthrough confirmed — ${address}`,
        body: (name) => `${name}, the walkthrough for ${address} has been confirmed.\n\nhttps://investorkonnect.com`,
        sms: `Walkthrough confirmed for ${address} — investorkonnect.com`,
      },
      cma_uploaded: {
        target: 'investor',
        subject: `CMA uploaded — ${address}`,
        body: (name) => `${name}, your agent uploaded the CMA for ${address}. Log in to review the estimated list price.\n\nhttps://investorkonnect.com`,
        sms: `CMA uploaded for ${address}. Review list price at investorkonnect.com`,
      },
      list_price_confirmed: {
        target: 'agent',
        subject: `List price confirmed — ${address}`,
        body: (name) => `${name}, the investor confirmed the list price for ${address}. Upload the listing agreement when ready.\n\nhttps://investorkonnect.com`,
        sms: `List price confirmed for ${address}. Upload listing agreement — investorkonnect.com`,
      },
      listing_agreement_uploaded: {
        target: 'investor',
        subject: `Listing agreement uploaded — ${address}`,
        body: (name) => `${name}, your agent uploaded the listing agreement for ${address}.\n\nhttps://investorkonnect.com`,
        sms: `Listing agreement uploaded for ${address} — investorkonnect.com`,
      },
      listing_active: {
        target: 'investor',
        subject: `Listing is live — ${address}`,
        body: (name) => `${name}, your property at ${address} is now listed on the MLS.\n\nhttps://investorkonnect.com`,
        sms: `${address} is now live on the MLS — investorkonnect.com`,
      },
      buyer_contract_uploaded: {
        target: 'investor',
        subject: `Buyer's contract received — ${address}`,
        body: (name) => `${name}, your agent uploaded a buyer's contract for ${address}. Log in to review and move to closing.\n\nhttps://investorkonnect.com`,
        sms: `Buyer's contract received for ${address}. Review at investorkonnect.com`,
      },
      moved_to_closing: {
        target: 'agent',
        subject: `Deal moved to closing — ${address}`,
        body: (name) => `${name}, the investor moved ${address} to closing.\n\nhttps://investorkonnect.com`,
        sms: `${address} moved to closing — investorkonnect.com`,
      },
      deal_completed: {
        target: 'agent',
        subject: `Deal closed — ${address}`,
        body: (name) => `${name}, the deal for ${address} has been marked as closed. Don't forget to leave a review.\n\nhttps://investorkonnect.com`,
        sms: `Deal closed for ${address}. Leave a review at investorkonnect.com`,
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
      const firstName = recipient.full_name?.split(' ')[0] || 'there';

      if (recipient.email && recipient.notification_preferences?.email !== false) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: recipient.email,
            subject: config.subject,
            body: config.body(firstName),
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