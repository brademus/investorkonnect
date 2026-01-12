import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Clock, MapPin, Edit, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import AgentScheduleModal from './AgentScheduleModal';
import MarkCompleteModal from './MarkCompleteModal';
import RescheduleModal from './RescheduleModal';

function StatusPill({ status }) {
  const map = {
    NOT_SET: 'bg-[#1F1F1F] text-[#808080] border-[#333]'
    , PROPOSED: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
    , SCHEDULED: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30'
    , COMPLETED: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
    , CANCELED: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || map.NOT_SET}`}>
      {status?.replace('_',' ') || 'NOT SET'}
    </span>
  );
}

function EventCard({ label, data, role, onPrimary, onSecondary, onInvestorRequest }) {
  const hasDate = !!data?.datetime;
  const dateStr = hasDate ? new Date(data.datetime).toLocaleString() : '—';
  const loc = data?.locationType === 'ON_SITE' ? 'On-site' : (data?.locationType === 'VIRTUAL' ? 'Virtual' : '—');

  const primaryLabel = useMemo(() => {
    if (role === 'agent') {
      if (data?.status === 'SCHEDULED') return 'Mark Completed';
      if (data?.status === 'COMPLETED' || data?.status === 'CANCELED') return `Edit ${label}`;
      return `Schedule ${label}`;
    } else {
      if (['NOT_SET','PROPOSED','SCHEDULED'].includes(data?.status || 'NOT_SET')) return 'Request Reschedule';
      return 'View Details';
    }
  }, [role, data?.status, label]);

  return (
    <div className="p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
      <div className="flex items-start justify-between mb-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#FAFAFA]">{label}</p>
          <div className="flex items-center gap-2 text-xs text-[#808080]">
            <CalendarIcon className="w-3.5 h-3.5" /> <span>{dateStr}</span>
            {data?.timezone && (<span className="ml-1">({data.timezone})</span>)}
            <span className="text-[#333]">|</span>
            <Clock className="w-3.5 h-3.5" /> <span>{hasDate ? new Date(data.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <span className="text-[#333]">|</span>
            <MapPin className="w-3.5 h-3.5" /> <span>{loc}</span>
          </div>
          {data?.notes && (
            <p className="text-xs text-[#FAFAFA] line-clamp-2 max-w-prose">{data.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={data?.status || 'NOT_SET'} />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {role === 'agent' ? (
          <>
            <Button size="sm" className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs" onClick={onPrimary}>{primaryLabel}</Button>
            <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onSecondary}><Edit className="w-3 h-3 mr-1"/>Edit</Button>
          </>
        ) : (
          <>
            <Button size="sm" className="bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] rounded-full text-xs" onClick={onInvestorRequest}>{primaryLabel}</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DealAppointmentsCard({ dealId, userRole }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [opening, setOpening] = useState({ type: null, mode: null });
  const [showAll, setShowAll] = useState(false);
  const [requests, setRequests] = useState([]);

  const load = async () => {
    if (!dealId) return;
    setLoading(true);
    setError('');
    try {
      const [a, r] = await Promise.all([
        base44.functions.invoke('getDealAppointments', { dealId }),
        base44.functions.invoke('listRescheduleRequests', { dealId })
      ]);
      if (a.status === 200) setData(a.data);
      if (r.status === 200) setRequests(r.data?.items || []);
    } catch (e) {
      setError('Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dealId]);

  const onCloseModal = (changed) => {
    setOpening({ type: null, mode: null });
    if (changed) load();
  };

  const topRequests = useMemo(() => (showAll ? requests : requests.slice(0,3)), [showAll, requests]);

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-[#FAFAFA]">Appointments & Walkthroughs</h4>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-[#808080]" />}
      </div>

      {error ? (
        <p className="text-sm text-[#EF4444]">{error}</p>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 bg-[#141414] border border-[#1F1F1F] rounded-xl animate-pulse" />
          <div className="h-28 bg-[#141414] border border-[#1F1F1F] rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <EventCard
              label="Walkthrough"
              data={data?.walkthrough || {}}
              role={userRole}
              onPrimary={() => {
                if (userRole === 'agent') {
                  if (data?.walkthrough?.status === 'SCHEDULED') setOpening({ type: 'WALKTHROUGH', mode: 'complete' });
                  else setOpening({ type: 'WALKTHROUGH', mode: 'schedule' });
                }
              }}
              onSecondary={() => setOpening({ type: 'WALKTHROUGH', mode: 'schedule' })}
              onInvestorRequest={() => setOpening({ type: 'WALKTHROUGH', mode: 'reschedule' })}
            />
            <EventCard
              label="Inspection"
              data={data?.inspection || {}}
              role={userRole}
              onPrimary={() => {
                if (userRole === 'agent') {
                  if (data?.inspection?.status === 'SCHEDULED') setOpening({ type: 'INSPECTION', mode: 'complete' });
                  else setOpening({ type: 'INSPECTION', mode: 'schedule' });
                }
              }}
              onSecondary={() => setOpening({ type: 'INSPECTION', mode: 'schedule' })}
              onInvestorRequest={() => setOpening({ type: 'INSPECTION', mode: 'reschedule' })}
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-[#FAFAFA]">Reschedule Requests</h5>
              {requests.length > 3 && (
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => setShowAll(s => !s)}>
                  {showAll ? (<><ChevronUp className="w-3 h-3 mr-1"/>Collapse</>) : (<><ChevronDown className="w-3 h-3 mr-1"/>View all</>)}
                </Button>
              )}
            </div>
            {requests.length === 0 ? (
              <p className="text-xs text-[#808080]">No reschedule requests yet.</p>
            ) : (
              <div className="space-y-2">
                {topRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-[#808080]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{r.eventType}</span>
                        <span className="text-[#333]">|</span>
                        <span>{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] bg-[#1F1F1F] text-[#808080] px-2 py-0.5 rounded-full border border-[#333]">by {r.requestedByUserId}</span>
                    </div>
                    <p className="text-xs text-[#FAFAFA] mt-1 line-clamp-2">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {opening.mode === 'schedule' && (
        <AgentScheduleModal
          open
          onClose={onCloseModal}
          dealId={dealId}
          eventType={opening.type}
          initial={opening.type === 'WALKTHROUGH' ? data?.walkthrough : data?.inspection}
        />
      )}
      {opening.mode === 'complete' && (
        <MarkCompleteModal
          open
          onClose={onCloseModal}
          dealId={dealId}
          eventType={opening.type}
          current={opening.type === 'WALKTHROUGH' ? data?.walkthrough : data?.inspection}
        />
      )}
      {opening.mode === 'reschedule' && (
        <RescheduleModal
          open
          onClose={(changed) => { onCloseModal(changed); }}
          dealId={dealId}
          eventType={opening.type}
        />
      )}
    </div>
  );
}