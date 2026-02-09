import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

export default function WalkthroughInlineScheduler({ deal, roomId, profile, onScheduled, onCancel }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!date.trim()) { toast.error("Please enter a date"); return; }
    if (!time.trim()) { toast.error("Please enter a time"); return; }
    setSaving(true);
    try {
      const isoDatetime = new Date(date + ' ' + time).toISOString();

      await base44.entities.Deal.update(deal.id, {
        walkthrough_scheduled: true,
        walkthrough_datetime: isoDatetime
      });

      const formatted = new Date(date + ' ' + time).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
      await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile?.id,
        body: `📅 Walk-through Requested\n\nProposed Date & Time: ${formatted}\n\nPlease confirm or suggest a different time.`,
        metadata: { type: 'walkthrough_request', walkthrough_datetime: isoDatetime, status: 'pending' }
      });

      toast.success("Walk-through request sent!");
      onScheduled?.({ walkthrough_scheduled: true, walkthrough_datetime: isoDatetime });
    } catch (e) {
      toast.error("Failed to schedule walk-through");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <Input
        type="text"
        value={date}
        onChange={e => setDate(e.target.value)}
        placeholder="MM/DD/YYYY"
        className="h-8 w-28 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] rounded-full px-3"
      />
      <Input
        type="text"
        value={time}
        onChange={e => setTime(e.target.value)}
        placeholder="00:00 AM/PM"
        className="h-8 w-28 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] rounded-full px-3"
      />
      <Button
        onClick={handleSubmit}
        disabled={saving || !date.trim() || !time.trim()}
        size="sm"
        className="h-8 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs px-3"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      </Button>
      <button onClick={onCancel} className="text-[#808080] hover:text-[#FAFAFA] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}