/**
 * useWakeLock — Keeps the screen awake during an active workout.
 *
 * Platform behaviour:
 *   - iOS/Android: Uses expo-keep-awake (activateKeepAwakeAsync / deactivateKeepAwake).
 *   - Web: Uses the Screen Wake Lock API (navigator.wakeLock.request('screen')).
 *     Falls back silently when the API is unavailable.
 *
 * Pass `active = true` to acquire the lock, `false` to release it.
 * The lock is always released on unmount.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWakeLock(active: boolean): void {
  // Ref holds the WakeLockSentinel on web so we can release it later.
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      // Release any existing lock when deactivated.
      release();
      return;
    }

    // Acquire the wake lock.
    acquire();

    // ------------------------------------------------------------------
    // Platform-specific acquire / release helpers
    // ------------------------------------------------------------------

    async function acquire() {
      if (Platform.OS === 'web') {
        acquireWeb();
      } else {
        try {
          await activateKeepAwakeAsync();
        } catch {
          // Silently ignore — keep-awake may fail in some environments.
        }
      }
    }

    function release() {
      if (Platform.OS === 'web') {
        releaseWeb();
      } else {
        deactivateKeepAwake();
      }
    }

    async function acquireWeb() {
      // Guard: Screen Wake Lock API may not be available in all browsers.
      if (
        typeof navigator === 'undefined' ||
        !('wakeLock' in navigator)
      ) {
        return;
      }

      try {
        sentinelRef.current = await navigator.wakeLock.request('screen');

        // The browser can release the lock when the tab loses visibility.
        sentinelRef.current.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // Request can fail (e.g. low battery, permissions). Fail silently.
      }
    }

    function releaseWeb() {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    }

    // Re-acquire the wake lock when the tab becomes visible again.
    function handleVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        sentinelRef.current === null &&
        active
      ) {
        acquireWeb();
      }
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      release();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [active]);
}
