import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import {
  Bell, MessageSquare, ArrowRightLeft, Calendar,
  Upload, RefreshCw, Zap, FileSignature, Loader2, ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ICON_MAP = {
  unread_messages: MessageSquare,
  counter_offer_pending: ArrowRightLeft,
  counter_offer_accepted: ArrowRightLeft,
  counter_offer_declined: ArrowRightLeft,
  new_deal: Zap,
  agreement_sign: FileSignature,
  agreement_fully_signed: FileSignature,
  agreement_regenerated: RefreshCw,
  investor_signed: FileSignature,
  agent_signed: FileSignature,
  walkthrough_confirm: Calendar,
  walkthrough_scheduled: Calendar,
  action_needed: Upload,
};

function NotificationItem({ notification, onClick }) {
  const Icon = ICON_MAP[notification.type] || Bell;
  const isHigh = notification.priority === 'high';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isHigh ? 'bg-[#E3C567]/12' : 'bg-white/[0.05]'
      }`}>
        <Icon className={`w-3.5 h-3.5 ${isHigh ? 'text-[#E3C567]' : 'text-[#808080]'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-tight font-medium ${isHigh ? 'text-[#FAFAFA]' : 'text-[#C0C0C0]'}`}>
          {notification.title}
        </p>
        {notification.description && (
          <p className="text-[11px] text-[#606060] truncate mt-0.5">{notification.description}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {notification.timestamp && (
          <span className="text-[10px] text-[#505050]">
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
          </span>
        )}
        <ChevronRight className="w-3 h-3 text-[#404040] group-hover:text-[#606060] transition-colors" />
      </div>
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

  const [lastSeenAt, setLastSeenAt] = useState(() => {
    try {
      const stored = sessionStorage.getItem('notif_last_seen');
      return stored ? parseInt(stored, 10) : 0;
    } catch { return 0; }
  });

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

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120_000);
    return () => clearInterval(interval);
  }, []);

  const debounceRef = useRef(null);
  useEffect(() => {
    const debounced = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchNotifications, 5000);
    };
    const unsubs = [
      base44.entities.Deal.subscribe(debounced),
      base44.entities.Room.subscribe(debounced),
      base44.entities.CounterOffer.subscribe(debounced),
      base44.entities.DealInvite.subscribe(debounced),
    ];
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubs.forEach(u => { try { u(); } catch (_) {} });
    };
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const seenTs = Date.now() + 1;
    setLastSeenAt(seenTs);
    try { sessionStorage.setItem('notif_last_seen', String(seenTs)); } catch {}
  }, [open]);

  const handleToggle = () => {
    if (!open) { fetchNotifications(); setOpen(true); }
    else setOpen(false);
  };

  const handleNotificationClick = (n) => {
    setOpen(false);
    if (n.roomId) navigate(`${createPageUrl("Room")}?roomId=${n.roomId}`);
    else if (n.dealId) navigate(`${createPageUrl("Room")}?dealId=${n.dealId}`);
  };

  const unseenCount = notifications.filter(n => {
    if (!lastSeenAt) return true;
    return (n.timestamp ? new Date(n.timestamp).getTime() : 0) > lastSeenAt;
  }).length;

  const hasHigh = notifications.some(n =>
    n.priority === 'high' && (n.timestamp ? new Date(n.timestamp).getTime() : 0) > lastSeenAt
  );

  const high = notifications.filter(n => n.priority === 'high');
  const other = notifications.filter(n => n.priority !== 'high');

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-full border border-[#1F1F1F] bg-[#1A1A1A] hover:bg-[#222] hover:border-[#E3C567]/40 transition-all"
        aria-label={`${unseenCount} notifications`}
      >
        <Bell className={`w-5 h-5 ${unseenCount > 0 ? 'text-[#E3C567]' : 'text-[#505050]'}`} />
        {unseenCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1 leading-none ${
            hasHigh ? 'bg-red-500 text-white' : 'bg-[#E3C567] text-black'
          }`}>
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[320px] rounded-2xl z-50 overflow-hidden"
          style={{
            background: '#111114',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
          }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[13px] font-semibold text-[#FAFAFA] tracking-wide">Notifications</span>
            {loading && <Loader2 className="w-3 h-3 text-[#E3C567] animate-spin" />}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {!fetched && loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-4 h-4 text-[#E3C567] animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="w-7 h-7 text-[#2A2A2A] mx-auto mb-2.5" />
                <p className="text-[13px] text-[#505050]">All caught up</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {high.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-[#E3C567]/60 uppercase tracking-widest px-3 pt-2 pb-1">
                      Action required
                    </p>
                    {high.map((n, i) => (
                      <NotificationItem
                        key={`high-${i}`}
                        notification={n}
                        onClick={() => handleNotificationClick(n)}
                      />
                    ))}
                  </>
                )}

                {other.length > 0 && (
                  <>
                    {high.length > 0 && (
                      <div className="mx-3 my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />
                    )}
                    <p className="text-[10px] font-semibold text-[#505050] uppercase tracking-widest px-3 pt-1 pb-1">
                      Updates
                    </p>
                    {other.map((n, i) => (
                      <NotificationItem
                        key={`other-${i}`}
                        notification={n}
                        onClick={() => handleNotificationClick(n)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}