import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Clock, Plus, Lock, ArrowRight, Pen, FileText,
  MessageSquare, Image, Shield, UserCheck, UserX, Send
} from "lucide-react";
import moment from "moment";

const ICON_MAP = {
  created: Plus,
  signed: Pen,
  locked: Lock,
  stage: ArrowRight,
  agreement: Shield,
  message: MessageSquare,
  photo: Image,
  file: FileText,
  invite: Send,
  agent_action: UserCheck,
  voided: UserX,
  default: Clock,
};

function stageLabel(stage) {
  if (!stage) return 'Unknown';
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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

    // Fetch all relevant data in parallel
    const [deals, rooms, agreements, invites, activities, messages] = await Promise.all([
      dealId ? base44.entities.Deal.filter({ id: dealId }) : Promise.resolve([]),
      roomId ? base44.entities.Room.filter({ id: roomId }) : Promise.resolve([]),
      (dealId || roomId) ? base44.entities.LegalAgreement.filter(
        roomId ? { room_id: roomId } : { deal_id: dealId }, '-created_date', 20
      ) : Promise.resolve([]),
      dealId ? base44.entities.DealInvite.filter({ deal_id: dealId }) : Promise.resolve([]),
      (dealId || roomId) ? base44.entities.Activity.filter(
        dealId ? { deal_id: dealId } : { room_id: roomId }, '-created_date', 100
      ) : Promise.resolve([]),
      roomId ? base44.entities.Message.filter({ room_id: roomId }, 'created_date', 200) : Promise.resolve([]),
    ]);

    const deal = deals?.[0];
    const room = rooms?.[0];

    // --- Deal created ---
    if (deal) {
      events.push({
        type: 'created',
        message: `Deal created: ${deal.title || deal.property_address || 'New Deal'}`,
        date: deal.created_date,
      });
    }

    // --- Room created ---
    if (room && room.requested_at) {
      events.push({
        type: 'created',
        message: 'Deal room opened',
        date: room.requested_at,
      });
    }

    // --- Deal Invites ---
    (invites || []).forEach(inv => {
      events.push({
        type: 'invite',
        message: `Agent invited to deal`,
        detail: inv.agent_profile_id,
        date: inv.created_at_iso || inv.created_date,
      });
      if (inv.status === 'LOCKED') {
        events.push({
          type: 'locked',
          message: 'Agent locked in — first to sign',
          date: inv.updated_date,
        });
      } else if (inv.status === 'VOIDED') {
        events.push({
          type: 'voided',
          message: 'Invite voided (another agent signed first)',
          date: inv.updated_date,
        });
      }
    });

    // --- Agreements ---
    (agreements || []).forEach(ag => {
      events.push({
        type: 'agreement',
        message: `Agreement generated (${ag.signer_mode || 'standard'} mode)`,
        date: ag.created_date,
      });
      if (ag.investor_signed_at) {
        events.push({
          type: 'signed',
          message: 'Investor signed agreement',
          date: ag.investor_signed_at,
        });
      }
      if (ag.agent_signed_at) {
        events.push({
          type: 'signed',
          message: 'Agent signed agreement',
          date: ag.agent_signed_at,
        });
      }
      if (ag.status === 'fully_signed') {
        events.push({
          type: 'locked',
          message: 'Agreement fully signed — deal locked',
          date: ag.agent_signed_at || ag.investor_signed_at || ag.updated_date,
        });
      }
      if (ag.status === 'voided') {
        events.push({
          type: 'voided',
          message: 'Agreement voided',
          date: ag.updated_date,
        });
      }
    });

    // --- Room lock-in ---
    if (room?.locked_at) {
      events.push({
        type: 'locked',
        message: 'Deal room locked to winning agent',
        date: room.locked_at,
      });
    }

    // --- Deal connected ---
    if (deal?.connected_at) {
      events.push({
        type: 'locked',
        message: 'Deal connected — agent and investor paired',
        date: deal.connected_at,
      });
    }

    // --- Pipeline stage changes from Activity entity ---
    (activities || []).forEach(a => {
      // Only add Activity records that aren't duplicated by our synthesized events
      if (a.type === 'deal_stage_changed') {
        events.push({
          type: 'stage',
          message: a.message || 'Deal moved to a new stage',
          actor: a.actor_name,
          date: a.created_date,
        });
      } else if (!['deal_created', 'agent_locked_in'].includes(a.type)) {
        events.push({
          type: a.type === 'file_uploaded' ? 'file' : a.type === 'photo_uploaded' ? 'photo' : a.type === 'message_sent' ? 'message' : 'default',
          message: a.message,
          actor: a.actor_name,
          date: a.created_date,
        });
      }
    });

    // --- Messages summary (group by day to avoid flooding) ---
    const msgsByDay = {};
    let photoCount = 0;
    let fileCount = 0;
    (messages || []).forEach(m => {
      const day = moment(m.created_date).format('YYYY-MM-DD');
      msgsByDay[day] = (msgsByDay[day] || 0) + 1;
      if (m?.metadata?.type === 'photo' || (m?.metadata?.file_type || '').startsWith('image/')) photoCount++;
      else if (m?.metadata?.file_url) fileCount++;
    });
    Object.entries(msgsByDay).forEach(([day, count]) => {
      events.push({
        type: 'message',
        message: `${count} message${count > 1 ? 's' : ''} exchanged`,
        date: day + 'T12:00:00Z',
      });
    });
    if (photoCount > 0) {
      events.push({
        type: 'photo',
        message: `${photoCount} photo${photoCount > 1 ? 's' : ''} shared in chat`,
        date: messages.filter(m => m?.metadata?.type === 'photo' || (m?.metadata?.file_type || '').startsWith('image/')).pop()?.created_date,
      });
    }
    if (fileCount > 0) {
      events.push({
        type: 'file',
        message: `${fileCount} file${fileCount > 1 ? 's' : ''} shared in chat`,
        date: messages.filter(m => m?.metadata?.file_url && m?.metadata?.type !== 'photo').pop()?.created_date,
      });
    }

    // --- Current pipeline stage ---
    if (deal?.pipeline_stage) {
      // We don't know *when* each stage happened unless Activity entity tracks it,
      // so add the current stage as a latest event if not already covered
      const hasStageActivity = events.some(e => e.type === 'stage');
      if (!hasStageActivity) {
        events.push({
          type: 'stage',
          message: `Current stage: ${stageLabel(deal.pipeline_stage)}`,
          date: deal.updated_date || deal.created_date,
        });
      }
    }

    // Deduplicate by message+date (within 1 minute)
    const deduped = [];
    const seen = new Set();
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const e of events) {
      if (!e.date) continue;
      const key = `${e.message}|${moment(e.date).format('YYYY-MM-DD HH:mm')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }

    setTimeline(deduped);
    setLoading(false);
  }

  if (loading) return <div className="text-center py-12 text-[#808080]">Loading activity...</div>;

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Activity Timeline</h4>
      {timeline.length === 0 ? (
        <p className="text-sm text-[#808080] text-center py-8">No activity yet</p>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#1F1F1F]" />
          <div className="space-y-4">
            {timeline.map((e, i) => {
              const Icon = ICON_MAP[e.type] || ICON_MAP.default;
              const isLock = e.type === 'locked' || e.type === 'signed';
              return (
                <div key={i} className="relative flex items-start gap-3">
                  <div className={`absolute -left-6 w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${isLock ? 'bg-[#E3C567]/20 ring-2 ring-[#E3C567]/40' : 'bg-[#141414] border border-[#1F1F1F]'}`}>
                    <Icon className={`w-3 h-3 ${isLock ? 'text-[#E3C567]' : 'text-[#808080]'}`} />
                  </div>
                  <div className="flex-1 min-w-0 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                    <p className={`text-sm ${isLock ? 'text-[#E3C567] font-medium' : 'text-[#FAFAFA]'}`}>{e.message}</p>
                    <p className="text-xs text-[#808080] mt-1">
                      {e.actor && <span className="text-[#E3C567]">{e.actor} · </span>}
                      {moment(e.date).format('MMM D, YYYY h:mm A')}
                      <span className="ml-2 opacity-60">({moment(e.date).fromNow()})</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}