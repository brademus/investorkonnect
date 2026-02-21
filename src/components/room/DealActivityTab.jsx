import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pen, CheckCircle, Send, FileText, TrendingUp, Home, Clock, XCircle } from "lucide-react";
import moment from "moment";

const STAGE_LABELS = {
  new_deals: "Moved to New Deals",
  connected_deals: "Deal Connected — moved to Active",
  active_listings: "Property Listed — moved to Active Listings",
  in_closing: "Moved to In Closing",
  completed: "Deal Completed",
  canceled: "Deal Canceled",
};

const DOC_LABELS = {
  purchase_contract: "Purchase contract uploaded",
  listing_agreement: "Listing agreement uploaded",
  buyer_contract: "Buyer's contract uploaded",
  cma: "CMA uploaded",
  operating_agreement: "Operating agreement uploaded",
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
    const events = [];

    // 1. Deal created
    if (deal?.created_date) {
      events.push({ icon: Plus, color: 'muted', message: 'Deal submitted', date: deal.created_date });
    }

    // 2. Agents invited
    const inviteCount = (invites || []).length;
    if (inviteCount > 0) {
      const firstInvite = [...invites].sort((a, b) =>
        new Date(a.created_at_iso || a.created_date) - new Date(b.created_at_iso || b.created_date)
      )[0];
      events.push({
        icon: Send, color: 'muted',
        message: `Sent to ${inviteCount} agent${inviteCount > 1 ? 's' : ''}`,
        date: firstInvite.created_at_iso || firstInvite.created_date,
      });
    }

    // 3. Agreement signing events (use the active/latest agreement)
    const activeAgreement = (agreements || [])
      .filter(a => !['voided', 'superseded'].includes(a.status))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

    if (activeAgreement?.investor_signed_at) {
      events.push({ icon: Pen, color: 'gold', message: 'Investor signed agreement', date: activeAgreement.investor_signed_at });
    }
    if (activeAgreement?.agent_signed_at) {
      events.push({ icon: Pen, color: 'gold', message: 'Agent signed agreement', date: activeAgreement.agent_signed_at });
    }
    if (activeAgreement?.status === 'fully_signed') {
      const connectedDate = activeAgreement.agent_signed_at || activeAgreement.updated_date;
      events.push({ icon: CheckCircle, color: 'green', message: 'Both parties signed — deal connected!', date: connectedDate });
    }

    // 4. Pipeline stage changes (derived from deal's current stage + connected_at)
    if (deal?.connected_at) {
      events.push({ icon: TrendingUp, color: 'gold', message: STAGE_LABELS['connected_deals'], date: deal.connected_at });
    }

    // Use deal updated_date for stage moves beyond connected (approximate)
    const stage = deal?.pipeline_stage;
    if (stage && !['new_deals', 'connected_deals', 'draft'].includes(stage)) {
      const stageLabel = STAGE_LABELS[stage];
      if (stageLabel && deal?.updated_date) {
        // Only show stage moves that make sense
        const stageIcon = stage === 'completed' ? CheckCircle : stage === 'canceled' ? XCircle : stage === 'in_closing' ? Clock : Home;
        const stageColor = stage === 'completed' ? 'green' : stage === 'canceled' ? 'red' : 'gold';
        events.push({ icon: stageIcon, color: stageColor, message: stageLabel, date: deal.updated_date });
      }
    }

    // 5. Document uploads — each document type as its own event
    const docs = deal?.documents || {};
    for (const [key, label] of Object.entries(DOC_LABELS)) {
      const doc = docs[key];
      if (doc?.url) {
        events.push({
          icon: FileText, color: 'muted',
          message: label,
          date: doc.uploaded_at || doc.updated_at || deal.updated_date,
        });
      }
    }

    // 6. Room files uploaded (generic)
    for (const file of (room?.files || [])) {
      events.push({
        icon: FileText, color: 'muted',
        message: `File uploaded: ${file.name || 'document'}`,
        date: file.uploaded_at || room.updated_date,
      });
    }

    // Sort oldest first (chronological)
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Dedup
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

  if (loading) return <div className="text-center py-12 text-[#808080] text-sm">Loading activity...</div>;

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-6">Activity</h4>
      {timeline.length === 0 ? (
        <p className="text-sm text-[#808080] text-center py-8">No activity yet</p>
      ) : (
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[#1F1F1F]" />
          <div className="space-y-5">
            {timeline.map((e, i) => {
              const Icon = e.icon;
              const isGreen = e.color === 'green';
              const isGold = e.color === 'gold';
              const isRed = e.color === 'red';
              const dotBg = isGreen ? 'bg-[#10B981]/20' : isGold ? 'bg-[#E3C567]/15' : isRed ? 'bg-red-500/15' : 'bg-[#141414] border border-[#1F1F1F]';
              const iconColor = isGreen ? 'text-[#10B981]' : isGold ? 'text-[#E3C567]' : isRed ? 'text-red-400' : 'text-[#808080]';
              const textColor = isGreen ? 'text-[#10B981] font-medium' : isGold ? 'text-[#E3C567] font-medium' : isRed ? 'text-red-400' : 'text-[#FAFAFA]';

              return (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${dotBg}`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className={`text-sm ${textColor}`}>{e.message}</p>
                    <p className="text-xs text-[#808080] mt-0.5">{moment(e.date).format('MMM D, YYYY · h:mm A')}</p>
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