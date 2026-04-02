/**
 * Application settings types for Schlag.
 *
 * Settings are stored locally (MMKV) and are not synced to the cloud.
 * They control global audio behavior, workout display theme, and defaults.
 */

/** Workout screen background theme. Includes v2 Pro-only themes. */
export type WorkoutTheme = 'dark' | 'light' | 'interval-color' | 'ember' | 'ocean' | 'forest' | 'midnight';

export interface AppSettings {
  /** Global toggle for built-in interval beep tones. */
  beepsEnabled: boolean;

  /** Global toggle for TTS voice countdown ("3... 2... 1..."). */
  voiceCountdownEnabled: boolean;

  /** Workout screen background theme. */
  workoutTheme: WorkoutTheme;

  /** When true, screen wake lock is held during workouts. Default ON. */
  keepScreenAwake: boolean;

  /** Default auto-advance value applied to new sequences. */
  defaultAutoAdvance: boolean;

  /** Volume multiplier for built-in beeps. Range 0..1. */
  beepVolume: number;

  /** Pitch multiplier for built-in beeps. Range 0.5..2.0. */
  beepPitch: number;

  /** v2: Default halfway alert for new sequences. */
  defaultHalfwayAlert: boolean;

  /** v2: Default announce interval names for new sequences. */
  defaultAnnounceNames: boolean;
}
