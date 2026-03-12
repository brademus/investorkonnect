// Simple event bus for cross-component notification refresh
const listeners = new Set();

export const notificationEvents = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit() {
    listeners.forEach(fn => fn());
  },
};