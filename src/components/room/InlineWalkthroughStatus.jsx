import React, { useState } from "react";
import { Calendar, Check, Loader2, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmWalkthrough, formatSlot } from "@/components/room/walkthroughActions";

/**
 * Inline walkthrough status shown in the Deal Board progress section.
 * Reads from deal.walkthrough_slots and deal.walkthrough_confirmed_slot.
 */
export default function InlineWalkthroughStatus({ deal, room, profile, roomId }) {
  const [responding, setResponding] = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);
  const [localConfirmed, setLocalConfirmed] = useState(null);

  const isAgent = profile?.user_role === "agent";
  const isSigned = room?.agreement_status === "fully_signed" || room?.request_status === "locked" || room?.is_fully_signed === true;

  const slots = (deal?.walkthrough_slots || []).filter(s => s.date && s.date.length >= 8);
  const confirmedSlot = localConfirmed || deal?.walkthrough_confirmed_slot;
  const hasWalkthrough = slots.length > 0;

  if (!hasWalkthrough) {
    return (
      <div className="flex items-center gap-2 py-1">
        <CalendarX className="w-4 h-4 text-[#808080]" />
        <span className="text-xs text-[#808080]">No walk-through scheduled</span>
      </div>
    );
  }

  if (confirmedSlot) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Check className="w-3.5 h-3.5 text-[#10B981]" />
        <span className="text-xs font-medium text-[#10B981]">Confirmed: {formatSlot(confirmedSlot)}</span>
      </div>
    );
  }

  const canConfirm = isAgent && isSigned;

  const handleConfirm = async () => {
    if (selectedSlotIdx == null || !slots[selectedSlotIdx]) return;
    setResponding(true);
    const slot = slots[selectedSlotIdx];
    setLocalConfirmed(slot);
    try {
      await confirmWalkthrough({ dealId: deal.id, roomId, profileId: profile?.id, slot });
      toast.success("Walk-through confirmed");
    } catch (err) {
      setLocalConfirmed(null);
      toast.error("Failed to confirm");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="space-y-2" data-walkthrough-panel>
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
        <span className="text-xs font-medium text-[#F59E0B]">Proposed — Awaiting Confirmation</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-[#808080]">{canConfirm ? "Select a date & time:" : "Proposed options:"}</p>
        {slots.map((slot, idx) => {
          const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
          const isSelected = selectedSlotIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => canConfirm && setSelectedSlotIdx(idx)}
              disabled={!canConfirm}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left text-xs ${
                isSelected ? "bg-[#E3C567]/10 border-[#E3C567]" : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"
              } ${canConfirm ? "cursor-pointer" : "cursor-default"}`}
            >
              <Calendar className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-[#E3C567]" : "text-[#E3C567]/70"}`} />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-[#FAFAFA]">
                  {slots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}
                </span>
                {timeLabel && <span className="text-[#808080] ml-1.5">{timeLabel.replace(/(AM|PM)/g, ' $1').trim()}</span>}
              </div>
              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-[#E3C567] flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-black" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {canConfirm && (
        <Button
          onClick={handleConfirm}
          disabled={responding || selectedSlotIdx == null}
          size="sm"
          className="w-full bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs h-8"
        >
          {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
          {selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
        </Button>
      )}

      {isAgent && !isSigned && (
        <p className="text-xs text-[#F59E0B]">Sign the agreement to confirm this walk-through.</p>
      )}
    </div>
  );
}