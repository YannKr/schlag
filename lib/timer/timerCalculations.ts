/**
 * Pure utility functions for Schlag timer calculations.
 *
 * These are stateless, easily testable functions used by both the
 * TimerEngine and UI components.  All timing uses milliseconds
 * and absolute-time arithmetic to prevent drift accumulation.
 */

import type { Sequence, Interval, TimelineEntry, TimerState } from '@/types';

// ---------------------------------------------------------------------------
// Remaining time
// ---------------------------------------------------------------------------

/**
 * Compute the milliseconds remaining in the current interval.
 *
 * Uses absolute-time subtraction:
 *   remaining = startTime + durationMs - Date.now() - pausedElapsed
 *
 * @returns Remaining ms, clamped to >= 0.
 */
export function computeRemainingMs(
  startTime: number,
  durationMs: number,
  pausedElapsed: number,
): number {
  const now = Date.now();
  const remaining = startTime + durationMs - now + pausedElapsed;
  return Math.max(0, remaining);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Compute the progress fraction (0 = just started, 1 = complete) for the
 * current interval.
 *
 * @param remainingMs  Milliseconds remaining (from computeRemainingMs).
 * @param totalMs      Full duration of the interval in milliseconds.
 * @returns A number in [0, 1].
 */
export function computeIntervalProgress(
  remainingMs: number,
  totalMs: number,
): number {
  if (totalMs <= 0) return 1;
  const progress = 1 - remainingMs / totalMs;
  return Math.min(1, Math.max(0, progress));
}

// ---------------------------------------------------------------------------
// Total workout duration
// ---------------------------------------------------------------------------

/**
 * Compute the total duration of a workout in milliseconds, across all
 * intervals and rounds, including rest-between-sets periods.
 *
 * For infinite repeat (repeat_count === 0) this returns the duration
 * of a single round (no rest appended).
 */
export function computeTotalWorkoutDuration(sequence: Sequence): number {
  const roundMs = sequence.intervals.reduce(
    (sum, iv) => sum + iv.duration_seconds * 1000,
    0,
  );

  if (roundMs === 0) return 0;

  const rounds = sequence.repeat_count === 0 ? 1 : sequence.repeat_count;
  const restMs = sequence.rest_between_sets_seconds * 1000;

  // Rest is inserted between rounds, so (rounds - 1) rest periods.
  const totalRestMs = rounds > 1 ? (rounds - 1) * restMs : 0;

  return rounds * roundMs + totalRestMs;
}

// ---------------------------------------------------------------------------
// Timeline flattening
// ---------------------------------------------------------------------------

/**
 * Create a virtual "Rest" interval used between sets.
 */
function makeRestInterval(durationSeconds: number): Interval {
  return {
    id: '__rest_between_sets__',
    name: 'Rest',
    duration_seconds: durationSeconds,
    color: '#475569', // Slate
    note: '',
  };
}

/**
 * Expand a sequence into a flat ordered list of timeline entries.
 *
 * Each entry represents one interval to be executed, in order.  Rounds are
 * unrolled and rest-between-sets intervals are inserted between rounds
 * (not after the final round).
 *
 * For infinite repeat (repeat_count === 0), returns a single round with
 * no rest appended (the engine handles looping dynamically).
 */
export function flattenSequenceToTimeline(
  sequence: Sequence,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const rounds = sequence.repeat_count === 0 ? 1 : sequence.repeat_count;
  const hasRest =
    sequence.rest_between_sets_seconds > 0 && rounds > 1;

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < sequence.intervals.length; i++) {
      entries.push({
        interval: sequence.intervals[i],
        round,
        indexInRound: i,
        isRestBetweenSets: false,
      });
    }

    // Insert rest between sets after each round except the last.
    if (hasRest && round < rounds) {
      entries.push({
        interval: makeRestInterval(sequence.rest_between_sets_seconds),
        round,
        indexInRound: sequence.intervals.length, // virtual index after all intervals
        isRestBetweenSets: true,
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Notification boundary events
// ---------------------------------------------------------------------------

/**
 * An upcoming interval-boundary event, used to schedule OS-level local
 * notifications when the app is backgrounded (JS audio cues cannot fire
 * from a backgrounded managed RN app).
 */
export interface BoundaryEvent {
  /** Absolute epoch ms when the notification should fire. */
  fireDate: number;
  title: string;
  body: string;
}

/** Platform-safe cap on scheduled notifications (iOS allows 64 pending). */
export const MAX_BOUNDARY_EVENTS = 60;

/** Position within the unrolled workout timeline. */
interface TimelinePosition {
  intervalIndex: number;
  round: number;
  isRestBetweenSets: boolean;
}

/**
 * Compute the position that follows `pos`, mirroring the TimerEngine's
 * advance semantics (rest-between-sets insertion, round looping,
 * finish-after-round). Returns null when `pos` is the final interval.
 */
function nextPosition(
  sequence: Sequence,
  pos: TimelinePosition,
  finishAfterRound: boolean,
): TimelinePosition | null {
  const isInfinite = sequence.repeat_count === 0;
  const totalRounds = isInfinite ? Infinity : sequence.repeat_count;

  if (pos.isRestBetweenSets) {
    // Rest complete -> first interval of the next round.
    return { intervalIndex: 0, round: pos.round + 1, isRestBetweenSets: false };
  }

  if (pos.intervalIndex < sequence.intervals.length - 1) {
    // More intervals in this round.
    return {
      intervalIndex: pos.intervalIndex + 1,
      round: pos.round,
      isRestBetweenSets: false,
    };
  }

  // At the last interval of a round.
  if (pos.round < totalRounds && !finishAfterRound) {
    if (sequence.rest_between_sets_seconds > 0) {
      return { ...pos, isRestBetweenSets: true };
    }
    return { intervalIndex: 0, round: pos.round + 1, isRestBetweenSets: false };
  }

  // Final interval of the final round (or finishing after this round).
  return null;
}

/**
 * Compute the upcoming interval-boundary events for a running workout.
 *
 * Pure function: anchored to the engine's absolute start time plus
 * accumulated paused time, so the result is exact regardless of when
 * it is called within the current interval.
 *
 * - Each interval transition produces a "Next: [name]" event.
 * - The final boundary produces a "Workout complete 🎉" event.
 * - With auto-advance OFF the timer freezes at each boundary until the
 *   user taps, so only the first boundary is real.
 * - Events in the past (fireDate <= now) are skipped.
 * - Capped at `maxEvents` (infinite-repeat sequences cap naturally).
 *
 * Returns [] unless the state is 'running'.
 */
export function computeUpcomingBoundaries(
  sequence: Sequence,
  state: TimerState,
  now: number = Date.now(),
  maxEvents: number = MAX_BOUNDARY_EVENTS,
): BoundaryEvent[] {
  if (state.status !== 'running' || sequence.intervals.length === 0) return [];

  const durationMsAt = (pos: TimelinePosition): number =>
    (pos.isRestBetweenSets
      ? sequence.rest_between_sets_seconds
      : sequence.intervals[pos.intervalIndex].duration_seconds) * 1000;

  const nameAt = (pos: TimelinePosition): string =>
    pos.isRestBetweenSets ? 'Rest' : sequence.intervals[pos.intervalIndex].name;

  const events: BoundaryEvent[] = [];

  let pos: TimelinePosition = {
    intervalIndex: state.currentIntervalIndex,
    round: state.currentRound,
    isRestBetweenSets: state.isRestBetweenSets,
  };

  // End of the current interval, anchored to its absolute start time
  // shifted by the time spent paused.
  let boundaryTime = state.absoluteStartTime + state.pausedElapsed + durationMsAt(pos);

  // Safety bound mirrors TimerEngine's advance loop.
  let safetyCounter = 0;
  const MAX_ITERATIONS = 10000;

  while (events.length < maxEvents && safetyCounter < MAX_ITERATIONS) {
    safetyCounter++;

    const next = nextPosition(sequence, pos, state.finishAfterRound);

    if (boundaryTime > now) {
      if (next === null) {
        events.push({
          fireDate: boundaryTime,
          title: 'Workout complete 🎉',
          body: sequence.name,
        });
      } else {
        events.push({
          fireDate: boundaryTime,
          title: `Next: ${nameAt(next)}`,
          body: `${nameAt(pos)} complete · ${formatTime(durationMsAt(next))}`,
        });
      }
    }

    if (next === null) break;

    // Auto-advance OFF: the timer freezes at the boundary until the user
    // taps, so later boundaries have no predictable fire time.
    if (!sequence.auto_advance) break;

    pos = next;
    boundaryTime += durationMsAt(pos);
  }

  return events;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as "MM:SS" or "H:MM:SS" if >= 1 hour.
 * Returns "00:00" for zero or negative values.
 */
export function formatTime(ms: number): string {
  if (ms <= 0) return '00:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Format milliseconds as "MM:SS.T" (with tenths) or "H:MM:SS.T" if >= 1 hour.
 * Returns "00:00.0" for zero or negative values.
 */
export function formatTimeWithTenths(ms: number): string {
  if (ms <= 0) return '00:00.0';

  const tenths = Math.floor((ms % 1000) / 100);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}.${tenths}`;
}
