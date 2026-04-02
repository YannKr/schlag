/**
 * Timer state and derived tick data for the Schlag workout engine.
 *
 * TimerState is the persisted source of truth stored in Zustand / MMKV.
 * TimerTickData is the computed view model derived every animation frame.
 */

import { Interval } from './interval';

/** Lifecycle states of the timer engine. */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

/**
 * Core timer state -- persisted to local storage so a killed process
 * can resume the workout.  All timing is absolute (Date.now() based).
 */
export interface TimerState {
  status: TimerStatus;

  /** ID of the sequence being run. */
  sequenceId: string;

  /** Zero-based index into the sequence's interval list. */
  currentIntervalIndex: number;

  /** One-based round number (1 = first pass through the interval list). */
  currentRound: number;

  /**
   * Absolute timestamp (ms since epoch) when the current interval started.
   * Used to compute elapsed time without accumulation drift.
   */
  absoluteStartTime: number;

  /** Total milliseconds spent paused during the current interval. */
  pausedElapsed: number;

  /** Timestamp when the timer was paused, or null if running. */
  pausedAt: number | null;

  /** True when the timer is in an auto-inserted rest-between-sets period. */
  isRestBetweenSets: boolean;

  /**
   * In infinite-repeat mode, the user can tap "Finish after this round"
   * to let the current set complete and then stop.
   */
  finishAfterRound: boolean;
}

/**
 * Computed view model emitted every tick (animation frame / 100 ms interval).
 * Components subscribe to this for rendering -- it contains everything needed
 * to draw the workout screen without re-deriving from TimerState.
 */
export interface TimerTickData {
  status: TimerStatus;

  /** The interval currently counting down. */
  currentInterval: Interval;

  /** Zero-based index of the current interval. */
  currentIntervalIndex: number;

  /** Total number of intervals in one round. */
  totalIntervals: number;

  /** One-based current round. */
  currentRound: number;

  /** Total rounds (0 = infinite). */
  totalRounds: number;

  /** Milliseconds remaining in the current interval. */
  remainingMs: number;

  /** Full duration of the current interval in milliseconds. */
  intervalDurationMs: number;

  /** Progress fraction 0..1 (elapsed / total for the current interval). */
  progress: number;

  /** The next interval, or null if this is the last interval of the last round. */
  nextInterval: Interval | null;

  /** True when in an auto-inserted rest-between-sets period. */
  isRestBetweenSets: boolean;

  /** Pre-formatted countdown string, e.g. "01:23" or "1:05:30". */
  formattedTime: string;
}

/**
 * A flattened entry in the workout timeline used by the expanded view
 * to show the full list of upcoming intervals across all rounds.
 */
export interface TimelineEntry {
  /** The interval data. */
  interval: Interval;

  /** One-based round this entry belongs to. */
  round: number;

  /** Zero-based index of this interval within its round. */
  indexInRound: number;

  /** True if this entry represents a rest-between-sets period. */
  isRestBetweenSets: boolean;
}

/**
 * Serialized timer session saved to MMKV on app background.
 * Used to restore a workout after the process is killed.
 */
export interface TimerSession {
  sequenceId: string;
  state: TimerState;

  /** Timestamp (ms since epoch) when this session was persisted. */
  savedAt: number;
}
