import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, CalendarX, CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatWalkthrough, respondToWalkthrough } from "@/components/room/walkthroughActions";
import ProposeNewDatesForm from "@/components/room/ProposeNewDatesForm";

const _wtCache = {};
const RESOLVED_STATUSES = new Set(["SCHEDULED", "CANCELED", "COMPLETED"]);

export default function InlineWalkthroughStatus({ deal, room, profile, roomId, externalStatus, externalProposedBy, externalLoaded }) {
  const dealId = deal?.id;
  // Use external state from DealBoard if provided (avoids duplicate subscriptions)
  const useExternal = externalStatus !== undefined;
  const [responding, setResponding] = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposedByProfileId, setProposedByProfileId] = useState(externalProposedBy || null);
  const [localStatus, setLocalStatus] = useState(null);

  // Sync external proposedBy
  useEffect(() => {
    if (externalProposedBy !== undefined) setProposedByProfileId(externalProposedBy);
  }, [externalProposedBy]);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned = room?.agreement_status === "fully_signed" || room?.request_status === "locked" || room?.is_fully_signed === true;

  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
  const wtTime = deal?.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
  const dealHasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtTime || wtSlots.length > 0);
  const dealConfirmed = deal?.walkthrough_confirmed === true;
  const apptLoaded = useExternal ? (externalLoaded !== false) : true;
  const hasWalkthrough = dealHasWalkthrough || (externalStatus && externalStatus !== "NOT_SET");

  const status = localStatus || (dealConfirmed ? "SCHEDULED" : (externalStatus || (apptLoaded && hasWalkthrough ? "PROPOSED" : null)));
  // Either party can confirm proposed dates — the one who didn't propose them
  const proposedBySelf2 = proposedByProfileId === profile?.id;
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED" && !proposedBySelf2;
  const canInvestorRespond = isInvestor && isSigned && status === "PROPOSED" && !proposedBySelf2;
  const canRespond = (canAgentRespond || canInvestorRespond) && status === "PROPOSED";
  const hasSlots = wtSlots.length > 0;

  const handleRespond = async () => {
    if (!deal?.id) return;
    setResponding(true);
    setLocalStatus("SCHEDULED");
    _wtCache[dealId] = { status: "SCHEDULED", userActionAt: Date.now() };

    let chosenDate = wtDate;
    let chosenTime = wtTime;
    if (hasSlots && selectedSlotIdx != null && wtSlots[selectedSlotIdx]) {
      const slot = wtSlots[selectedSlotIdx];
      chosenDate = slot.date;
      chosenTime = slot.timeStart || null;
    }

    try {
      await respondToWalkthrough({ action: "confirm", dealId: deal.id, roomId, profileId: profile?.id, wtDate: chosenDate, wtTime: chosenTime });
      toast.success("Walk-through confirmed");
    } catch (_) {
      setLocalStatus(null);
      delete _wtCache[dealId];
      toast.error("Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  if (!apptLoaded && hasWalkthrough) {
    return <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-[#808080]" /><span className="text-xs text-[#808080]">Loading...</span></div>;
  }

  if (!hasWalkthrough) {
    return (
      <div className="flex items-center gap-2 py-1">
        <CalendarX className="w-4 h-4 text-[#808080]" />
        <span className="text-xs text-[#808080]">No walk-through scheduled yet</span>
      </div>
    );
  }

  const proposedBySelf = proposedByProfileId === profile?.id;
  const statusColor = status === "SCHEDULED" ? "text-[#10B981]" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]";
  let statusLabel = "Proposed — Awaiting Confirmation";
  if (status === "SCHEDULED") statusLabel = "Confirmed";
  else if (status === "COMPLETED") statusLabel = "Completed";
  else if (status === "PROPOSED" && proposedBySelf) statusLabel = "Waiting for Confirmation";
  else if (status === "PROPOSED" && !proposedBySelf && proposedByProfileId) statusLabel = "New Dates Proposed — Please Confirm";

  return (
    <div className="space-y-2" data-walkthrough-panel>
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`w-3.5 h-3.5 ${statusColor}`} />
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {wtSlots.length > 0 && status === "PROPOSED" ? (
        <div className="space-y-1.5">
          <p className="text-xs text-[#808080]">
            {canRespond ? "Select a date & time:" : "Proposed options:"}
          </p>
          {wtSlots.map((slot, idx) => {
            const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
            const isSelected = selectedSlotIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!canRespond) return;
                  setSelectedSlotIdx(prev => prev === idx ? null : idx);
                }}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left text-xs ${
                  isSelected ? "bg-[#E3C567]/10 border-[#E3C567]" : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"
                } ${canRespond ? "cursor-pointer" : "cursor-default"}`}
              >
                <Calendar className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-[#E3C567]" : "text-[#E3C567]/70"}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-[#FAFAFA]">
                    {wtSlots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}
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
      ) : wtSlots.length === 0 ? (
        <div className="flex items-center gap-2.5 p-2.5 bg-[#141414] rounded-lg border border-[#1F1F1F] text-xs">
          <Calendar className="w-4 h-4 text-[#E3C567]" />
          <span className="text-[#FAFAFA] font-medium">{wtDate || 'TBD'}</span>
          {wtTime && <><Clock className="w-3.5 h-3.5 text-[#60A5FA] ml-2" /><span className="text-[#FAFAFA]">{wtTime}</span></>}
        </div>
      ) : null}

      {canRespond && (
        <div className="space-y-2">
          <Button
            onClick={handleRespond}
            disabled={responding || (hasSlots && selectedSlotIdx == null)}
            size="sm"
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs h-8"
          >
            {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            {hasSlots && selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
          </Button>
          {!showProposeForm ? (
            <button
              onClick={() => setShowProposeForm(true)}
              className="w-full flex items-center justify-center gap-1 text-xs text-[#808080] hover:text-[#E3C567] py-1 transition-colors"
            >
              <CalendarPlus className="w-3 h-3" />
              Propose Different Dates
            </button>
          ) : (
            <ProposeNewDatesForm
              dealId={dealId}
              roomId={roomId}
              profileId={profile?.id}
              compact
              onProposed={() => {
                setShowProposeForm(false);
                setSelectedSlotIdx(null);
                setLocalStatus(null);
                setProposedByProfileId(profile?.id);
              }}
              onCancel={() => setShowProposeForm(false)}
            />
          )}
        </div>
      )}

      {(isAgent || isInvestor) && !isSigned && status === "PROPOSED" && (
        <p className="text-xs text-[#F59E0B]">Sign the agreement to confirm this walk-through.</p>
      )}
    </div>
  );
}