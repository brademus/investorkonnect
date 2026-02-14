import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, X, CalendarX } from "lucide-react";
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
const _wtCache = {};

export default function WalkthroughPanel({ deal, room, profile, roomId }) {
  const dealId = deal?.id;
  const cached = dealId ? _wtCache[dealId] : null;
  const [apptStatus, setApptStatus] = useState(cached || null);
  const [apptLoaded, setApptLoaded] = useState(!!cached);
  const [responding, setResponding] = useState(false);

  // Persist to cache whenever apptStatus changes
  useEffect(() => {
    if (dealId && apptStatus) _wtCache[dealId] = apptStatus;
  }, [dealId, apptStatus]);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned =
    room?.agreement_status === "fully_signed" ||
    room?.request_status === "locked" ||
    room?.is_fully_signed === true;

  const wtDate = deal?.walkthrough_date || null;
  const wtTime = deal?.walkthrough_time || null;
  const hasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtTime);

  // Load DealAppointments to get real status — skip if cache already has authoritative status
  useEffect(() => {
    if (!dealId) return;
    // Check cache fresh (not the stale `cached` from render) to survive remounts
    const freshCached = _wtCache[dealId];
    if (freshCached && freshCached !== "PROPOSED") {
      setApptStatus(freshCached);
      setApptLoaded(true);
      return;
    }
    let cancelled = false;
    setApptLoaded(false);
    base44.entities.DealAppointments.filter({ dealId }).then(rows => {
      if (cancelled) return;
      const s = rows?.[0]?.walkthrough?.status;
      if (s && s !== "NOT_SET") {
        setApptStatus(s);
      } else if (hasWalkthrough) {
        setApptStatus("PROPOSED");
      }
      setApptLoaded(true);
    }).catch(() => {
      if (!cancelled && hasWalkthrough && !_wtCache[dealId]) setApptStatus("PROPOSED");
      setApptLoaded(true);
    });
    return () => { cancelled = true; };
  }, [dealId, hasWalkthrough]);

  // Real-time: DealAppointments
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === deal.id && e.data.walkthrough?.status) {
        setApptStatus(e.data.walkthrough.status);
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
      if (d.metadata?.type === "walkthrough_request") {
        if (d.metadata.status === "confirmed") setApptStatus("SCHEDULED");
        else if (d.metadata.status === "denied") setApptStatus("CANCELED");
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  const status = apptStatus || (hasWalkthrough ? "PROPOSED" : null);
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";
  const displayText = formatWalkthrough(wtDate, wtTime);

  const handleRespond = async (action) => {
    if (!deal?.id) return;
    setResponding(true);
    const optimistic = action === "confirm" ? "SCHEDULED" : "CANCELED";
    setApptStatus(optimistic);
    try {
      await respondToWalkthrough({
        action,
        dealId: deal.id,
        roomId,
        profileId: profile?.id,
        wtDate,
        wtTime,
      });
      toast.success(`Walk-through ${action === "confirm" ? "confirmed" : "declined"}`);
    } catch (e) {
      setApptStatus("PROPOSED");
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

      {!hasWalkthrough ? (
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

          {canAgentRespond && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleRespond("confirm")} disabled={responding} size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Confirm
              </Button>
              <Button onClick={() => handleRespond("deny")} disabled={responding} size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                Decline
              </Button>
            </div>
          )}

          {isAgent && !isSigned && status === "PROPOSED" && (
            <p className="text-xs text-[#F59E0B] pt-2">Sign the agreement to accept or decline this walk-through.</p>
          )}

          {isInvestor && status === "CANCELED" && (
            <div className="pt-3 border-t border-[#1F1F1F] mt-3">
              <p className="text-xs text-[#808080]">
                The agent declined. Use the <span className="text-[#E3C567]">Schedule Walk-through</span> button in the messages header to propose a new date.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}