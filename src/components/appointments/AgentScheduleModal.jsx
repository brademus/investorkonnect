import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

const STATUSES = ['NOT_SET','PROPOSED','SCHEDULED','CANCELED'];

export default function AgentScheduleModal({ open, onClose, dealId, eventType, initial }) {
  const [datetime, setDatetime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locationType, setLocationType] = useState('');
  const [status, setStatus] = useState('NOT_SET');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(initial?.timezone || tz || '');
    setDatetime(initial?.datetime ? initial.datetime.slice(0,16) : '');
    setLocationType(initial?.locationType || '');
    setStatus(initial?.status || 'NOT_SET');
    setNotes(initial?.notes || '');
  }, [open, initial]);

  const save = async () => {
    if (!dealId) return;
    setSaving(true);
    try {
      const patch = {
        status,
        datetime: datetime ? new Date(datetime).toISOString() : null,
        timezone: timezone || null,
        locationType: locationType || null,
        notes: notes || null,
      };
      const res = await base44.functions.invoke('upsertDealAppointment', { dealId, eventType, patch });
      if (res.status === 200 && !res.data?.error) onClose(true);
      else onClose(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
        <DialogHeader>
          <DialogTitle>Schedule / Edit {eventType === 'WALKTHROUGH' ? 'Walkthrough' : 'Inspection'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-[#FAFAFA] mb-1 block">Date & Time</label>
            <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="bg-[#141414] border-[#1F1F1F]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[#FAFAFA] mb-1 block">Timezone</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/Chicago" className="bg-[#141414] border-[#1F1F1F]" />
            </div>
            <div>
              <label className="text-sm text-[#FAFAFA] mb-1 block">Location</label>
              <Select value={locationType || ''} onValueChange={setLocationType}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_SITE">On-site</SelectItem>
                  <SelectItem value="VIRTUAL">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm text-[#FAFAFA] mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-[#141414] border-[#1F1F1F]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (<SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-[#FAFAFA] mb-1 block">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-[#141414] border-[#1F1F1F] min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}