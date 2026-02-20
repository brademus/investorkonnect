import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * Smart conditional next-steps message sent once per room after agreement is fully signed.
 * Walkthrough section is conditionally rendered based on whether a walkthrough is scheduled.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const event = payload.event;
    const data = payload.data;
    const old_data = payload.old_data;

    if (event?.type !== "update") return Response.json({ ok: true, skipped: "not_update" });
    if (data?.status !== "fully_signed") return Response.json({ ok: true, skipped: "not_fully_signed" });
    if (old_data?.status === "fully_signed") return Response.json({ ok: true, skipped: "already_signed" });

    const dealId = data.deal_id;
    const roomId = data.room_id;
    if (!dealId) return Response.json({ ok: true, skipped: "no_deal_id" });

    console.log("[sendNextSteps] Agreement fully signed for deal:", dealId, "room:", roomId);

    // Find room
    let room = null;
    if (roomId) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
      room = rooms?.[0];
    }
    if (!room) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
      room = rooms?.[0];
    }
    if (!room) return Response.json({ ok: true, skipped: "no_room" });

    if (room.onboarding_message_sent === true) {
      console.log("[sendNextSteps] Message already sent for room:", room.id);
      return Response.json({ ok: true, skipped: "already_sent" });
    }

    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];
    if (!deal) return Response.json({ ok: true, skipped: "no_deal" });

    // Load investor profile
    const investorId = deal.investor_id || room.investorId;
    if (!investorId) return Response.json({ ok: true, skipped: "no_investor_id" });
    const invProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
    const investor = invProfiles?.[0];
    if (!investor) return Response.json({ ok: true, skipped: "no_investor_profile" });

    // Load agent profile
    const agentId = room.locked_agent_id || deal.locked_agent_id || (room.agent_ids ? room.agent_ids[0] : null) || deal.agent_id;
    let agent = null;
    if (agentId) {
      const agProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      agent = agProfiles?.[0];
    }

    // Resolve placeholders
    const propertyAddress = deal.property_address || "";
    const agentFullName = agent?.full_name || "";
    const agentFirstName = agentFullName.split(" ")[0] || "there";
    const companyName = investor.company || (investor.investor ? investor.investor.company_name : "") || "";
    const partnerName = companyName.trim() ? companyName.trim() : "me";
    const investorFullName = investor.full_name || "";
    const investorPhone = investor.phone || "";
    const investorEmail = investor.email || "";

    // Check if investor has a custom next steps template
    const customTemplate = investor.next_steps_template || null;

    // Build message body
    let body;
    if (customTemplate) {
      // Use custom template if set, always without walkthrough times
      // Just ask for availability, never include specific dates/times
      const walkthroughSection = `Please let me know your availability this week so we can schedule the walkthrough for the property.`;
      
      body = customTemplate
        .replace(/{{PROPERTY_ADDRESS}}/g, propertyAddress)
        .replace(/{{AGENT_FIRST_NAME}}/g, agentFirstName)
        .replace(/{{PARTNER_NAME}}/g, partnerName)
        .replace(/{{INVESTOR_FULL_NAME}}/g, investorFullName)
        .replace(/{{INVESTOR_PHONE_NUMBER}}/g, investorPhone)
        .replace(/{{INVESTOR_EMAIL}}/g, investorEmail)
        .replace(/{{WALKTHROUGH_SECTION}}/g, walkthroughSection);
    } else {
      // Use default template — always without walkthrough times
      const walkthroughSection = `Please let me know your availability this week so we can schedule the walkthrough for the property.`;
      
      body = `Next Steps for ${propertyAddress}

Hi ${agentFirstName},

Thank you for partnering with ${partnerName} on the property at ${propertyAddress}. I'm looking forward to working together.

Below is a clear outline of the next steps so we're aligned from the start.

Step 1: Initial Walkthrough

${walkthroughSection}

During the walkthrough, please:

- Take clear, detailed photos of the entire property (interior and exterior)
- Make note of any visible defects, damages, or repair items that could impact financing
- Provide your professional feedback on condition and marketability
- Prepare and send your CMA (Comparative Market Analysis)
- Include:
  - Estimated As-Is Listing Price
  - Estimated ARV (After Repair Value)

Step 2: Submission & Review

After the walkthrough, please upload the following directly to the Deal Room under the Documents tab (or send to ${investorEmail}):

- All photos
- Your written notes
- CMA report
- As-Is Listing Price
- ARV

Once reviewed, we'll confirm alignment and move forward with next steps.

Looking forward to working together.

Best,
${investorFullName}
${investorPhone}
${investorEmail}`;
    }

    await base44.asServiceRole.entities.Message.create({
      room_id: room.id,
      sender_profile_id: investorId,
      body: body,
      read_by: [investorId],
    });

    await base44.asServiceRole.entities.Room.update(room.id, {
      onboarding_message_sent: true,
    });

    console.log("[sendNextSteps] Message sent successfully for room:", room.id, "walkthroughScheduled:", hasFullWalkthrough);
    return Response.json({ ok: true, sent: true, walkthroughScheduled: hasFullWalkthrough });
  } catch (error) {
    console.error("[sendNextSteps] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});