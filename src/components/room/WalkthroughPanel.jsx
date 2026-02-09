import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WalkthroughPanel({ deal }) {
  const [apptData, setApptData] = useState(null);
  const [loadingAppt, setLoadingAppt] = useState(false);

  // Fetch DealAppointments AND re-check Deal entity as authoritative sources
  useEffect(() => {
    if (!deal?.id) return;
    setLoadingAppt(true);
    (async () => {
      try {
        // Fetch DealAppointments
        const rows = await base44.entities.DealAppointments.filter({ dealId: deal.id });
        if (rows?.[0]?.walkthrough && rows[0].walkthrough.status !== 'NOT_SET') {
          setApptData(rows[0].walkthrough);
        } else {
          // No DealAppointments — check Deal entity directly for walkthrough fields
          // (the deal prop may come from getDealDetailsForUser which has the correct data)
          const dealRows = await base44.entities.Deal.filter({ id: deal.id });
          const liveDeal = dealRows?.[0];
          if (liveDeal?.walkthrough_scheduled === true && liveDeal?.walkthrough_datetime) {
            // Create a synthetic appt-like object from deal fields
            setApptData({
              status: 'PROPOSED',
              datetime: liveDeal.walkthrough_datetime,
              timezone: null,
              locationType: 'ON_SITE',
              notes: null
            });
          }
        }
      } catch (e) {
        console.warn('[WalkthroughPanel] Failed to load walkthrough data:', e);
      } finally {
        setLoadingAppt(false);
      }
    })();
  }, [deal?.id, deal?.walkthrough_scheduled, deal?.walkthrough_datetime]);

  // Subscribe to real-time DealAppointments updates
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.DealAppointments.subscribe((event) => {
      if (event?.data?.dealId === deal.id && event.data.walkthrough) {
        setApptData(event.data.walkthrough);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // Subscribe to real-time Deal updates for walkthrough fields
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.Deal.subscribe((event) => {
      if (event?.data?.id === deal.id && event.data.walkthrough_scheduled === true && event.data.walkthrough_datetime) {
        setApptData({
          status: 'PROPOSED',
          datetime: event.data.walkthrough_datetime,
          timezone: null,
          locationType: 'ON_SITE',
          notes: null
        });
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // Use DealAppointments/apptData first, fallback to deal entity fields passed as props
  const apptDatetime = apptData?.datetime;
  const apptStatus = apptData?.status;
  const hasWalkthroughFromAppt = apptStatus && apptStatus !== 'NOT_SET' && apptStatus !== 'CANCELED';
  const wtSched = deal?.walkthrough_scheduled;
  const hasWalkthroughFromDeal = (wtSched === true || wtSched === 'true') && deal?.walkthrough_datetime;
  const hasWalkthrough = hasWalkthroughFromAppt || hasWalkthroughFromDeal;

  const rawDatetime = apptDatetime || deal?.walkthrough_datetime;
  const dt = rawDatetime ? new Date(rawDatetime) : null;
  const isValidDate = dt && !isNaN(dt.getTime());

  if (loadingAppt) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 text-[#808080] mx-auto animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Walk-through</h4>

      {!hasWalkthrough ? (
        <div className="text-center py-6">
          <Calendar className="w-8 h-8 text-[#808080] mx-auto mb-2" />
          <p className="text-sm text-[#808080]">No walk-through scheduled</p>
        </div>
      ) : !isValidDate ? (
        <div className="text-center py-6">
          <Calendar className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
          <p className="text-sm text-[#F59E0B]">Walk-through scheduled — date pending</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs font-medium text-[#10B981]">
              {apptStatus === 'COMPLETED' ? 'Completed' : apptStatus === 'SCHEDULED' ? 'Scheduled' : 'Proposed'}
            </span>
          </div>

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

          <div className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-[#1F1F1F]">
            <div className="w-10 h-10 rounded-full bg-[#60A5FA]/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#60A5FA]" />
            </div>
            <div>
              <p className="text-xs text-[#808080]">Time</p>
              <p className="text-sm font-medium text-[#FAFAFA]">
                {dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}