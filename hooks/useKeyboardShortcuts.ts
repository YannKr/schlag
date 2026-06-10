/**
 * useKeyboardShortcuts — Web-only keyboard shortcuts for the workout screen.
 *
 * Key bindings:
 *   Space / k      — toggle pause / resume
 *   n / ArrowRight — skip to next interval
 *   Escape / q     — stop workout
 *   e              — toggle expanded / compact view
 *   m              — mute / unmute audio
 *   ?              — show keyboard shortcut overlay
 *
 * While the shortcut overlay is open, only ? and Escape fire (both close
 * the overlay) so workout controls cannot be triggered accidentally.
 *
 * No-op on native platforms.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardShortcutHandlers {
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
  onStop?: () => void;
  onToggleExpanded?: () => void;
  onToggleMute?: () => void;
  onShowShortcuts?: () => void;
  isPaused: boolean;
  /** When true, only ? and Escape fire (both invoke onShowShortcuts to close). */
  isOverlayVisible?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  // The handlers object is recreated every render (the workout screen
  // re-renders ~60×/sec while the timer ticks). Read it through a ref so the
  // keydown listener is attached exactly once instead of being torn down and
  // re-added on every render, while still seeing fresh state.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function handleKeyDown(event: KeyboardEvent) {
      const {
        onPause,
        onResume,
        onSkip,
        onStop,
        onToggleExpanded,
        onToggleMute,
        onShowShortcuts,
        isPaused,
        isOverlayVisible,
      } = handlersRef.current;

      // Ignore events from input fields so users can still type in forms.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // While the overlay is open, swallow workout shortcuts — only ? and
      // Escape pass through, both toggling the overlay closed.
      if (isOverlayVisible) {
        if (event.key === '?' || event.key === 'Escape') {
          event.preventDefault();
          onShowShortcuts?.();
        }
        return;
      }

      switch (event.key) {
        case ' ':
        case 'k': {
          event.preventDefault();
          if (isPaused) {
            onResume?.();
          } else {
            onPause?.();
          }
          break;
        }

        case 'n':
        case 'ArrowRight': {
          event.preventDefault();
          onSkip?.();
          break;
        }

        case 'Escape':
        case 'q': {
          event.preventDefault();
          onStop?.();
          break;
        }

        case 'e': {
          event.preventDefault();
          onToggleExpanded?.();
          break;
        }

        case 'm': {
          event.preventDefault();
          onToggleMute?.();
          break;
        }

        case '?': {
          event.preventDefault();
          onShowShortcuts?.();
          break;
        }

        default:
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
