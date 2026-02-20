import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, CalendarX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatWalkthrough, respondToWalkthrough } from "@/components/room/walkthroughActions";

const _wtCache = {};
const RESOLVED_STATUSES = new Set(["SCHEDULED", "CANCELED", "COMPLETED"]);

export default function InlineWalkthroughStatus({ deal, room, profile, roomId }) {
  const dealId = deal?.id;
  const cached = dealId ? _wtCache[dealId] : null;
  const [apptStatus, setApptStatus] = useState(cached?.status || null);
  const [apptLoaded, setApptLoaded] = useState(!!cached);
  const [responding, setResponding] = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);

  const safeSetStatus = (newStatus) => {
    setApptStatus(prev => {
      if (RESOLVED_STATUSES.has(prev) && !RESOLVED_STATUSES.has(newStatus)) return prev;
      return newStatus;
    });
  };

  useEffect(() => {
    if (dealId && apptStatus) _wtCache[dealId] = { ..._wtCache[dealId], status: apptStatus };
  }, [dealId, apptStatus]);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned = room?.agreement_status === "fully_signed" || room?.request_status === "locked" || room?.is_fully_signed === true;

  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
  const wtTime = deal?.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
  const dealHasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtTime || wtSlots.length > 0);
  const hasWalkthrough = dealHasWalkthrough || (apptStatus && apptStatus !== "NOT_SET");

  useEffect(() => {
    if (!dealId) return;
    const freshCached = _wtCache[dealId];
    if (freshCached?.userActionAt && (Date.now() - freshCached.userActionAt) < 30000) {
      safeSetStatus(freshCached.status);
      setApptLoaded(true);
      return;
    }
    let cancelled = false;
    setApptLoaded(false);
    base44.entities.DealAppointments.filter({ dealId }).then(rows => {
      if (cancelled) return;
      const latestCache = _wtCache[dealId];
      if (latestCache?.userActionAt && (Date.now() - latestCache.userActionAt) < 30000) { setApptLoaded(true); return; }
      const s = rows?.[0]?.walkthrough?.status;
      if (s && s !== "NOT_SET") safeSetStatus(s);
      else if (dealHasWalkthrough) safeSetStatus("PROPOSED");
      setApptLoaded(true);
    }).catch(() => {
      if (!cancelled && dealHasWalkthrough && !_wtCache[dealId]?.status) safeSetStatus("PROPOSED");
      setApptLoaded(true);
    });
    return () => { cancelled = true; };
  }, [dealId, dealHasWalkthrough]);

  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === deal.id && e.data.walkthrough?.status) {
        const s = e.data.walkthrough.status;
        safeSetStatus(s);
        if (RESOLVED_STATUSES.has(s)) _wtCache[deal.id] = { status: s, userActionAt: Date.now() };
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Message.subscribe(e => {
      const d = e?.data;
      if (!d || d.room_id !== roomId) return;
      if (d.metadata?.type === "walkthrough_request" || d.metadata?.type === "walkthrough_response") {
        if (d.metadata.status === "confirmed") { safeSetStatus("SCHEDULED"); _wtCache[dealId] = { status: "SCHEDULED", userActionAt: Date.now() }; }
        else if (d.metadata.status === "denied") { safeSetStatus("CANCELED"); _wtCache[dealId] = { status: "CANCELED", userActionAt: Date.now() }; }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId, dealId]);

  const status = apptStatus || (apptLoaded && hasWalkthrough ? "PROPOSED" : null);
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";
  const hasSlots = wtSlots.length > 0;

  const handleRespond = async () => {
    if (!deal?.id) return;
    setResponding(true);
    safeSetStatus("SCHEDULED");
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
      safeSetStatus("PROPOSED");
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

  const statusColor = status === "SCHEDULED" ? "text-[#10B981]" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]";
  const statusLabel = status === "SCHEDULED" ? "Confirmed" : status === "COMPLETED" ? "Completed" : "Proposed — Awaiting Confirmation";

  return (
    <div className="space-y-2" data-walkthrough-panel>
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`w-3.5 h-3.5 ${statusColor}`} />
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {wtSlots.length > 0 && status === "PROPOSED" ? (
        <div className="space-y-1.5">
          <p className="text-xs text-[#808080]">
            {canAgentRespond ? "Select a date & time:" : "Proposed options:"}
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
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left text-xs ${
                  isSelected ? "bg-[#E3C567]/10 border-[#E3C567]" : "bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]/40"
                } ${canAgentRespond ? "cursor-pointer" : "cursor-default"}`}
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

      {canAgentRespond && (
        <Button
          onClick={handleRespond}
          disabled={responding || (hasSlots && selectedSlotIdx == null)}
          size="sm"
          className="w-full bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs h-8"
        >
          {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
          {hasSlots && selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
        </Button>
      )}

      {isAgent && !isSigned && status === "PROPOSED" && (
        <p className="text-xs text-[#F59E0B]">Sign the agreement to confirm this walk-through.</p>
      )}
    </div>
  );
}