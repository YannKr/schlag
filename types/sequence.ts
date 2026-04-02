/**
 * Sequence type definition for Schlag.
 *
 * A Sequence is a saved interval program consisting of an ordered list of
 * Intervals, repeat/loop settings, and audio configuration.
 */

import { AudioConfig } from './audio';
import { Interval } from './interval';

export interface Sequence {
  /** Unique identifier (UUID v4). */
  id: string;

  /** Sequence title shown in the library. */
  name: string;

  /** Optional subtitle for the library card. Max 120 characters. */
  description: string;

  /**
   * Number of times the full interval list loops.
   * Range 1--99 for finite repeats. 0 = infinite (open-ended) mode.
   */
  repeat_count: number;

  /** Automatic rest duration (seconds) inserted between each loop. 0 = no rest. */
  rest_between_sets_seconds: number;

  /**
   * When true the timer auto-advances to the next interval at T=0.
   * When false the user must tap to continue.
   */
  auto_advance: boolean;

  /** Ordered list of intervals. Minimum 1 entry. */
  intervals: Interval[];

  /** Per-sequence audio preferences. */
  audio_config: AudioConfig;

  /** ISO 8601 timestamp of creation. */
  created_at: string;

  /** ISO 8601 timestamp of last modification. */
  updated_at: string;

  /** ISO 8601 timestamp of last workout start, or null if never run. */
  last_used_at: string | null;
}
