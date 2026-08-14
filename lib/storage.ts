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
import { DEFAULT_SETTINGS } from '@/constants/defaults';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
  SEQUENCES: 'schlag.sequences',
  SETTINGS: 'schlag.settings',
  TIMER_SESSION: 'schlag.timerSession',
  SESSIONS: 'schlag.sessions',
} as const;

/** Prefix for copies of stored values that could not be parsed. */
const QUARANTINE_PREFIX = 'schlag.corrupt.';

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

/**
 * Keep a copy of a value that could not be parsed, under a key nothing else
 * writes to, so the next save cannot overwrite it.
 *
 * Only the first bad copy per key is kept. A later failure is almost always
 * the same data read again, and storing every attempt would grow without
 * bound in exactly the situation where space may already be short.
 */
function quarantine(key: string, raw: string): void {
  const quarantineKey = `${QUARANTINE_PREFIX}${key}`;
  try {
    if (storage.getString(quarantineKey) == null) {
      storage.set(quarantineKey, raw);
    }
  } catch (err) {
    // Nothing useful is left to try — the original value is untouched.
    console.error(`[Schlag] Could not quarantine ${key}:`, err);
  }
}

function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    // Returning null makes the caller fall back to its default, and the next
    // save then writes over the unreadable value for good. Park a copy first
    // so the data can still be recovered by hand.
    quarantine(key, raw);
    const message = err instanceof Error ? err.message : 'Stored data is unreadable';
    console.error(`[Schlag] Storage read failed for ${key}:`, err);
    onStorageError?.({
      key,
      message: `${message}. A copy of the unreadable data was kept.`,
    });
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
// Quarantine (unreadable data)
// ---------------------------------------------------------------------------

/**
 * Keys whose stored value could not be parsed and was set aside.
 * Returns the original key names, not the quarantine key names.
 */
export function getQuarantinedKeys(): string[] {
  return storage
    .getAllKeys()
    .filter((k) => k.startsWith(QUARANTINE_PREFIX))
    .map((k) => k.slice(QUARANTINE_PREFIX.length));
}

/** The raw text that was set aside for a key, or null if there is none. */
export function getQuarantinedValue(key: string): string | null {
  return storage.getString(`${QUARANTINE_PREFIX}${key}`) ?? null;
}

/** Drop the copy kept for a key, once it has been recovered or given up on. */
export function clearQuarantined(key: string): void {
  storage.remove(`${QUARANTINE_PREFIX}${key}`);
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
