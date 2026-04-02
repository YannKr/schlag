/**
 * MMKV storage abstraction for Schlag.
 *
 * Provides typed helpers for persisting sequences, settings, timer sessions,
 * and auth tokens. MMKV v4 supports both native (iOS/Android) and web
 * (IndexedDB) out of the box.
 *
 * All read helpers return sensible defaults when a key does not exist,
 * so callers never have to handle `undefined` storage values.
 */

import { createMMKV } from 'react-native-mmkv';
import type { Sequence } from '@/types/sequence';
import type { AppSettings } from '@/types/settings';
import type { TimerSession } from '@/types/timer';
import type { WorkoutSession } from '@/types/session';
import type { ProStatus } from '@/types/pro';
import { DEFAULT_SETTINGS, DEFAULT_PRO_STATUS } from '@/constants/defaults';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
  SEQUENCES: 'schlag.sequences',
  SETTINGS: 'schlag.settings',
  TIMER_SESSION: 'schlag.timerSession',
  SESSIONS: 'schlag.sessions',
  PRO_STATUS: 'schlag.proStatus',
} as const;

// ---------------------------------------------------------------------------
// Singleton MMKV instance
// ---------------------------------------------------------------------------

export const storage = createMMKV({
  id: 'schlag-storage',
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

export function getSequences(): Sequence[] {
  return getJSON<Sequence[]>(KEYS.SEQUENCES) ?? [];
}

export function saveSequences(sequences: Sequence[]): void {
  setJSON(KEYS.SEQUENCES, sequences);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  const stored = getJSON<AppSettings>(KEYS.SETTINGS);
  if (stored == null) return { ...DEFAULT_SETTINGS };
  // Merge with defaults so newly added settings keys are always present.
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: AppSettings): void {
  setJSON(KEYS.SETTINGS, settings);
}

// ---------------------------------------------------------------------------
// Timer session (background persistence)
// ---------------------------------------------------------------------------

export function getTimerSession(): TimerSession | null {
  return getJSON<TimerSession>(KEYS.TIMER_SESSION);
}

export function saveTimerSession(session: TimerSession): void {
  setJSON(KEYS.TIMER_SESSION, session);
}

export function clearTimerSession(): void {
  storage.remove(KEYS.TIMER_SESSION);
}

// ---------------------------------------------------------------------------
// Workout sessions (v2 history)
// ---------------------------------------------------------------------------

export function getSessions(): WorkoutSession[] {
  return getJSON<WorkoutSession[]>(KEYS.SESSIONS) ?? [];
}

export function saveSessions(sessions: WorkoutSession[]): void {
  setJSON(KEYS.SESSIONS, sessions);
}

// ---------------------------------------------------------------------------
// Pro status (v2)
// ---------------------------------------------------------------------------

export function getProStatus(): ProStatus {
  const stored = getJSON<ProStatus>(KEYS.PRO_STATUS);
  if (stored == null) return { ...DEFAULT_PRO_STATUS };
  return { ...DEFAULT_PRO_STATUS, ...stored };
}

export function saveProStatus(status: ProStatus): void {
  setJSON(KEYS.PRO_STATUS, status);
}
