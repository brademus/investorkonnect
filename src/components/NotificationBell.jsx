import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import {
  Bell, MessageSquare, FileSignature, ArrowRightLeft,
  Calendar, Upload, RefreshCw, ChevronRight, Loader2, AlertTriangle,
  CheckCircle2, XCircle, UserCheck, TrendingUp, FileCheck, Camera, Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ICON_MAP = {
  unread_messages: MessageSquare,
  counter_offer_pending: ArrowRightLeft,
  counter_offer_accepted: CheckCircle2,
  counter_offer_declined: XCircle,
  new_deal: Zap,
  agreement_sign: FileSignature,
  agreement_fully_signed: FileCheck,
  agreement_regenerated: RefreshCw,
  investor_signed: UserCheck,
  agent_signed: UserCheck,
  walkthrough_confirm: Calendar,
  walkthrough_scheduled: Calendar,
  action_needed: Upload,
  activity_deal_created: Zap,
  activity_agent_accepted: UserCheck,
  activity_agent_locked_in: CheckCircle2,
  activity_agent_rejected: XCircle,
  activity_deal_stage_changed: TrendingUp,
  activity_file_uploaded: FileCheck,
  activity_photo_uploaded: Camera,
};

const COLOR_MAP = {
  high: 'text-red-400',
  medium: 'text-[#E3C567]',
  low: 'text-[#808080]',
};

const BG_MAP = {
  high: 'bg-red-400/10',
  medium: 'bg-[#E3C567]/10',
  low: 'bg-[#808080]/10',
};

function NotificationItem({ notification, onClick }) {
  const Icon = ICON_MAP[notification.type] || AlertTriangle;
  const color = COLOR_MAP[notification.priority] || 'text-[#808080]';
  const bg = BG_MAP[notification.priority] || 'bg-[#808080]/10';
  const timeAgo = notification.timestamp
    ? formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })
    : '';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-[#1A1A1F] transition-colors text-left"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#FAFAFA] leading-tight">{notification.title}</p>
        <p className="text-xs text-[#808080] truncate mt-0.5">{notification.description}</p>
        {timeAgo && <p className="text-[10px] text-[#666] mt-1">{timeAgo}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-[#666] flex-shrink-0 mt-1" />
    </button>
  );
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getNotifications", {});
      setNotifications(res.data?.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Fetch on mount + auto-refresh every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Real-time: refetch when deals/rooms/messages/invites change
  useEffect(() => {
    const unsubs = [];
    const refresh = () => fetchNotifications();
    unsubs.push(base44.entities.Deal.subscribe(refresh));
    unsubs.push(base44.entities.Room.subscribe(refresh));
    unsubs.push(base44.entities.Message.subscribe(refresh));
    unsubs.push(base44.entities.DealInvite.subscribe(refresh));
    unsubs.push(base44.entities.CounterOffer.subscribe(refresh));
    unsubs.push(base44.entities.LegalAgreement.subscribe(refresh));
    unsubs.push(base44.entities.DealAppointments.subscribe(refresh));
    unsubs.push(base44.entities.Activity.subscribe(refresh));
    return () => unsubs.forEach(u => { try { u(); } catch (_) {} });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && !fetched) fetchNotifications();
    else if (!open) fetchNotifications(); // always refresh on open
    setOpen(!open);
  };

  const handleNotificationClick = (n) => {
    setOpen(false);
    if (n.roomId) {
      navigate(`${createPageUrl("Room")}?roomId=${n.roomId}`);
    } else if (n.dealId) {
      navigate(`${createPageUrl("Room")}?dealId=${n.dealId}`);
    }
  };

  const count = notifications.length;
  const highCount = notifications.filter(n => n.priority === 'high').length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-full border border-[#1F1F1F] bg-[#1A1A1A] hover:bg-[#222] hover:border-[#E3C567] transition-all"
        aria-label={`${count} notifications`}
      >
        <Bell className={`w-5 h-5 ${count > 0 ? "text-[#E3C567]" : "text-[#808080]"}`} />
        {count > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-bold px-1 leading-none ${highCount > 0 ? 'bg-red-500' : 'bg-[#E3C567] text-black'}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[360px] max-h-[480px] overflow-y-auto rounded-[16px] z-50"
          style={{
            background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.80)',
          }}
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Notifications</h3>
            {loading && <Loader2 className="w-3.5 h-3.5 text-[#E3C567] animate-spin" />}
          </div>

          <div className="p-2">
            {loading && !fetched ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#E3C567] animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-[#333] mx-auto mb-2" />
                <p className="text-sm text-[#808080]">You're all caught up</p>
                <p className="text-xs text-[#666] mt-1">No pending notifications</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((n, i) => (
                  <NotificationItem
                    key={`${n.type}-${n.dealId}-${n.roomId}-${i}`}
                    notification={n}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}