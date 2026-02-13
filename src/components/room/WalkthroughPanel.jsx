import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Check, X, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function WalkthroughPanel({ deal, room, profile, roomId }) {
  const [apptData, setApptData] = useState(null);
  const [loadingAppt, setLoadingAppt] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [responding, setResponding] = useState(false);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const isSigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'locked';

  const autoFormatDate = (value) => {
    const raw = value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += raw[i];
    }
    return formatted;
  };

  // Load walkthrough data
  useEffect(() => {
    if (!deal?.id) return;
    setLoadingAppt(true);
    (async () => {
      try {
        // 1. Check DealAppointments (authoritative source)
        const rows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
        if (rows?.[0]?.walkthrough && rows[0].walkthrough.status !== 'NOT_SET') {
          setApptData(rows[0].walkthrough);
          return;
        }

        // 2. Check Deal entity directly
        if (deal.walkthrough_scheduled === true && deal.walkthrough_datetime) {
          setApptData({ status: 'PROPOSED', datetime: deal.walkthrough_datetime });
          return;
        }

        // 3. Fetch fresh deal from DB in case props are stale
        const dealRows = await base44.entities.Deal.filter({ id: deal.id });
        const liveDeal = dealRows?.[0];
        if (liveDeal?.walkthrough_scheduled === true && liveDeal?.walkthrough_datetime) {
          setApptData({ status: 'PROPOSED', datetime: liveDeal.walkthrough_datetime });
        }
      } catch (e) {
        console.error('[WalkthroughPanel] Error:', e);
      } finally { setLoadingAppt(false); }
    })();
  }, [deal?.id]);

  // Real-time: DealAppointments updates
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe((event) => {
      if (event?.data?.dealId === deal.id && event.data.walkthrough) {
        setApptData(event.data.walkthrough);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  const apptStatus = apptData?.status;
  const hasWalkthrough = apptStatus && apptStatus !== 'NOT_SET';
  const dt = apptData?.datetime ? new Date(apptData.datetime) : null;
  const isValidDate = dt && !isNaN(dt.getTime());
  const canAgentRespond = isAgent && isSigned && apptStatus === 'PROPOSED';

  // Investor: schedule walkthrough
  const handleSchedule = async () => {
    if (!scheduleDate) { toast.error("Please enter a date"); return; }
    if (!deal?.id) return;
    setSaving(true);
    try {
      const isoDatetime = new Date(scheduleDate + ' ' + (scheduleTime || '12:00 PM')).toISOString();

      await base44.entities.Deal.update(deal.id, { walkthrough_scheduled: true, walkthrough_datetime: isoDatetime });

      const apptRows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
      const apptPatch = {
        walkthrough: {
          status: 'PROPOSED', datetime: isoDatetime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locationType: 'ON_SITE', notes: null,
          updatedByUserId: profile?.id || null, updatedAt: new Date().toISOString()
        }
      };
      if (apptRows?.[0]) {
        await base44.entities.DealAppointments.update(apptRows[0].id, apptPatch);
      } else {
        await base44.entities.DealAppointments.create({
          dealId: deal.id, ...apptPatch,
          inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
          rescheduleRequests: []
        });
      }

      // Send chat message
      if (roomId) {
        const formatted = new Date(scheduleDate + ' ' + (scheduleTime || '12:00 PM')).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        await base44.entities.Message.create({
          room_id: roomId, sender_profile_id: profile?.id,
          body: `📅 Walk-through Requested\n\nProposed Date & Time: ${formatted}\n\nPlease confirm or suggest a different time.`,
          metadata: { type: 'walkthrough_request', walkthrough_datetime: isoDatetime, status: 'pending' }
        });
      }

      setApptData({ status: 'PROPOSED', datetime: isoDatetime });
      toast.success("Walk-through request sent!");
      setScheduleDate("");
      setScheduleTime("");
    } catch (e) {
      toast.error("Failed to schedule walk-through");
    } finally { setSaving(false); }
  };

  // Agent: confirm or deny
  const handleRespond = async (action) => {
    if (!deal?.id) return;
    setResponding(true);
    try {
      const newStatus = action === 'confirm' ? 'SCHEDULED' : 'CANCELED';
      
      const apptRows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
      if (apptRows?.[0]) {
        await base44.entities.DealAppointments.update(apptRows[0].id, {
          walkthrough: { ...apptRows[0].walkthrough, status: newStatus, updatedByUserId: profile?.id, updatedAt: new Date().toISOString() }
        });
      }

      if (roomId) {
        const emoji = action === 'confirm' ? '✅' : '❌';
        const label = action === 'confirm' ? 'Confirmed' : 'Declined';
        const formatted = isValidDate ? dt.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'the proposed date';
        await base44.entities.Message.create({
          room_id: roomId, sender_profile_id: profile?.id,
          body: `${emoji} Walk-through ${label}\n\n${action === 'confirm' ? `See you on ${formatted}` : 'Please propose a different time.'}`,
          metadata: { type: 'walkthrough_response', walkthrough_datetime: apptData?.datetime, status: action === 'confirm' ? 'confirmed' : 'denied' }
        });

        // Update pending walkthrough_request messages
        const msgs = await base44.entities.Message.filter({ room_id: roomId });
        for (const m of msgs.filter(m => m.metadata?.type === 'walkthrough_request' && m.metadata?.status === 'pending')) {
          await base44.entities.Message.update(m.id, {
            metadata: { ...m.metadata, status: action === 'confirm' ? 'confirmed' : 'denied', responded_by: profile?.id, responded_at: new Date().toISOString() }
          });
        }
      }

      setApptData(prev => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Walk-through ${action === 'confirm' ? 'confirmed' : 'declined'}`);
    } catch (e) {
      toast.error("Failed to respond");
    } finally { setResponding(false); }
  };

  if (loadingAppt) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>
        <div className="text-center py-6"><Loader2 className="w-6 h-6 text-[#808080] mx-auto animate-spin" /></div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>

      {hasWalkthrough && isValidDate ? (
        <div className="space-y-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className={`w-4 h-4 ${apptStatus === 'SCHEDULED' ? 'text-[#10B981]' : apptStatus === 'CANCELED' ? 'text-red-400' : 'text-[#F59E0B]'}`} />
            <span className={`text-xs font-medium ${apptStatus === 'SCHEDULED' ? 'text-[#10B981]' : apptStatus === 'CANCELED' ? 'text-red-400' : 'text-[#F59E0B]'}`}>
              {apptStatus === 'SCHEDULED' ? 'Confirmed' : apptStatus === 'CANCELED' ? 'Declined' : apptStatus === 'COMPLETED' ? 'Completed' : 'Proposed — Awaiting Confirmation'}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
            <div className="w-10 h-10 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#E3C567]" />
            </div>
            <div>
              <p className="text-xs text-[#808080]">Date</p>
              <p className="text-sm font-medium text-[#FAFAFA]">
                {dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
            <div className="w-10 h-10 rounded-full bg-[#60A5FA]/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#60A5FA]" />
            </div>
            <div>
              <p className="text-xs text-[#808080]">Time</p>
              <p className="text-sm font-medium text-[#FAFAFA]">
                {dt.getHours() === 0 && dt.getMinutes() === 0 ? 'TBD' : dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Agent: confirm/deny (only after signing) */}
          {canAgentRespond && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleRespond('confirm')} disabled={responding} size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Confirm Walk-through
              </Button>
              <Button onClick={() => handleRespond('deny')} disabled={responding} size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs flex-1">
                {responding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                Decline
              </Button>
            </div>
          )}

          {/* Agent: hasn't signed yet */}
          {isAgent && !isSigned && apptStatus === 'PROPOSED' && (
            <p className="text-xs text-[#F59E0B] pt-2">Sign the agreement to accept or decline this walk-through.</p>
          )}

          {/* Investor: reschedule if declined */}
          {isInvestor && apptStatus === 'CANCELED' && (
            <div className="pt-3 border-t border-[#1F1F1F] mt-3">
              <p className="text-xs text-[#808080] mb-3">The agent declined. Propose a new date & time:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#808080] mb-1 block">Date</label>
                  <Input type="text" value={scheduleDate} onChange={e => setScheduleDate(autoFormatDate(e.target.value))} placeholder="MM/DD/YYYY" maxLength={10} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#808080] mb-1 block">Time</label>
                  <Input type="text" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} placeholder="00:00 AM/PM" className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] text-sm" />
                </div>
              </div>
              <Button onClick={handleSchedule} disabled={saving || !scheduleDate} className="mt-3 w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send New Request
              </Button>
            </div>
          )}
        </div>
      ) : hasWalkthrough && !isValidDate ? (
        <div className="text-center py-6">
          <Calendar className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
          <p className="text-sm text-[#F59E0B]">Walk-through scheduled — date pending</p>
        </div>
      ) : (
        /* No walkthrough — investor can schedule one */
        <div>
          {isInvestor ? (
            <div className="space-y-4">
              <p className="text-sm text-[#808080]">
                Select your preferred date and time. The agent will be notified and can confirm or suggest an alternative.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#808080] mb-1 block">Date</label>
                  <Input type="text" value={scheduleDate} onChange={e => setScheduleDate(autoFormatDate(e.target.value))} placeholder="MM/DD/YYYY" maxLength={10} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#808080] mb-1 block">Time</label>
                  <Input type="text" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} placeholder="00:00 AM/PM" className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] text-sm" />
                </div>
              </div>
              <Button onClick={handleSchedule} disabled={saving || !scheduleDate} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Request
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-[#808080] mx-auto mb-2" />
              <p className="text-sm text-[#808080]">No walk-through scheduled yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}