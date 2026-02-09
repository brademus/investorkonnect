import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WalkthroughPanel({ deal, roomId }) {
  // Primary source: Deal entity walkthrough fields
  const dealHasWalkthrough = deal?.walkthrough_scheduled === true;
  const dealDt = deal?.walkthrough_datetime ? new Date(deal.walkthrough_datetime) : null;
  const dealDateValid = dealDt && !isNaN(dealDt.getTime());

  // Secondary source: confirmed walkthrough messages in chat
  const [msgWalkthrough, setMsgWalkthrough] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dealHasWalkthrough && dealDateValid) return; // already have good data from deal
    if (!roomId) return;
    setLoading(true);
    (async () => {
      try {
        const msgs = await base44.entities.Message.filter({ room_id: roomId }, "-created_date", 200);
        const confirmed = msgs.find(m =>
          m?.metadata?.type === 'walkthrough' && m?.metadata?.status === 'confirmed' && m?.metadata?.walkthrough_datetime
        );
        if (confirmed) {
          setMsgWalkthrough({
            datetime: confirmed.metadata.walkthrough_datetime,
            status: confirmed.metadata.status
          });
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, [roomId, dealHasWalkthrough, dealDateValid]);

  // Merge: prefer deal entity, fall back to confirmed message
  const hasWalkthrough = dealHasWalkthrough || !!msgWalkthrough;
  const dt = dealDateValid ? dealDt : (msgWalkthrough?.datetime ? new Date(msgWalkthrough.datetime) : null);
  const isValidDate = dt && !isNaN(dt.getTime());

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
            <span className="text-xs font-medium text-[#10B981]">Confirmed</span>
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