import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

export default function RescheduleModal({ open, onClose, dealId, eventType }) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('createRescheduleRequest', { dealId, eventType, message });
      if (res.status === 200 && !res.data?.error) onClose(true);
      else onClose(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
        <DialogHeader>
          <DialogTitle>Request Reschedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-[#808080]">What needs to change / your availability</p>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="bg-[#141414] border-[#1F1F1F] min-h-[100px]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} className="rounded-full">Cancel</Button>
          <Button onClick={submit} disabled={saving || !message.trim()} className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">{saving ? 'Sending...' : 'Send Request'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}