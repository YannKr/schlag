/**
 * Comprehensive unit tests for the Schlag timer calculations module.
 *
 * Covers: computeRemainingMs, computeIntervalProgress,
 * computeTotalWorkoutDuration, flattenSequenceToTimeline,
 * formatTime, and formatTimeWithTenths.
 */

import {
  computeRemainingMs,
  computeIntervalProgress,
  computeTotalWorkoutDuration,
  flattenSequenceToTimeline,
  formatTime,
  formatTimeWithTenths,
} from '@/lib/timer/timerCalculations';

import type { Interval } from '@/types/interval';
import type { Sequence } from '@/types/sequence';
import type { TimelineEntry } from '@/types/timer';

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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let dateNowSpy: jest.SpyInstance;

beforeEach(() => {
  intervalIdCounter = 0;
});

afterEach(() => {
  if (dateNowSpy) {
    dateNowSpy.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// computeRemainingMs
// ---------------------------------------------------------------------------

describe('computeRemainingMs', () => {
  it('returns approximately half the duration when started halfway through', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const startTime = now - 5_000; // started 5 seconds ago
    const durationMs = 10_000;     // 10 second interval
    const pausedElapsed = 0;

    const remaining = computeRemainingMs(startTime, durationMs, pausedElapsed);

    // startTime + durationMs - now + pausedElapsed
    // = (now - 5000) + 10000 - now + 0 = 5000
    expect(remaining).toBe(5_000);
  });

  it('clamps to 0 when elapsed time exceeds the duration', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const startTime = now - 15_000; // started 15s ago, duration only 10s
    const durationMs = 10_000;

    const remaining = computeRemainingMs(startTime, durationMs, 0);
    expect(remaining).toBe(0);
  });

  it('accounts for pausedElapsed offset (adds back paused time)', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    // Wall clock says 8s elapsed, but 3s of that were paused
    const startTime = now - 8_000;
    const durationMs = 10_000;
    const pausedElapsed = 3_000;

    const remaining = computeRemainingMs(startTime, durationMs, pausedElapsed);

    // (now - 8000) + 10000 - now + 3000 = 5000
    expect(remaining).toBe(5_000);
  });

  it('returns approximately the full duration when just started', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const startTime = now; // just started
    const durationMs = 30_000;

    const remaining = computeRemainingMs(startTime, durationMs, 0);
    expect(remaining).toBe(30_000);
  });

  it('returns 0 (not negative) when far past the duration', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const startTime = now - 999_999;
    const durationMs = 1_000;

    const remaining = computeRemainingMs(startTime, durationMs, 0);
    expect(remaining).toBe(0);
  });

  it('handles large pausedElapsed values that exceed elapsed wall time', () => {
    const now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    // Wall clock 5s, but paused offset larger than elapsed
    const startTime = now - 5_000;
    const durationMs = 10_000;
    const pausedElapsed = 7_000;

    const remaining = computeRemainingMs(startTime, durationMs, pausedElapsed);

    // (now - 5000) + 10000 - now + 7000 = 12000
    expect(remaining).toBe(12_000);
  });
});

// ---------------------------------------------------------------------------
// computeIntervalProgress
// ---------------------------------------------------------------------------

describe('computeIntervalProgress', () => {
  it('returns 0 when full duration is remaining (just started)', () => {
    expect(computeIntervalProgress(10_000, 10_000)).toBe(0);
  });

  it('returns 1 when zero remaining (complete)', () => {
    expect(computeIntervalProgress(0, 10_000)).toBe(1);
  });

  it('returns 0.5 when half the duration remains', () => {
    expect(computeIntervalProgress(5_000, 10_000)).toBe(0.5);
  });

  it('returns 0.25 when 75% of duration remains', () => {
    expect(computeIntervalProgress(7_500, 10_000)).toBe(0.25);
  });

  it('returns 0.75 when 25% of duration remains', () => {
    expect(computeIntervalProgress(2_500, 10_000)).toBe(0.75);
  });

  it('returns 1 for a zero-duration interval (edge case)', () => {
    expect(computeIntervalProgress(0, 0)).toBe(1);
  });

  it('returns 1 for a negative-duration interval (edge case)', () => {
    expect(computeIntervalProgress(0, -5_000)).toBe(1);
  });

  it('clamps to 0 when remainingMs exceeds totalMs', () => {
    // This could happen due to pausedElapsed overshooting
    expect(computeIntervalProgress(15_000, 10_000)).toBe(0);
  });

  it('clamps to 1 when remainingMs is negative', () => {
    // Shouldn't happen if computeRemainingMs clamps, but verify defense in depth
    expect(computeIntervalProgress(-1_000, 10_000)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeTotalWorkoutDuration
// ---------------------------------------------------------------------------

describe('computeTotalWorkoutDuration', () => {
  it('computes duration for a single round with no rest', () => {
    const seq = makeSequence({
      repeat_count: 1,
      rest_between_sets_seconds: 0,
      intervals: [
        makeInterval({ duration_seconds: 30 }),
        makeInterval({ duration_seconds: 60 }),
      ],
    });

    // (30 + 60) * 1000 = 90000
    expect(computeTotalWorkoutDuration(seq)).toBe(90_000);
  });

  it('computes duration for multiple rounds with rest between sets', () => {
    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 15,
      intervals: [
        makeInterval({ duration_seconds: 20 }),
        makeInterval({ duration_seconds: 10 }),
      ],
    });

    // roundMs = (20 + 10) * 1000 = 30_000
    // rest periods = (3 - 1) * 15_000 = 30_000
    // total = 3 * 30_000 + 30_000 = 120_000
    expect(computeTotalWorkoutDuration(seq)).toBe(120_000);
  });

  it('returns single-round duration for infinite mode (repeat_count = 0)', () => {
    const seq = makeSequence({
      repeat_count: 0,
      rest_between_sets_seconds: 30,
      intervals: [
        makeInterval({ duration_seconds: 45 }),
        makeInterval({ duration_seconds: 15 }),
      ],
    });

    // Infinite mode treats as 1 round, no rest
    // roundMs = (45 + 15) * 1000 = 60_000
    expect(computeTotalWorkoutDuration(seq)).toBe(60_000);
  });

  it('does not add rest for a single round even when rest_between_sets is set', () => {
    const seq = makeSequence({
      repeat_count: 1,
      rest_between_sets_seconds: 30,
      intervals: [
        makeInterval({ duration_seconds: 60 }),
      ],
    });

    // 1 round, no rest periods between sets
    expect(computeTotalWorkoutDuration(seq)).toBe(60_000);
  });

  it('returns 0 when intervals list is empty', () => {
    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 10,
      intervals: [],
    });

    expect(computeTotalWorkoutDuration(seq)).toBe(0);
  });

  it('handles a single 1-second interval with many rounds', () => {
    const seq = makeSequence({
      repeat_count: 99,
      rest_between_sets_seconds: 5,
      intervals: [makeInterval({ duration_seconds: 1 })],
    });

    // roundMs = 1 * 1000 = 1_000
    // rest = (99 - 1) * 5_000 = 490_000
    // total = 99 * 1_000 + 490_000 = 589_000
    expect(computeTotalWorkoutDuration(seq)).toBe(589_000);
  });

  it('handles intervals with zero seconds (edge case)', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 5,
      intervals: [
        makeInterval({ duration_seconds: 0 }),
        makeInterval({ duration_seconds: 0 }),
      ],
    });

    // roundMs = 0, so returns 0 early
    expect(computeTotalWorkoutDuration(seq)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// flattenSequenceToTimeline
// ---------------------------------------------------------------------------

describe('flattenSequenceToTimeline', () => {
  it('returns entries matching intervals for a single round', () => {
    const intervals = [
      makeInterval({ name: 'Work', duration_seconds: 30 }),
      makeInterval({ name: 'Rest', duration_seconds: 10 }),
    ];

    const seq = makeSequence({
      repeat_count: 1,
      rest_between_sets_seconds: 0,
      intervals,
    });

    const timeline = flattenSequenceToTimeline(seq);

    expect(timeline).toHaveLength(2);

    expect(timeline[0].interval.name).toBe('Work');
    expect(timeline[0].round).toBe(1);
    expect(timeline[0].indexInRound).toBe(0);
    expect(timeline[0].isRestBetweenSets).toBe(false);

    expect(timeline[1].interval.name).toBe('Rest');
    expect(timeline[1].round).toBe(1);
    expect(timeline[1].indexInRound).toBe(1);
    expect(timeline[1].isRestBetweenSets).toBe(false);
  });

  it('includes rest entries between rounds for multiple rounds', () => {
    const intervals = [
      makeInterval({ name: 'Push-ups', duration_seconds: 30 }),
    ];

    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 15,
      intervals,
    });

    const timeline = flattenSequenceToTimeline(seq);

    // 3 interval entries + 2 rest-between-sets entries = 5
    expect(timeline).toHaveLength(5);

    // Round 1: interval
    expect(timeline[0].interval.name).toBe('Push-ups');
    expect(timeline[0].round).toBe(1);
    expect(timeline[0].isRestBetweenSets).toBe(false);

    // Rest between round 1 and 2
    expect(timeline[1].interval.name).toBe('Rest');
    expect(timeline[1].interval.id).toBe('__rest_between_sets__');
    expect(timeline[1].interval.duration_seconds).toBe(15);
    expect(timeline[1].round).toBe(1);
    expect(timeline[1].indexInRound).toBe(1); // virtual index after all intervals
    expect(timeline[1].isRestBetweenSets).toBe(true);

    // Round 2: interval
    expect(timeline[2].interval.name).toBe('Push-ups');
    expect(timeline[2].round).toBe(2);
    expect(timeline[2].isRestBetweenSets).toBe(false);

    // Rest between round 2 and 3
    expect(timeline[3].isRestBetweenSets).toBe(true);
    expect(timeline[3].round).toBe(2);

    // Round 3: interval (no rest after final round)
    expect(timeline[4].interval.name).toBe('Push-ups');
    expect(timeline[4].round).toBe(3);
    expect(timeline[4].isRestBetweenSets).toBe(false);
  });

  it('returns a single round for infinite mode (repeat_count = 0)', () => {
    const intervals = [
      makeInterval({ name: 'Sprint', duration_seconds: 20 }),
      makeInterval({ name: 'Jog', duration_seconds: 40 }),
    ];

    const seq = makeSequence({
      repeat_count: 0,
      rest_between_sets_seconds: 30,
      intervals,
    });

    const timeline = flattenSequenceToTimeline(seq);

    // Only 1 round, no rest entries despite rest_between_sets being set
    expect(timeline).toHaveLength(2);
    expect(timeline[0].round).toBe(1);
    expect(timeline[1].round).toBe(1);
    expect(timeline.every((e) => !e.isRestBetweenSets)).toBe(true);
  });

  it('produces no rest entries when rest_between_sets_seconds is 0', () => {
    const intervals = [
      makeInterval({ name: 'A', duration_seconds: 10 }),
      makeInterval({ name: 'B', duration_seconds: 10 }),
    ];

    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 0,
      intervals,
    });

    const timeline = flattenSequenceToTimeline(seq);

    // 3 rounds * 2 intervals = 6 entries, no rest entries
    expect(timeline).toHaveLength(6);
    expect(timeline.every((e) => !e.isRestBetweenSets)).toBe(true);

    // Verify round assignments
    expect(timeline[0].round).toBe(1);
    expect(timeline[1].round).toBe(1);
    expect(timeline[2].round).toBe(2);
    expect(timeline[3].round).toBe(2);
    expect(timeline[4].round).toBe(3);
    expect(timeline[5].round).toBe(3);
  });

  it('returns only rest entries for a sequence with no intervals (edge case)', () => {
    // When there are no intervals but rest_between_sets > 0 and rounds > 1,
    // the function still produces rest-between-sets entries (one per non-final round).
    // This is an edge case -- real sequences always have at least one interval.
    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 10,
      intervals: [],
    });

    const timeline = flattenSequenceToTimeline(seq);

    // 2 rest entries (between round 1-2 and round 2-3), no interval entries
    expect(timeline).toHaveLength(2);
    expect(timeline.every((e) => e.isRestBetweenSets)).toBe(true);
  });

  it('returns an empty array for a sequence with no intervals and no rest', () => {
    const seq = makeSequence({
      repeat_count: 3,
      rest_between_sets_seconds: 0,
      intervals: [],
    });

    const timeline = flattenSequenceToTimeline(seq);
    expect(timeline).toHaveLength(0);
  });

  it('assigns correct indexInRound across multiple intervals and rounds', () => {
    const intervals = [
      makeInterval({ name: 'A' }),
      makeInterval({ name: 'B' }),
      makeInterval({ name: 'C' }),
    ];

    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 10,
      intervals,
    });

    const timeline = flattenSequenceToTimeline(seq);

    // Round 1: A(0), B(1), C(2), Rest(3)
    // Round 2: A(0), B(1), C(2)
    expect(timeline).toHaveLength(7);

    // Round 1
    expect(timeline[0].indexInRound).toBe(0);
    expect(timeline[1].indexInRound).toBe(1);
    expect(timeline[2].indexInRound).toBe(2);
    expect(timeline[3].indexInRound).toBe(3); // rest, virtual index
    expect(timeline[3].isRestBetweenSets).toBe(true);

    // Round 2
    expect(timeline[4].indexInRound).toBe(0);
    expect(timeline[5].indexInRound).toBe(1);
    expect(timeline[6].indexInRound).toBe(2);
  });

  it('uses slate color (#475569) for rest-between-sets intervals', () => {
    const seq = makeSequence({
      repeat_count: 2,
      rest_between_sets_seconds: 20,
      intervals: [makeInterval()],
    });

    const timeline = flattenSequenceToTimeline(seq);
    const restEntry = timeline.find((e) => e.isRestBetweenSets);

    expect(restEntry).toBeDefined();
    expect(restEntry!.interval.color).toBe('#475569');
    expect(restEntry!.interval.note).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats under 1 minute correctly', () => {
    expect(formatTime(45_000)).toBe('00:45');
  });

  it('formats minutes and seconds correctly', () => {
    // 2 minutes 5 seconds = 125s = 125_000ms
    expect(formatTime(125_000)).toBe('02:05');
  });

  it('formats over an hour with H:MM:SS format', () => {
    // 1 hour, 5 minutes, 30 seconds = 3930s = 3_930_000ms
    expect(formatTime(3_930_000)).toBe('1:05:30');
  });

  it('returns "00:00" for zero milliseconds', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('returns "00:00" for negative milliseconds', () => {
    expect(formatTime(-5_000)).toBe('00:00');
  });

  it('uses Math.ceil (999ms rounds up to 1 second)', () => {
    expect(formatTime(999)).toBe('00:01');
  });

  it('uses Math.ceil (1ms rounds up to 1 second)', () => {
    expect(formatTime(1)).toBe('00:01');
  });

  it('handles exact second boundaries', () => {
    expect(formatTime(1_000)).toBe('00:01');
    expect(formatTime(60_000)).toBe('01:00');
    expect(formatTime(3_600_000)).toBe('1:00:00');
  });

  it('formats 59 seconds correctly', () => {
    expect(formatTime(59_000)).toBe('00:59');
  });

  it('formats 59 minutes 59 seconds correctly', () => {
    // 59m59s = 3599s = 3_599_000ms
    expect(formatTime(3_599_000)).toBe('59:59');
  });

  it('does not pad hours', () => {
    // 10 hours, 0 minutes, 0 seconds
    expect(formatTime(36_000_000)).toBe('10:00:00');
  });

  it('pads minutes and seconds even in hourly format', () => {
    // 2 hours, 3 minutes, 7 seconds = 7387s
    expect(formatTime(7_387_000)).toBe('2:03:07');
  });
});

// ---------------------------------------------------------------------------
// formatTimeWithTenths
// ---------------------------------------------------------------------------

describe('formatTimeWithTenths', () => {
  it('includes tenths digit for a sub-minute duration', () => {
    // 45.3 seconds = 45_300ms
    expect(formatTimeWithTenths(45_300)).toBe('00:45.3');
  });

  it('returns "00:00.0" for zero milliseconds', () => {
    expect(formatTimeWithTenths(0)).toBe('00:00.0');
  });

  it('returns "00:00.0" for negative milliseconds', () => {
    expect(formatTimeWithTenths(-100)).toBe('00:00.0');
  });

  it('formats minutes with tenths', () => {
    // 2 minutes, 5 seconds, 700ms = 125_700ms
    expect(formatTimeWithTenths(125_700)).toBe('02:05.7');
  });

  it('formats hours with tenths', () => {
    // 1 hour, 5 minutes, 30 seconds, 200ms = 3_930_200ms
    expect(formatTimeWithTenths(3_930_200)).toBe('1:05:30.2');
  });

  it('shows .0 for exact second boundaries', () => {
    expect(formatTimeWithTenths(10_000)).toBe('00:10.0');
  });

  it('truncates tenths (floors, not rounds)', () => {
    // 999ms -> tenths = Math.floor(999/100) = 9, totalSeconds = Math.floor(999/1000) = 0
    expect(formatTimeWithTenths(999)).toBe('00:00.9');
  });

  it('handles 100ms increments correctly', () => {
    expect(formatTimeWithTenths(100)).toBe('00:00.1');
    expect(formatTimeWithTenths(200)).toBe('00:00.2');
    expect(formatTimeWithTenths(500)).toBe('00:00.5');
    expect(formatTimeWithTenths(900)).toBe('00:00.9');
  });

  it('handles sub-100ms values (shows .0 with 0 whole seconds)', () => {
    // 50ms -> tenths = Math.floor(50/100) = 0, totalSeconds = 0
    expect(formatTimeWithTenths(50)).toBe('00:00.0');
  });
});
