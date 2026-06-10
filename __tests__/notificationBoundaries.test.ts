/**
 * Unit tests for computeUpcomingBoundaries — the pure function that
 * turns engine state into upcoming interval-boundary notification events.
 *
 * Covers: mid-interval start, paused time offset, repeat rounds with
 * rest-between-sets, the 60-event cap (infinite mode), the completion
 * event, auto-advance OFF, and past-event filtering.
 */

import {
  computeUpcomingBoundaries,
  MAX_BOUNDARY_EVENTS,
} from '@/lib/timer/timerCalculations';

import type { Interval } from '@/types/interval';
import type { Sequence } from '@/types/sequence';
import type { TimerState } from '@/types/timer';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let intervalIdCounter = 0;

function makeInterval(overrides: Partial<Interval> = {}): Interval {
  intervalIdCounter += 1;
  return {
    id: `interval-${intervalIdCounter}`,
    name: `Interval ${intervalIdCounter}`,
    duration_seconds: 30,
    color: '#E63946',
    note: '',
    ...overrides,
  };
}

function makeSequence(overrides: Partial<Sequence> = {}): Sequence {
  return {
    id: 'seq-1',
    name: 'Test Sequence',
    description: '',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [makeInterval()],
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

const T0 = 1_750_000_000_000; // arbitrary fixed epoch ms

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    status: 'running',
    sequenceId: 'seq-1',
    currentIntervalIndex: 0,
    currentRound: 1,
    absoluteStartTime: T0,
    pausedElapsed: 0,
    pausedAt: null,
    isRestBetweenSets: false,
    finishAfterRound: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeUpcomingBoundaries', () => {
  it('returns transition and completion events from mid-interval', () => {
    const sequence = makeSequence({
      intervals: [
        makeInterval({ name: 'Work', duration_seconds: 30 }),
        makeInterval({ name: 'Rest', duration_seconds: 60 }),
      ],
    });
    const state = makeState();

    // Called 10s into the first interval — anchoring must be absolute,
    // not relative to "now".
    const events = computeUpcomingBoundaries(sequence, state, T0 + 10_000);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      fireDate: T0 + 30_000,
      title: 'Next: Rest',
      body: 'Work complete · 01:00',
    });
    expect(events[1]).toEqual({
      fireDate: T0 + 90_000,
      title: 'Workout complete 🎉',
      body: 'Test Sequence',
    });
  });

  it('shifts all boundaries by accumulated paused time', () => {
    const sequence = makeSequence({
      intervals: [
        makeInterval({ name: 'A', duration_seconds: 30 }),
        makeInterval({ name: 'B', duration_seconds: 30 }),
      ],
    });
    const state = makeState({ pausedElapsed: 5_000 });

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events[0].fireDate).toBe(T0 + 35_000);
    expect(events[1].fireDate).toBe(T0 + 65_000);
  });

  it('walks repeat rounds with rest-between-sets', () => {
    const sequence = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      intervals: [makeInterval({ name: 'Squats', duration_seconds: 20 })],
    });
    const state = makeState();

    const events = computeUpcomingBoundaries(sequence, state, T0);

    // Round 1 end -> rest, rest end -> round 2, round 2 end -> complete.
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      fireDate: T0 + 20_000,
      title: 'Next: Rest',
    });
    expect(events[1]).toMatchObject({
      fireDate: T0 + 30_000,
      title: 'Next: Squats',
    });
    expect(events[2]).toMatchObject({
      fireDate: T0 + 50_000,
      title: 'Workout complete 🎉',
    });
  });

  it('starts mid-round at the correct interval index', () => {
    const sequence = makeSequence({
      intervals: [
        makeInterval({ name: 'A', duration_seconds: 10 }),
        makeInterval({ name: 'B', duration_seconds: 20 }),
        makeInterval({ name: 'C', duration_seconds: 30 }),
      ],
    });
    // Currently on interval B (index 1).
    const state = makeState({ currentIntervalIndex: 1 });

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ fireDate: T0 + 20_000, title: 'Next: C' });
    expect(events[1]).toMatchObject({
      fireDate: T0 + 50_000,
      title: 'Workout complete 🎉',
    });
  });

  it('caps infinite-repeat sequences at MAX_BOUNDARY_EVENTS with no completion', () => {
    const sequence = makeSequence({
      repeat_count: 0, // infinite
      intervals: [makeInterval({ name: 'Loop', duration_seconds: 10 })],
    });
    const state = makeState();

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events).toHaveLength(MAX_BOUNDARY_EVENTS);
    expect(events.every((e) => e.title === 'Next: Loop')).toBe(true);
    // Boundaries are evenly spaced 10s apart.
    expect(events[59].fireDate).toBe(T0 + 60 * 10_000);
  });

  it('emits only the first boundary when auto-advance is off', () => {
    const sequence = makeSequence({
      auto_advance: false,
      intervals: [
        makeInterval({ name: 'A', duration_seconds: 30 }),
        makeInterval({ name: 'B', duration_seconds: 30 }),
      ],
    });
    const state = makeState();

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fireDate: T0 + 30_000, title: 'Next: B' });
  });

  it('skips boundaries already in the past', () => {
    const sequence = makeSequence({
      intervals: [
        makeInterval({ name: 'A', duration_seconds: 30 }),
        makeInterval({ name: 'B', duration_seconds: 30 }),
      ],
    });
    const state = makeState();

    // 35s in: the first boundary (T0+30s) has already passed.
    const events = computeUpcomingBoundaries(sequence, state, T0 + 35_000);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fireDate: T0 + 60_000,
      title: 'Workout complete 🎉',
    });
  });

  it('respects finishAfterRound in infinite mode', () => {
    const sequence = makeSequence({
      repeat_count: 0,
      intervals: [makeInterval({ name: 'Loop', duration_seconds: 10 })],
    });
    const state = makeState({ finishAfterRound: true });

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fireDate: T0 + 10_000,
      title: 'Workout complete 🎉',
    });
  });

  it('anchors the first boundary at the rest end when in rest-between-sets', () => {
    const sequence = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      intervals: [makeInterval({ name: 'Work', duration_seconds: 20 })],
    });
    // In the rest after round 1; the rest started at T0.
    const state = makeState({ isRestBetweenSets: true });

    const events = computeUpcomingBoundaries(sequence, state, T0);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      fireDate: T0 + 10_000,
      title: 'Next: Work',
    });
    expect(events[1]).toMatchObject({
      fireDate: T0 + 30_000,
      title: 'Workout complete 🎉',
    });
  });

  it('respects finishAfterRound while in rest-between-sets (infinite mode)', () => {
    const sequence = makeSequence({
      repeat_count: 0, // infinite
      rest_between_sets_seconds: 10,
      intervals: [makeInterval({ name: 'Loop', duration_seconds: 20 })],
    });
    const state = makeState({
      isRestBetweenSets: true,
      finishAfterRound: true,
      currentRound: 3,
    });

    const events = computeUpcomingBoundaries(sequence, state, T0);

    // Rest finishes -> one final round -> complete.
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      fireDate: T0 + 10_000,
      title: 'Next: Loop',
    });
    expect(events[1]).toMatchObject({
      fireDate: T0 + 30_000,
      title: 'Workout complete 🎉',
    });
  });

  it('returns [] for a sequence with no intervals', () => {
    const sequence = makeSequence({ intervals: [] });
    expect(computeUpcomingBoundaries(sequence, makeState(), T0)).toEqual([]);
  });

  it('returns [] when not running', () => {
    const sequence = makeSequence();
    expect(
      computeUpcomingBoundaries(sequence, makeState({ status: 'paused' }), T0),
    ).toEqual([]);
    expect(
      computeUpcomingBoundaries(sequence, makeState({ status: 'idle' }), T0),
    ).toEqual([]);
    expect(
      computeUpcomingBoundaries(
        sequence,
        makeState({ status: 'completed' }),
        T0,
      ),
    ).toEqual([]);
  });
});
