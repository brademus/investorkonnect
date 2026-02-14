import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, X, CalendarX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * WalkthroughPanel — reads walkthrough_scheduled + walkthrough_datetime
 * directly from the Deal entity, exactly like every other deal field.
 * Falls back to DealAppointments only for status updates (confirmed/declined).
 */
export default function WalkthroughPanel({ deal, room, profile, roomId }) {
  const [apptStatus, setApptStatus] = useState(null);
  const [responding, setResponding] = useState(false);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned =
    room?.agreement_status === "fully_signed" ||
    room?.request_status === "locked" ||
    room?.is_fully_signed === true;

  // The walkthrough data comes from the deal — stored as raw strings (date + time)
  const wtScheduled = deal?.walkthrough_scheduled === true;
  const wtDate = deal?.walkthrough_date || null;
  const wtTime = deal?.walkthrough_time || null;
  const hasDateOrTime = wtDate || wtTime;

  // Set status immediately from deal data so the panel renders instantly
  useEffect(() => {
    if (wtScheduled && hasDateOrTime && !apptStatus) {
      setApptStatus("PROPOSED");
    }
  }, [wtScheduled, hasDateOrTime]);

  // Load DealAppointments to get the *status* (confirmed/declined by agent) — overrides PROPOSED if found
  useEffect(() => {
    if (!deal?.id) return;
    let cancelled = false;

    (async () => {
      const rows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
      const appt = rows?.[0]?.walkthrough;
      if (!cancelled && appt?.status && appt.status !== "NOT_SET") {
        setApptStatus(appt.status);
      }
    })();

    return () => { cancelled = true; };
  }, [deal?.id]);

  // Real-time: DealAppointments status changes
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe((event) => {
      if (event?.data?.dealId === deal.id && event.data.walkthrough?.status) {
        setApptStatus(event.data.walkthrough.status);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  const status = apptStatus || (wtScheduled && hasDateOrTime ? "PROPOSED" : null);
  const hasWalkthrough = wtScheduled && hasDateOrTime;
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";

  const handleRespond = async (action) => {
    if (!deal?.id) return;
    setResponding(true);
    try {
      const newStatus = action === "confirm" ? "SCHEDULED" : "CANCELED";
      const apptRows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
      if (apptRows?.[0]) {
        await base44.entities.DealAppointments.update(apptRows[0].id, {
          walkthrough: {
            ...apptRows[0].walkthrough,
            status: newStatus,
            updatedByUserId: profile?.id,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      if (roomId) {
        const emoji = action === "confirm" ? "✅" : "❌";
        const label = action === "confirm" ? "Confirmed" : "Declined";
        const displayText = `${wtDate || 'TBD'} at ${wtTime || 'TBD'}`;
        await base44.entities.Message.create({
          room_id: roomId,
          sender_profile_id: profile?.id,
          body: `${emoji} Walk-through ${label}\n\n${action === "confirm" ? `See you on ${displayText}` : "Please propose a different time."}`,
          metadata: { type: "walkthrough_response", walkthrough_date: wtDate, walkthrough_time: wtTime, status: action === "confirm" ? "confirmed" : "denied" },
        });

        const msgs = await base44.entities.Message.filter({ room_id: roomId });
        for (const m of msgs.filter(m => m.metadata?.type === "walkthrough_request" && m.metadata?.status === "pending")) {
          await base44.entities.Message.update(m.id, {
            metadata: { ...m.metadata, status: action === "confirm" ? "confirmed" : "denied", responded_by: profile?.id, responded_at: new Date().toISOString() },
          });
        }
      }

      setApptStatus(newStatus);
      toast.success(`Walk-through ${action === "confirm" ? "confirmed" : "declined"}`);
    } catch (e) {
      toast.error("Failed to respond");
    } finally {
      setResponding(false);
    }
  };

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
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2
              className={`w-4 h-4 ${
                status === "SCHEDULED" ? "text-[#10B981]" : status === "CANCELED" ? "text-red-400" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]"
              }`}
            />
            <span className={`text-xs font-medium ${
              status === "SCHEDULED" ? "text-[#10B981]" : status === "CANCELED" ? "text-red-400" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]"
            }`}>
              {status === "SCHEDULED" ? "Confirmed" : status === "CANCELED" ? "Declined" : status === "COMPLETED" ? "Completed" : "Proposed — Awaiting Confirmation"}
            </span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
            <div className="w-10 h-10 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#E3C567]" />
            </div>
            <div>
              <p className="text-xs text-[#808080]">Date</p>
              <p className="text-sm font-medium text-[#FAFAFA]">
                {wtDate || 'TBD'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
            <div className="w-10 h-10 rounded-full bg-[#60A5FA]/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#60A5FA]" />
            </div>
            <div>
              <p className="text-xs text-[#808080]">Time</p>
              <p className="text-sm font-medium text-[#FAFAFA]">
                {wtTime || 'TBD'}
              </p>
            </div>
          </div>

          {/* Agent: confirm/decline */}
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