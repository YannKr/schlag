/**
 * Sanitizers for untrusted import JSON.
 *
 * Sequence/history imports come from arbitrary files on disk, so nothing in
 * them can be trusted: strings may be oversized, numbers may be NaN or out of
 * range, and objects may carry unknown keys. Each sanitizer rebuilds the
 * entry from scratch using a whitelist of known keys (never spreads the
 * untrusted object), clamping or defaulting salvageable fields and returning
 * null for unsalvageable entries.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Sequence } from '@/types/sequence';
import type { Interval, ExerciseType } from '@/types/interval';
import type { AudioConfig, IntervalAudioTone } from '@/types/audio';
import type { WorkoutSession, PauseEntry, SessionStatus } from '@/types/session';
import {
  INTERVAL_NAME_MAX_LENGTH,
  INTERVAL_NOTE_MAX_LENGTH,
  INTERVAL_DURATION_MIN_SECONDS,
  INTERVAL_DURATION_MAX_SECONDS,
  SEQUENCE_DESCRIPTION_MAX_LENGTH,
  SEQUENCE_REPEAT_MAX,
} from '@/constants/validation';
import {
  DEFAULT_INTERVAL_COLOR,
  INTERVAL_HEX_SET,
  normalizeIntervalHex,
} from '@/constants/colors';

// ---------------------------------------------------------------------------
// Limits local to import sanitization
// ---------------------------------------------------------------------------

/** The builder caps sequence names at the same 32 chars as interval names. */
const SEQUENCE_NAME_MAX_LENGTH = INTERVAL_NAME_MAX_LENGTH;

/** Generous cap for IDs and timestamps so a hostile file can't bloat MMKV. */
const ID_MAX_LENGTH = 64;

/**
 * IDs flow into router paths (`/workout/${id}`), so restrict them to a safe
 * charset; anything else gets a fresh UUID instead.
 */
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Hard cap on intervals salvaged from a single imported sequence. */
const SEQUENCE_INTERVALS_MAX = 500;

/** Hard cap on pause entries salvaged from a single imported session. */
const SESSION_PAUSES_MAX = 1000;

/** Upper bound for session counters (seconds/counts) -- ~31 years in seconds. */
const SESSION_COUNTER_MAX = 999_999_999;

const VALID_SESSION_STATUSES: ReadonlySet<string> = new Set<SessionStatus>([
  'completed',
  'stopped',
  'in_progress',
]);

const VALID_AUDIO_TONES: ReadonlySet<string> = new Set<IntervalAudioTone>([
  'default', 'bell', 'whistle', 'horn', 'chime', 'buzz', 'click', 'gong', 'drum', 'custom',
]);

const VALID_EXERCISE_TYPES: ReadonlySet<string> = new Set<ExerciseType>([
  'squat', 'deadlift', 'bench', 'curl', 'overhead_press', 'row',
]);

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** Narrow an unknown value to a plain object (arrays excluded). */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Trim + truncate a string, or null when the value isn't a string. */
function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  // Code-point-safe truncation: a raw .slice() can split a surrogate pair
  // (e.g. an emoji) in half and produce mojibake.
  return Array.from(value.trim()).slice(0, maxLength).join('');
}

/** Round + clamp a finite number into [min, max], or null when invalid. */
function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A boolean, or the fallback when the value isn't a boolean. */
function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** A safe-charset, bounded ID string, or null when invalid/empty. */
function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** A bounded, parseable timestamp string, or null when invalid. */
function cleanTimestampOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > ID_MAX_LENGTH) return null;
  // Garbage like 'yesterday-ish' would survive a typeof check and produce
  // NaN in date math later -- require an actually parseable date.
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

/** A bounded timestamp string, falling back when invalid. */
function cleanTimestamp(value: unknown, fallback: string): string {
  return cleanTimestampOrNull(value) ?? fallback;
}

/** A bounded timestamp string or null (for nullable timestamp fields). */
function cleanNullableTimestamp(value: unknown): string | null {
  return value === null ? null : cleanTimestampOrNull(value);
}

/**
 * Repeat count with infinite-mode semantics: only an exact incoming 0 maps
 * to 0 (infinite). Any other number clamps to [1, max] so a corrupt value
 * can never silently turn a finite workout into a never-ending one.
 * Non-numbers default to 1.
 */
function cleanRepeatCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  if (value === 0) return 0;
  return Math.min(SEQUENCE_REPEAT_MAX, Math.max(1, Math.round(value)));
}

/** Return current ISO-8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Interval / audio config sanitizers
// ---------------------------------------------------------------------------

/**
 * Sanitize a single untrusted interval. Returns null (skip the interval)
 * when it lacks a usable name or duration; everything else is clamped or
 * defaulted. Only whitelisted Interval keys make it into the result.
 */
export function sanitizeInterval(value: unknown): Interval | null {
  if (!isObject(value)) return null;

  const name = cleanString(value.name, INTERVAL_NAME_MAX_LENGTH);
  if (name === null || name.length === 0) return null;

  // NaN / non-number durations are unsalvageable -- skip the interval.
  const duration = clampInt(
    value.duration_seconds,
    INTERVAL_DURATION_MIN_SECONDS,
    INTERVAL_DURATION_MAX_SECONDS,
  );
  if (duration === null) return null;

  // Color must resolve to the 12-color palette (legacy hexes are remapped).
  // Compare uppercased so lowercase palette hexes are accepted, and store
  // the canonical uppercase form.
  let color = DEFAULT_INTERVAL_COLOR;
  if (typeof value.color === 'string') {
    const normalized = normalizeIntervalHex(value.color).toUpperCase();
    if (INTERVAL_HEX_SET.has(normalized)) color = normalized;
  }

  const interval: Interval = {
    id: cleanId(value.id) ?? uuidv4(),
    name,
    duration_seconds: duration,
    color,
    note: cleanString(value.note, INTERVAL_NOTE_MAX_LENGTH) ?? '',
  };

  // Optional v2 fields -- only kept when they match the known enums.
  if (typeof value.audio_tone === 'string' && VALID_AUDIO_TONES.has(value.audio_tone)) {
    interval.audio_tone = value.audio_tone as IntervalAudioTone;
  }
  if (typeof value.exercise_type === 'string' && VALID_EXERCISE_TYPES.has(value.exercise_type)) {
    interval.exercise_type = value.exercise_type as ExerciseType;
  }

  return interval;
}

/** Sanitize an untrusted audio config, defaulting any non-boolean field. */
function sanitizeAudioConfig(value: unknown): AudioConfig {
  const source = isObject(value) ? value : {};
  return {
    use_voice_countdown: cleanBoolean(source.use_voice_countdown, true),
    use_builtin_beeps: cleanBoolean(source.use_builtin_beeps, true),
    announce_interval_names: cleanBoolean(source.announce_interval_names, false),
    halfway_alert: cleanBoolean(source.halfway_alert, false),
  };
}

// ---------------------------------------------------------------------------
// Sequence sanitizer
// ---------------------------------------------------------------------------

/**
 * Sanitize a single untrusted sequence. Returns null when the entry is not
 * an object, lacks a non-empty name, or has no salvageable intervals.
 * Only whitelisted Sequence keys make it into the result.
 */
export function sanitizeSequence(value: unknown): Sequence | null {
  if (!isObject(value)) return null;

  const name = cleanString(value.name, SEQUENCE_NAME_MAX_LENGTH);
  if (name === null || name.length === 0) return null;

  if (!Array.isArray(value.intervals)) return null;
  // Cap the array before sanitizing so a hostile file can't force unbounded
  // per-interval work; excess entries are dropped.
  const intervals = value.intervals
    .slice(0, SEQUENCE_INTERVALS_MAX)
    .map(sanitizeInterval)
    .filter((i): i is Interval => i !== null);
  if (intervals.length === 0) return null;

  const timestamp = now();
  return {
    id: cleanId(value.id) ?? uuidv4(),
    name,
    description: cleanString(value.description, SEQUENCE_DESCRIPTION_MAX_LENGTH) ?? '',
    repeat_count: cleanRepeatCount(value.repeat_count),
    rest_between_sets_seconds:
      clampInt(value.rest_between_sets_seconds, 0, INTERVAL_DURATION_MAX_SECONDS) ?? 0,
    auto_advance: cleanBoolean(value.auto_advance, true),
    intervals,
    audio_config: sanitizeAudioConfig(value.audio_config),
    created_at: cleanTimestamp(value.created_at, timestamp),
    updated_at: cleanTimestamp(value.updated_at, timestamp),
    last_used_at: cleanNullableTimestamp(value.last_used_at),
  };
}

// ---------------------------------------------------------------------------
// Session sanitizer
// ---------------------------------------------------------------------------

/** Sanitize an untrusted pauses array, dropping malformed and excess entries. */
function sanitizePauses(value: unknown): PauseEntry[] {
  if (!Array.isArray(value)) return [];
  const pauses: PauseEntry[] = [];
  for (const entry of value.slice(0, SESSION_PAUSES_MAX)) {
    if (!isObject(entry)) continue;
    const pausedAt = cleanTimestampOrNull(entry.paused_at);
    if (pausedAt === null) continue;
    pauses.push({
      paused_at: pausedAt,
      resumed_at: cleanNullableTimestamp(entry.resumed_at),
    });
  }
  return pauses;
}

/**
 * Sanitize a single untrusted workout session. Returns null when required
 * identity fields (id, sequence_id, started_at, status) are missing or the
 * snapshot is present but not an object. A salvageable-but-garbled snapshot
 * degrades to null (analytics already tolerate null snapshots). Only
 * whitelisted WorkoutSession keys make it into the result.
 */
export function sanitizeSession(value: unknown): WorkoutSession | null {
  if (!isObject(value)) return null;

  const id = cleanId(value.id);
  const sequenceId = cleanId(value.sequence_id);
  const startedAt = cleanTimestampOrNull(value.started_at);
  if (id === null || sequenceId === null || startedAt === null) return null;

  if (typeof value.status !== 'string' || !VALID_SESSION_STATUSES.has(value.status)) {
    return null;
  }

  // Snapshot must be null or an object (mirrors the old shape check); an
  // object that the sequence sanitizer can't salvage degrades to null.
  if (value.sequence_snapshot !== null && !isObject(value.sequence_snapshot)) {
    return null;
  }
  const snapshot =
    value.sequence_snapshot === null ? null : sanitizeSequence(value.sequence_snapshot);

  return {
    id,
    sequence_id: sequenceId,
    sequence_snapshot: snapshot,
    started_at: startedAt,
    ended_at: cleanNullableTimestamp(value.ended_at),
    status: value.status as SessionStatus,
    stopped_at_interval:
      value.stopped_at_interval === null
        ? null
        : clampInt(value.stopped_at_interval, 0, SESSION_COUNTER_MAX),
    stopped_at_round:
      value.stopped_at_round === null
        ? null
        : clampInt(value.stopped_at_round, 0, SESSION_COUNTER_MAX),
    intervals_completed: clampInt(value.intervals_completed, 0, SESSION_COUNTER_MAX) ?? 0,
    rounds_completed: clampInt(value.rounds_completed, 0, SESSION_COUNTER_MAX) ?? 0,
    total_active_seconds: clampInt(value.total_active_seconds, 0, SESSION_COUNTER_MAX) ?? 0,
    total_rest_seconds: clampInt(value.total_rest_seconds, 0, SESSION_COUNTER_MAX) ?? 0,
    pauses: sanitizePauses(value.pauses),
    created_at: cleanTimestamp(value.created_at, startedAt),
    updated_at: cleanTimestamp(value.updated_at, startedAt),
    deleted_at: cleanNullableTimestamp(value.deleted_at),
  };
}
