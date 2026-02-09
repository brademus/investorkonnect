import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock } from "lucide-react";
import moment from "moment";

export default function DealActivityTab({ dealId, roomId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId && !roomId) { setLoading(false); return; }
    const load = async () => {
      const query = dealId ? { deal_id: dealId } : { room_id: roomId };
      const data = await base44.entities.Activity.filter(query, '-created_date', 50);
      setActivities(data || []);
      setLoading(false);
    };
    load();
  }, [dealId, roomId]);

  if (loading) return <div className="text-center py-12 text-[#808080]">Loading activity...</div>;

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Activity</h4>
      {activities.length === 0 ? (
        <p className="text-sm text-[#808080] text-center py-8">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
              <Clock className="w-4 h-4 text-[#E3C567] mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#FAFAFA]">{a.message}</p>
                <p className="text-xs text-[#808080] mt-1">
                  {a.actor_name && <span className="text-[#E3C567]">{a.actor_name}</span>}
                  {a.actor_name && ' · '}
                  {moment(a.created_date).fromNow()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}