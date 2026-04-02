/**
 * Zustand store for workout session history (v2).
 *
 * Tracks completed and stopped workout sessions, providing analytics
 * helpers for streaks, weekly/monthly summaries, and work:rest ratios.
 * Every mutation automatically persists the full session list to MMKV.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Sequence } from '@/types/sequence';
import type { WorkoutSession, PauseEntry } from '@/types/session';
import { getSessions, saveSessions } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface SessionStore {
  sessions: WorkoutSession[];
  isLoaded: boolean;

  // Lifecycle
  loadFromStorage: () => void;

  // Start a new session (called when workout begins). Returns session ID.
  startSession: (sequence: Sequence) => string;

  // Update a running session (called periodically during workout).
  updateSession: (sessionId: string, updates: Partial<WorkoutSession>) => void;

  // Complete a session.
  completeSession: (
    sessionId: string,
    data: {
      intervals_completed: number;
      rounds_completed: number;
      total_active_seconds: number;
      total_rest_seconds: number;
    },
  ) => void;

  // Stop a session early.
  stopSession: (
    sessionId: string,
    data: {
      stopped_at_interval: number;
      stopped_at_round: number;
      intervals_completed: number;
      rounds_completed: number;
      total_active_seconds: number;
      total_rest_seconds: number;
    },
  ) => void;

  // Record a pause event.
  addPause: (sessionId: string) => void;

  // Record a resume event.
  recordResume: (sessionId: string) => void;

  // Soft delete (recoverable for 30 days).
  deleteSession: (sessionId: string) => void;

  // Get sessions (excluding soft-deleted).
  getActiveSessions: () => WorkoutSession[];

  // Get sessions for a specific date range.
  getSessionsForDateRange: (start: Date, end: Date) => WorkoutSession[];

  // Get sessions grouped by date (YYYY-MM-DD key).
  getSessionsGroupedByDate: () => Map<string, WorkoutSession[]>;

  // Analytics helpers
  getCurrentStreak: () => number;
  getWeekSummary: () => {
    sessions: number;
    activeSeconds: number;
    restSeconds: number;
  };
  getMonthSummary: () => {
    sessions: number;
    activeSeconds: number;
    restSeconds: number;
  };
  getWorkRestRatio: () => number;
  getMostUsedSequence: () => { name: string; count: number } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist the full session array to MMKV and return it (for chaining). */
function persist(sessions: WorkoutSession[]): WorkoutSession[] {
  saveSessions(sessions);
  return sessions;
}

/** Deep-clone an object by round-tripping through JSON. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/** Return current ISO-8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

/** Extract YYYY-MM-DD using local date components (not UTC). */
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Get the start of today (local time) as a Date. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the start of a given day offset from today. */
function startOfDayOffset(daysAgo: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Get the start of the current week (Monday). */
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay();
  // getDay() returns 0 for Sunday; shift so Monday = 0.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Get the start of the current calendar month. */
function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  isLoaded: false,

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  loadFromStorage: () => {
    const sessions = getSessions();
    set({ sessions, isLoaded: true });
  },

  // -------------------------------------------------------------------------
  // Session CRUD
  // -------------------------------------------------------------------------

  startSession: (sequence) => {
    const id = uuidv4();
    const timestamp = now();

    const session: WorkoutSession = {
      id,
      sequence_id: sequence.id,
      sequence_snapshot: deepClone(sequence),
      started_at: timestamp,
      ended_at: null,
      status: 'in_progress',
      stopped_at_interval: null,
      stopped_at_round: null,
      intervals_completed: 0,
      rounds_completed: 0,
      total_active_seconds: 0,
      total_rest_seconds: 0,
      pauses: [],
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    set((state) => ({
      sessions: persist([session, ...state.sessions]),
    }));

    return id;
  },

  updateSession: (sessionId, updates) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, ...updates, updated_at: now() }
          : s,
      );
      return { sessions: persist(sessions) };
    });
  },

  completeSession: (sessionId, data) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              ...data,
              status: 'completed' as const,
              ended_at: now(),
              updated_at: now(),
            }
          : s,
      );
      return { sessions: persist(sessions) };
    });
  },

  stopSession: (sessionId, data) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              ...data,
              status: 'stopped' as const,
              ended_at: now(),
              updated_at: now(),
            }
          : s,
      );
      return { sessions: persist(sessions) };
    });
  },

  // -------------------------------------------------------------------------
  // Pause / Resume
  // -------------------------------------------------------------------------

  addPause: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;

        const pause: PauseEntry = {
          paused_at: now(),
          resumed_at: null,
        };

        return {
          ...s,
          pauses: [...s.pauses, pause],
          updated_at: now(),
        };
      });
      return { sessions: persist(sessions) };
    });
  },

  recordResume: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;

        const pauses = [...s.pauses];
        // Find the last pause that hasn't been resumed yet.
        for (let i = pauses.length - 1; i >= 0; i--) {
          if (pauses[i].resumed_at === null) {
            pauses[i] = { ...pauses[i], resumed_at: now() };
            break;
          }
        }

        return { ...s, pauses, updated_at: now() };
      });
      return { sessions: persist(sessions) };
    });
  },

  // -------------------------------------------------------------------------
  // Soft delete
  // -------------------------------------------------------------------------

  deleteSession: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, deleted_at: now(), updated_at: now() }
          : s,
      );
      return { sessions: persist(sessions) };
    });
  },

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getActiveSessions: () => {
    return get().sessions.filter((s) => s.deleted_at === null);
  },

  getSessionsForDateRange: (start, end) => {
    return get()
      .sessions.filter((s) => {
        if (s.deleted_at !== null) return false;
        const d = new Date(s.started_at);
        return d >= start && d <= end;
      })
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
  },

  getSessionsGroupedByDate: () => {
    const active = get().getActiveSessions();
    const sorted = [...active].sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    const grouped = new Map<string, WorkoutSession[]>();
    for (const session of sorted) {
      const key = toDateKey(new Date(session.started_at));
      const existing = grouped.get(key);
      if (existing) {
        existing.push(session);
      } else {
        grouped.set(key, [session]);
      }
    }

    return grouped;
  },

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  getCurrentStreak: () => {
    const active = get().getActiveSessions();
    if (active.length === 0) return 0;

    // Build a set of unique dates (local) that have completed sessions.
    const completedDates = new Set<string>();
    for (const s of active) {
      if (s.status === 'completed' || s.status === 'stopped') {
        completedDates.add(toDateKey(new Date(s.started_at)));
      }
    }

    if (completedDates.size === 0) return 0;

    let streak = 0;
    const today = startOfToday();
    const todayKey = toDateKey(today);

    // Check if today has a session; if not, start from yesterday.
    let cursor = new Date(today);
    if (!completedDates.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    // Walk backwards counting consecutive days.
    while (completedDates.has(toDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  },

  getWeekSummary: () => {
    const weekStart = startOfWeek();
    const weekEnd = new Date();
    const sessions = get().getSessionsForDateRange(weekStart, weekEnd);

    return {
      sessions: sessions.length,
      activeSeconds: sessions.reduce(
        (sum, s) => sum + s.total_active_seconds,
        0,
      ),
      restSeconds: sessions.reduce(
        (sum, s) => sum + s.total_rest_seconds,
        0,
      ),
    };
  },

  getMonthSummary: () => {
    const monthStart = startOfMonth();
    const monthEnd = new Date();
    const sessions = get().getSessionsForDateRange(monthStart, monthEnd);

    return {
      sessions: sessions.length,
      activeSeconds: sessions.reduce(
        (sum, s) => sum + s.total_active_seconds,
        0,
      ),
      restSeconds: sessions.reduce(
        (sum, s) => sum + s.total_rest_seconds,
        0,
      ),
    };
  },

  getWorkRestRatio: () => {
    const { activeSeconds, restSeconds } = get().getWeekSummary();
    if (restSeconds === 0) return activeSeconds > 0 ? Infinity : 0;
    return Math.round((activeSeconds / restSeconds) * 10) / 10;
  },

  getMostUsedSequence: () => {
    const monthStart = startOfMonth();
    const monthEnd = new Date();
    const sessions = get().getSessionsForDateRange(monthStart, monthEnd);

    if (sessions.length === 0) return null;

    // Count by sequence name (from snapshot, so we capture the name at workout time).
    const counts = new Map<string, number>();
    for (const s of sessions) {
      const name = s.sequence_snapshot.name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    let best: { name: string; count: number } | null = null;
    for (const [name, count] of counts) {
      if (!best || count > best.count) {
        best = { name, count };
      }
    }

    return best;
  },
}));
