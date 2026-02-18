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
  const [userActed, setUserActed] = useState(false);
  const [resolvedWtDate, setResolvedWtDate] = useState(null);
  const [resolvedWtTime, setResolvedWtTime] = useState(null);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);
  const meta = message?.metadata || {};
  // If user acted, always trust localStatus — don't let meta.status revert it
  const status = userActed ? (localStatus || 'pending') : (localStatus || meta.status || 'pending');

  // Multiple walkthrough slots from message metadata, with deal fallback
  const [dealSlots, setDealSlots] = useState([]);

  // Sync from real-time message updates — but don't overwrite user action
  useEffect(() => {
    if (userActed) return;
    if (meta.status && meta.status !== 'pending') setLocalStatus(meta.status);
  }, [meta.status, userActed]);

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

  // If metadata is missing date/time or slots, pull from deal entity
  // Also sync appointment status from DealAppointments (authoritative source)
  useEffect(() => {
    if (!resolvedDealId) return;
    base44.entities.Deal.filter({ id: resolvedDealId }).then(deals => {
      const d = deals?.[0];
      if (d) {
        if (!meta.walkthrough_date && d.walkthrough_date) setResolvedWtDate(d.walkthrough_date);
        if (!meta.walkthrough_time && d.walkthrough_time) setResolvedWtTime(d.walkthrough_time);
        // Fallback: load slots from deal if message metadata doesn't have them
        if (!(meta.walkthrough_slots?.length > 0) && d.walkthrough_slots?.length > 0) {
          setDealSlots(d.walkthrough_slots);
        }
      }
    }).catch(() => {});
    // Also check DealAppointments for authoritative status
    base44.entities.DealAppointments.filter({ dealId: resolvedDealId }).then(rows => {
      const apptStatus = rows?.[0]?.walkthrough?.status;
      if (apptStatus === 'SCHEDULED' && status !== 'confirmed') setLocalStatus('confirmed');
      else if (apptStatus === 'CANCELED' && status !== 'denied') setLocalStatus('denied');
    }).catch(() => {});
  }, [resolvedDealId]);

  // Combine: prefer message metadata slots, fallback to deal slots
  const rawSlots = (meta.walkthrough_slots?.length > 0) ? meta.walkthrough_slots : dealSlots;
  const wtSlots = (rawSlots || []).filter(s => s.date && s.date.length >= 8);
  const hasMultipleSlots = wtSlots.length > 1;

  const respond = async (action) => {
    setResponding(true);
    const msgAction = action === 'confirm' ? 'confirmed' : 'denied';
    setLocalStatus(msgAction);
    setUserActed(true);

    // Determine which slot is being confirmed
    let chosenDate = wtDate;
    let chosenTime = wtTime;
    if (action === 'confirm' && hasMultipleSlots && selectedSlotIdx != null && wtSlots[selectedSlotIdx]) {
      const slot = wtSlots[selectedSlotIdx];
      chosenDate = slot.date;
      chosenTime = slot.timeStart || null;
    }

    try {
      await respondToWalkthrough({
        action,
        dealId: resolvedDealId,
        roomId,
        profileId: profile?.id,
        wtDate: chosenDate,
        wtTime: chosenTime,
      });
      toast.success(`Walk-through ${action === 'confirm' ? 'confirmed' : 'declined'}`);
    } catch (e) {
      setLocalStatus(null);
      setUserActed(false);
      toast.error('Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  const canRespond = isRecipient && isSigned && status === 'pending';

  return (
    <div className="bg-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl p-4 max-w-[85%]">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-[#E3C567]" />
        <span className="text-sm font-semibold text-[#E3C567]">Walk-through Request</span>
      </div>

      {/* Show all proposed slots if multiple were sent */}
      {hasMultipleSlots ? (
        <div className="space-y-2 mb-2">
          <p className="text-xs text-[#808080]">
            {canRespond ? "Select a date & time that works for you:" : "Proposed walk-through options:"}
          </p>
          {wtSlots.map((slot, idx) => {
            const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
            const isSelected = selectedSlotIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => canRespond && setSelectedSlotIdx(idx)}
                disabled={!canRespond}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  isSelected
                    ? "bg-[#E3C567]/10 border-[#E3C567]"
                    : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"
                } ${canRespond ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-[#E3C567]/20" : "bg-[#E3C567]/10"
                }`}>
                  <Calendar className={`w-4 h-4 ${isSelected ? "text-[#E3C567]" : "text-[#E3C567]/70"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#FAFAFA]">
                    Option {idx + 1}: {slot.date}
                  </p>
                  {timeLabel && (
                    <p className="text-xs text-[#808080]">{timeLabel.replace(/(AM|PM)/g, ' $1').trim()}</p>
                  )}
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-[#E3C567] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[#FAFAFA] mb-1">
          <span className="text-[#808080]">Proposed:</span> {displayText}
        </p>
      )}

      {canRespond && (
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => respond('confirm')}
            disabled={responding || (hasMultipleSlots && selectedSlotIdx == null)}
            size="sm"
            className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs"
          >
            {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            {hasMultipleSlots && selectedSlotIdx == null ? "Select a Date" : "Confirm"}
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