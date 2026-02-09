import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WalkthroughScheduleModal({ open, onOpenChange, deal, roomId, profile, onScheduled }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!date) { toast.error("Please enter a date"); return; }
    setSaving(true);
    try {
      const isoDatetime = new Date(date + ' ' + (time || '12:00 PM')).toISOString();

      // Update the deal
      await base44.entities.Deal.update(deal.id, {
        walkthrough_scheduled: true,
        walkthrough_datetime: isoDatetime
      });

      // Upsert DealAppointments so the Appointments tab stays in sync
      try {
        const apptRows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
        const apptPatch = {
          walkthrough: {
            status: 'PROPOSED',
            datetime: isoDatetime,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locationType: 'ON_SITE',
            notes: null,
            updatedByUserId: profile?.id || null,
            updatedAt: new Date().toISOString()
          }
        };
        if (apptRows?.[0]) {
          await base44.entities.DealAppointments.update(apptRows[0].id, apptPatch);
        } else {
          await base44.entities.DealAppointments.create({
            dealId: deal.id,
            ...apptPatch,
            inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
            rescheduleRequests: []
          });
        }
      } catch (e) {
        console.warn('[WalkthroughScheduleModal] Failed to upsert DealAppointments:', e);
      }

      // Send a system-style message to the room so the agent sees it
      const formatted = new Date(date + ' ' + (time || '12:00 PM')).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile?.id,
        body: `📅 Walk-through Requested\n\nProposed Date & Time: ${formatted}\n\nPlease confirm or suggest a different time.`,
        metadata: {
          type: 'walkthrough_request',
          walkthrough_datetime: isoDatetime,
          status: 'pending'
        }
      });

      toast.success("Walk-through request sent!");
      onScheduled?.({ walkthrough_scheduled: true, walkthrough_datetime: isoDatetime });
      onOpenChange(false);
      setDate("");
      setTime("");
    } catch (e) {
      toast.error("Failed to schedule walk-through");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border border-[#1F1F1F] text-[#FAFAFA] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#E3C567] flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Walk-through
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-[#808080]">
            Select your preferred date and time. The agent will be notified and can confirm or suggest an alternative.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#808080] mb-1 block">Date</label>
              <Input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="MM/DD/YYYY"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
            <div>
              <label className="text-xs text-[#808080] mb-1 block">Time</label>
              <Input
                type="text"
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="00:00 AM/PM"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1 border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !date}
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}