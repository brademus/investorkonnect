import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const DEFAULT_TEMPLATE = "Next Steps for {{PROPERTY_ADDRESS}}\n\nHi {{AGENT_FIRST_NAME}},\n\nThank you for partnering with {{PARTNER_NAME}} on the property at {{PROPERTY_ADDRESS}}. I'm looking forward to working together.\n\nBelow is a clear outline of the next steps so we're aligned from the start.\n\nStep 1: Initial Walkthrough\n\nWe are planning to schedule the walkthrough for:\n\n{{WALKTHROUGH_DATE}} at {{WALKTHROUGH_TIME}}\n\nPlease let me know if that works for you, or feel free to suggest another time.\n\nDuring the walkthrough, please:\n\n- Take clear, detailed photos of the entire property (interior and exterior)\n- Make note of any visible defects, damages, or repair items that could impact financing\n- Provide your professional feedback on condition and marketability\n- Prepare and send your CMA (Comparative Market Analysis)\n- Include:\n  - Estimated As-Is Listing Price\n  - Estimated ARV (After Repair Value)\n\nStep 2: Submission & Review\n\nAfter the walkthrough, please upload the following directly to the Deal Room under the Documents tab (or send to {{INVESTOR_EMAIL}}):\n\n- All photos\n- Your written notes\n- CMA report\n- As-Is Listing Price\n- ARV\n\nOnce reviewed, we'll confirm alignment and move forward with next steps.\n\nLooking forward to working together.\n\nBest,\n{{INVESTOR_FULL_NAME}}\n{{INVESTOR_PHONE_NUMBER}}\n{{INVESTOR_EMAIL}}";

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

    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];
    if (!deal) return Response.json({ ok: true, skipped: "no_deal" });

    const investorId = deal.investor_id || room.investorId;
    if (!investorId) return Response.json({ ok: true, skipped: "no_investor_id" });
    const invProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
    const investor = invProfiles?.[0];
    if (!investor) return Response.json({ ok: true, skipped: "no_investor_profile" });

    const agentId = room.locked_agent_id || deal.locked_agent_id || (room.agent_ids ? room.agent_ids[0] : null) || deal.agent_id;
    let agent = null;
    if (agentId) {
      const agProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      agent = agProfiles?.[0];
    }

    let walkthroughDate = "To Be Scheduled";
    let walkthroughTime = "To Be Scheduled";
    if (deal.walkthrough_datetime) {
      try {
        const d = new Date(deal.walkthrough_datetime);
        if (!isNaN(d.getTime())) {
          walkthroughDate = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          walkthroughTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        }
      } catch (e) { console.log("walkthrough date parse error", e); }
    } else {
      try {
        const appts = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: dealId });
        const wt = appts?.[0]?.walkthrough;
        if (wt?.datetime) {
          const d = new Date(wt.datetime);
          if (!isNaN(d.getTime())) {
            walkthroughDate = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            walkthroughTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
          }
        }
      } catch (e) { console.log("appts check error", e); }
    }

    const companyName = investor.company || (investor.investor ? investor.investor.company_name : "") || "";
    const partnerName = companyName.trim() ? companyName.trim() : "me";
    const agentFullName = agent?.full_name || "";
    const agentFirstName = agentFullName.split(" ")[0] || "there";

    const replacements = {
      "{{PROPERTY_ADDRESS}}": deal.property_address || "",
      "{{AGENT_FIRST_NAME}}": agentFirstName,
      "{{PARTNER_NAME}}": partnerName,
      "{{WALKTHROUGH_DATE}}": walkthroughDate,
      "{{WALKTHROUGH_TIME}}": walkthroughTime,
      "{{INVESTOR_FULL_NAME}}": investor.full_name || "",
      "{{INVESTOR_PHONE_NUMBER}}": investor.phone || "",
      "{{INVESTOR_EMAIL}}": investor.email || "",
    };

    const template = investor.next_steps_template || DEFAULT_TEMPLATE;
    let body = template;
    const keys = Object.keys(replacements);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      while (body.includes(k)) {
        body = body.replace(k, replacements[k]);
      }
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

    console.log("[sendNextSteps] Message sent successfully for room:", room.id);
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    console.error("[sendNextSteps] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});