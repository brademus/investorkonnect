/**
 * In-App Purchase (IAP) abstraction — SCAFFOLDED BUT DISABLED.
 *
 * Apple Guideline 3.1.1 requires StoreKit IAP for digital subscriptions
 * purchased inside the iOS app; Stripe web checkout is rejected there.
 *
 * Current state: `IAP_ENABLED = false`. The native paywall therefore shows
 * a "coming soon" state instead of broken purchases, while web continues to
 * use Stripe unchanged. To go live on iOS (PART 2):
 *   1. Create subscription products in App Store Connect.
 *   2. Create a RevenueCat account, add the products, get the API key.
 *   3. Add `@revenuecat/purchases-capacitor` to package.json (Mac).
 *   4. Set REVENUECAT_IOS_API_KEY (env / build-time, NEVER hardcoded).
 *   5. Flip IAP_ENABLED to true and implement the TODO blocks below.
 *
 * `startCheckout(plan, { web, native })` is the single entry point the UI
 * calls — it branches on platform so the rest of the app stays platform-agnostic.
 */

import { isNativeIOS } from '@/lib/native';

// Master switch — keep false until RevenueCat is configured on a Mac (PART 2).
export const IAP_ENABLED = false;

// Map app plans → store product identifiers (created in App Store Connect).
export const IAP_PRODUCTS = {
  membership: 'com.investorkonnect.app.membership.monthly',
  team: 'com.investorkonnect.app.team.monthly',
};

/**
 * Is the in-app paywall purchasable right now on this platform?
 * - Web: always true (Stripe path).
 * - iOS: only when IAP has been enabled & configured.
 */
export function isCheckoutAvailable() {
  if (!isNativeIOS()) return true; // web → Stripe
  return IAP_ENABLED;
}

/**
 * Platform-aware checkout entry point.
 *
 * @param {('membership'|'team')} plan
 * @param {{ web?: () => Promise<void>|void, native?: () => Promise<void>|void }} handlers
 *   - web:    the existing Stripe flow (caller passes it in so this file stays
 *             free of Stripe specifics).
 *   - native: optional override; defaults to the RevenueCat flow below.
 */
export async function startCheckout(plan, handlers = {}) {
  if (isNativeIOS()) {
    if (handlers.native) return handlers.native(plan);
    return purchaseNative(plan);
  }
  if (handlers.web) return handlers.web(plan);
  throw new Error('No web checkout handler provided');
}

/**
 * RevenueCat purchase — DISABLED until configured (PART 2).
 * Throws a clear, user-presentable error while disabled.
 */
async function purchaseNative(plan) {
  if (!IAP_ENABLED) {
    const err = new Error('In-app purchases are not available yet.');
    err.code = 'IAP_DISABLED';
    throw err;
  }

  // TODO (PART 2): implement RevenueCat purchase.
  // const { Purchases } = await import('@revenuecat/purchases-capacitor');
  // const offerings = await Purchases.getOfferings();
  // const pkg = offerings?.current?.availablePackages?.find(
  //   p => p.product.identifier === IAP_PRODUCTS[plan]
  // );
  // if (!pkg) throw new Error('Plan not available');
  // await Purchases.purchasePackage({ aPackage: pkg });
  throw new Error('IAP not implemented');
}

/**
 * Read native entitlement state — DISABLED until configured (PART 2).
 * When live, returns true if the user has an active RevenueCat entitlement.
 * Used by useCurrentProfile to satisfy `isPaidSubscriber` on native.
 */
export async function hasActiveNativeEntitlement() {
  if (!IAP_ENABLED || !isNativeIOS()) return false;

  // TODO (PART 2): read RevenueCat customer info.
  // const { Purchases } = await import('@revenuecat/purchases-capacitor');
  // const info = await Purchases.getCustomerInfo();
  // return Object.keys(info?.customerInfo?.entitlements?.active || {}).length > 0;
  return false;
}

export default { IAP_ENABLED, IAP_PRODUCTS, isCheckoutAvailable, startCheckout, hasActiveNativeEntitlement };