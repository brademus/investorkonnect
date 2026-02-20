import React, { useState } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmWalkthrough, formatSlot } from "@/components/room/walkthroughActions";

/**
 * WalkthroughPanel — shows walkthrough status on the Deal Board.
 * Single source of truth: deal.walkthrough_slots + deal.walkthrough_confirmed_slot.
 */
export default function WalkthroughPanel({ deal, room, profile, roomId }) {
  const [responding, setResponding] = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);
  const [localConfirmed, setLocalConfirmed] = useState(null);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned =
    room?.agreement_status === "fully_signed" ||
    room?.request_status === "locked" ||
    room?.is_fully_signed === true;

  const wtSlots = (deal?.walkthrough_slots || []).filter(s => s.date && s.date.length >= 8);
  const confirmedSlot = localConfirmed || deal?.walkthrough_confirmed_slot;
  const hasWalkthrough = wtSlots.length > 0;
  const status = confirmedSlot ? "SCHEDULED" : (hasWalkthrough ? "PROPOSED" : "NOT_SET");

  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";

  const handleRespond = async () => {
    if (selectedSlotIdx == null || !wtSlots[selectedSlotIdx]) return;
    setResponding(true);
    const slot = wtSlots[selectedSlotIdx];
    setLocalConfirmed(slot);
    try {
      await confirmWalkthrough({ dealId: deal.id, roomId, profileId: profile?.id, slot });
      toast.success("Walk-through confirmed");
    } catch (e) {
      setLocalConfirmed(null);
      toast.error("Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  const statusColor = status === "SCHEDULED" ? "text-[#10B981]" : "text-[#F59E0B]";
  const statusLabel = status === "SCHEDULED" ? "Confirmed" : "Proposed — Awaiting Confirmation";

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>

      {!hasWalkthrough && !confirmedSlot ? (
        <div className="text-center py-6">
          <CalendarX className="w-8 h-8 text-[#808080] mx-auto mb-2" />
          <p className="text-sm text-[#808080]">No walk-through scheduled</p>
          {isInvestor && isSigned && (
            <p className="text-xs text-[#808080] mt-2">
              Use the <span className="text-[#E3C567]">Schedule Walk-through</span> button in the messages header to propose a date.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className={`w-4 h-4 ${statusColor}`} />
            <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
          </div>

          {confirmedSlot ? (
            <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
              <div className="w-10 h-10 rounded-full bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#10B981]">{formatSlot(confirmedSlot)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[#808080]">
                {canAgentRespond ? "Select a date & time that works for you:" : "Proposed walk-through options:"}
              </p>
              {wtSlots.map((slot, idx) => {
                const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
                const isSelected = selectedSlotIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => canAgentRespond && setSelectedSlotIdx(idx)}
                    disabled={!canAgentRespond}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-[#E3C567]/10 border-[#E3C567]"
                        : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"
                    } ${canAgentRespond ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-[#E3C567]/20" : "bg-[#E3C567]/10"
                    }`}>
                      <Calendar className={`w-5 h-5 ${isSelected ? "text-[#E3C567]" : "text-[#E3C567]/70"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#FAFAFA]">
                        {wtSlots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}
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
          )}

          {canAgentRespond && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleRespond}
                disabled={responding || selectedSlotIdx == null}
                size="sm"
                className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs flex-1"
              >
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                {selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
              </Button>
            </div>
          )}

          {isAgent && !isSigned && status === "PROPOSED" && (
            <p className="text-xs text-[#F59E0B] pt-2">Sign the agreement to confirm this walk-through.</p>
          )}
        </div>
      )}
    </div>
  );
}