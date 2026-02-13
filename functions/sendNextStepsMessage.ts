import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEFAULT_TEMPLATE = `Next Steps for {{PROPERTY_ADDRESS}}

Hi {{AGENT_FIRST_NAME}},

Thank you for partnering with {{PARTNER_NAME}} on the property at {{PROPERTY_ADDRESS}}. I'm looking forward to working together.

Below is a clear outline of the next steps so we're aligned from the start.

Step 1: Initial Walkthrough

We are planning to schedule the walkthrough for:

{{WALKTHROUGH_DATE}} at {{WALKTHROUGH_TIME}}

Please let me know if that works for you, or feel free to suggest another time.

During the walkthrough, please:

- Take clear, detailed photos of the entire property (interior and exterior)
- Make note of any visible defects, damages, or repair items that could impact financing
- Provide your professional feedback on condition and marketability
- Prepare and send your CMA (Comparative Market Analysis)
- Include:
  - Estimated As-Is Listing Price
  - Estimated ARV (After Repair Value)

Step 2: Submission & Review

After the walkthrough, please upload the following directly to the Deal Room under the Documents tab (or send to {{INVESTOR_EMAIL}}):

- All photos
- Your written notes
- CMA report
- As-Is Listing Price
- ARV

Once reviewed, we'll confirm alignment and move forward with next steps.

Looking forward to working together.

Best,
{{INVESTOR_FULL_NAME}}
{{INVESTOR_PHONE_NUMBER}}
{{INVESTOR_EMAIL}}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Only trigger on LegalAgreement update to fully_signed
    if (event?.type !== 'update') return Response.json({ ok: true, skipped: 'not_update' });
    if (data?.status !== 'fully_signed') return Response.json({ ok: true, skipped: 'not_fully_signed' });
    if (old_data?.status === 'fully_signed') return Response.json({ ok: true, skipped: 'already_signed' });

    const dealId = data.deal_id;
    const roomId = data.room_id;
    if (!dealId) return Response.json({ ok: true, skipped: 'no_deal_id' });

    console.log('[sendNextSteps] Agreement fully signed for deal:', dealId, 'room:', roomId);

    // Find the room
    let room = null;
    if (roomId) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
      room = rooms?.[0];
    }
    if (!room) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
      room = rooms?.[0];
    }
    if (!room) return Response.json({ ok: true, skipped: 'no_room' });

    // Check duplicate guard
    if (room.onboarding_message_sent === true) {
      console.log('[sendNextSteps] Message already sent for room:', room.id);
      return Response.json({ ok: true, skipped: 'already_sent' });
    }

    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];
    if (!deal) return Response.json({ ok: true, skipped: 'no_deal' });

    // Load investor profile
    const investorId = deal.investor_id || room.investorId;
    if (!investorId) return Response.json({ ok: true, skipped: 'no_investor_id' });
    const invProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
    const investor = invProfiles?.[0];
    if (!investor) return Response.json({ ok: true, skipped: 'no_investor_profile' });

    // Load agent profile
    const agentId = room.locked_agent_id || deal.locked_agent_id || room.agent_ids?.[0] || deal.agent_id;
    let agent = null;
    if (agentId) {
      const agProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      agent = agProfiles?.[0];
    }

    // Resolve walkthrough
    let walkthroughDate = 'To Be Scheduled';
    let walkthroughTime = 'To Be Scheduled';
    if (deal.walkthrough_datetime) {
      try {
        const d = new Date(deal.walkthrough_datetime);
        if (!isNaN(d.getTime())) {
          walkthroughDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          walkthroughTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
      } catch (_) {}
    } else {
      // Check DealAppointments
      try {
        const appts = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: dealId });
        const wt = appts?.[0]?.walkthrough;
        if (wt?.datetime) {
          const d = new Date(wt.datetime);
          if (!isNaN(d.getTime())) {
            walkthroughDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            walkthroughTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          }
        }
      } catch (_) {}
    }

    // Resolve partner name
    const companyName = investor.company || investor.investor?.company_name || '';
    const partnerName = companyName.trim() ? companyName.trim() : 'me';

    // Resolve agent first name
    const agentFullName = agent?.full_name || '';
    const agentFirstName = agentFullName.split(' ')[0] || 'there';

    // Build replacements
    const replacements = {
      '{{PROPERTY_ADDRESS}}': deal.property_address || '',
      '{{AGENT_FIRST_NAME}}': agentFirstName,
      '{{PARTNER_NAME}}': partnerName,
      '{{WALKTHROUGH_DATE}}': walkthroughDate,
      '{{WALKTHROUGH_TIME}}': walkthroughTime,
      '{{INVESTOR_FULL_NAME}}': investor.full_name || '',
      '{{INVESTOR_PHONE_NUMBER}}': investor.phone || '',
      '{{INVESTOR_EMAIL}}': investor.email || '',
    };

    // Use custom template if investor has one, otherwise default
    const template = investor.next_steps_template || DEFAULT_TEMPLATE;
    let body = template;
    for (const [key, value] of Object.entries(replacements)) {
      body = body.replaceAll(key, value);
    }

    // Create the message as if sent by investor
    await base44.asServiceRole.entities.Message.create({
      room_id: room.id,
      sender_profile_id: investorId,
      body: body,
      read_by: [investorId],
    });

    // Set the guard flag
    await base44.asServiceRole.entities.Room.update(room.id, {
      onboarding_message_sent: true,
    });

    console.log('[sendNextSteps] Message sent successfully for room:', room.id);
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    console.error('[sendNextSteps] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});