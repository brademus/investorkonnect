import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Shared hook for room messages — single fetch, single subscription.
 * All consumers (SimpleMessageBoard, DealBoard photos, FilesTab) use this
 * instead of making independent Message.filter calls.
 */

// Module-level cache: roomId -> { messages, fetchedAt, promise }
const _cache = {};

export function useRoomMessages(roomId) {
  const [messages, setMessages] = useState(() => _cache[roomId]?.messages || []);
  const [loaded, setLoaded] = useState(() => !!_cache[roomId]?.messages);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // Fetch messages (deduped across components via shared promise)
  useEffect(() => {
    if (!roomId) { setMessages([]); setLoaded(true); return; }

    // If cached and fresh (< 10s), use cache
    const cached = _cache[roomId];
    if (cached?.messages && cached.fetchedAt && (Date.now() - cached.fetchedAt) < 10000) {
      setMessages(cached.messages);
      setLoaded(true);
      return;
    }

    // If another component is already fetching, reuse its promise
    if (cached?.promise) {
      cached.promise.then(msgs => {
        if (roomIdRef.current === roomId) {
          setMessages(msgs);
          setLoaded(true);
        }
      });
      return;
    }

    // First caller fetches
    setLoaded(false);
    const fetchPromise = base44.entities.Message.filter({ room_id: roomId }, "created_date")
      .then(rows => {
        const msgs = rows || [];
        _cache[roomId] = { messages: msgs, fetchedAt: Date.now(), promise: null };
        if (roomIdRef.current === roomId) {
          setMessages(msgs);
          setLoaded(true);
        }
        return msgs;
      })
      .catch(() => {
        if (_cache[roomId]) _cache[roomId].promise = null;
        setLoaded(true);
        return [];
      });

    _cache[roomId] = { ..._cache[roomId], promise: fetchPromise };
  }, [roomId]);

  // Single subscription for real-time updates
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      const d = event?.data;
      if (!d || d.room_id !== roomId) return;

      const updater = (prev) => {
        if (event.type === "create") {
          if (prev.some(m => m.id === d.id)) return prev;
          return [...prev, d];
        } else if (event.type === "delete") {
          return prev.filter(m => m.id !== event.id);
        } else if (event.type === "update") {
          return prev.map(m => m.id === event.id ? { ...m, ...d } : m);
        }
        return prev;
      };

      setMessages(updater);
      // Also update cache
      if (_cache[roomId]?.messages) {
        _cache[roomId].messages = updater(_cache[roomId].messages);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  // Allow manual addition of optimistic messages
  const addOptimistic = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const replaceOptimistic = useCallback((tempId, realMsg) => {
    setMessages(prev => {
      if (prev.some(m => m.id === realMsg.id)) return prev.filter(m => m.id !== tempId);
      return prev.map(m => m.id === tempId ? realMsg : m);
    });
  }, []);

  const removeOptimistic = useCallback((tempId) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
  }, []);

  return { messages, loaded, addOptimistic, replaceOptimistic, removeOptimistic };
}