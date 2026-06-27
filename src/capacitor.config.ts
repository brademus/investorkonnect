import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the native iOS build.
 *
 * This file is consumed ONLY by the Capacitor CLI on a Mac
 * (`npx cap sync ios` / `npx cap open ios`). It has no effect on
 * the Base44 web build and is safe to keep in the repo.
 *
 * Bundle id is permanent once published — keep it in sync with the
 * Xcode "Bundle Identifier" (PART 2 §B4).
 */
const config: CapacitorConfig = {
  appId: 'com.investorkonnect.app',
  appName: 'Investor Konnect',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0D0D0D',
    limitsNavigationsToAppBoundDomains: true,
  },
  server: {
    // Webview origin becomes https://localhost — required for many
    // auth/cookie/storage behaviors and camera/identity flows.
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    Keyboard: {
      // Webview resizes natively so inputs aren't covered.
      resize: 'native',
    },
  },
};

export default config;