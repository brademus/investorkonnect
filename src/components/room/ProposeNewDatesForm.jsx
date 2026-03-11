import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIME_OPTIONS = (() => {
  const times = [];
  for (let h = 6; h <= 12; h++) times.push(`${h.toString().padStart(2, '0')}:00AM`);
  for (let h = 1; h <= 9; h++) times.push(`${h.toString().padStart(2, '0')}:00PM`);
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

/**
 * Reusable form for proposing up to 3 walkthrough date/time slots.
 * Used by both WalkthroughPanel (agent propose) and InlineWalkthroughStatus (agent propose).
 */
export default function ProposeNewDatesForm({ dealId, roomId, profileId, onProposed, onCancel, compact = false }) {
  const [slots, setSlots] = useState([{ date: "", timeStart: "", timeEnd: "" }]);
  const [proposing, setProposing] = useState(false);

  const updateSlot = (idx, field, value) => {
    const updated = [...slots];
    updated[idx] = { ...updated[idx], [field]: value };
    setSlots(updated);
  };

  const removeSlot = (idx) => setSlots(slots.filter((_, i) => i !== idx));
  const addSlot = () => setSlots([...slots, { date: "", timeStart: "", timeEnd: "" }]);

  const handleSubmit = async () => {
    const firstSlot = slots[0];
    if (!firstSlot?.date || firstSlot.date.length < 8) {
      toast.error("Please enter a date for at least the first option");
      return;
    }
    setProposing(true);
    try {
      const validSlots = slots.filter(s => s.date && s.date.length >= 8);
      const displayText = formatSlotsForDisplay(validSlots);

      // 1. Update deal entity with new proposed slots
      await base44.entities.Deal.update(dealId, {
        walkthrough_scheduled: true,
        walkthrough_date: firstSlot.date,
        walkthrough_time: firstSlot.timeStart || null,
        walkthrough_slots: validSlots,
      });

      // 2. Reset DealAppointments to PROPOSED
      const apptRows = await base44.entities.DealAppointments.filter({ dealId });
      const apptPatch = {
        walkthrough: {
          status: 'PROPOSED',
          datetime: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locationType: 'ON_SITE',
          notes: null,
          updatedByUserId: profileId,
          updatedAt: new Date().toISOString()
        }
      };
      if (apptRows?.[0]) {
        await base44.entities.DealAppointments.update(apptRows[0].id, apptPatch);
      } else {
        await base44.entities.DealAppointments.create({
          dealId,
          ...apptPatch,
          inspection: { status: 'NOT_SET' },
          rescheduleRequests: []
        });
      }

      // 3. Mark all previous walkthrough_request messages as superseded
      try {
        const oldMsgs = await base44.entities.Message.filter({ room_id: roomId });
        const oldWtMsgs = (oldMsgs || []).filter(m => m.metadata?.type === 'walkthrough_request' && m.metadata?.status === 'pending');
        await Promise.all(oldWtMsgs.map(m =>
          base44.entities.Message.update(m.id, { metadata: { ...m.metadata, status: 'superseded' } })
        ));
      } catch (_) {}

      // 4. Send walkthrough_request message with new slots
      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profileId,
        body: `📅 New Walk-through Dates Proposed\n\n${displayText}\n\nPlease confirm or suggest a different time.`,
        metadata: {
          type: 'walkthrough_request',
          walkthrough_date: firstSlot.date,
          walkthrough_time: firstSlot.timeStart || null,
          walkthrough_slots: validSlots,
          status: 'pending'
        }
      });

      toast.success("New dates proposed!");
      onProposed?.({
        walkthrough_scheduled: true,
        walkthrough_date: firstSlot.date,
        walkthrough_time: firstSlot.timeStart || null,
        walkthrough_slots: validSlots,
      });
      setSlots([{ date: "", timeStart: "", timeEnd: "" }]);
    } catch (e) {
      toast.error("Failed to propose new dates");
    } finally {
      setProposing(false);
    }
  };

  const inputSize = compact ? "h-7 text-xs" : "h-8 text-xs";

  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-3 space-y-3">
      <p className="text-xs text-[#808080]">Propose up to 3 date/time options:</p>

      {slots.map((slot, idx) => (
        <div key={idx} className="space-y-1.5">
          {slots.length > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#E3C567]">Option {idx + 1}</span>
              <button type="button" onClick={() => removeSlot(idx)} className="text-[#808080] hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-[#808080] mb-0.5">Date</label>
              <Input
                type="text"
                value={slot.date}
                onChange={(e) => updateSlot(idx, "date", autoFormatDate(e.target.value))}
                placeholder="MM/DD/YYYY"
                maxLength={10}
                className={`bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] ${inputSize}`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#808080] mb-0.5">Start</label>
              <Select value={slot.timeStart} onValueChange={(v) => updateSlot(idx, "timeStart", v)}>
                <SelectTrigger className={`bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA] ${inputSize}`}>
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                  {TIME_OPTIONS.map(t => (
                    <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black text-xs" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] text-[#808080] mb-0.5">End</label>
              <Select value={slot.timeEnd} onValueChange={(v) => updateSlot(idx, "timeEnd", v)}>
                <SelectTrigger className={`bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA] ${inputSize}`}>
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[#141414] border-[#1F1F1F]">
                  {TIME_OPTIONS.map(t => (
                    <SelectItem className="text-[#FAFAFA] focus:bg-[#E3C567] focus:text-black text-xs" key={t} value={t}>{t.replace(/(AM|PM)/, ' $1')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      {slots.length < 3 && (
        <button type="button" onClick={addSlot} className="flex items-center gap-1.5 text-xs text-[#E3C567] hover:text-[#EDD89F] transition-colors">
          <Plus className="w-3 h-3" />
          Add option ({3 - slots.length} remaining)
        </button>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={proposing || !slots[0]?.date || slots[0].date.length < 8}
          onClick={handleSubmit}
          className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs h-7"
        >
          {proposing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Send Proposal
        </Button>
        <button onClick={onCancel} className="text-xs text-[#808080] hover:text-[#FAFAFA]">Cancel</button>
      </div>
    </div>
  );
}