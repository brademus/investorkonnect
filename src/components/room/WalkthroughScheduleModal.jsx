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

/**
 * Modal for scheduling a walkthrough from within the Room/DealBoard.
 * Saves slots to Deal.walkthrough_slots and sends a chat message.
 */
export default function WalkthroughScheduleModal({ open, onOpenChange, deal, roomId, profile, onScheduled }) {
  const [slots, setSlots] = useState([{ date: "", timeStart: "", timeEnd: "" }]);
  const [saving, setSaving] = useState(false);

  const updateSlot = (idx, field, value) => {
    const updated = [...slots];
    updated[idx] = { ...updated[idx], [field]: value };
    setSlots(updated);
  };

  const handleSubmit = async () => {
    const validSlots = slots.filter(s => s.date && s.date.length >= 8);
    if (validSlots.length === 0) {
      toast.error("Please enter at least one complete date (MM/DD/YYYY)");
      return;
    }
    setSaving(true);
    try {
      // 1. Save slots on Deal
      await base44.entities.Deal.update(deal.id, {
        walkthrough_slots: validSlots,
        walkthrough_confirmed_slot: null,
      });

      // 2. Send chat message
      const displayText = validSlots.map((s, i) => {
        let text = s.date;
        if (s.timeStart) text += ` ${s.timeStart.replace(/(AM|PM)/, ' $1')}`;
        if (s.timeEnd) text += ` – ${s.timeEnd.replace(/(AM|PM)/, ' $1')}`;
        return `Option ${i + 1}: ${text}`;
      }).join('\n');

      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile?.id,
        body: `📅 Walk-through Requested\n\n${displayText}\n\nPlease confirm or suggest a different time.`,
        metadata: {
          type: 'walkthrough_request',
          walkthrough_slots: validSlots,
          status: 'pending'
        }
      });

      toast.success("Walk-through request sent!");
      onScheduled?.({ walkthrough_slots: validSlots, walkthrough_confirmed_slot: null });
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
            Propose up to 3 date/time windows. The agent can confirm after signing.
          </p>

          {slots.map((slot, idx) => (
            <div key={idx} className="space-y-2">
              {slots.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#E3C567]">Option {idx + 1}</span>
                  <button type="button" onClick={() => setSlots(slots.filter((_, i) => i !== idx))} className="text-[#808080] hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#808080] mb-1">Date</label>
                  <Input
                    type="text" value={slot.date}
                    onChange={(e) => updateSlot(idx, "date", autoFormatDate(e.target.value))}
                    placeholder="MM/DD/YYYY" maxLength={10}
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#808080] mb-1">Start Time</label>
                  <Select value={slot.timeStart} onValueChange={(v) => updateSlot(idx, "timeStart", v)}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="Start" /></SelectTrigger>
                    <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                      {TIME_OPTIONS.map(t => <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-[#808080] mb-1">End Time</label>
                  <Select value={slot.timeEnd} onValueChange={(v) => updateSlot(idx, "timeEnd", v)}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="End" /></SelectTrigger>
                    <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                      {TIME_OPTIONS.map(t => <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          {slots.length < 3 && (
            <button type="button" onClick={() => setSlots([...slots, { date: "", timeStart: "", timeEnd: "" }])} className="flex items-center gap-2 text-sm text-[#E3C567] hover:text-[#EDD89F]">
              <Plus className="w-4 h-4" />
              Add another date option ({3 - slots.length} remaining)
            </button>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1 border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] rounded-full">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !slots[0]?.date} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}