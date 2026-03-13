import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { notificationEvents } from "@/components/utils/notificationEvents";
import { Mail, Loader2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MessagesBell() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    // Primary: try getUnreadMessages
    try {
      const res = await base44.functions.invoke("getUnreadMessages", {});
      if (res.data?.messages?.length > 0 || res.data?.count >= 0) {
        setData(res.data);
        setLoading(false);
        setFetched(true);
        return;
      }
    } catch (err) {
      console.warn('[MessagesBell] getUnreadMessages failed, using fallback:', err?.message);
    }

    // Fallback: extract unread messages from getNotifications
    try {
      const res = await base44.functions.invoke("getNotifications", {});
      const allNotifs = res.data?.notifications || [];
      const msgNotifs = allNotifs.filter(n => n.type === 'unread_messages');
      const messages = msgNotifs.map(n => ({
        roomId: n.roomId,
        dealId: n.dealId,
        senderName: n.title || 'New message',
        senderHeadshot: null,
        preview: n.description || '',
        address: n.subtitle || n.description || '',
        count: 1,
        timestamp: n.timestamp,
      }));
      setData({ messages, count: messages.length });
    } catch {
      setData({ messages: [], count: 0 });
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Fetch on mount + poll + re-fetch on tab focus (user returning from Room page)
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 120_000);
    const onFocus = () => { setTimeout(fetchMessages, 500); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Refresh when Room page marks messages as read
  useEffect(() => {
    return notificationEvents.subscribe(() => {
      // Small delay to let the server persist the timestamp, then fetch twice
      // (first fetch catches most cases, second handles slow propagation)
      setTimeout(fetchMessages, 1000);
      setTimeout(fetchMessages, 3000);
    });
  }, [fetchMessages]);

  // Real-time: new messages trigger refresh
  useEffect(() => {
    const debounceRef = { current: null };
    const unsub = base44.entities.Message.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchMessages, 3000);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try { unsub(); } catch (_) {}
    };
  }, []);

  // Close panel on outside click
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
    if (!open) { fetchMessages(); setOpen(true); }
    else setOpen(false);
  };

  const messages = data?.messages || [];
  // Badge count = number of rooms with unread messages (from server)
  const unreadCount = messages.length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-full border border-[#1F1F1F] bg-[#1A1A1A] hover:bg-[#222] hover:border-[#E3C567]/40 transition-all"
        aria-label={`${unreadCount} unread messages`}
      >
        <Mail className={`w-5 h-5 ${unreadCount > 0 ? 'text-[#E3C567]' : 'text-[#505050]'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1 leading-none bg-red-500 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
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
            <span className="text-[13px] font-semibold text-[#FAFAFA] tracking-wide">Messages</span>
            {loading && <Loader2 className="w-3 h-3 text-[#E3C567] animate-spin" />}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {!fetched && loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-4 h-4 text-[#E3C567] animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Mail className="w-7 h-7 text-[#2A2A2A] mx-auto mb-2.5" />
                <p className="text-[13px] text-[#505050]">No unread messages</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {messages.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setOpen(false);
                      if (m.roomId) navigate(`${createPageUrl("Room")}?roomId=${m.roomId}&view=messages`);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {m.senderHeadshot ? (
                        <img src={m.senderHeadshot} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-[#E3C567]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] leading-tight font-medium text-[#FAFAFA]">
                        {m.senderName || 'Message'}
                      </p>
                      <p className="text-[11px] text-[#808080] truncate mt-0.5">
                        {m.preview || m.address || ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {m.timestamp && (
                        <span className="text-[10px] text-[#505050]">
                          {formatDistanceToNow(new Date(m.timestamp), { addSuffix: true })}
                        </span>
                      )}
                      {m.count > 1 && (
                        <span className="text-[9px] bg-[#E3C567] text-black px-1.5 py-0.5 rounded-full font-bold">
                          {m.count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}