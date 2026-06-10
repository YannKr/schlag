/**
 * Service worker registration for the web build.
 *
 * Registers /sw.js (see public/sw.js) so the app shell loads offline.
 * No-op on native, in development, and in browsers without SW support.
 */

import { Platform } from 'react-native';

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web' || __DEV__ || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Registration failure is non-fatal — the app just won't work offline.
  });
}
