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
 * Delegates to server function (asServiceRole) so both agents and investors
 * can write to DealAppointments, Deal, and Message entities.
 */
export async function respondToWalkthrough({ action, dealId, roomId, profileId, wtDate, wtTime }) {
  const res = await base44.functions.invoke('respondToWalkthrough', {
    action,
    dealId,
    roomId,
    wtDate: wtDate || null,
    wtTime: wtTime || null,
  });

  if (res?.data?.error) {
    throw new Error(res.data.error);
  }

  return res.data;
}