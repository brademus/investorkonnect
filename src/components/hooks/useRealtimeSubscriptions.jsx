import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Consolidated subscription manager - single entry point for all real-time updates
 * Prevents subscription spam and batches updates
 */
export function useRealtimeSubscriptions(profileId, userRole, onUpdate) {
  const unsubscribeRef = useRef(() => {});

  useEffect(() => {
    if (!profileId) return;

    // Clean up previous subscriptions
    unsubscribeRef.current();

    const subscriptions = [];

    // Subscribe to deals
    const unsubDeal = base44.entities.Deal.subscribe((event) => {
      if (event?.type === 'create' || event?.type === 'update') {
        onUpdate({ type: 'deal', event });
      }
    });
    subscriptions.push(unsubDeal);

    // Subscribe to rooms
    const unsubRoom = base44.entities.Room.subscribe((event) => {
      if (event?.type === 'create' || event?.type === 'update') {
        const r = event?.data;
        // Agent: only care about rooms for this agent
        if (userRole === 'agent' && r?.agentId !== profileId) return;
        onUpdate({ type: 'room', event });
      }
    });
    subscriptions.push(unsubRoom);

    // Subscribe to counters (investor only)
    if (userRole === 'investor') {
      const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
        onUpdate({ type: 'counter', event });
      });
      subscriptions.push(unsubCounter);
    }

    // Store cleanup function
    unsubscribeRef.current = () => {
      subscriptions.forEach(unsub => {
        try { unsub && unsub(); } catch (_) {}
      });
    };

    return () => unsubscribeRef.current();
  }, [profileId, userRole, onUpdate]);
}