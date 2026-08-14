/**
 * TimerEngine — Core state machine for the Schlag workout timer.
 *
 * DESIGN PRINCIPLES:
 * 1. **Absolute time**: Every interval stores the epoch timestamp when it
 *    started (`absoluteStartTime`). Remaining time is always computed as
 *    `absoluteStartTime + durationMs - Date.now() + pausedElapsed`.
 *    This eliminates drift accumulation entirely.
 *
 * 2. **No side effects**: The engine does NOT play audio or update UI.
 *    It emits which audio cues should fire via `getAudioCuesToFire()`,
 *    and returns a `TimerTickData` snapshot for the UI.
 *
 * 3. **Deterministic cue tracking**: A `Set<string>` of fired cue keys
 *    prevents double-firing even if tick() is called at irregular rates.
 *
 * 4. **Session persistence**: `saveSession()` / `restoreSession()` allow
 *    the engine to survive process kills during background.
 */

import type {
  Sequence,
  Interval,
  TimerState,
  TimerTickData,
  TimerSession,
  TimelineEntry,
  ToneName,
} from '@/types';

import {
  computeRemainingMs,
  computeIntervalProgress,
  flattenSequenceToTimeline,
  formatTime,
} from './timerCalculations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pre-fire buffer for native audio cues (ms). */
const AUDIO_PRE_FIRE_MS = 50;

/** Threshold for countdown cue detection (ms tolerance window).
 *  Widened from 150ms to 500ms to handle web tick jitter — if the
 *  rAF loop lags, we still detect countdown thresholds. */
const COUNTDOWN_WINDOW_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What the caller needs to know about the interval boundary that just fired
 * an end cue. Both values describe the interval that ENDED, which the engine
 * may already have advanced past by the time the caller reads them.
 */
export interface EndCueContext {
  /** Name of the interval that starts next, or null at the end of a workout. */
  nextIntervalName: string | null;

  /** True when the interval that ended was an auto-inserted rest period. */
  endedDuringRest: boolean;
}

/**
 * Build a rest interval for between-sets periods.
 */
function makeRestInterval(durationSeconds: number): Interval {
  return {
    id: '__rest_between_sets__',
    name: 'Rest',
    duration_seconds: durationSeconds,
    color: '#475569',
    note: '',
  };
}

// ---------------------------------------------------------------------------
// TimerEngine
// ---------------------------------------------------------------------------

export class TimerEngine {
  private state: TimerState | null = null;
  private sequence: Sequence | null = null;
  private timeline: TimelineEntry[] = [];
  private firedCues: Set<string> = new Set();

  /** End-of-interval cues queued by a boundary crossing inside tick().
   *  Drained by the next getAudioCuesToFire() call. */
  private pendingCues: ToneName[] = [];

  /** Context of the queued end cue, captured before the engine advances so
   *  the caller reads the right values however late it looks. */
  private pendingEndContext: EndCueContext | null = null;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start a new workout from the beginning.
   * Transition: idle -> running.
   */
  startWorkout(sequence: Sequence): void {
    if (sequence.intervals.length === 0) {
      throw new Error('Cannot start a workout with zero intervals.');
    }

    this.sequence = sequence;
    this.timeline = flattenSequenceToTimeline(sequence);
    this.firedCues.clear();
    this.pendingCues = [];
    this.pendingEndContext = null;

    this.state = {
      status: 'running',
      sequenceId: sequence.id,
      currentIntervalIndex: 0,
      currentRound: 1,
      absoluteStartTime: Date.now(),
      pausedElapsed: 0,
      pausedAt: null,
      isRestBetweenSets: false,
      finishAfterRound: false,
    };
  }

  /**
   * Pause the timer.
   * Transition: running -> paused.
   */
  pause(): void {
    if (!this.state || this.state.status !== 'running') return;
    this.state = {
      ...this.state,
      status: 'paused',
      pausedAt: Date.now(),
    };
  }

  /**
   * Resume from pause.
   * Transition: paused -> running.
   * Accumulates the paused duration into pausedElapsed.
   */
  resume(): void {
    if (!this.state || this.state.status !== 'paused' || this.state.pausedAt === null) return;

    const pauseDuration = Date.now() - this.state.pausedAt;
    this.state = {
      ...this.state,
      status: 'running',
      pausedElapsed: this.state.pausedElapsed + pauseDuration,
      pausedAt: null,
    };
  }

  /**
   * Skip to the next interval immediately.
   * If at the end of all rounds, completes the workout.
   */
  skip(): void {
    if (!this.state || !this.sequence) return;
    if (this.state.status !== 'running' && this.state.status !== 'paused') return;

    this.advanceToNext();
  }

  /**
   * Stop the workout entirely.
   * Transition: any -> idle.
   */
  stop(): void {
    this.state = null;
    this.sequence = null;
    this.timeline = [];
    this.firedCues.clear();
    this.pendingCues = [];
    this.pendingEndContext = null;
  }

  /**
   * In infinite repeat mode, signal that the workout should stop
   * after the current round completes.
   */
  requestFinishAfterRound(): void {
    if (!this.state) return;
    this.state = {
      ...this.state,
      finishAfterRound: true,
    };
  }

  // -----------------------------------------------------------------------
  // Tick — called by the UI loop every frame / 100ms
  // -----------------------------------------------------------------------

  /**
   * Compute the current timer snapshot. Returns null when no workout
   * is active.
   *
   * If the current interval has elapsed:
   *   - With auto_advance ON: automatically advances to the next interval.
   *   - With auto_advance OFF: remains at 0 until skip() is called.
   *   - At the very end of all rounds: transitions to 'completed'.
   */
  tick(): TimerTickData | null {
    if (!this.state || !this.sequence) return null;

    const { status } = this.state;
    if (status === 'idle' || status === 'completed') {
      return this.buildTickData(0);
    }

    let currentInterval = this.getCurrentInterval();
    let durationMs = currentInterval.duration_seconds * 1000;

    // When paused, compute remaining as if time froze at pausedAt.
    let remainingMs: number;
    if (status === 'paused' && this.state.pausedAt !== null) {
      const elapsedBeforePause =
        this.state.pausedAt - this.state.absoluteStartTime - this.state.pausedElapsed;
      remainingMs = Math.max(0, durationMs - elapsedBeforePause);
    } else {
      remainingMs = computeRemainingMs(
        this.state.absoluteStartTime,
        durationMs,
        this.state.pausedElapsed,
      );
    }

    // Check if interval is complete — use a loop instead of recursion
    // to handle multiple elapsed intervals (e.g. after backgrounding).
    let safetyCounter = 0;
    const MAX_ITERATIONS = 10000;

    // End cue for the boundary this tick crosses. Held aside until the loop
    // finishes: a long background gap fast-forwards through many intervals,
    // and only a genuine single crossing should beep.
    const crossingCues: ToneName[] = [];

    while (
      remainingMs <= 0 &&
      this.state.status === 'running' &&
      !this.isLastInterval() &&
      this.sequence.auto_advance &&
      safetyCounter < MAX_ITERATIONS
    ) {
      safetyCounter++;

      // Edge-triggered end cue: emitted at the instant the boundary is
      // crossed, before the engine advances. A time-window test would be
      // stepped over by the 100ms native tick roughly half the time.
      if (safetyCounter === 1) {
        this.emitEndCue(crossingCues);
      }

      // Anchor the next interval at the current interval's mathematical
      // end time (not Date.now()), so that after a long background gap
      // the loop genuinely fast-forwards through every elapsed interval
      // and lands on the correct one at the correct remaining time.
      const intervalEndTime =
        this.state.absoluteStartTime + durationMs + this.state.pausedElapsed;
      this.advanceToNext(intervalEndTime);

      // Recalculate for the new interval.
      currentInterval = this.getCurrentInterval();
      durationMs = currentInterval.duration_seconds * 1000;
      remainingMs = computeRemainingMs(
        this.state.absoluteStartTime,
        durationMs,
        this.state.pausedElapsed,
      );
    }

    // Exactly one boundary crossed — deliver its end cue. More than one means
    // the app was away and intervals elapsed unheard; a burst of beeps on
    // return would be noise, so those cues are dropped.
    if (safetyCounter === 1) {
      this.pendingCues.push(...crossingCues);
    }

    // After the loop, handle remaining edge cases.
    if (remainingMs <= 0 && this.state.status === 'running') {
      if (this.isLastInterval()) {
        // Workout complete.
        this.emitEndCue(this.pendingCues);
        this.state = { ...this.state, status: 'completed' };
        return this.buildTickData(0);
      }

      // Auto-advance OFF: freeze at 0, wait for skip().
      this.emitEndCue(this.pendingCues);
      return this.buildTickData(0);
    }

    return this.buildTickData(remainingMs);
  }

  // -----------------------------------------------------------------------
  // Audio cue detection
  // -----------------------------------------------------------------------

  /**
   * Determine which audio cues should fire at the given remaining time.
   * Uses the firedCues Set to prevent double-firing.
   *
   * This method is called by the UI loop after tick().
   * It accounts for the AUDIO_PRE_FIRE_MS buffer on native.
   *
   * @param remainingMs Current remaining milliseconds in the interval.
   * @returns Array of ToneNames to play this tick.
   */
  getAudioCuesToFire(remainingMs: number): ToneName[] {
    // Cues queued by a boundary crossing inside tick() are always delivered.
    // The crossing already happened, and on the final interval the status is
    // 'completed' by the time the caller gets here — the completion flourish
    // must still play.
    const cues: ToneName[] = this.pendingCues;
    this.pendingCues = [];

    if (!this.state || this.state.status !== 'running') return cues;

    const round = this.state.currentRound;
    const idx = this.state.currentIntervalIndex;
    const isRest = this.state.isRestBetweenSets;
    const prefix = `r${round}-i${idx}-rest${isRest}`;

    // Interval start cue: fired when interval begins (remaining close to full duration).
    // Skip for rest-between-sets intervals — rest should be silent.
    if (!isRest) {
      const startKey = `${prefix}-start`;
      if (!this.firedCues.has(startKey)) {
        // Fire on the first tick of a new interval.
        this.firedCues.add(startKey);
        cues.push('intervalStart');
      }
    }

    // Countdown cues at T-3, T-2, T-1 seconds.
    // Adjusted by AUDIO_PRE_FIRE_MS for native scheduling latency.
    // These fire for BOTH work and rest intervals — during rest they
    // warn the user that the next work interval is about to start.
    const adjustedRemaining = remainingMs - AUDIO_PRE_FIRE_MS;

    for (const sec of [3, 2, 1] as const) {
      const thresholdMs = sec * 1000;
      const cueKey = `${prefix}-cd${sec}`;

      if (
        !this.firedCues.has(cueKey) &&
        adjustedRemaining <= thresholdMs &&
        adjustedRemaining > thresholdMs - COUNTDOWN_WINDOW_MS - AUDIO_PRE_FIRE_MS
      ) {
        this.firedCues.add(cueKey);
        const toneMap: Record<number, ToneName> = {
          3: 'countdown3',
          2: 'countdown2',
          1: 'countdown1',
        };
        cues.push(toneMap[sec]);
      }
    }

    // v2: Halfway cue — fires when remaining crosses the halfway point.
    // Only for intervals >= 10 seconds. Skip during rest.
    if (!isRest) {
      const currentInterval = this.getCurrentInterval();
      const halfwayMs = (currentInterval.duration_seconds * 1000) / 2;
      if (currentInterval.duration_seconds >= 10) {
        const halfwayKey = `${prefix}-halfway`;
        if (
          !this.firedCues.has(halfwayKey) &&
          adjustedRemaining <= halfwayMs &&
          adjustedRemaining > halfwayMs - COUNTDOWN_WINDOW_MS - AUDIO_PRE_FIRE_MS
        ) {
          this.firedCues.add(halfwayKey);
          cues.push('halfway');
        }
      }
    }

    // Interval end cue at T=0. Pre-fires when a tick happens to land inside
    // the buffer; tick() emits the same cue at the boundary crossing when no
    // tick does, so it is never missed.
    if (remainingMs <= AUDIO_PRE_FIRE_MS) {
      this.emitEndCue(cues);
    }

    return cues;
  }

  /**
   * Consume the context of the most recent end cue, or null when there is
   * none left to read.
   *
   * Captured at the moment the boundary is detected, so the caller gets the
   * right values whether the cue pre-fired or was emitted after the engine
   * had already advanced past the interval that ended.
   */
  consumeEndCueContext(): EndCueContext | null {
    const context = this.pendingEndContext;
    this.pendingEndContext = null;
    return context;
  }

  /**
   * Emit the end-of-interval cue for the interval that is ending right now,
   * into `out`. Guarded by firedCues so it fires exactly once per interval.
   */
  private emitEndCue(out: ToneName[]): void {
    if (!this.state) return;

    const { currentRound, currentIntervalIndex, isRestBetweenSets } = this.state;
    const endKey = `r${currentRound}-i${currentIntervalIndex}-rest${isRestBetweenSets}-end`;
    if (this.firedCues.has(endKey)) return;
    this.firedCues.add(endKey);

    this.pendingEndContext = {
      nextIntervalName: this.getNextInterval()?.name ?? null,
      endedDuringRest: isRestBetweenSets,
    };

    out.push(this.isLastInterval() ? 'workoutComplete' : 'intervalEnd');
  }

  // -----------------------------------------------------------------------
  // State accessors
  // -----------------------------------------------------------------------

  getState(): TimerState | null {
    return this.state ? { ...this.state } : null;
  }

  getSequence(): Sequence | null {
    return this.sequence;
  }

  isActive(): boolean {
    return (
      this.state !== null &&
      (this.state.status === 'running' || this.state.status === 'paused')
    );
  }

  // -----------------------------------------------------------------------
  // Session persistence
  // -----------------------------------------------------------------------

  /**
   * Serialize the current session for MMKV storage.
   * Called when the app backgrounds.
   */
  saveSession(): TimerSession | null {
    if (!this.state || !this.sequence) return null;
    return {
      sequenceId: this.state.sequenceId,
      state: { ...this.state },
      savedAt: Date.now(),
    };
  }

  /**
   * Restore a persisted session.
   * The sequence must be provided separately (loaded from storage).
   *
   * If the session was running when saved, it remains running — the
   * absolute-time approach means the timer display will jump to the
   * correct position automatically on the next tick().
   *
   * If the session was paused, it stays paused at exactly where it was.
   *
   * If the saved interval index is out of range for the given sequence
   * (e.g. the sequence was edited while the process was dead), the
   * session is treated as invalid and the engine stays idle.
   */
  restoreSession(session: TimerSession, sequence: Sequence): void {
    const idx = session.state.currentIntervalIndex;
    if (idx < 0 || idx >= sequence.intervals.length) {
      this.stop();
      return;
    }

    this.sequence = sequence;
    this.timeline = flattenSequenceToTimeline(sequence);
    this.firedCues.clear();
    this.pendingCues = [];
    this.pendingEndContext = null;

    // If the session was running when saved, we need to account for the
    // time between save and restore. The absolute-time approach handles
    // this automatically — no adjustment needed.
    //
    // If it was paused, pausedAt is still set and the next resume() will
    // correctly compute the additional pause duration.
    this.state = { ...session.state };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Get the currently active Interval object.
   */
  private getCurrentInterval(): Interval {
    if (!this.state || !this.sequence) {
      throw new Error('No active workout.');
    }

    if (this.state.isRestBetweenSets) {
      return makeRestInterval(this.sequence.rest_between_sets_seconds);
    }

    return this.sequence.intervals[this.state.currentIntervalIndex];
  }

  /**
   * Get the next Interval object, or null if at the end.
   */
  private getNextInterval(): Interval | null {
    if (!this.state || !this.sequence) return null;

    const seq = this.sequence;
    const { currentIntervalIndex, currentRound, isRestBetweenSets } = this.state;
    const isInfinite = seq.repeat_count === 0;
    const totalRounds = isInfinite ? Infinity : seq.repeat_count;
    const lastIntervalIdx = seq.intervals.length - 1;

    if (isRestBetweenSets) {
      // After rest, next is the first interval of the next round.
      return seq.intervals[0];
    }

    if (currentIntervalIndex < lastIntervalIdx) {
      // More intervals in this round.
      return seq.intervals[currentIntervalIndex + 1];
    }

    // At the last interval of a round.
    if (currentRound < totalRounds && !this.state.finishAfterRound) {
      // More rounds to go.
      if (seq.rest_between_sets_seconds > 0) {
        return makeRestInterval(seq.rest_between_sets_seconds);
      }
      return seq.intervals[0];
    }

    // Final interval of final round (or finishing after this round).
    return null;
  }

  /**
   * Determine if the current position is the very last interval of the workout.
   */
  private isLastInterval(): boolean {
    if (!this.state || !this.sequence) return true;

    const seq = this.sequence;
    const { currentIntervalIndex, currentRound, isRestBetweenSets, finishAfterRound } = this.state;
    const isInfinite = seq.repeat_count === 0;

    // Rest between sets is never the last.
    if (isRestBetweenSets) return false;

    const isLastInRound = currentIntervalIndex >= seq.intervals.length - 1;

    if (!isLastInRound) return false;

    // If infinite mode and not finishing, never the last.
    if (isInfinite && !finishAfterRound) return false;

    // Finite: check if on the final round.
    if (!isInfinite && currentRound < seq.repeat_count) return false;

    // Infinite with finishAfterRound: this is the last.
    return true;
  }

  /**
   * Advance to the next interval or round.
   * Handles rest-between-sets insertion and infinite repeat looping.
   *
   * @param anchorAt Epoch ms at which the next interval starts. Defaults
   *   to Date.now() (correct for user-initiated skip()). The tick()
   *   catch-up loop passes the previous interval's mathematical end time
   *   instead, so multiple elapsed intervals fast-forward correctly
   *   after a long background gap.
   */
  private advanceToNext(anchorAt: number = Date.now()): void {
    if (!this.state || !this.sequence) return;

    const seq = this.sequence;
    const { currentIntervalIndex, currentRound, isRestBetweenSets } = this.state;
    const isInfinite = seq.repeat_count === 0;
    const totalRounds = isInfinite ? Infinity : seq.repeat_count;

    // Clear fired cues for the new interval.
    this.firedCues.clear();

    if (isRestBetweenSets) {
      // Rest period complete -> start next round's first interval.
      this.state = {
        ...this.state,
        status: 'running',
        currentIntervalIndex: 0,
        currentRound: currentRound + 1,
        absoluteStartTime: anchorAt,
        pausedElapsed: 0,
        pausedAt: null,
        isRestBetweenSets: false,
      };
      return;
    }

    if (currentIntervalIndex < seq.intervals.length - 1) {
      // More intervals in the current round.
      this.state = {
        ...this.state,
        status: 'running',
        currentIntervalIndex: currentIntervalIndex + 1,
        absoluteStartTime: anchorAt,
        pausedElapsed: 0,
        pausedAt: null,
      };
      return;
    }

    // At the end of a round.
    if (currentRound < totalRounds && !this.state.finishAfterRound) {
      // More rounds to go.
      if (seq.rest_between_sets_seconds > 0) {
        // Insert rest period.
        this.state = {
          ...this.state,
          status: 'running',
          absoluteStartTime: anchorAt,
          pausedElapsed: 0,
          pausedAt: null,
          isRestBetweenSets: true,
        };
      } else {
        // No rest, start next round immediately.
        this.state = {
          ...this.state,
          status: 'running',
          currentIntervalIndex: 0,
          currentRound: currentRound + 1,
          absoluteStartTime: anchorAt,
          pausedElapsed: 0,
          pausedAt: null,
        };
      }
      return;
    }

    // Infinite mode loop (finishAfterRound not set).
    if (isInfinite && !this.state.finishAfterRound) {
      if (seq.rest_between_sets_seconds > 0) {
        this.state = {
          ...this.state,
          status: 'running',
          absoluteStartTime: anchorAt,
          pausedElapsed: 0,
          pausedAt: null,
          isRestBetweenSets: true,
        };
      } else {
        this.state = {
          ...this.state,
          status: 'running',
          currentIntervalIndex: 0,
          currentRound: currentRound + 1,
          absoluteStartTime: anchorAt,
          pausedElapsed: 0,
          pausedAt: null,
        };
      }
      return;
    }

    // Workout complete.
    this.state = {
      ...this.state,
      status: 'completed',
    };
  }

  /**
   * Build the TimerTickData view model for the current state.
   */
  private buildTickData(remainingMs: number): TimerTickData {
    if (!this.state || !this.sequence) {
      throw new Error('No active workout.');
    }

    const currentInterval = this.getCurrentInterval();
    const durationMs = currentInterval.duration_seconds * 1000;
    const progress = computeIntervalProgress(remainingMs, durationMs);

    return {
      status: this.state.status,
      currentInterval,
      currentIntervalIndex: this.state.currentIntervalIndex,
      totalIntervals: this.sequence.intervals.length,
      currentRound: this.state.currentRound,
      totalRounds: this.sequence.repeat_count,
      remainingMs,
      intervalDurationMs: durationMs,
      progress,
      nextInterval: this.getNextInterval(),
      isRestBetweenSets: this.state.isRestBetweenSets,
      formattedTime: formatTime(remainingMs),
    };
  }
}
