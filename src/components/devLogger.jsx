export const devLog = (...args) => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    console.log('[DEV]', ...args);
  }
};