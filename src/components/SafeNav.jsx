/**
 * Safe Navigation Guard
 * Prevents navigation to placeholder URLs, invalid routes, or computed email addresses
 */

const ALLOWED_ROUTES = [
  "/",
  "/how-it-works",
  "/investors",
  "/agents",
  "/pricing",
  "/reviews",
  "/resources",
  "/about",
  "/contact",
  "/onboarding",
  "/dashboard",
  "/account/billing",
  "/account/profile",
  "/deal-rooms",
  "/matches",
  "/inbox",
  "/nda",
  "/auth/finish",
  "/security",
  "/faq",
  "/privacy-policy",
  "/terms",
  "/review-policy",
  "/cookies",
  "/thank-you",
  "/vetting",
  "/admin/approvals"
];

/**
 * Validates and navigates to a URL safely
 * @param {string} to - Target URL or path
 * @param {boolean} replace - Use replace instead of assign
 */
export function safeNavigate(to, replace = false) {
  try {
    // Null/undefined check
    if (!to || typeof to !== 'string') {
      console.error('safeNavigate: Invalid target', to);
      window.location.replace('/');
      return;
    }

    // Check for placeholder patterns
    const placeholderPatterns = [
      /\(.*currentuser.*\)/i,
      /\{.*currentuser.*\}/i,
      /\[.*currentuser.*\]/i,
      /\$\{.*\}/,
      /currentuser\.email/i,
      /\{\{.*\}\}/,
      /undefined/i,
      /null/i
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(to)) {
        console.error('safeNavigate: Blocked placeholder URL:', to);
        window.location.replace('/');
        return;
      }
    }

    // Allow absolute HTTPS URLs (like Stripe)
    if (/^https:\/\//i.test(to)) {
      window.location.href = to;
      return;
    }

    // Ensure leading slash for relative paths
    if (!to.startsWith('/')) {
      to = '/' + to;
    }

    // Check if route is in allowed list
    const basePath = to.split('?')[0]; // Remove query params for check
    if (!ALLOWED_ROUTES.includes(basePath)) {
      console.warn('safeNavigate: Route not in allowed list:', basePath);
      // Allow it anyway if it looks like a valid path (starts with /)
      if (!to.startsWith('/')) {
        window.location.replace('/');
        return;
      }
    }

    // Navigate safely
    if (replace) {
      window.location.replace(to);
    } else {
      window.location.assign(to);
    }
  } catch (error) {
    console.error('safeNavigate: Error during navigation', error);
    window.location.replace('/');
  }
}

/**
 * Validates a URL before using it in href
 * @param {string} url - URL to validate
 * @returns {string} - Safe URL or fallback
 */
export function validateHref(url) {
  if (!url || typeof url !== 'string') return '/';
  
  // Check for placeholders
  const placeholderPatterns = [
    /\(.*currentuser.*\)/i,
    /\{.*currentuser.*\}/i,
    /currentuser\.email/i,
    /\$\{.*\}/,
    /\{\{.*\}\}/
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(url)) {
      console.error('validateHref: Blocked placeholder URL:', url);
      return '/';
    }
  }

  // Allow absolute URLs
  if (/^https?:\/\//i.test(url)) return url;
  
  // Ensure relative paths start with /
  if (!url.startsWith('/')) return '/' + url;
  
  return url;
}

export default { safeNavigate, validateHref };