import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Pure subscription-based messaging - no polling
 * Only refetches on subscription events
 */
export function useMessages(roomId, enabled = true) {
  const [messages, setMessages] = useState([]);

  // Initial load
  const { data: initialMessages = [], isLoading } = useQuery({
    queryKey: ['messages', roomId],
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!roomId) return [];
      const items = await base44.entities.Message.filter({ room_id: roomId }, '-created_date', 500);
      return items;
    },
    enabled: enabled && !!roomId,
  });

  // Set initial messages
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event?.type === 'create' && event?.data?.room_id === roomId) {
        setMessages(prev => [...prev, event.data]);
      } else if (event?.type === 'update' && event?.data?.room_id === roomId) {
        setMessages(prev => prev.map(m => m.id === event.data.id ? event.data : m));
      }
    });

    return () => {
      try { unsubscribe && unsubscribe(); } catch (_) {}
    };
  }, [roomId]);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  return { messages, isLoading, addMessage };
}