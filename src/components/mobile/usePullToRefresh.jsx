import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh gesture hook for mobile scroll containers.
 * Attaches touch handlers to the given ref. When the user pulls down past
 * `threshold` from the top of the page, `onRefresh` is invoked.
 *
 * Returns { pullDistance, refreshing } so the UI can render a pull indicator.
 */
export default function usePullToRefresh(ref, onRefresh, { threshold = 70, max = 120 } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onTouchStart = (e) => {
      if (refreshing) return;
      if (atTop()) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && atTop()) {
        // Dampen the pull so it feels natural
        const dist = Math.min(max, delta * 0.5);
        setPullDistance(dist);
        if (dist > 5 && e.cancelable) e.preventDefault();
      } else {
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;
      if (pullDistance >= threshold) {
        setRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onRefresh, threshold, max, pullDistance, refreshing]);

  return { pullDistance, refreshing };
}