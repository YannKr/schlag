/**
 * MMKV storage abstraction for Schlag.
 *
 * Provides typed helpers for persisting sequences, settings, timer sessions,
 * and auth tokens. MMKV v4 supports both native (iOS/Android) and web
 * (localStorage) out of the box.
 *
 * All read helpers return sensible defaults when a key does not exist,
 * so callers never have to handle `undefined` storage values.
 */

import { Platform } from 'react-native';
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
// Storage error callback
// ---------------------------------------------------------------------------

type StorageErrorHandler = (error: { key: string; message: string }) => void;
let onStorageError: StorageErrorHandler | null = null;

/** Register a callback invoked when a storage write fails (quota exceeded, etc.). */
export function setStorageErrorHandler(handler: StorageErrorHandler): void {
  onStorageError = handler;
}

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

function setJSON<T>(key: string, value: T): boolean {
  try {
    storage.set(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage write failed';
    console.error(`[Schlag] Storage write failed for ${key}:`, err);
    onStorageError?.({ key, message });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

export function getSequences(): Sequence[] {
  return getJSON<Sequence[]>(KEYS.SEQUENCES) ?? [];
}

export function saveSequences(sequences: Sequence[]): boolean {
  return setJSON(KEYS.SEQUENCES, sequences);
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

export function saveSettings(settings: AppSettings): boolean {
  return setJSON(KEYS.SETTINGS, settings);
}

// ---------------------------------------------------------------------------
// Timer session (background persistence)
// ---------------------------------------------------------------------------

export function getTimerSession(): TimerSession | null {
  return getJSON<TimerSession>(KEYS.TIMER_SESSION);
}

export function saveTimerSession(session: TimerSession): boolean {
  return setJSON(KEYS.TIMER_SESSION, session);
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

export function saveSessions(sessions: WorkoutSession[]): boolean {
  return setJSON(KEYS.SESSIONS, sessions);
}

// ---------------------------------------------------------------------------
// Pro status (v2)
// ---------------------------------------------------------------------------

export function getProStatus(): ProStatus {
  const stored = getJSON<ProStatus>(KEYS.PRO_STATUS);
  if (stored == null) return { ...DEFAULT_PRO_STATUS };
  return { ...DEFAULT_PRO_STATUS, ...stored };
}

export function saveProStatus(status: ProStatus): boolean {
  return setJSON(KEYS.PRO_STATUS, status);
}

// ---------------------------------------------------------------------------
// Storage usage (web)
// ---------------------------------------------------------------------------

/** Estimate bytes used by this app's keys in localStorage. Returns 0 on native. */
export function getStorageUsageBytes(): number {
  if (Platform.OS !== 'web') return 0;
  let total = 0;
  for (const key of storage.getAllKeys()) {
    const val = storage.getString(key);
    if (val) total += key.length + val.length;
  }
  // JS strings are UTF-16: 2 bytes per character
  return total * 2;
}

// ---------------------------------------------------------------------------
// Persistent storage (web)
// ---------------------------------------------------------------------------

/**
 * Request the browser to mark this origin's storage as persistent so it
 * won't be evicted under storage pressure. Firefox uses "best-effort" by
 * default and can silently delete localStorage data days after last visit.
 *
 * No-op on native platforms (MMKV uses file-based storage there).
 * Returns true when storage is (or was already) persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (Platform.OS !== 'web') return true;
  if (!navigator.storage?.persist) return false;

  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return true;

  return navigator.storage.persist();
}
