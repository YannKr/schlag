/**
 * Unit tests for the import sanitizers (lib/importValidation.ts).
 *
 * These exercise the trust boundary for sequence/history JSON imports:
 * oversized strings, NaN/out-of-range numbers, off-palette colors, unknown
 * keys, and outright garbage entries.
 */

// Mock UUID for deterministic generated IDs.
let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `gen-uuid-${++mockUuidCounter}`,
}));

import {
  sanitizeInterval,
  sanitizeSequence,
  sanitizeSession,
} from '@/lib/importValidation';
import type { Sequence } from '@/types/sequence';
import type { Interval } from '@/types/interval';
import type { WorkoutSession } from '@/types/session';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeInterval(overrides?: Partial<Interval>): Interval {
  return {
    id: 'int-1',
    name: 'Work',
    duration_seconds: 30,
    color: '#E5484D',
    note: '',
    ...overrides,
  };
}

function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    id: 'seq-1',
    name: 'Test Sequence',
    description: 'A test sequence',
    repeat_count: 3,
    rest_between_sets_seconds: 60,
    auto_advance: true,
    intervals: [makeInterval()],
    audio_config: {
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-02T00:00:00.000Z',
    last_used_at: null,
    ...overrides,
  };
}

function makeSession(overrides?: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: 'session-1',
    sequence_id: 'seq-1',
    sequence_snapshot: makeSequence(),
    started_at: '2025-06-01T10:00:00.000Z',
    ended_at: '2025-06-01T10:30:00.000Z',
    status: 'completed',
    stopped_at_interval: null,
    stopped_at_round: null,
    intervals_completed: 3,
    rounds_completed: 1,
    total_active_seconds: 1200,
    total_rest_seconds: 600,
    pauses: [{ paused_at: '2025-06-01T10:10:00.000Z', resumed_at: '2025-06-01T10:11:00.000Z' }],
    created_at: '2025-06-01T10:00:00.000Z',
    updated_at: '2025-06-01T10:30:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUuidCounter = 0;
});

// ---------------------------------------------------------------------------
// sanitizeInterval
// ---------------------------------------------------------------------------

describe('sanitizeInterval', () => {
  it('round-trips a valid interval unchanged', () => {
    const interval = makeInterval({ note: 'Keep elbows in' });
    expect(sanitizeInterval(interval)).toEqual(interval);
  });

  it('rejects non-objects', () => {
    expect(sanitizeInterval(null)).toBeNull();
    expect(sanitizeInterval(undefined)).toBeNull();
    expect(sanitizeInterval('work')).toBeNull();
    expect(sanitizeInterval(42)).toBeNull();
    expect(sanitizeInterval([makeInterval()])).toBeNull();
  });

  it('rejects intervals with a missing or empty name', () => {
    expect(sanitizeInterval(makeInterval({ name: undefined as any }))).toBeNull();
    expect(sanitizeInterval(makeInterval({ name: 123 as any }))).toBeNull();
    expect(sanitizeInterval(makeInterval({ name: '   ' }))).toBeNull();
  });

  it('truncates oversized names and notes', () => {
    const result = sanitizeInterval(
      makeInterval({ name: 'x'.repeat(500), note: 'y'.repeat(500) }),
    );
    expect(result?.name).toHaveLength(32);
    expect(result?.note).toHaveLength(80);
  });

  it('truncates by code point without splitting surrogate pairs', () => {
    const result = sanitizeInterval(
      makeInterval({ name: '\u{1F600}'.repeat(40), note: '\u{1F4AA}'.repeat(100) }),
    );
    // 32 / 80 code points, not UTF-16 units -- no mojibake half-pairs.
    expect(result?.name).toBe('\u{1F600}'.repeat(32));
    expect(result?.note).toBe('\u{1F4AA}'.repeat(80));
  });

  it('rejects NaN / non-number durations', () => {
    expect(sanitizeInterval(makeInterval({ duration_seconds: NaN }))).toBeNull();
    expect(sanitizeInterval(makeInterval({ duration_seconds: Infinity }))).toBeNull();
    expect(sanitizeInterval(makeInterval({ duration_seconds: '30' as any }))).toBeNull();
    expect(sanitizeInterval(makeInterval({ duration_seconds: undefined as any }))).toBeNull();
  });

  it('clamps negative, oversized, and fractional durations', () => {
    expect(sanitizeInterval(makeInterval({ duration_seconds: -5 }))?.duration_seconds).toBe(1);
    expect(sanitizeInterval(makeInterval({ duration_seconds: 9_999_999 }))?.duration_seconds).toBe(
      359_999,
    );
    expect(sanitizeInterval(makeInterval({ duration_seconds: 29.6 }))?.duration_seconds).toBe(30);
  });

  it('replaces off-palette colors with the default', () => {
    expect(sanitizeInterval(makeInterval({ color: '#BADA55' }))?.color).toBe('#E5484D');
    expect(sanitizeInterval(makeInterval({ color: 'javascript:alert(1)' }))?.color).toBe('#E5484D');
    expect(sanitizeInterval(makeInterval({ color: 12 as any }))?.color).toBe('#E5484D');
  });

  it('remaps legacy palette colors to the current palette', () => {
    // Old Schlag Red -> Signal red.
    expect(sanitizeInterval(makeInterval({ color: '#E63946' }))?.color).toBe('#E5484D');
  });

  it('accepts lowercase palette hexes and stores the canonical uppercase form', () => {
    expect(sanitizeInterval(makeInterval({ color: '#e5484d' }))?.color).toBe('#E5484D');
    expect(sanitizeInterval(makeInterval({ color: '#12a594' }))?.color).toBe('#12A594');
    // Lowercase legacy hexes still remap.
    expect(sanitizeInterval(makeInterval({ color: '#e63946' }))?.color).toBe('#E5484D');
  });

  it('drops unknown keys', () => {
    const result = sanitizeInterval({ ...makeInterval(), __proto__hack: 'x', evil: () => {} });
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(['id', 'name', 'duration_seconds', 'color', 'note']);
  });

  it('keeps optional fields only when they match known enums', () => {
    const valid = sanitizeInterval(
      makeInterval({ audio_tone: 'bell', exercise_type: 'squat' }),
    );
    expect(valid?.audio_tone).toBe('bell');
    expect(valid?.exercise_type).toBe('squat');

    const invalid = sanitizeInterval(
      makeInterval({ audio_tone: 'airhorn' as any, exercise_type: 'yoga' as any }),
    );
    expect(invalid?.audio_tone).toBeUndefined();
    expect(invalid?.exercise_type).toBeUndefined();
  });

  it('generates a fresh ID when the incoming one is missing or invalid', () => {
    expect(sanitizeInterval(makeInterval({ id: undefined as any }))?.id).toBe('gen-uuid-1');
    expect(sanitizeInterval(makeInterval({ id: 42 as any }))?.id).toBe('gen-uuid-2');
  });

  it('replaces IDs with unsafe characters (they flow into router paths)', () => {
    expect(sanitizeInterval(makeInterval({ id: '../../etc/passwd' }))?.id).toBe('gen-uuid-1');
    expect(sanitizeInterval(makeInterval({ id: 'a?b=c' }))?.id).toBe('gen-uuid-2');
    expect(sanitizeInterval(makeInterval({ id: 'a#frag' }))?.id).toBe('gen-uuid-3');
    expect(sanitizeInterval(makeInterval({ id: 'a\nb' }))?.id).toBe('gen-uuid-4');
    expect(sanitizeInterval(makeInterval({ id: 'x'.repeat(65) }))?.id).toBe('gen-uuid-5');
    // Safe charset is kept as-is.
    expect(sanitizeInterval(makeInterval({ id: 'Abc-123_x.y' }))?.id).toBe('Abc-123_x.y');
  });
});

// ---------------------------------------------------------------------------
// sanitizeSequence
// ---------------------------------------------------------------------------

describe('sanitizeSequence', () => {
  it('round-trips a valid sequence unchanged', () => {
    const sequence = makeSequence();
    expect(sanitizeSequence(sequence)).toEqual(sequence);
  });

  it('rejects non-objects and garbage entries', () => {
    expect(sanitizeSequence(null)).toBeNull();
    expect(sanitizeSequence(undefined)).toBeNull();
    expect(sanitizeSequence('a sequence')).toBeNull();
    expect(sanitizeSequence([])).toBeNull();
    expect(sanitizeSequence({ id: 'bad' })).toBeNull();
  });

  it('rejects sequences without a usable name', () => {
    expect(sanitizeSequence(makeSequence({ name: undefined as any }))).toBeNull();
    expect(sanitizeSequence(makeSequence({ name: '  ' }))).toBeNull();
  });

  it('rejects sequences with missing intervals or no salvageable intervals', () => {
    expect(sanitizeSequence(makeSequence({ intervals: undefined as any }))).toBeNull();
    expect(sanitizeSequence(makeSequence({ intervals: [] }))).toBeNull();
    expect(
      sanitizeSequence(makeSequence({ intervals: [null, 'junk', { name: 'no duration' }] as any })),
    ).toBeNull();
  });

  it('drops only the malformed intervals when some are salvageable', () => {
    const result = sanitizeSequence(
      makeSequence({
        intervals: [makeInterval(), null as any, makeInterval({ duration_seconds: NaN })],
      }),
    );
    expect(result?.intervals).toHaveLength(1);
  });

  it('truncates oversized names and descriptions', () => {
    const result = sanitizeSequence(
      makeSequence({ name: 'n'.repeat(500), description: 'd'.repeat(500) }),
    );
    expect(result?.name).toHaveLength(32);
    expect(result?.description).toHaveLength(120);
  });

  it('clamps repeat_count and rest_between_sets_seconds', () => {
    const clamped = sanitizeSequence(
      makeSequence({ repeat_count: 500, rest_between_sets_seconds: -10 }),
    );
    expect(clamped?.repeat_count).toBe(99);
    expect(clamped?.rest_between_sets_seconds).toBe(0);

    // 0 = infinite mode is preserved.
    expect(sanitizeSequence(makeSequence({ repeat_count: 0 }))?.repeat_count).toBe(0);
  });

  it('defaults non-numeric repeat_count and rest', () => {
    const result = sanitizeSequence(
      makeSequence({ repeat_count: 'lots' as any, rest_between_sets_seconds: NaN }),
    );
    expect(result?.repeat_count).toBe(1);
    expect(result?.rest_between_sets_seconds).toBe(0);
  });

  it('never turns a corrupt repeat_count into infinite mode (0)', () => {
    // Only an exact incoming 0 means infinite; everything else clamps to [1, 99].
    expect(sanitizeSequence(makeSequence({ repeat_count: -5 }))?.repeat_count).toBe(1);
    expect(sanitizeSequence(makeSequence({ repeat_count: 0.2 }))?.repeat_count).toBe(1);
    expect(sanitizeSequence(makeSequence({ repeat_count: NaN }))?.repeat_count).toBe(1);
    expect(sanitizeSequence(makeSequence({ repeat_count: -Infinity }))?.repeat_count).toBe(1);
  });

  it('caps intervals at 500 per sequence', () => {
    const result = sanitizeSequence(
      makeSequence({ intervals: Array.from({ length: 600 }, () => makeInterval()) }),
    );
    expect(result?.intervals).toHaveLength(500);
  });

  it('rebuilds a malformed audio_config with defaults', () => {
    const result = sanitizeSequence(makeSequence({ audio_config: 'loud' as any }));
    expect(result?.audio_config).toEqual({
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    });
  });

  it('drops unknown keys', () => {
    const result = sanitizeSequence({
      ...makeSequence(),
      is_pro: true,
      injected_payload: { nested: 'data' },
    });
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('is_pro');
    expect(result).not.toHaveProperty('injected_payload');
  });

  it('generates a fresh ID when the incoming one is missing', () => {
    const result = sanitizeSequence(makeSequence({ id: undefined as any }));
    expect(result?.id).toBe('gen-uuid-1');
  });

  it('defaults garbage timestamps and last_used_at', () => {
    const result = sanitizeSequence(
      makeSequence({
        created_at: 42 as any,
        updated_at: null as any,
        last_used_at: { hacked: true } as any,
      }),
    );
    expect(typeof result?.created_at).toBe('string');
    expect(typeof result?.updated_at).toBe('string');
    expect(result?.last_used_at).toBeNull();
  });

  it('rejects unparseable timestamp strings, not just non-strings', () => {
    const result = sanitizeSequence(
      makeSequence({
        created_at: 'yesterday-ish',
        updated_at: 'not a date',
        last_used_at: 'garbage',
      }),
    );
    // Defaults to a parseable timestamp / null instead of keeping the garbage.
    expect(Number.isFinite(Date.parse(result!.created_at))).toBe(true);
    expect(Number.isFinite(Date.parse(result!.updated_at))).toBe(true);
    expect(result?.last_used_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sanitizeSession
// ---------------------------------------------------------------------------

describe('sanitizeSession', () => {
  it('round-trips a valid session unchanged', () => {
    const session = makeSession();
    expect(sanitizeSession(session)).toEqual(session);
  });

  it('rejects non-objects', () => {
    expect(sanitizeSession(null)).toBeNull();
    expect(sanitizeSession(undefined)).toBeNull();
    expect(sanitizeSession('session')).toBeNull();
    expect(sanitizeSession([])).toBeNull();
  });

  it('rejects sessions missing required identity fields', () => {
    expect(sanitizeSession(makeSession({ id: undefined as any }))).toBeNull();
    expect(sanitizeSession(makeSession({ sequence_id: undefined as any }))).toBeNull();
    expect(sanitizeSession(makeSession({ started_at: undefined as any }))).toBeNull();
    expect(sanitizeSession(makeSession({ status: undefined as any }))).toBeNull();
  });

  it('rejects unknown status values', () => {
    expect(sanitizeSession(makeSession({ status: 'exploded' as any }))).toBeNull();
  });

  it('rejects IDs with unsafe characters and unparseable started_at', () => {
    expect(sanitizeSession(makeSession({ id: 'a/b' }))).toBeNull();
    expect(sanitizeSession(makeSession({ sequence_id: 'seq?id=1' }))).toBeNull();
    expect(sanitizeSession(makeSession({ started_at: 'yesterday-ish' }))).toBeNull();
  });

  it('rejects non-object, non-null snapshots', () => {
    expect(sanitizeSession(makeSession({ sequence_snapshot: 'snap' as any }))).toBeNull();
    expect(sanitizeSession(makeSession({ sequence_snapshot: 42 as any }))).toBeNull();
  });

  it('keeps the session but nulls an unsalvageable snapshot object', () => {
    const result = sanitizeSession(
      makeSession({ sequence_snapshot: { garbage: true } as any }),
    );
    expect(result).not.toBeNull();
    expect(result?.sequence_snapshot).toBeNull();
  });

  it('sanitizes the embedded snapshot with the sequence sanitizer', () => {
    const result = sanitizeSession(
      makeSession({
        sequence_snapshot: {
          ...makeSequence({ name: 'n'.repeat(100) }),
          rogue_key: 'x',
        } as any,
      }),
    );
    expect(result?.sequence_snapshot?.name).toHaveLength(32);
    expect(result?.sequence_snapshot).not.toHaveProperty('rogue_key');
  });

  it('clamps NaN / negative / fractional counters to sane integers', () => {
    const result = sanitizeSession(
      makeSession({
        intervals_completed: NaN,
        rounds_completed: -3,
        total_active_seconds: 12.7,
        total_rest_seconds: 'lots' as any,
      }),
    );
    expect(result?.intervals_completed).toBe(0);
    expect(result?.rounds_completed).toBe(0);
    expect(result?.total_active_seconds).toBe(13);
    expect(result?.total_rest_seconds).toBe(0);
  });

  it('drops malformed pause entries and tolerates a missing pauses array', () => {
    const result = sanitizeSession(
      makeSession({
        pauses: [
          { paused_at: '2025-06-01T10:10:00.000Z', resumed_at: null },
          { resumed_at: '2025-06-01T10:11:00.000Z' } as any,
          'junk' as any,
        ],
      }),
    );
    expect(result?.pauses).toHaveLength(1);

    const missing = sanitizeSession(makeSession({ pauses: undefined as any }));
    expect(missing?.pauses).toEqual([]);
  });

  it('drops pauses with unparseable timestamps', () => {
    const result = sanitizeSession(
      makeSession({
        pauses: [
          { paused_at: 'yesterday-ish', resumed_at: null } as any,
          { paused_at: '2025-06-01T10:10:00.000Z', resumed_at: 'later-ish' } as any,
        ],
      }),
    );
    // First entry is dropped; second survives with the garbage resumed_at nulled.
    expect(result?.pauses).toEqual([
      { paused_at: '2025-06-01T10:10:00.000Z', resumed_at: null },
    ]);
  });

  it('caps pauses at 1000 per session', () => {
    const result = sanitizeSession(
      makeSession({
        pauses: Array.from({ length: 1100 }, () => ({
          paused_at: '2025-06-01T10:10:00.000Z',
          resumed_at: null,
        })),
      }),
    );
    expect(result?.pauses).toHaveLength(1000);
  });

  it('drops unknown keys', () => {
    const result = sanitizeSession({ ...makeSession(), admin: true, score: 9001 });
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('admin');
    expect(result).not.toHaveProperty('score');
  });
});
