/**
 * Factory functions and default values for Schlag data types.
 *
 * These are used by the sequence builder, settings screen, and
 * anywhere a new entity needs sensible initial values.
 */

import { v4 as uuidv4 } from 'uuid';

import type { Interval } from '../types/interval';
import type { Sequence } from '../types/sequence';
import type { AppSettings } from '../types/settings';
import type { ProStatus } from '../types/pro';

import { DEFAULT_INTERVAL_COLOR } from './colors';

// ---------------------------------------------------------------------------
// Interval factory
// ---------------------------------------------------------------------------

/**
 * Creates a new interval with sensible defaults.
 *
 * - Name: "New Interval"
 * - Duration: 60 seconds
 * - Color: Schlag Red (#E63946)
 * - Note: empty string
 */
export function createDefaultInterval(overrides?: Partial<Interval>): Interval {
  return {
    id: uuidv4(),
    name: 'New Interval',
    duration_seconds: 60,
    color: DEFAULT_INTERVAL_COLOR,
    note: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sequence factory
// ---------------------------------------------------------------------------

/**
 * Creates a new sequence with sensible defaults.
 *
 * - Name: "New Sequence"
 * - One default interval
 * - Repeat count: 1
 * - No rest between sets
 * - Auto-advance: true
 * - Beeps enabled, voice countdown enabled
 */
export function createDefaultSequence(
  overrides?: Partial<Sequence>,
): Sequence {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: 'New Sequence',
    description: '',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [createDefaultInterval()],
    audio_config: {
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: now,
    updated_at: now,
    last_used_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Default app settings
// ---------------------------------------------------------------------------

/**
 * Default application settings.
 *
 * Beeps and voice countdown are on by default.
 * Workout theme defaults to dark.
 * Screen wake lock is on by default.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  beepsEnabled: true,
  voiceCountdownEnabled: true,
  workoutTheme: 'dark',
  keepScreenAwake: true,
  defaultAutoAdvance: true,
  beepVolume: 1.0,
  beepPitch: 1.0,
  defaultHalfwayAlert: false,
  defaultAnnounceNames: false,
  getReadySeconds: 3,
  reduceMotion: false,
  cameraEnabled: false,
  cameraPosition: 'front' as const,
  showCameraPreview: true,
  selectedVoiceId: null,
} as const;

// ---------------------------------------------------------------------------
// Default Pro status
// ---------------------------------------------------------------------------

export const DEFAULT_PRO_STATUS: ProStatus = {
  pro_unlocked: false,
  pro_purchased_at: null,
  weekly_goal: null,
} as const;
