/**
 * CENTRALIZED DEV LOGGER
 * 
 * Production-safe logging utility.
 * Only logs in non-production environments.
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const devLog = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};

export const devError = (...args) => {
  if (isDev) {
    console.error(...args);
  }
};

export default {
  log: devLog,
  warn: devWarn,
  error: devError
};