import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatWalkthrough, respondToWalkthrough } from "@/components/room/walkthroughActions";

/**
 * Inline walkthrough card shown in the message list.
 * Uses the same shared respond logic as WalkthroughPanel.
 */
export default function WalkthroughMessageCard({ message, isAgent, isRecipient, roomId, profile, isSigned, dealId }) {
  const [responding, setResponding] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const [resolvedWtDate, setResolvedWtDate] = useState(null);
  const [resolvedWtTime, setResolvedWtTime] = useState(null);
  const meta = message?.metadata || {};
  const status = localStatus || meta.status || 'pending';

  // Sync from real-time message updates
  useEffect(() => {
    if (meta.status && meta.status !== 'pending') setLocalStatus(meta.status);
  }, [meta.status]);

  // Resolve dealId: prefer prop, then look up from room
  const [resolvedDealId, setResolvedDealId] = useState(dealId || null);
  useEffect(() => {
    if (dealId) { setResolvedDealId(dealId); return; }
    if (!roomId) return;
    base44.entities.Room.filter({ id: roomId }).then(rows => {
      if (rows?.[0]?.deal_id) setResolvedDealId(rows[0].deal_id);
    }).catch(() => {});
  }, [dealId, roomId]);

  // Get walkthrough date/time from metadata first, fallback to deal entity
  const wtDate = meta.walkthrough_date || resolvedWtDate;
  const wtTime = meta.walkthrough_time || resolvedWtTime;
  const displayText = formatWalkthrough(wtDate, wtTime);

  // If metadata is missing date/time, pull from deal entity
  // Also sync appointment status from DealAppointments (authoritative source)
  useEffect(() => {
    if (!resolvedDealId) return;
    base44.entities.Deal.filter({ id: resolvedDealId }).then(deals => {
      const d = deals?.[0];
      if (d) {
        if (!meta.walkthrough_date && d.walkthrough_date) setResolvedWtDate(d.walkthrough_date);
        if (!meta.walkthrough_time && d.walkthrough_time) setResolvedWtTime(d.walkthrough_time);
      }
    }).catch(() => {});
    // Also check DealAppointments for authoritative status
    base44.entities.DealAppointments.filter({ dealId: resolvedDealId }).then(rows => {
      const apptStatus = rows?.[0]?.walkthrough?.status;
      if (apptStatus === 'SCHEDULED' && status !== 'confirmed') setLocalStatus('confirmed');
      else if (apptStatus === 'CANCELED' && status !== 'denied') setLocalStatus('denied');
    }).catch(() => {});
  }, [resolvedDealId]);

  const respond = async (action) => {
    setResponding(true);
    const msgAction = action === 'confirm' ? 'confirmed' : 'denied';
    setLocalStatus(msgAction);
    try {
      await respondToWalkthrough({
        action,
        dealId: resolvedDealId,
        roomId,
        profileId: profile?.id,
        wtDate,
        wtTime,
      });
      toast.success(`Walk-through ${action === 'confirm' ? 'confirmed' : 'declined'}`);
    } catch (e) {
      setLocalStatus(null);
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
        <span className="text-[#808080]">Proposed:</span> {displayText}
      </p>

      {status === 'pending' && isRecipient && isSigned && (
        <div className="flex gap-2 mt-3">
          <Button onClick={() => respond('confirm')} disabled={responding} size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs">
            {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            Confirm
          </Button>
          <Button onClick={() => respond('deny')} disabled={responding} size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs">
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