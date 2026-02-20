import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmWalkthrough, formatSlot } from "@/components/room/walkthroughActions";

/**
 * Inline walkthrough card shown in the message list.
 * Agent can select a slot and confirm directly from the message.
 */
export default function WalkthroughMessageCard({ message, isAgent, isRecipient, roomId, profile, isSigned, dealId }) {
  const [responding, setResponding] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);
  const [dealSlots, setDealSlots] = useState([]);

  const meta = message?.metadata || {};
  const status = localStatus || meta.status || 'pending';

  // Load slots from deal as fallback
  useEffect(() => {
    if (meta.walkthrough_slots?.length > 0) return;
    if (!dealId) return;
    base44.entities.Deal.filter({ id: dealId }).then(deals => {
      const d = deals?.[0];
      if (d?.walkthrough_slots?.length > 0) setDealSlots(d.walkthrough_slots);
      // Sync confirmed status from deal
      if (d?.walkthrough_confirmed_slot && status === 'pending') setLocalStatus('confirmed');
    }).catch(() => {});
  }, [dealId]);

  const rawSlots = (meta.walkthrough_slots?.length > 0) ? meta.walkthrough_slots : dealSlots;
  const slots = (rawSlots || []).filter(s => s.date && s.date.length >= 8);
  const canRespond = isRecipient && isSigned && status === 'pending';

  const handleConfirm = async () => {
    if (selectedSlotIdx == null || !slots[selectedSlotIdx]) return;
    setResponding(true);
    setLocalStatus('confirmed');
    try {
      await confirmWalkthrough({ dealId, roomId, profileId: profile?.id, slot: slots[selectedSlotIdx] });
      toast.success("Walk-through confirmed");
    } catch (e) {
      setLocalStatus(null);
      toast.error("Failed to confirm");
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

      {slots.length > 0 ? (
        <div className="space-y-2 mb-2">
          <p className="text-xs text-[#808080]">{canRespond ? "Select a date & time:" : "Proposed options:"}</p>
          {slots.map((slot, idx) => {
            const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
            const isSelected = selectedSlotIdx === idx;
            return (
              <button key={idx} type="button" onClick={() => canRespond && setSelectedSlotIdx(idx)} disabled={!canRespond}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${isSelected ? "bg-[#E3C567]/10 border-[#E3C567]" : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"} ${canRespond ? "cursor-pointer" : "cursor-default"}`}>
                <Calendar className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-[#E3C567]" : "text-[#E3C567]/70"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#FAFAFA]">{slots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}</p>
                  {timeLabel && <p className="text-xs text-[#808080]">{timeLabel.replace(/(AM|PM)/g, ' $1').trim()}</p>}
                </div>
                {isSelected && <div className="w-5 h-5 rounded-full bg-[#E3C567] flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-black" /></div>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[#FAFAFA] mb-1"><span className="text-[#808080]">Proposed:</span> TBD</p>
      )}

      {canRespond && (
        <Button onClick={handleConfirm} disabled={responding || selectedSlotIdx == null} size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs mt-2">
          {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
          {selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
        </Button>
      )}

      {status === 'pending' && isRecipient && !isSigned && <div className="mt-2 text-xs text-[#F59E0B]">Sign the agreement to confirm</div>}
      {status === 'confirmed' && <div className="mt-2 flex items-center gap-1.5 text-xs text-[#10B981]"><Check className="w-3 h-3" /> Confirmed</div>}
      {status === 'pending' && !isRecipient && <div className="mt-2 text-xs text-[#F59E0B]">{isSigned ? 'Awaiting agent response' : 'Proposed — agents can respond after signing'}</div>}
    </div>
  );
}