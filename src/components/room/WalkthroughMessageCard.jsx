import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Renders inline in the message list for walkthrough_request messages.
 * Agents see Confirm/Deny buttons. Investors see the status.
 */
export default function WalkthroughMessageCard({ message, isAgent, isRecipient, roomId, profile, isSigned }) {
  const [responding, setResponding] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const meta = message?.metadata || {};
  const status = localStatus || meta.status || 'pending'; // pending | confirmed | denied
  const dt = meta.walkthrough_datetime;
  const wtDate = meta.walkthrough_date;
  const wtTime = meta.walkthrough_time;

  // Sync status from parent message metadata updates (real-time subscription)
  React.useEffect(() => {
    if (meta.status && meta.status !== 'pending') {
      setLocalStatus(meta.status);
    }
  }, [meta.status]);

  // Build display: prefer raw date/time strings, fall back to ISO datetime, then body extraction
  const formatted = (() => {
    if (wtDate || wtTime) {
      return [wtDate, wtTime].filter(Boolean).join(' at ') || 'No date set';
    }
    if (dt) {
      try {
        const d = new Date(dt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
          });
        }
      } catch (_) {}
    }
    // Try to extract from message body as last resort
    const bodyMatch = message?.body?.match(/Proposed Date & Time:\s*(.+)/);
    if (bodyMatch) return bodyMatch[1].trim();
    return 'No date set';
  })();

  const respond = async (action) => {
    setResponding(true);
    // Optimistically update local status
    setLocalStatus(action);
    try {
      // Update the original message metadata
      await base44.entities.Message.update(message.id, {
        metadata: { ...meta, status: action, responded_by: profile?.id, responded_at: new Date().toISOString() }
      });

      // Send a reply message
      const emoji = action === 'confirmed' ? '✅' : '❌';
      const label = action === 'confirmed' ? 'Confirmed' : 'Declined';
      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile?.id,
        body: `${emoji} Walk-through ${label}\n\n${action === 'confirmed' ? `See you on ${formatted}` : 'Please propose a different time.'}`,
        metadata: { type: 'walkthrough_response', walkthrough_datetime: dt, walkthrough_date: wtDate, walkthrough_time: wtTime, status: action }
      });

      // Update deal and DealAppointments regardless of whether dt exists
      try {
        const rooms = await base44.entities.Room.filter({ id: roomId });
        const room = rooms?.[0];
        if (room?.deal_id) {
          const newApptStatus = action === 'confirmed' ? 'SCHEDULED' : 'CANCELED';

          // Update DealAppointments status
          try {
            const apptRows = await base44.entities.DealAppointments.filter({ dealId: room.deal_id });
            if (apptRows?.[0]) {
              await base44.entities.DealAppointments.update(apptRows[0].id, {
                walkthrough: {
                  ...apptRows[0].walkthrough,
                  status: newApptStatus,
                  updatedByUserId: profile?.id,
                  updatedAt: new Date().toISOString()
                }
              });
            }
          } catch (_) { /* non-critical */ }
        }
      } catch (_) { /* non-critical */ }

      toast.success(`Walk-through ${label.toLowerCase()}`);
    } catch (e) {
      setLocalStatus(null); // revert on error
      toast.error('Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="bg-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl p-4 max-w-[85%]">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-[#E3C567]" />
        <span className="text-sm font-semibold text-[#E3C567]">Walk-through Request</span>
      </div>
      <p className="text-sm text-[#FAFAFA] mb-1">
        <span className="text-[#808080]">Proposed:</span> {formatted}
      </p>

      {status === 'pending' && isRecipient && isSigned && (
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => respond('confirmed')}
            disabled={responding}
            size="sm"
            className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs"
          >
            {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            Confirm
          </Button>
          <Button
            onClick={() => respond('denied')}
            disabled={responding}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs"
          >
            {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Decline
          </Button>
        </div>
      )}
      {status === 'pending' && isRecipient && !isSigned && (
        <div className="mt-2 text-xs text-[#F59E0B]">Sign the agreement to accept or decline</div>
      )}

      {status === 'confirmed' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#10B981]">
          <Check className="w-3 h-3" /> Confirmed
        </div>
      )}
      {status === 'denied' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <X className="w-3 h-3" /> Declined
        </div>
      )}
      {status === 'pending' && !isRecipient && (
        <div className="mt-2 text-xs text-[#F59E0B]">{isSigned ? 'Awaiting agent response' : 'Proposed — agents can respond after signing'}</div>
      )}
    </div>
  );
}