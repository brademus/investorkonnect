/**
 * Native (Capacitor / iOS) integration layer.
 *
 * IMPORTANT: This module is import-safe on the web. The `@capacitor/*`
 * packages are NOT installed in the Base44 web environment, so every
 * Capacitor access is behind a guarded dynamic `import()` that only runs
 * when the app is actually running inside a native shell. On web, every
 * exported function is a no-op (or falls back to plain browser behavior).
 *
 * Wiring on a Mac (PART 2): once `@capacitor/*` deps are installed and the
 * iOS project is generated, these dynamic imports resolve and the native
 * behaviors activate automatically. No further code changes required here.
 */

// Dynamically import a Capacitor module by name.
//
// The specifier is built at runtime (via a variable) so the bundler cannot
// statically resolve it. On web the `@capacitor/*` packages don't exist, so
// the import rejects and we fall back to no-op/web behavior. On a Mac native
// build the packages are installed and these resolve normally.
const CAP = '@capacitor';
function loadCap(name) {
  // @vite-ignore prevents Rollup from trying to bundle/resolve this import.
  return import(/* @vite-ignore */ `${CAP}/${name}`);
}

// Cache the Capacitor core module once resolved.
let _capacitor = null;
let _triedCapacitor = false;

async function getCapacitor() {
  if (_triedCapacitor) return _capacitor;
  _triedCapacitor = true;
  try {
    const mod = await loadCap('core');
    _capacitor = mod?.Capacitor || null;
  } catch (_) {
    _capacitor = null;
  }
  return _capacitor;
}

/**
 * Synchronous best-effort platform check.
 * Returns false on web (where Capacitor is not present).
 */
export function isNativePlatform() {
  try {
    const cap = window?.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  } catch (_) {
    return false;
  }
}

/**
 * True only when running as a native iOS app. Drives the IAP/paywall branch.
 */
export function isNativeIOS() {
  try {
    const cap = window?.Capacitor;
    return !!(cap && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'ios');
  } catch (_) {
    return false;
  }
}

/**
 * Open an external URL.
 * - Native: in-app Capacitor Browser (stays inside the app, iOS-friendly).
 * - Web: standard new tab with noopener.
 * mailto:/tel: links always use the system handler.
 */
export async function openExternal(url) {
  if (!url) return;
  const isSystemLink = /^(mailto:|tel:)/i.test(url);

  if (!isSystemLink && isNativePlatform()) {
    try {
      const { Browser } = await loadCap('browser');
      await Browser.open({ url });
      return;
    } catch (_) {
      // fall through to web behavior
    }
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (_) {
    window.location.href = url;
  }
}

/**
 * One-time native shell init. Safe to call on web (no-ops).
 * Called from main.jsx.
 */
export async function initNative(router) {
  const cap = await getCapacitor();
  if (!cap || !cap.isNativePlatform?.()) return; // web → nothing to do

  // Status bar: light text on the near-black UI.
  try {
    const { StatusBar, Style } = await loadCap('status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (_) {}

  // Hide the splash once the web app is ready.
  try {
    const { SplashScreen } = await loadCap('splash-screen');
    await SplashScreen.hide();
  } catch (_) {}

  // Keyboard: resize the webview so inputs aren't covered.
  try {
    const { Keyboard } = await loadCap('keyboard');
    await Keyboard.setResizeMode?.({ mode: 'native' });
  } catch (_) {}

  // Deep links + hardware back.
  try {
    const { App } = await loadCap('app');

    // Deep links: OAuth / DocuSign / Stripe returns land back in-app.
    // We strip the scheme+host and route the path via React Router so
    // e.g. https://investorkonnect.com/DocuSignReturn?... opens the right page.
    App.addListener('appUrlOpen', (event) => {
      try {
        const incoming = event?.url || '';
        const u = new URL(incoming);
        const target = `${u.pathname}${u.search}${u.hash}` || '/';
        if (router?.navigate) router.navigate(target);
        else window.location.assign(target);
      } catch (_) {}
    });

    // iOS doesn't have a hardware back button, but this also covers
    // Android if ever added: exit on root, otherwise go back.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp?.();
    });
  } catch (_) {}
}

export default { initNative, openExternal, isNativePlatform, isNativeIOS };