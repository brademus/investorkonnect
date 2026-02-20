
import * as Sentry from '@sentry/react';
import { toast } from 'sonner';

/**
 * Report an error to both the user (toast) and Sentry.
 * Use this instead of raw toast.error() so every user-facing error is tracked.
 *
 * @param {string} message - User-facing error message
 * @param {object} [options]
 * @param {object} [options.extra] - Extra context for Sentry (dealId, roomId, etc.)
 * @param {string} [options.level] - Sentry level: 'error' | 'warning' | 'info'
 * @param {Error}  [options.cause] - Original error object if available
 * @param {boolean} [options.silent] - If true, skip the toast (Sentry only)
 */
export function reportError(message, options = {}) {
  const { extra = {}, level = 'error', cause, silent = false } = options;

  // Show toast to user
  if (!silent) {
    toast.error(message);
  }

  // Report to Sentry
  if (cause instanceof Error) {
    Sentry.captureException(cause, {
      level,
      tags: { source: 'reportError' },
      extra: { userMessage: message, ...extra },
    });
  } else {
    Sentry.captureMessage(message, {
      level,
      tags: { source: 'reportError' },
      extra,
    });
  }
}

/**
 * Report a data integrity issue to Sentry (no toast — user sees graceful fallback UI).
 * Use for "silent" backend bugs like missing room links, orphaned records, etc.
 *
 * @param {string} message - Description of the integrity issue
 * @param {object} [extra] - Context (dealId, roomId, agreementId, etc.)
 */
export function reportDataIssue(message, extra = {}) {
  console.warn('[DataIssue]', message, extra);
  Sentry.captureMessage(message, {
    level: 'error',
    tags: { source: 'dataIntegrity' },
    extra,
  });
}
