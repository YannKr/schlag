/**
 * useKeyboardShortcuts — Web-only keyboard shortcuts for the workout screen.
 *
 * Key bindings:
 *   Space / k      — toggle pause / resume
 *   n / ArrowRight — skip to next interval
 *   Escape / q     — stop workout
 *   e              — toggle expanded / compact view  (v2)
 *   m              — mute / unmute audio             (v2)
 *   ?              — show keyboard shortcut overlay   (v2)
 *
 * No-op on native platforms.
 */

import { useEffect } from 'react';
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
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const {
    onPause,
    onResume,
    onSkip,
    onStop,
    onToggleExpanded,
    onToggleMute,
    onShowShortcuts,
    isPaused,
  } = handlers;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function handleKeyDown(event: KeyboardEvent) {
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
  }, [
    isPaused,
    onPause,
    onResume,
    onSkip,
    onStop,
    onToggleExpanded,
    onToggleMute,
    onShowShortcuts,
  ]);
}
