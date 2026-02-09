import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Plus, CheckCircle, Lock, Pen, Send, FileText } from "lucide-react";
import moment from "moment";

const ICON_MAP = {
  created: Plus,
  signed: Pen,
  locked: Lock,
  connected: CheckCircle,
  invite: Send,
  file: FileText,
  default: Clock,
};

export default function DealActivityTab({ dealId, roomId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId && !roomId) { setLoading(false); return; }
    buildTimeline();
  }, [dealId, roomId]);

  async function buildTimeline() {
    setLoading(true);
    const events = [];

    const [deals, rooms, agreements, invites] = await Promise.all([
      dealId ? base44.entities.Deal.filter({ id: dealId }) : Promise.resolve([]),
      roomId ? base44.entities.Room.filter({ id: roomId }) : Promise.resolve([]),
      (dealId || roomId) ? base44.entities.LegalAgreement.filter(
        roomId ? { room_id: roomId } : { deal_id: dealId }, '-created_date', 20
      ) : Promise.resolve([]),
      dealId ? base44.entities.DealInvite.filter({ deal_id: dealId }) : Promise.resolve([]),
    ]);

    const deal = deals?.[0];
    const room = rooms?.[0];

    // Deal created
    if (deal) {
      events.push({
        type: 'created',
        message: 'Deal submitted',
        date: deal.created_date,
      });
    }

    // Agents invited
    const inviteCount = (invites || []).length;
    if (inviteCount > 0) {
      const firstInvite = invites.reduce((a, b) =>
        new Date(a.created_at_iso || a.created_date) < new Date(b.created_at_iso || b.created_date) ? a : b
      );
      events.push({
        type: 'invite',
        message: `Sent to ${inviteCount} agent${inviteCount > 1 ? 's' : ''}`,
        date: firstInvite.created_at_iso || firstInvite.created_date,
      });
    }

    // Only show the latest active agreement's key events (skip voided/superseded)
    const activeAgreement = (agreements || []).find(
      a => !['voided', 'superseded'].includes(a.status)
    );

    if (activeAgreement) {
      if (activeAgreement.investor_signed_at) {
        events.push({
          type: 'signed',
          message: 'Investor signed agreement',
          date: activeAgreement.investor_signed_at,
        });
      }
      if (activeAgreement.agent_signed_at) {
        events.push({
          type: 'signed',
          message: 'Agent signed agreement',
          date: activeAgreement.agent_signed_at,
        });
      }
      if (activeAgreement.status === 'fully_signed') {
        events.push({
          type: 'connected',
          message: 'Both parties signed — deal connected!',
          date: activeAgreement.agent_signed_at || activeAgreement.updated_date,
        });
      }
    }

    // Files uploaded to room
    const fileCount = (room?.files || []).length;
    if (fileCount > 0) {
      const lastFile = room.files[room.files.length - 1];
      events.push({
        type: 'file',
        message: `${fileCount} file${fileCount > 1 ? 's' : ''} uploaded`,
        date: lastFile.uploaded_at || room.updated_date,
      });
    }

    // Sort newest first (reverse chronological order)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    const seen = new Set();
    const deduped = events.filter(e => {
      if (!e.date) return false;
      const key = `${e.message}|${moment(e.date).format('YYYY-MM-DD HH:mm')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setTimeline(deduped);
    setLoading(false);
  }

  if (loading) return <div className="text-center py-12 text-[#808080]">Loading...</div>;

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Activity</h4>
      {timeline.length === 0 ? (
        <p className="text-sm text-[#808080] text-center py-8">No activity yet</p>
      ) : (
        <div className="space-y-3">
          {timeline.map((e, i) => {
            const Icon = ICON_MAP[e.type] || ICON_MAP.default;
            const isHighlight = e.type === 'signed' || e.type === 'connected';
            return (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  e.type === 'connected' ? 'bg-[#10B981]/20' :
                  isHighlight ? 'bg-[#E3C567]/15' : 'bg-[#141414] border border-[#1F1F1F]'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    e.type === 'connected' ? 'text-[#10B981]' :
                    isHighlight ? 'text-[#E3C567]' : 'text-[#808080]'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${
                    e.type === 'connected' ? 'text-[#10B981] font-medium' :
                    isHighlight ? 'text-[#E3C567] font-medium' : 'text-[#FAFAFA]'
                  }`}>{e.message}</p>
                  <p className="text-xs text-[#808080]">{moment(e.date).format('MMM D, YYYY · h:mm A')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}