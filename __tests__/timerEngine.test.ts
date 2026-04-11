/**
 * Comprehensive unit tests for the Schlag TimerEngine.
 *
 * The engine is a pure state machine with no side effects -- it computes
 * timer snapshots and audio cue lists from absolute timestamps.  We control
 * time via `jest.spyOn(Date, 'now')` so every assertion is deterministic.
 */

import { TimerEngine } from '@/lib/timer/timerEngine';
import type { Sequence, Interval, TimerSession, ToneName } from '@/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let intervalCounter = 0;

function makeInterval(overrides?: Partial<Interval>): Interval {
  intervalCounter += 1;
  return {
    id: `interval-${intervalCounter}`,
    name: `Interval ${intervalCounter}`,
    duration_seconds: 10,
    color: '#E63946',
    note: '',
    ...overrides,
  };
}

function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    id: 'seq-1',
    name: 'Test Sequence',
    description: '',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [makeInterval(), makeInterval()],
    audio_config: {
      use_voice_countdown: false,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_used_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let engine: TimerEngine;
let dateNowSpy: jest.SpyInstance;
let now: number;

/**
 * Advance the mocked clock by `ms` milliseconds.
 */
function advanceTime(ms: number): void {
  now += ms;
  dateNowSpy.mockReturnValue(now);
}

/**
 * Set the mocked clock to an absolute value.
 */
function setTime(ms: number): void {
  now = ms;
  dateNowSpy.mockReturnValue(now);
}

beforeEach(() => {
  intervalCounter = 0;
  engine = new TimerEngine();
  now = 1_000_000;
  dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  dateNowSpy.mockRestore();
});

// ===========================================================================
// 1. Lifecycle
// ===========================================================================

describe('Lifecycle', () => {
  describe('startWorkout()', () => {
    it('sets status to running, round 1, index 0', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);

      const state = engine.getState();
      expect(state).not.toBeNull();
      expect(state!.status).toBe('running');
      expect(state!.currentRound).toBe(1);
      expect(state!.currentIntervalIndex).toBe(0);
      expect(state!.pausedAt).toBeNull();
      expect(state!.pausedElapsed).toBe(0);
      expect(state!.isRestBetweenSets).toBe(false);
      expect(state!.finishAfterRound).toBe(false);
    });

    it('records absoluteStartTime as Date.now()', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      expect(engine.getState()!.absoluteStartTime).toBe(now);
    });

    it('throws when given empty intervals', () => {
      const seq = makeSequence({ intervals: [] });
      expect(() => engine.startWorkout(seq)).toThrow(
        'Cannot start a workout with zero intervals.',
      );
    });

    it('stores the sequence reference', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      expect(engine.getSequence()).toEqual(seq);
    });

    it('marks engine as active', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      expect(engine.isActive()).toBe(true);
    });
  });

  describe('pause()', () => {
    it('transitions status from running to paused', () => {
      engine.startWorkout(makeSequence());
      advanceTime(2000);
      engine.pause();

      const state = engine.getState()!;
      expect(state.status).toBe('paused');
    });

    it('records pausedAt timestamp', () => {
      engine.startWorkout(makeSequence());
      advanceTime(3000);
      engine.pause();

      expect(engine.getState()!.pausedAt).toBe(now);
    });

    it('is a no-op when not running', () => {
      engine.startWorkout(makeSequence());
      engine.pause();
      const afterFirstPause = engine.getState()!.pausedAt;

      advanceTime(500);
      engine.pause(); // Should be no-op since already paused
      expect(engine.getState()!.pausedAt).toBe(afterFirstPause);
    });

    it('is a no-op when no workout is active', () => {
      engine.pause();
      expect(engine.getState()).toBeNull();
    });

    it('keeps engine as active', () => {
      engine.startWorkout(makeSequence());
      engine.pause();
      expect(engine.isActive()).toBe(true);
    });
  });

  describe('resume()', () => {
    it('transitions status from paused to running', () => {
      engine.startWorkout(makeSequence());
      engine.pause();
      advanceTime(1000);
      engine.resume();

      expect(engine.getState()!.status).toBe('running');
    });

    it('accumulates paused duration into pausedElapsed', () => {
      engine.startWorkout(makeSequence());
      advanceTime(2000);
      engine.pause();

      advanceTime(3000);
      engine.resume();

      expect(engine.getState()!.pausedElapsed).toBe(3000);
      expect(engine.getState()!.pausedAt).toBeNull();
    });

    it('accumulates across multiple pause/resume cycles', () => {
      engine.startWorkout(makeSequence());
      advanceTime(1000);
      engine.pause();
      advanceTime(500);
      engine.resume();

      advanceTime(1000);
      engine.pause();
      advanceTime(700);
      engine.resume();

      expect(engine.getState()!.pausedElapsed).toBe(1200); // 500 + 700
    });

    it('is a no-op when not paused', () => {
      engine.startWorkout(makeSequence());
      const before = engine.getState()!;
      engine.resume(); // Already running, should be no-op
      const after = engine.getState()!;

      expect(after.pausedElapsed).toBe(before.pausedElapsed);
    });

    it('is a no-op when no workout is active', () => {
      engine.resume();
      expect(engine.getState()).toBeNull();
    });
  });

  describe('stop()', () => {
    it('clears all state so tick() returns null', () => {
      engine.startWorkout(makeSequence());
      engine.stop();

      expect(engine.getState()).toBeNull();
      expect(engine.getSequence()).toBeNull();
      expect(engine.tick()).toBeNull();
      expect(engine.isActive()).toBe(false);
    });

    it('can be called when no workout is active without error', () => {
      expect(() => engine.stop()).not.toThrow();
    });
  });

  describe('skip()', () => {
    it('advances to the next interval', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);

      const stateBefore = engine.getState()!;
      expect(stateBefore.currentIntervalIndex).toBe(0);

      engine.skip();

      const stateAfter = engine.getState()!;
      expect(stateAfter.currentIntervalIndex).toBe(1);
    });

    it('completes the workout when at the last interval of the last round', () => {
      const seq = makeSequence({ repeat_count: 1 });
      engine.startWorkout(seq);

      engine.skip(); // move to interval 1 (last)
      engine.skip(); // should complete

      expect(engine.getState()!.status).toBe('completed');
    });

    it('works when paused', () => {
      engine.startWorkout(makeSequence());
      engine.pause();
      engine.skip();

      // Should have advanced and set status to running
      const state = engine.getState()!;
      expect(state.currentIntervalIndex).toBe(1);
      expect(state.status).toBe('running');
    });

    it('is a no-op when no workout is active', () => {
      expect(() => engine.skip()).not.toThrow();
    });

    it('resets absoluteStartTime and pausedElapsed for the new interval', () => {
      engine.startWorkout(makeSequence());
      advanceTime(3000);

      engine.skip();

      const state = engine.getState()!;
      expect(state.absoluteStartTime).toBe(now);
      expect(state.pausedElapsed).toBe(0);
    });
  });

  describe('requestFinishAfterRound()', () => {
    it('sets finishAfterRound flag', () => {
      const seq = makeSequence({ repeat_count: 0 }); // infinite
      engine.startWorkout(seq);
      engine.requestFinishAfterRound();

      expect(engine.getState()!.finishAfterRound).toBe(true);
    });

    it('is a no-op when no workout is active', () => {
      expect(() => engine.requestFinishAfterRound()).not.toThrow();
    });
  });
});

// ===========================================================================
// 2. tick() behavior
// ===========================================================================

describe('tick() behavior', () => {
  it('returns null when no workout is active', () => {
    expect(engine.tick()).toBeNull();
  });

  it('returns TimerTickData with correct fields', () => {
    const intervals = [makeInterval({ duration_seconds: 30 }), makeInterval()];
    const seq = makeSequence({ intervals });
    engine.startWorkout(seq);

    const tick = engine.tick()!;
    expect(tick.status).toBe('running');
    expect(tick.currentInterval).toEqual(intervals[0]);
    expect(tick.currentIntervalIndex).toBe(0);
    expect(tick.totalIntervals).toBe(2);
    expect(tick.currentRound).toBe(1);
    expect(tick.totalRounds).toBe(1);
    expect(tick.intervalDurationMs).toBe(30_000);
    expect(tick.isRestBetweenSets).toBe(false);
    expect(tick.nextInterval).toEqual(intervals[1]);
  });

  it('computes remaining time correctly using absolute timestamps', () => {
    const seq = makeSequence({
      intervals: [makeInterval({ duration_seconds: 10 })],
    });
    engine.startWorkout(seq);

    advanceTime(3000);
    const tick = engine.tick()!;
    expect(tick.remainingMs).toBe(7000);
  });

  it('computes progress correctly', () => {
    const seq = makeSequence({
      intervals: [makeInterval({ duration_seconds: 10 })],
    });
    engine.startWorkout(seq);

    advanceTime(5000); // 50% elapsed
    const tick = engine.tick()!;
    expect(tick.progress).toBeCloseTo(0.5, 2);
  });

  it('formats time correctly', () => {
    const seq = makeSequence({
      intervals: [makeInterval({ duration_seconds: 90 })],
    });
    engine.startWorkout(seq);

    // 90s remaining at start
    const tick = engine.tick()!;
    expect(tick.formattedTime).toBe('01:30');
  });

  describe('auto_advance ON', () => {
    it('auto-advances to next interval when remaining <= 0', () => {
      const seq = makeSequence({
        auto_advance: true,
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 10 }),
        ],
      });
      engine.startWorkout(seq);

      advanceTime(5000); // interval 0 fully elapsed
      const tick = engine.tick()!;

      expect(tick.currentIntervalIndex).toBe(1);
      expect(tick.status).toBe('running');
    });

    it('sets new absoluteStartTime after auto-advance', () => {
      const seq = makeSequence({
        auto_advance: true,
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 10 }),
        ],
      });
      engine.startWorkout(seq);

      advanceTime(5000);
      engine.tick();

      const state = engine.getState()!;
      expect(state.absoluteStartTime).toBe(now);
      expect(state.pausedElapsed).toBe(0);
    });
  });

  describe('auto_advance OFF', () => {
    it('stays at 0 and waits for skip()', () => {
      const seq = makeSequence({
        auto_advance: false,
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 10 }),
        ],
      });
      engine.startWorkout(seq);

      advanceTime(6000); // well past the 5s duration
      const tick = engine.tick()!;

      expect(tick.remainingMs).toBe(0);
      expect(tick.currentIntervalIndex).toBe(0); // did NOT advance
      expect(tick.status).toBe('running');
    });

    it('advances after manual skip()', () => {
      const seq = makeSequence({
        auto_advance: false,
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 10 }),
        ],
      });
      engine.startWorkout(seq);

      advanceTime(6000);
      engine.tick(); // interval 0 at 0, waiting
      engine.skip();

      const tick = engine.tick()!;
      expect(tick.currentIntervalIndex).toBe(1);
    });
  });

  describe('workout completion', () => {
    it('transitions to completed when last interval finishes (auto_advance ON)', () => {
      const seq = makeSequence({
        auto_advance: true,
        repeat_count: 1,
        intervals: [makeInterval({ duration_seconds: 5 })],
      });
      engine.startWorkout(seq);

      advanceTime(5000);
      const tick = engine.tick()!;

      expect(tick.status).toBe('completed');
      expect(tick.remainingMs).toBe(0);
    });

    it('transitions to completed when last interval finishes (auto_advance OFF)', () => {
      const seq = makeSequence({
        auto_advance: false,
        repeat_count: 1,
        intervals: [makeInterval({ duration_seconds: 5 })],
      });
      engine.startWorkout(seq);

      advanceTime(5000);
      const tick = engine.tick()!;

      // Even with auto_advance OFF, the very last interval completes the workout
      expect(tick.status).toBe('completed');
    });
  });

  describe('paused state', () => {
    it('freezes remaining time (does not decrease while paused)', () => {
      const seq = makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      });
      engine.startWorkout(seq);

      advanceTime(3000);
      engine.pause();

      const tickAtPause = engine.tick()!;
      expect(tickAtPause.remainingMs).toBe(7000);

      advanceTime(5000); // time passes but should not affect remaining
      const tickLater = engine.tick()!;
      expect(tickLater.remainingMs).toBe(7000); // unchanged
    });

    it('resumes from the correct position', () => {
      const seq = makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      });
      engine.startWorkout(seq);

      advanceTime(3000);
      engine.pause();
      advanceTime(5000); // paused for 5s
      engine.resume();

      // Immediately after resume, remaining should still be 7s
      const tick = engine.tick()!;
      expect(tick.remainingMs).toBe(7000);

      // Now advance 2 more seconds while running
      advanceTime(2000);
      const tick2 = engine.tick()!;
      expect(tick2.remainingMs).toBe(5000);
    });
  });
});

// ===========================================================================
// 3. Multi-round behavior
// ===========================================================================

describe('Multi-round behavior', () => {
  it('advances rounds correctly (2 rounds, no rest)', () => {
    const intervals = [
      makeInterval({ duration_seconds: 5 }),
      makeInterval({ duration_seconds: 5 }),
    ];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 0,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Complete interval 0 of round 1
    advanceTime(5000);
    let tick = engine.tick()!;
    expect(tick.currentRound).toBe(1);
    expect(tick.currentIntervalIndex).toBe(1);

    // Complete interval 1 of round 1 -> should go to round 2, interval 0
    advanceTime(5000);
    tick = engine.tick()!;
    expect(tick.currentRound).toBe(2);
    expect(tick.currentIntervalIndex).toBe(0);

    // Complete interval 0 of round 2
    advanceTime(5000);
    tick = engine.tick()!;
    expect(tick.currentRound).toBe(2);
    expect(tick.currentIntervalIndex).toBe(1);

    // Complete interval 1 of round 2 -> workout complete
    advanceTime(5000);
    tick = engine.tick()!;
    expect(tick.status).toBe('completed');
  });

  it('inserts rest-between-sets when configured', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Complete interval 0 of round 1 -> should enter rest
    advanceTime(5000);
    let tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);
    expect(tick.currentInterval.name).toBe('Rest');
    expect(tick.currentInterval.duration_seconds).toBe(10);
    expect(tick.currentInterval.id).toBe('__rest_between_sets__');
  });

  it('rest interval has correct color (Slate)', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.currentInterval.color).toBe('#475569');
  });

  it('starts next round at index 0 after rest completes', () => {
    const intervals = [
      makeInterval({ duration_seconds: 5 }),
      makeInterval({ duration_seconds: 5 }),
    ];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 3,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Complete both intervals of round 1
    advanceTime(5000);
    engine.tick(); // -> interval 1
    advanceTime(5000);
    let tick = engine.tick()!; // -> rest
    expect(tick.isRestBetweenSets).toBe(true);

    // Complete rest -> should start round 2 at index 0
    advanceTime(3000);
    tick = engine.tick()!;
    expect(tick.currentRound).toBe(2);
    expect(tick.currentIntervalIndex).toBe(0);
    expect(tick.isRestBetweenSets).toBe(false);
  });

  it('does not insert rest after the final round', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Round 1 complete -> rest
    advanceTime(5000);
    let tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);

    // Rest complete -> round 2
    advanceTime(10000);
    tick = engine.tick()!;
    expect(tick.currentRound).toBe(2);
    expect(tick.isRestBetweenSets).toBe(false);

    // Round 2 complete -> should be completed, NOT rest
    advanceTime(5000);
    tick = engine.tick()!;
    expect(tick.status).toBe('completed');
  });

  it('reports correct totalRounds in tick data', () => {
    const seq = makeSequence({ repeat_count: 3 });
    engine.startWorkout(seq);
    const tick = engine.tick()!;
    expect(tick.totalRounds).toBe(3);
  });

  it('reports nextInterval correctly during rest between sets', () => {
    const intervals = [makeInterval({ duration_seconds: 5, name: 'Work' })];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 5,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);
    // Next after rest should be first interval of next round
    expect(tick.nextInterval).not.toBeNull();
    expect(tick.nextInterval!.name).toBe('Work');
  });
});

// ===========================================================================
// 4. Infinite mode
// ===========================================================================

describe('Infinite mode', () => {
  it('loops indefinitely (rounds keep incrementing)', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 0, // infinite
      rest_between_sets_seconds: 0,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    for (let expectedRound = 1; expectedRound <= 5; expectedRound++) {
      const tick = engine.tick()!;
      expect(tick.currentRound).toBe(expectedRound);
      expect(tick.status).toBe('running');
      advanceTime(5000);
    }
  });

  it('reports totalRounds as 0 for infinite mode', () => {
    const seq = makeSequence({ repeat_count: 0 });
    engine.startWorkout(seq);
    const tick = engine.tick()!;
    expect(tick.totalRounds).toBe(0);
  });

  it('requestFinishAfterRound() causes completion after current round', () => {
    const intervals = [
      makeInterval({ duration_seconds: 5 }),
      makeInterval({ duration_seconds: 5 }),
    ];
    const seq = makeSequence({
      repeat_count: 0,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // In the middle of round 1, request finish
    advanceTime(3000);
    engine.requestFinishAfterRound();

    // Complete interval 0
    advanceTime(2000);
    let tick = engine.tick()!;
    expect(tick.currentIntervalIndex).toBe(1);
    expect(tick.status).toBe('running');

    // Complete interval 1 (last in round) -> should complete
    advanceTime(5000);
    tick = engine.tick()!;
    expect(tick.status).toBe('completed');
  });

  it('infinite mode with rest between sets inserts rest correctly', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 0,
      rest_between_sets_seconds: 3,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Complete round 1 -> should go to rest
    advanceTime(5000);
    let tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);
    expect(tick.currentInterval.name).toBe('Rest');

    // Complete rest -> round 2
    advanceTime(3000);
    tick = engine.tick()!;
    expect(tick.currentRound).toBe(2);
    expect(tick.isRestBetweenSets).toBe(false);
  });

  it('nextInterval is not null in infinite mode (always more work to do)', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 0,
      rest_between_sets_seconds: 0,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    const tick = engine.tick()!;
    // In infinite mode without finishAfterRound, the next interval should
    // be the first interval of the next round (loops back).
    expect(tick.nextInterval).not.toBeNull();
  });

  it('nextInterval is null when finishAfterRound is set and on last interval', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 0,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);
    engine.requestFinishAfterRound();

    const tick = engine.tick()!;
    // finishAfterRound + last interval in round -> no next
    expect(tick.nextInterval).toBeNull();
  });
});

// ===========================================================================
// 5. Audio cue detection (getAudioCuesToFire)
// ===========================================================================

describe('Audio cue detection (getAudioCuesToFire)', () => {
  it('fires intervalStart on the first tick of a new interval', () => {
    engine.startWorkout(makeSequence());
    const cues = engine.getAudioCuesToFire(10_000);
    expect(cues).toContain('intervalStart');
  });

  it('does NOT double-fire intervalStart on subsequent calls', () => {
    engine.startWorkout(makeSequence());
    engine.getAudioCuesToFire(10_000);
    const cues2 = engine.getAudioCuesToFire(9_500);
    expect(cues2).not.toContain('intervalStart');
  });

  it('fires countdown3 cue near T-3 seconds', () => {
    engine.startWorkout(
      makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      }),
    );

    // Fire intervalStart first
    engine.getAudioCuesToFire(10_000);

    // Remaining is near 3000ms (accounting for 50ms pre-fire)
    // adjustedRemaining = 3000 - 50 = 2950 which is <= 3000 and > 3000 - 200 = 2800
    const cues = engine.getAudioCuesToFire(3000);
    expect(cues).toContain('countdown3');
  });

  it('fires countdown2 cue near T-2 seconds', () => {
    engine.startWorkout(
      makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      }),
    );
    engine.getAudioCuesToFire(10_000); // clear intervalStart

    // Fire countdown3 first so it doesn't interfere
    engine.getAudioCuesToFire(3000);

    const cues = engine.getAudioCuesToFire(2000);
    expect(cues).toContain('countdown2');
  });

  it('fires countdown1 cue near T-1 second', () => {
    engine.startWorkout(
      makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      }),
    );
    engine.getAudioCuesToFire(10_000);
    engine.getAudioCuesToFire(3000);
    engine.getAudioCuesToFire(2000);

    const cues = engine.getAudioCuesToFire(1000);
    expect(cues).toContain('countdown1');
  });

  it('fires intervalEnd at T=0 for non-final interval', () => {
    const seq = makeSequence({
      intervals: [
        makeInterval({ duration_seconds: 5 }),
        makeInterval({ duration_seconds: 5 }),
      ],
    });
    engine.startWorkout(seq);
    engine.getAudioCuesToFire(5000); // intervalStart

    // remainingMs <= 50 (AUDIO_PRE_FIRE_MS)
    const cues = engine.getAudioCuesToFire(30);
    expect(cues).toContain('intervalEnd');
    expect(cues).not.toContain('workoutComplete');
  });

  it('fires workoutComplete instead of intervalEnd on the final interval', () => {
    const seq = makeSequence({
      repeat_count: 1,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);
    engine.getAudioCuesToFire(5000); // intervalStart

    const cues = engine.getAudioCuesToFire(30); // near T=0
    expect(cues).toContain('workoutComplete');
    expect(cues).not.toContain('intervalEnd');
  });

  it('does NOT double-fire end cue on repeated calls', () => {
    const seq = makeSequence({
      repeat_count: 1,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);
    engine.getAudioCuesToFire(5000); // intervalStart
    engine.getAudioCuesToFire(30); // workoutComplete fires

    const cues = engine.getAudioCuesToFire(0);
    expect(cues).not.toContain('workoutComplete');
    expect(cues).not.toContain('intervalEnd');
  });

  it('returns empty array when paused', () => {
    engine.startWorkout(makeSequence());
    engine.pause();
    const cues = engine.getAudioCuesToFire(5000);
    expect(cues).toEqual([]);
  });

  it('returns empty array when no workout is active', () => {
    const cues = engine.getAudioCuesToFire(5000);
    expect(cues).toEqual([]);
  });

  it('fires intervalStart on newly advanced interval after skip()', () => {
    const seq = makeSequence({
      intervals: [
        makeInterval({ duration_seconds: 10 }),
        makeInterval({ duration_seconds: 10 }),
      ],
    });
    engine.startWorkout(seq);
    engine.getAudioCuesToFire(10_000); // intervalStart for interval 0

    engine.skip(); // advance to interval 1

    // firedCues is cleared on advance, so intervalStart should fire again
    const cues = engine.getAudioCuesToFire(10_000);
    expect(cues).toContain('intervalStart');
  });

  it('can fire multiple cues in a single call', () => {
    engine.startWorkout(
      makeSequence({
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 5 }),
        ],
      }),
    );

    // First tick when remaining is near 1000ms
    // This should fire both intervalStart and countdown1
    // adjustedRemaining = 1000 - 50 = 950 which is <= 1000 and > 1000 - 200 = 800
    const cues = engine.getAudioCuesToFire(1000);
    expect(cues).toContain('intervalStart');
    expect(cues).toContain('countdown1');
  });

  it('fires all three countdown cues in correct order when checked at correct times', () => {
    engine.startWorkout(
      makeSequence({
        intervals: [makeInterval({ duration_seconds: 10 })],
      }),
    );
    engine.getAudioCuesToFire(10_000); // intervalStart

    const firedTones: ToneName[] = [];

    // T-3
    firedTones.push(...engine.getAudioCuesToFire(3000));
    // T-2
    firedTones.push(...engine.getAudioCuesToFire(2000));
    // T-1
    firedTones.push(...engine.getAudioCuesToFire(1000));

    expect(firedTones).toEqual(['countdown3', 'countdown2', 'countdown1']);
  });

  // Regression tests: rest-between-sets audio behavior
  it('does NOT fire intervalStart during rest-between-sets', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    // Complete the first interval to enter rest.
    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);

    // Rest should NOT get an intervalStart beep.
    const cuesAtStart = engine.getAudioCuesToFire(10_000);
    expect(cuesAtStart).not.toContain('intervalStart');
  });

  it('DOES fire countdown beeps during rest to warn of upcoming interval', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    // Complete the first interval to enter rest.
    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);

    // Countdown beeps SHOULD fire during rest (warn that rest is ending).
    engine.getAudioCuesToFire(10_000); // first tick (no intervalStart)

    const cuesAt3 = engine.getAudioCuesToFire(3000);
    expect(cuesAt3).toContain('countdown3');

    const cuesAt2 = engine.getAudioCuesToFire(2000);
    expect(cuesAt2).toContain('countdown2');

    const cuesAt1 = engine.getAudioCuesToFire(1000);
    expect(cuesAt1).toContain('countdown1');
  });

  it('does NOT fire halfway cue during rest-between-sets', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 20,
      auto_advance: true,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    // Complete the first interval to enter rest.
    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);

    // Halfway through 20s rest = 10s remaining. Should NOT fire halfway cue.
    engine.getAudioCuesToFire(20_000); // first tick
    const cues = engine.getAudioCuesToFire(10_000);
    expect(cues).not.toContain('halfway');
  });

  it('still fires intervalEnd when rest-between-sets ends', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 5,
      auto_advance: true,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    // Complete the first interval to enter rest.
    advanceTime(5000);
    const tick = engine.tick()!;
    expect(tick.isRestBetweenSets).toBe(true);

    // At T=0 of rest, intervalEnd should still fire (signals transition back).
    engine.getAudioCuesToFire(5000); // first rest tick (no intervalStart)
    const cues = engine.getAudioCuesToFire(30); // near T=0
    expect(cues).toContain('intervalEnd');
  });
});

// ===========================================================================
// 6. Session persistence
// ===========================================================================

describe('Session persistence', () => {
  describe('saveSession()', () => {
    it('returns serialized state when workout is active', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      advanceTime(2000);

      const session = engine.saveSession();
      expect(session).not.toBeNull();
      expect(session!.sequenceId).toBe(seq.id);
      expect(session!.state.status).toBe('running');
      expect(session!.savedAt).toBe(now);
    });

    it('returns null when no workout is active', () => {
      expect(engine.saveSession()).toBeNull();
    });

    it('preserves paused state', () => {
      engine.startWorkout(makeSequence());
      advanceTime(3000);
      engine.pause();

      const session = engine.saveSession()!;
      expect(session.state.status).toBe('paused');
      expect(session.state.pausedAt).toBe(now);
    });

    it('preserves interval index and round', () => {
      const seq = makeSequence({
        repeat_count: 3,
        auto_advance: true,
        intervals: [
          makeInterval({ duration_seconds: 5 }),
          makeInterval({ duration_seconds: 5 }),
        ],
      });
      engine.startWorkout(seq);

      // Advance to round 1, interval 1
      advanceTime(5000);
      engine.tick();
      advanceTime(1000);

      const session = engine.saveSession()!;
      expect(session.state.currentIntervalIndex).toBe(1);
      expect(session.state.currentRound).toBe(1);
    });
  });

  describe('restoreSession()', () => {
    it('restores state correctly', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      advanceTime(2000);
      engine.pause();

      const session = engine.saveSession()!;

      // Create a new engine and restore
      const engine2 = new TimerEngine();
      engine2.restoreSession(session, seq);

      const state = engine2.getState()!;
      expect(state.status).toBe('paused');
      expect(state.sequenceId).toBe(seq.id);
      expect(state.currentIntervalIndex).toBe(0);
      expect(state.currentRound).toBe(1);
    });

    it('restored running session continues with correct absolute time', () => {
      const seq = makeSequence({
        intervals: [makeInterval({ duration_seconds: 30 })],
      });
      engine.startWorkout(seq);
      advanceTime(5000); // 5s into the workout

      const session = engine.saveSession()!;

      // Simulate app kill: 10 more seconds pass
      advanceTime(10000);

      const engine2 = new TimerEngine();
      engine2.restoreSession(session, seq);

      // Now 15s have elapsed total from start (5 before save + 10 after)
      const tick = engine2.tick()!;
      expect(tick.remainingMs).toBe(15000); // 30s - 15s elapsed
    });

    it('restored paused session stays paused at the correct position', () => {
      const seq = makeSequence({
        intervals: [makeInterval({ duration_seconds: 30 })],
      });
      engine.startWorkout(seq);
      advanceTime(5000);
      engine.pause();

      const session = engine.saveSession()!;

      // Lots of time passes
      advanceTime(60000);

      const engine2 = new TimerEngine();
      engine2.restoreSession(session, seq);

      const tick = engine2.tick()!;
      // Should be frozen at the pause point: 30s - 5s = 25s remaining
      expect(tick.remainingMs).toBe(25000);
      expect(tick.status).toBe('paused');
    });

    it('restores sequence reference', () => {
      const seq = makeSequence();
      engine.startWorkout(seq);
      const session = engine.saveSession()!;

      const engine2 = new TimerEngine();
      engine2.restoreSession(session, seq);
      expect(engine2.getSequence()).toEqual(seq);
    });

    it('restored session can be resumed and ticked', () => {
      const seq = makeSequence({
        intervals: [makeInterval({ duration_seconds: 20 })],
      });
      engine.startWorkout(seq);
      advanceTime(5000);
      engine.pause();

      const session = engine.saveSession()!;
      advanceTime(30000); // 30s pass while "app is killed"

      const engine2 = new TimerEngine();
      engine2.restoreSession(session, seq);

      // Resume
      engine2.resume();
      expect(engine2.getState()!.status).toBe('running');

      // Advance 3 more seconds
      advanceTime(3000);
      const tick = engine2.tick()!;
      // 20s total - 5s before pause - 3s after resume = 12s remaining
      expect(tick.remainingMs).toBe(12000);
    });
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('Edge cases', () => {
  it('handles single-interval single-round workout', () => {
    const seq = makeSequence({
      repeat_count: 1,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    const tick = engine.tick()!;
    expect(tick.nextInterval).toBeNull(); // only interval
    expect(tick.totalIntervals).toBe(1);

    advanceTime(5000);
    const tick2 = engine.tick()!;
    expect(tick2.status).toBe('completed');
  });

  it('handles very short intervals (1 second)', () => {
    const seq = makeSequence({
      auto_advance: true,
      intervals: [
        makeInterval({ duration_seconds: 1 }),
        makeInterval({ duration_seconds: 1 }),
      ],
    });
    engine.startWorkout(seq);

    advanceTime(1000);
    let tick = engine.tick()!;
    expect(tick.currentIntervalIndex).toBe(1);

    advanceTime(1000);
    tick = engine.tick()!;
    expect(tick.status).toBe('completed');
  });

  it('tick returns completed status data even after completion', () => {
    const seq = makeSequence({
      repeat_count: 1,
      intervals: [makeInterval({ duration_seconds: 5 })],
    });
    engine.startWorkout(seq);

    advanceTime(5000);
    engine.tick(); // completes

    // Subsequent ticks should still return data with completed status
    const tick = engine.tick()!;
    expect(tick).not.toBeNull();
    expect(tick.status).toBe('completed');
  });

  it('skip from rest period advances to next round', () => {
    const intervals = [makeInterval({ duration_seconds: 5 })];
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      auto_advance: true,
      intervals,
    });
    engine.startWorkout(seq);

    // Complete round 1 -> enter rest
    advanceTime(5000);
    engine.tick();
    expect(engine.getState()!.isRestBetweenSets).toBe(true);

    // Skip the rest
    engine.skip();
    const state = engine.getState()!;
    expect(state.isRestBetweenSets).toBe(false);
    expect(state.currentRound).toBe(2);
    expect(state.currentIntervalIndex).toBe(0);
  });

  it('multiple rapid ticks do not cause multiple advances', () => {
    const seq = makeSequence({
      auto_advance: true,
      intervals: [
        makeInterval({ duration_seconds: 5 }),
        makeInterval({ duration_seconds: 5 }),
      ],
    });
    engine.startWorkout(seq);

    advanceTime(5000);
    const tick1 = engine.tick()!;
    const tick2 = engine.tick()!;

    // Both should report the same state (interval 1) since
    // the second tick is within interval 1's duration
    expect(tick1.currentIntervalIndex).toBe(1);
    expect(tick2.currentIntervalIndex).toBe(1);
  });

  it('getState returns a copy (mutations do not affect engine)', () => {
    engine.startWorkout(makeSequence());
    const state = engine.getState()!;
    state.status = 'completed';
    state.currentRound = 99;

    const freshState = engine.getState()!;
    expect(freshState.status).toBe('running');
    expect(freshState.currentRound).toBe(1);
  });
});
