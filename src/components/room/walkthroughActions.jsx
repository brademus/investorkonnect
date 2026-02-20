import { base44 } from "@/api/base44Client";

/**
 * Confirm a walkthrough slot.
 * Agent picks a slot → saved on Deal.walkthrough_confirmed_slot + chat message sent.
 */
export async function confirmWalkthrough({ dealId, roomId, profileId, slot }) {
  const now = new Date().toISOString();

  // 1. Save confirmed slot on Deal
  await base44.entities.Deal.update(dealId, {
    walkthrough_confirmed_slot: slot,
  });

  // 2. Update any pending walkthrough_request messages in the room
  if (roomId) {
    const msgs = await base44.entities.Message.filter({ room_id: roomId });
    const pending = msgs.filter(m => m.metadata?.type === 'walkthrough_request' && m.metadata?.status === 'pending');
    for (const m of pending) {
      await base44.entities.Message.update(m.id, {
        metadata: { ...m.metadata, status: 'confirmed', responded_by: profileId, responded_at: now },
      });
    }

    // 3. Send confirmation message
    const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ');
    await base44.entities.Message.create({
      room_id: roomId,
      sender_profile_id: profileId,
      body: `✅ Walk-through Confirmed\n\n${slot.date}${timeLabel ? ` (${timeLabel})` : ''}`,
      metadata: { type: 'walkthrough_response', status: 'confirmed', slot },
    });
  }
}

/**
 * Format a slot for display: "05/14/2026 09:00 AM – 11:00 AM"
 */
export function formatSlot(slot) {
  if (!slot?.date) return 'TBD';
  let text = slot.date;
  const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ');
  if (timeLabel) text += ` (${timeLabel.replace(/(AM|PM)/g, ' $1').trim()})`;
  return text;
}