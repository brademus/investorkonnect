import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, CalendarX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatWalkthrough, respondToWalkthrough } from "@/components/room/walkthroughActions";

/**
 * WalkthroughPanel — shows walkthrough date/time + status on the Deal Board.
 * Single source of truth: deal.walkthrough_date / walkthrough_time for display,
 * DealAppointments.walkthrough.status for confirmed/declined.
 */
// Module-level cache so status persists across tab switches (component remounts)
// _wtCache stores { status, userActionAt } — userActionAt is a timestamp when user explicitly confirmed/declined
const _wtCache = {};

// Terminal/resolved statuses that must never revert to PROPOSED
const RESOLVED_STATUSES = new Set(["SCHEDULED", "CANCELED", "COMPLETED"]);

export default function WalkthroughPanel({ deal, room, profile, roomId, onOpenReschedule }) {
  const dealId = deal?.id;
  const cached = dealId ? _wtCache[dealId] : null;
  const [apptStatus, setApptStatus] = useState(cached?.status || null);
  const [apptLoaded, setApptLoaded] = useState(!!cached);
  const [responding, setResponding] = useState(false);

  // Safe setter: never allow a resolved status to revert to PROPOSED/NOT_SET
  const safeSetStatus = (newStatus) => {
    setApptStatus(prev => {
      if (RESOLVED_STATUSES.has(prev) && !RESOLVED_STATUSES.has(newStatus)) {
        return prev; // block regression
      }
      return newStatus;
    });
  };

  // Persist to cache whenever apptStatus changes
  useEffect(() => {
    if (dealId && apptStatus) {
      _wtCache[dealId] = { ..._wtCache[dealId], status: apptStatus };
    }
  }, [dealId, apptStatus]);

  const [selectedSlotIdx, setSelectedSlotIdx] = useState(null);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned =
    room?.agreement_status === "fully_signed" ||
    room?.request_status === "locked" ||
    room?.is_fully_signed === true;

  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
  const wtTime = deal?.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
  const hasMultipleSlots = wtSlots.length > 1;
  // Whether the deal itself says walkthrough is scheduled
  const dealHasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtTime || wtSlots.length > 0);
  // Show walkthrough section if deal says scheduled OR if DealAppointments has a non-NOT_SET status
  const hasWalkthrough = dealHasWalkthrough || (apptStatus && apptStatus !== "NOT_SET");

  // Load DealAppointments to get real status — skip if user recently took action
  useEffect(() => {
    if (!dealId) return;
    // If user explicitly confirmed/declined within last 30s, trust cache and don't overwrite
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
      // Re-check cache after async — user may have acted while fetch was in-flight
      const latestCache = _wtCache[dealId];
      if (latestCache?.userActionAt && (Date.now() - latestCache.userActionAt) < 30000) {
        setApptLoaded(true);
        return;
      }
      const s = rows?.[0]?.walkthrough?.status;
      if (s && s !== "NOT_SET") {
        safeSetStatus(s);
      } else if (dealHasWalkthrough) {
        safeSetStatus("PROPOSED");
      }
      setApptLoaded(true);
    }).catch(() => {
      if (!cancelled && dealHasWalkthrough && !_wtCache[dealId]?.status) {
        safeSetStatus("PROPOSED");
      }
      setApptLoaded(true);
    });
    return () => { cancelled = true; };
  }, [dealId, dealHasWalkthrough]);

  // Real-time: DealAppointments
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === deal.id && e.data.walkthrough?.status) {
        const s = e.data.walkthrough.status;
        safeSetStatus(s);
        if (RESOLVED_STATUSES.has(s)) {
          _wtCache[deal.id] = { status: s, userActionAt: Date.now() };
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // Real-time: Message updates (catch confirmations from message card)
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Message.subscribe(e => {
      const d = e?.data;
      if (!d || d.room_id !== roomId) return;
      // Catch both walkthrough_request (status updated) and walkthrough_response messages
      if (d.metadata?.type === "walkthrough_request") {
        if (d.metadata.status === "confirmed") { safeSetStatus("SCHEDULED"); _wtCache[dealId] = { status: "SCHEDULED", userActionAt: Date.now() }; }
        else if (d.metadata.status === "denied") { safeSetStatus("CANCELED"); _wtCache[dealId] = { status: "CANCELED", userActionAt: Date.now() }; }
      }
      if (d.metadata?.type === "walkthrough_response") {
        if (d.metadata.status === "confirmed") { safeSetStatus("SCHEDULED"); _wtCache[dealId] = { status: "SCHEDULED", userActionAt: Date.now() }; }
        else if (d.metadata.status === "denied") { safeSetStatus("CANCELED"); _wtCache[dealId] = { status: "CANCELED", userActionAt: Date.now() }; }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId, dealId]);

  // Only fall back to PROPOSED once we've actually loaded from DB (or cache)
  const status = apptStatus || (apptLoaded && hasWalkthrough ? "PROPOSED" : null);
  const hasSlots = wtSlots.length > 0;
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";
  const displayText = formatWalkthrough(wtDate, wtTime);

  const handleRespond = async () => {
    if (!deal?.id) return;
    setResponding(true);
    safeSetStatus("SCHEDULED");
    _wtCache[dealId] = { status: "SCHEDULED", userActionAt: Date.now() };

    // Determine which slot is being confirmed
    let chosenDate = wtDate;
    let chosenTime = wtTime;
    if (hasSlots && selectedSlotIdx != null && wtSlots[selectedSlotIdx]) {
      const slot = wtSlots[selectedSlotIdx];
      chosenDate = slot.date;
      chosenTime = slot.timeStart || null;
    }

    try {
      await respondToWalkthrough({
        action: "confirm",
        dealId: deal.id,
        roomId,
        profileId: profile?.id,
        wtDate: chosenDate,
        wtTime: chosenTime,
      });
      toast.success("Walk-through confirmed");
    } catch (e) {
      safeSetStatus("PROPOSED");
      delete _wtCache[dealId];
      toast.error("Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  const statusColor = status === "SCHEDULED" ? "text-[#10B981]" : status === "CANCELED" ? "text-red-400" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]";
  const statusLabel = status === "SCHEDULED" ? "Confirmed" : status === "CANCELED" ? "Declined" : status === "COMPLETED" ? "Completed" : "Proposed — Awaiting Confirmation";

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>

      {!apptLoaded && hasWalkthrough ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[#808080]" />
        </div>
      ) : !hasWalkthrough ? (
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

          {/* Always show all proposed slots */}
          {wtSlots.length > 0 && status === "PROPOSED" ? (
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
          ) : wtSlots.length === 0 ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                <div className="w-10 h-10 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#E3C567]" />
                </div>
                <div>
                  <p className="text-xs text-[#808080]">Date</p>
                  <p className="text-sm font-medium text-[#FAFAFA]">{wtDate || 'TBD'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                <div className="w-10 h-10 rounded-full bg-[#60A5FA]/15 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#60A5FA]" />
                </div>
                <div>
                  <p className="text-xs text-[#808080]">Time</p>
                  <p className="text-sm font-medium text-[#FAFAFA]">{wtTime || 'TBD'}</p>
                </div>
              </div>
            </>
          ) : null}

          {canAgentRespond && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleRespond}
                disabled={responding || (hasSlots && selectedSlotIdx == null)}
                size="sm"
                className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs flex-1"
              >
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                {hasSlots && selectedSlotIdx == null ? "Select a Date to Confirm" : "Confirm Walk-through"}
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