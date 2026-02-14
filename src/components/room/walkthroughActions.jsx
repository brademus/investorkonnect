import { base44 } from "@/api/base44Client";

/**
 * Shared walkthrough helpers — single source of truth for confirm/decline logic.
 * Both WalkthroughPanel and WalkthroughMessageCard call these.
 */

/** Build display string from raw date + time */
export function formatWalkthrough(wtDate, wtTime) {
  const parts = [wtDate, wtTime].filter(Boolean);
  return parts.length > 0 ? parts.join(' at ') : 'TBD';
}

/**
 * Confirm or decline a walkthrough.
 * Updates: DealAppointments status, all pending walkthrough_request messages, sends reply message.
 */
export async function respondToWalkthrough({ action, dealId, roomId, profileId, wtDate, wtTime }) {
  const isConfirm = action === 'confirm';
  const apptStatus = isConfirm ? 'SCHEDULED' : 'CANCELED';
  const msgStatus = isConfirm ? 'confirmed' : 'denied';
  const now = new Date().toISOString();
  const displayText = formatWalkthrough(wtDate, wtTime);

  // 1. Update DealAppointments
  if (dealId) {
    const apptRows = await base44.entities.DealAppointments.filter({ dealId });
    if (apptRows?.[0]) {
      await base44.entities.DealAppointments.update(apptRows[0].id, {
        walkthrough: {
          ...apptRows[0].walkthrough,
          status: apptStatus,
          updatedByUserId: profileId,
          updatedAt: now,
        },
      });
    }
  }

  // 2. Update ALL pending walkthrough_request messages in the room
  if (roomId) {
    const msgs = await base44.entities.Message.filter({ room_id: roomId });
    const pendingWt = msgs.filter(m => m.metadata?.type === 'walkthrough_request' && m.metadata?.status === 'pending');
    for (const m of pendingWt) {
      await base44.entities.Message.update(m.id, {
        metadata: { ...m.metadata, status: msgStatus, responded_by: profileId, responded_at: now },
      });
    }

    // 3. Send one reply message
    const emoji = isConfirm ? '✅' : '❌';
    const label = isConfirm ? 'Confirmed' : 'Declined';
    await base44.entities.Message.create({
      room_id: roomId,
      sender_profile_id: profileId,
      body: `${emoji} Walk-through ${label}\n\n${isConfirm ? `See you on ${displayText}` : 'Please propose a different time.'}`,
      metadata: { type: 'walkthrough_response', walkthrough_date: wtDate, walkthrough_time: wtTime, status: msgStatus },
    });
  }
}