import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, X, Send, CalendarX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * WalkthroughPanel — shown in DealBoard "Details" tab.
 *
 * Data source priority:
 *   1. DealAppointments entity (canonical / authoritative)
 *   2. Deal entity fields (walkthrough_scheduled + walkthrough_datetime)
 *
 * If neither source has walkthrough data → show "No walkthrough scheduled".
 * Investor schedules via the WalkthroughScheduleModal (opened from the messages header bar).
 */
export default function WalkthroughPanel({ deal, room, profile, roomId }) {
  const [apptData, setApptData] = useState(null); // { status, datetime }
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const isInvestor = profile?.user_role === "investor";
  const isAgent = profile?.user_role === "agent";
  const isSigned =
    room?.agreement_status === "fully_signed" ||
    room?.request_status === "locked" ||
    room?.is_fully_signed;

  // ── Load walkthrough data ──────────────────────────────────────────
  useEffect(() => {
    if (!deal?.id) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1. Check DealAppointments (authoritative)
        const rows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
        const appt = rows?.[0]?.walkthrough;
        if (!cancelled && appt && appt.status && appt.status !== "NOT_SET") {
          setApptData({ status: appt.status, datetime: appt.datetime || null });
          setLoading(false);
          return;
        }

        // 2. Check Deal entity fields from prop
        let wtScheduled = deal.walkthrough_scheduled === true;
        let wtDatetime = deal.walkthrough_datetime || null;

        // 3. If prop doesn't have walkthrough data, fetch fresh from DB
        // (the deal prop may have been loaded before walkthrough was saved by the automation)
        if (!wtScheduled) {
          try {
            const freshDeals = await base44.entities.Deal.filter({ id: deal.id });
            const freshDeal = freshDeals?.[0];
            if (freshDeal?.walkthrough_scheduled === true) {
              wtScheduled = true;
              wtDatetime = freshDeal.walkthrough_datetime || null;
            }
          } catch (e) {
            console.warn("[WalkthroughPanel] Failed to fetch fresh deal:", e);
          }
        }

        if (!cancelled && wtScheduled) {
          setApptData({ status: "PROPOSED", datetime: wtDatetime });
          setLoading(false);
          return;
        }

        // Nothing found
        if (!cancelled) { setApptData(null); setLoading(false); }
      } catch (e) {
        console.error("[WalkthroughPanel] load error:", e);
        if (!cancelled) { setApptData(null); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [deal?.id, deal?.walkthrough_scheduled, deal?.walkthrough_datetime]);

  // ── Real-time: DealAppointments changes ────────────────────────────
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe((event) => {
      if (event?.data?.dealId === deal.id && event.data.walkthrough) {
        const wt = event.data.walkthrough;
        if (wt.status && wt.status !== "NOT_SET") {
          setApptData({ status: wt.status, datetime: wt.datetime || null });
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // ── Real-time: Deal entity changes (walkthrough fields) ────────────
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.Deal.subscribe((event) => {
      if (event?.data?.id === deal.id) {
        const d = event.data;
        if (d.walkthrough_scheduled === true && d.walkthrough_datetime) {
          setApptData((prev) => {
            // Don't downgrade from a richer DealAppointments status
            if (prev && prev.status !== "PROPOSED" && prev.status !== "NOT_SET") return prev;
            return { status: "PROPOSED", datetime: d.walkthrough_datetime };
          });
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // ── Derived state ──────────────────────────────────────────────────
  const hasWalkthrough = !!apptData;
  const dt = apptData?.datetime ? new Date(apptData.datetime) : null;
  const isValidDate = dt && !isNaN(dt.getTime());
  const status = apptData?.status || null;
  const canAgentRespond = isAgent && isSigned && status === "PROPOSED";

  // ── Agent: confirm or decline ──────────────────────────────────────
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
        const formatted = isValidDate
          ? dt.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
          : "the proposed date";
        await base44.entities.Message.create({
          room_id: roomId,
          sender_profile_id: profile?.id,
          body: `${emoji} Walk-through ${label}\n\n${action === "confirm" ? `See you on ${formatted}` : "Please propose a different time."}`,
          metadata: {
            type: "walkthrough_response",
            walkthrough_datetime: apptData?.datetime,
            status: action === "confirm" ? "confirmed" : "denied",
          },
        });

        // Update pending walkthrough_request messages
        const msgs = await base44.entities.Message.filter({ room_id: roomId });
        for (const m of msgs.filter((m) => m.metadata?.type === "walkthrough_request" && m.metadata?.status === "pending")) {
          await base44.entities.Message.update(m.id, {
            metadata: { ...m.metadata, status: action === "confirm" ? "confirmed" : "denied", responded_by: profile?.id, responded_at: new Date().toISOString() },
          });
        }
      }

      setApptData((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast.success(`Walk-through ${action === "confirm" ? "confirmed" : "declined"}`);
    } catch (e) {
      toast.error("Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 text-[#808080] mx-auto animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>

      {!hasWalkthrough ? (
        /* ── No walkthrough ────────────────────────────── */
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
        /* ── Walkthrough exists ────────────────────────── */
        <div className="space-y-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2
              className={`w-4 h-4 ${
                status === "SCHEDULED" ? "text-[#10B981]" : status === "CANCELED" ? "text-red-400" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                status === "SCHEDULED" ? "text-[#10B981]" : status === "CANCELED" ? "text-red-400" : status === "COMPLETED" ? "text-[#60A5FA]" : "text-[#F59E0B]"
              }`}
            >
              {status === "SCHEDULED"
                ? "Confirmed"
                : status === "CANCELED"
                ? "Declined"
                : status === "COMPLETED"
                ? "Completed"
                : "Proposed — Awaiting Confirmation"}
            </span>
          </div>

          {/* Date */}
          {isValidDate ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                <div className="w-10 h-10 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#E3C567]" />
                </div>
                <div>
                  <p className="text-xs text-[#808080]">Date</p>
                  <p className="text-sm font-medium text-[#FAFAFA]">
                    {dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
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
                    {dt.getHours() === 0 && dt.getMinutes() === 0 ? "TBD" : dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
              <div className="w-10 h-10 rounded-full bg-[#F59E0B]/15 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-xs text-[#808080]">Date & Time</p>
                <p className="text-sm font-medium text-[#F59E0B]">Pending</p>
              </div>
            </div>
          )}

          {/* Agent: confirm/decline (only after signing) */}
          {canAgentRespond && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleRespond("confirm")} disabled={responding} size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Confirm Walk-through
              </Button>
              <Button onClick={() => handleRespond("deny")} disabled={responding} size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                Decline
              </Button>
            </div>
          )}

          {/* Agent: hasn't signed yet */}
          {isAgent && !isSigned && status === "PROPOSED" && (
            <p className="text-xs text-[#F59E0B] pt-2">Sign the agreement to accept or decline this walk-through.</p>
          )}

          {/* Investor: walkthrough was declined — point to modal */}
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