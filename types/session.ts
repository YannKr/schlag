/**
 * WorkoutSession — v2 workout history logging.
 *
 * Every completed or partially completed workout is automatically logged.
 * Sessions store a frozen snapshot of the sequence at workout start so
 * edits to the sequence don't alter history.
 */

import type { Sequence } from './sequence';

/** Completion status of a workout session. */
export type SessionStatus = 'completed' | 'stopped' | 'in_progress';

/** A pause event within a workout session. */
export interface PauseEntry {
  paused_at: string; // ISO 8601
  resumed_at: string | null; // null if still paused
}

export interface WorkoutSession {
  /** Unique identifier (UUID v4). */
  id: string;

  /** ID of the sequence that was run. */
  sequence_id: string;

  /** Frozen copy of the sequence at workout start. Null for old sessions where snapshot was pruned. */
  sequence_snapshot: Sequence | null;

  /** ISO 8601 timestamp when the workout started. */
  started_at: string;

  /** ISO 8601 timestamp when the workout ended. Null if in progress. */
  ended_at: string | null;

  /** Completion status. */
  status: SessionStatus;

  /** If stopped early, the interval index where the user stopped. */
  stopped_at_interval: number | null;

  /** If stopped early, the round number where the user stopped. */
  stopped_at_round: number | null;

  /** Number of intervals fully completed. */
  intervals_completed: number;

  /** Number of full rounds completed. */
  rounds_completed: number;

  /** Total active (non-rest) time in seconds. */
  total_active_seconds: number;

  /** Total rest time in seconds. */
  total_rest_seconds: number;

  /** Array of pause/resume events. */
  pauses: PauseEntry[];

  /** ISO 8601 creation timestamp. */
  created_at: string;

  /** ISO 8601 last-updated timestamp. */
  updated_at: string;

  /** Soft-delete flag. Recoverable for 30 days. */
  deleted_at: string | null;
}
