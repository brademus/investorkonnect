import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const TIME_OPTIONS = (() => {
  const times = [];
  for (let h = 6; h <= 12; h++) times.push(`${h.toString().padStart(2,'0')}:00AM`);
  for (let h = 1; h <= 9; h++) times.push(`${h.toString().padStart(2,'0')}:00PM`);
  return times;
})();

const autoFormatDate = (value) => {
  const raw = value.replace(/\D/g, '').slice(0, 8);
  let formatted = '';
  for (let i = 0; i < raw.length; i++) {
    if (i === 2 || i === 4) formatted += '/';
    formatted += raw[i];
  }
  return formatted;
};

function formatSlotsForDisplay(slots) {
  return slots.filter(s => s.date).map((s, i) => {
    let text = s.date;
    if (s.timeStart) text += ` ${s.timeStart.replace(/(AM|PM)/, ' $1')}`;
    if (s.timeEnd) text += ` – ${s.timeEnd.replace(/(AM|PM)/, ' $1')}`;
    return `Option ${i + 1}: ${text}`;
  }).join('\n');
}

export default function WalkthroughScheduleModal({ open, onOpenChange, deal, roomId, profile, onScheduled }) {
  const [slots, setSlots] = useState([{ date: "", timeStart: "", timeEnd: "" }]);
  const [saving, setSaving] = useState(false);

  const updateSlot = (idx, field, value) => {
    const updated = [...slots];
    updated[idx] = { ...updated[idx], [field]: value };
    setSlots(updated);
  };

  const removeSlot = (idx) => setSlots(slots.filter((_, i) => i !== idx));
  const addSlot = () => setSlots([...slots, { date: "", timeStart: "", timeEnd: "" }]);

  const handleSubmit = async () => {
    const firstSlot = slots[0];
    if (!firstSlot?.date || firstSlot.date.length < 10) {
      toast.error("Please enter a complete date (MM/DD/YYYY) for at least the first option");
      return;
    }
    setSaving(true);
    try {
      const validSlots = slots.filter(s => s.date && s.date.length >= 8);
      const displayText = formatSlotsForDisplay(validSlots);

      // 1. Update deal entity
      await base44.entities.Deal.update(deal.id, {
        walkthrough_scheduled: true,
        walkthrough_date: firstSlot.date,
        walkthrough_time: firstSlot.timeStart || null,
        walkthrough_slots: validSlots,
      });

      // 2. Upsert DealAppointments
      try {
        const apptRows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
        const apptPatch = {
          walkthrough: {
            status: 'PROPOSED',
            datetime: null,
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

      // 3. Send walkthrough_request message with all slots in metadata
      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile?.id,
        body: `📅 Walk-through Requested\n\n${displayText}\n\nPlease confirm or suggest a different time.`,
        metadata: {
          type: 'walkthrough_request',
          walkthrough_date: firstSlot.date,
          walkthrough_time: firstSlot.timeStart || null,
          walkthrough_slots: validSlots,
          status: 'pending'
        }
      });

      toast.success("Walk-through request sent!");
      onScheduled?.({ walkthrough_scheduled: true, walkthrough_date: firstSlot.date, walkthrough_time: firstSlot.timeStart || null, walkthrough_slots: validSlots });
      onOpenChange(false);
      setSlots([{ date: "", timeStart: "", timeEnd: "" }]);
    } catch (e) {
      toast.error("Failed to schedule walk-through");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border border-[#1F1F1F] text-[#FAFAFA] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#E3C567] flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Walk-through
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-[#808080]">
            Propose up to 3 date/time windows. The agent will be notified and can confirm or suggest alternatives.
          </p>

          {slots.map((slot, idx) => (
            <div key={idx} className="space-y-2">
              {slots.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#E3C567]">Option {idx + 1}</span>
                  <button type="button" onClick={() => removeSlot(idx)} className="text-[#808080] hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#808080] mb-1">Date</label>
                  <Input
                    type="text"
                    value={slot.date}
                    onChange={(e) => updateSlot(idx, "date", autoFormatDate(e.target.value))}
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#808080] mb-1">Start Time</label>
                  <Select value={slot.timeStart} onValueChange={(v) => updateSlot(idx, "timeStart", v)}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                      {TIME_OPTIONS.map(t => (
                        <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-[#808080] mb-1">End Time</label>
                  <Select value={slot.timeEnd} onValueChange={(v) => updateSlot(idx, "timeEnd", v)}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                      {TIME_OPTIONS.map(t => (
                        <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {slot.timeStart && slot.timeEnd && (
                <p className="text-xs text-[#808080]">
                  Window: {slot.timeStart.replace(/(AM|PM)/, ' $1')} – {slot.timeEnd.replace(/(AM|PM)/, ' $1')}
                </p>
              )}
            </div>
          ))}

          {slots.length < 3 && (
            <button type="button" onClick={addSlot} className="flex items-center gap-2 text-sm text-[#E3C567] hover:text-[#EDD89F] transition-colors">
              <Plus className="w-4 h-4" />
              Add another date option ({3 - slots.length} remaining)
            </button>
          )}

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
              disabled={saving || !slots[0]?.date}
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