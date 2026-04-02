/**
 * useDocumentTitle — Updates the browser tab title during a workout.
 *
 * Web only. On native platforms this hook is a no-op.
 *
 * Pass a string to set the title (e.g. "0:42 — Rest").
 * Pass null to restore the original title that was captured on first call.
 * The original title is always restored on unmount.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentTitle(title: string | null): void {
  const originalTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Capture original title on first call.
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    if (title !== null) {
      document.title = title;
    } else {
      document.title = originalTitleRef.current;
    }

    return () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
  }, [title]);
}
