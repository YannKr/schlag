/**
 * Tests for storage resilience: error handling, pruning, and usage estimation.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before any imports)
// ---------------------------------------------------------------------------

const mockStorageData = new Map<string, string>();
let mockSetShouldThrow = false;

jest.mock('react-native-mmkv', () => ({
  createMMKV: (config: { id: string }) => {
    const keyPrefix = `${config.id}\\`;
    return {
      set: (key: string, value: string) => {
        if (mockSetShouldThrow) {
          throw new Error('QuotaExceededError: localStorage is full');
        }
        mockStorageData.set(keyPrefix + key, value);
      },
      getString: (key: string) => mockStorageData.get(keyPrefix + key) ?? undefined,
      remove: (key: string) => { mockStorageData.delete(keyPrefix + key); return true; },
      getAllKeys: () => {
        return [...mockStorageData.keys()]
          .filter((k) => k.startsWith(keyPrefix))
          .map((k) => k.slice(keyPrefix.length));
      },
    };
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  saveSequences,
  getSequences,
  saveSettings,
  saveSessions,
  getSessions,
  setStorageErrorHandler,
  getStorageUsageBytes,
} from '@/lib/storage';
import type { Sequence } from '@/types/sequence';
import type { WorkoutSession } from '@/types/session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    id: 'seq-1',
    name: 'Test Sequence',
    description: '',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [
      {
        id: 'int-1',
        name: 'Work',
        duration_seconds: 30,
        color: '#E63946',
        note: '',
      },
    ],
    audio_config: {
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: '2025-06-01T10:00:00.000Z',
    updated_at: '2025-06-01T10:00:00.000Z',
    last_used_at: null,
    ...overrides,
  };
}

function makeSession(overrides?: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: `session-${Math.random().toString(36).slice(2, 7)}`,
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
    pauses: [],
    created_at: '2025-06-01T10:00:00.000Z',
    updated_at: '2025-06-01T10:30:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockStorageData.clear();
  mockSetShouldThrow = false;
  setStorageErrorHandler(null as any);
});

// ---------------------------------------------------------------------------
// setJSON error handling
// ---------------------------------------------------------------------------

describe('storage error handling', () => {
  it('returns true on successful write', () => {
    expect(saveSequences([makeSequence()])).toBe(true);
  });

  it('returns false when storage.set() throws', () => {
    mockSetShouldThrow = true;
    expect(saveSequences([makeSequence()])).toBe(false);
  });

  it('calls the error handler with key and message on failure', () => {
    const handler = jest.fn();
    setStorageErrorHandler(handler);

    mockSetShouldThrow = true;
    saveSequences([makeSequence()]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      key: 'schlag.sequences',
      message: 'QuotaExceededError: localStorage is full',
    });
  });

  it('does not call error handler on success', () => {
    const handler = jest.fn();
    setStorageErrorHandler(handler);

    saveSequences([makeSequence()]);

    expect(handler).not.toHaveBeenCalled();
  });

  it('logs to console.error on failure', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    mockSetShouldThrow = true;

    saveSequences([makeSequence()]);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Storage write failed'),
      expect.any(Error),
    );
    spy.mockRestore();
  });

  it('saveSettings returns false on failure', () => {
    mockSetShouldThrow = true;
    expect(saveSettings({} as any)).toBe(false);
  });

  it('saveSessions returns false on failure', () => {
    mockSetShouldThrow = true;
    expect(saveSessions([])).toBe(false);
  });

  it('data is not corrupted after a failed write', () => {
    saveSequences([makeSequence({ id: 'original' })]);
    expect(getSequences()[0].id).toBe('original');

    mockSetShouldThrow = true;
    saveSequences([makeSequence({ id: 'should-not-persist' })]);

    mockSetShouldThrow = false;
    expect(getSequences()[0].id).toBe('original');
  });
});

// ---------------------------------------------------------------------------
// Storage usage estimation
// ---------------------------------------------------------------------------

describe('getStorageUsageBytes', () => {
  it('returns 0 when no data is stored', () => {
    expect(getStorageUsageBytes()).toBe(0);
  });

  it('returns a positive number after storing data', () => {
    saveSequences([makeSequence()]);
    expect(getStorageUsageBytes()).toBeGreaterThan(0);
  });

  it('increases when more data is stored', () => {
    saveSequences([makeSequence()]);
    const before = getStorageUsageBytes();

    saveSessions([makeSession(), makeSession(), makeSession()]);
    const after = getStorageUsageBytes();

    expect(after).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// Session pruning (via sessionStore)
// ---------------------------------------------------------------------------

describe('session pruning', () => {
  // Import session store — it uses our mocked storage via the same MMKV mock.
  const { useSessionStore } = require('@/stores/sessionStore');

  beforeEach(() => {
    useSessionStore.setState({ sessions: [], isLoaded: false });
  });

  it('removes soft-deleted sessions older than 30 days', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    useSessionStore.setState({
      sessions: [
        makeSession({ id: 'old-deleted', deleted_at: thirtyOneDaysAgo }),
        makeSession({ id: 'recent-deleted', deleted_at: fiveDaysAgo }),
        makeSession({ id: 'active', deleted_at: null }),
      ],
      isLoaded: true,
    });

    useSessionStore.getState().pruneOldSessions();
    const remaining = useSessionStore.getState().sessions;

    expect(remaining).toHaveLength(2);
    expect(remaining.map((s: WorkoutSession) => s.id)).toEqual(['recent-deleted', 'active']);
  });

  it('nullifies sequence_snapshot for sessions older than 90 days', () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    useSessionStore.setState({
      sessions: [
        makeSession({ id: 'old', created_at: ninetyOneDaysAgo, sequence_snapshot: makeSequence() }),
        makeSession({ id: 'recent', created_at: tenDaysAgo, sequence_snapshot: makeSequence() }),
      ],
      isLoaded: true,
    });

    useSessionStore.getState().pruneOldSessions();
    const remaining = useSessionStore.getState().sessions;

    expect(remaining[0].sequence_snapshot).toBeNull();
    expect(remaining[1].sequence_snapshot).not.toBeNull();
  });

  it('preserves recent sessions untouched', () => {
    const recentSession = makeSession({
      id: 'fresh',
      created_at: new Date().toISOString(),
      deleted_at: null,
    });

    useSessionStore.setState({
      sessions: [recentSession],
      isLoaded: true,
    });

    useSessionStore.getState().pruneOldSessions();
    const remaining = useSessionStore.getState().sessions;

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('fresh');
    expect(remaining[0].sequence_snapshot).not.toBeNull();
  });

  it('does not persist when nothing changed', () => {
    // Store a recent session and confirm the underlying storage is unchanged after prune.
    const recentSession = makeSession({
      id: 'no-change',
      created_at: new Date().toISOString(),
      deleted_at: null,
    });

    useSessionStore.setState({
      sessions: [recentSession],
      isLoaded: true,
    });

    // Snapshot current storage state
    const storageBefore = new Map(mockStorageData);

    useSessionStore.getState().pruneOldSessions();

    // Storage should be identical — no write occurred.
    expect(mockStorageData).toEqual(storageBefore);
  });
});
