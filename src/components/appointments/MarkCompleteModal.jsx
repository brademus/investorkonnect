import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

export default function MarkCompleteModal({ open, onClose, dealId, eventType, current }) {
  const [notes, setNotes] = useState(current?.notes || '');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      const patch = { status: 'COMPLETED', notes: notes || null };
      const res = await base44.functions.invoke('upsertDealAppointment', { dealId, eventType, patch });
      if (res.status === 200 && !res.data?.error) onClose(true);
      else onClose(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
        <DialogHeader>
          <DialogTitle>Mark {eventType === 'WALKTHROUGH' ? 'Walkthrough' : 'Inspection'} as Completed?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-[#808080]">Optionally add a note for the record.</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-[#141414] border-[#1F1F1F] min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} className="rounded-full">Cancel</Button>
          <Button onClick={confirm} disabled={saving} className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">{saving ? 'Saving...' : 'Confirm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}