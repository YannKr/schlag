/**
 * Interval type definitions for Schlag interval timer.
 *
 * An Interval is a single timed segment within a Sequence.
 * Each interval has a name, duration, color, and optional coaching note.
 */

/** Hex color string (e.g. '#E63946') from the 12-color interval palette. */
export type IntervalColorHex = string;

export interface Interval {
  /** Unique identifier (UUID v4). */
  id: string;

  /** Display name shown on the workout screen. Max 32 characters. */
  name: string;

  /** Duration in seconds. Min 1, max 359,999 (99:59:59). */
  duration_seconds: number;

  /** Background color from the interval palette. */
  color: IntervalColorHex;

  /** Optional coaching cue shown during the interval. Max 80 characters. */
  note: string;

  /** v2: Per-interval audio tone selection (Schlag Pro). Defaults to 'default'. */
  audio_tone?: import('./audio').IntervalAudioTone;

  /** v2: Per-interval custom audio URL (when audio_tone is 'custom'). */
  custom_audio_url?: string | null;
}
