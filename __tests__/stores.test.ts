/**
 * Unit tests for Zustand stores: sequenceStore, settingsStore, timerStore.
 *
 * MMKV storage is mocked to avoid native binding requirements.
 * UUID is mocked for deterministic ID generation.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before any imports that reference them)
// ---------------------------------------------------------------------------

// Mock MMKV storage - it requires native bindings
jest.mock('@/lib/storage', () => {
  let sequences: any[] = [];
  let settings: any = null;
  let timerSession: any = null;
  let sessions: any[] = [];

  return {
    storage: {},
    getSequences: jest.fn(() => sequences),
    saveSequences: jest.fn((s: any[]) => { sequences = s; }),
    getSettings: jest.fn(() => settings ?? {
      beepsEnabled: true,
      voiceCountdownEnabled: true,
      workoutTheme: 'dark',
      keepScreenAwake: true,
      defaultAutoAdvance: true,
      beepVolume: 0.8,
      beepPitch: 1.0,
      defaultHalfwayAlert: false,
      defaultAnnounceNames: false,
      getReadySeconds: 3,
      reduceMotion: false,
    }),
    saveSettings: jest.fn((s: any) => { settings = s; }),
    getTimerSession: jest.fn(() => timerSession),
    saveTimerSession: jest.fn((s: any) => { timerSession = s; }),
    clearTimerSession: jest.fn(() => { timerSession = null; }),
    getSessions: jest.fn(() => sessions),
    saveSessions: jest.fn((s: any[]) => { sessions = s; }),
    __reset: () => { sequences = []; settings = null; timerSession = null; sessions = []; },
  };
});

let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `test-uuid-${++mockUuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useSequenceStore } from '@/stores/sequenceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Sequence } from '@/types/sequence';
import type { Interval } from '@/types/interval';
import type { TimerTickData } from '@/types/timer';
import type { AppSettings } from '@/types/settings';
import type { WorkoutSession } from '@/types/session';
import { getSequences, saveSequences, getSettings, saveSettings, saveSessions } from '@/lib/storage';

// Access the __reset helper from the mocked storage module.
const storageMock = jest.requireMock('@/lib/storage') as {
  __reset: () => void;
  getSequences: jest.Mock;
  saveSequences: jest.Mock;
  getSettings: jest.Mock;
  saveSettings: jest.Mock;
  getSessions: jest.Mock;
  saveSessions: jest.Mock;
};

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeInterval(overrides?: Partial<Interval>): Interval {
  return {
    id: `interval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Work',
    duration_seconds: 30,
    color: '#E63946',
    note: '',
    ...overrides,
  };
}

function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Test Sequence',
    description: 'A test sequence',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [makeInterval()],
    audio_config: {
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    last_used_at: null,
    ...overrides,
  };
}

function makeSession(overrides?: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: 'seq-123',
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

function makeTickData(overrides?: Partial<TimerTickData>): TimerTickData {
  return {
    status: 'running',
    currentInterval: makeInterval(),
    currentIntervalIndex: 0,
    totalIntervals: 3,
    currentRound: 1,
    totalRounds: 1,
    remainingMs: 25000,
    intervalDurationMs: 30000,
    progress: 0.167,
    nextInterval: makeInterval({ name: 'Rest' }),
    isRestBetweenSets: false,
    formattedTime: '00:25',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Initial state snapshots (for resetting between tests)
// ---------------------------------------------------------------------------

const INITIAL_SEQUENCE_STATE = {
  sequences: [] as Sequence[],
  isLoaded: false,
  sortOrder: 'lastUsed' as const,
};

const INITIAL_SETTINGS_STATE = {
  settings: {
    beepsEnabled: true,
    voiceCountdownEnabled: true,
    workoutTheme: 'dark' as const,
    keepScreenAwake: true,
    defaultAutoAdvance: true,
    beepVolume: 1.0,
    beepPitch: 1.0,
    defaultHalfwayAlert: false,
    defaultAnnounceNames: false,
    getReadySeconds: 3,
    reduceMotion: false,
  },
  isLoaded: false,
};

const INITIAL_SESSION_STATE = {
  sessions: [] as WorkoutSession[],
  isLoaded: false,
};

const INITIAL_TIMER_STATE = {
  tickData: null,
  isActive: false,
  isExpanded: false,
  activeSequenceId: null,
};

// ============================================================================
// Tests
// ============================================================================

describe('SequenceStore', () => {
  beforeEach(() => {
    // Reset store state
    useSequenceStore.setState(INITIAL_SEQUENCE_STATE);
    // Reset storage mock data
    storageMock.__reset();
    // Reset uuid counter for deterministic IDs
    mockUuidCounter = 0;
    // Clear mock call history
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('loadFromStorage', () => {
    it('hydrates sequences from storage and sets isLoaded', () => {
      const seq = makeSequence({ id: 'stored-1', name: 'Stored Sequence' });
      storageMock.getSequences.mockReturnValueOnce([seq]);

      useSequenceStore.getState().loadFromStorage();

      const state = useSequenceStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.sequences).toHaveLength(1);
      expect(state.sequences[0].id).toBe('stored-1');
      expect(state.sequences[0].name).toBe('Stored Sequence');
    });

    it('sets empty array when storage has no sequences', () => {
      storageMock.getSequences.mockReturnValueOnce([]);

      useSequenceStore.getState().loadFromStorage();

      const state = useSequenceStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.sequences).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Sequence CRUD
  // -----------------------------------------------------------------------

  describe('addSequence', () => {
    it('adds a sequence to the array and persists', () => {
      const seq = makeSequence({ id: 'new-1', name: 'Push Day' });

      useSequenceStore.getState().addSequence(seq);

      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(1);
      expect(state.sequences[0].name).toBe('Push Day');
      expect(saveSequences).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'new-1' })]),
      );
    });

    it('appends to existing sequences', () => {
      const first = makeSequence({ id: 'first', name: 'First' });
      const second = makeSequence({ id: 'second', name: 'Second' });

      useSequenceStore.getState().addSequence(first);
      useSequenceStore.getState().addSequence(second);

      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(2);
      expect(state.sequences[0].name).toBe('First');
      expect(state.sequences[1].name).toBe('Second');
    });
  });

  describe('updateSequence', () => {
    it('updates the correct sequence by id', () => {
      const seq = makeSequence({ id: 'upd-1', name: 'Original' });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().updateSequence('upd-1', { name: 'Renamed' });

      const updated = useSequenceStore.getState().sequences[0];
      expect(updated.name).toBe('Renamed');
      expect(updated.id).toBe('upd-1');
    });

    it('sets updated_at to the current timestamp', () => {
      const seq = makeSequence({ id: 'upd-2', updated_at: '2024-01-01T00:00:00.000Z' });
      useSequenceStore.setState({ sequences: [seq] });

      const before = new Date().toISOString();
      useSequenceStore.getState().updateSequence('upd-2', { name: 'Changed' });
      const after = new Date().toISOString();

      const updated = useSequenceStore.getState().sequences[0];
      expect(updated.updated_at >= before).toBe(true);
      expect(updated.updated_at <= after).toBe(true);
    });

    it('does not mutate other sequences', () => {
      const seq1 = makeSequence({ id: 's1', name: 'Keep' });
      const seq2 = makeSequence({ id: 's2', name: 'Change' });
      useSequenceStore.setState({ sequences: [seq1, seq2] });

      useSequenceStore.getState().updateSequence('s2', { name: 'Changed' });

      const state = useSequenceStore.getState();
      expect(state.sequences[0].name).toBe('Keep');
      expect(state.sequences[1].name).toBe('Changed');
    });

    it('persists after update', () => {
      const seq = makeSequence({ id: 'upd-3' });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().updateSequence('upd-3', { description: 'Updated desc' });

      expect(saveSequences).toHaveBeenCalled();
    });
  });

  describe('deleteSequence', () => {
    it('removes the correct sequence by id', () => {
      const seq1 = makeSequence({ id: 'del-1', name: 'Keep' });
      const seq2 = makeSequence({ id: 'del-2', name: 'Delete Me' });
      useSequenceStore.setState({ sequences: [seq1, seq2] });

      useSequenceStore.getState().deleteSequence('del-2');

      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(1);
      expect(state.sequences[0].id).toBe('del-1');
    });

    it('persists after deletion', () => {
      const seq = makeSequence({ id: 'del-3' });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().deleteSequence('del-3');

      expect(saveSequences).toHaveBeenCalledWith([]);
    });

    it('handles deleting non-existent id gracefully', () => {
      const seq = makeSequence({ id: 'existing' });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().deleteSequence('non-existent');

      expect(useSequenceStore.getState().sequences).toHaveLength(1);
    });
  });

  describe('duplicateSequence', () => {
    it('creates a copy with a new id and "(Copy)" suffix', () => {
      const original = makeSequence({
        id: 'orig-1',
        name: 'Leg Day',
        intervals: [makeInterval({ id: 'int-1', name: 'Squats' })],
      });
      useSequenceStore.setState({ sequences: [original] });

      const duplicate = useSequenceStore.getState().duplicateSequence('orig-1');

      expect(duplicate.name).toBe('Leg Day (Copy)');
      expect(duplicate.id).not.toBe('orig-1');
      expect(duplicate.id).toBe('test-uuid-1'); // First uuid call
    });

    it('assigns new IDs to all intervals in the duplicate', () => {
      const original = makeSequence({
        id: 'orig-2',
        intervals: [
          makeInterval({ id: 'int-a', name: 'A' }),
          makeInterval({ id: 'int-b', name: 'B' }),
        ],
      });
      useSequenceStore.setState({ sequences: [original] });

      const duplicate = useSequenceStore.getState().duplicateSequence('orig-2');

      expect(duplicate.intervals).toHaveLength(2);
      expect(duplicate.intervals[0].id).not.toBe('int-a');
      expect(duplicate.intervals[1].id).not.toBe('int-b');
      // Interval names should be preserved
      expect(duplicate.intervals[0].name).toBe('A');
      expect(duplicate.intervals[1].name).toBe('B');
    });

    it('sets last_used_at to null on the duplicate', () => {
      const original = makeSequence({
        id: 'orig-3',
        last_used_at: '2025-06-01T00:00:00.000Z',
      });
      useSequenceStore.setState({ sequences: [original] });

      const duplicate = useSequenceStore.getState().duplicateSequence('orig-3');

      expect(duplicate.last_used_at).toBeNull();
    });

    it('adds the duplicate to the store and persists', () => {
      const original = makeSequence({ id: 'orig-4' });
      useSequenceStore.setState({ sequences: [original] });

      useSequenceStore.getState().duplicateSequence('orig-4');

      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(2);
      expect(saveSequences).toHaveBeenCalled();
    });

    it('throws when duplicating a non-existent sequence', () => {
      useSequenceStore.setState({ sequences: [] });

      expect(() => {
        useSequenceStore.getState().duplicateSequence('non-existent');
      }).toThrow('Sequence not found: non-existent');
    });
  });

  describe('getSequenceById', () => {
    it('returns the correct sequence', () => {
      const seq = makeSequence({ id: 'find-1', name: 'Found It' });
      useSequenceStore.setState({ sequences: [seq] });

      const result = useSequenceStore.getState().getSequenceById('find-1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Found It');
    });

    it('returns undefined for a non-existent id', () => {
      useSequenceStore.setState({ sequences: [] });

      const result = useSequenceStore.getState().getSequenceById('missing');

      expect(result).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  describe('importSequences', () => {
    it('adds new sequences and assigns new interval UUIDs', () => {
      const incoming = makeSequence({
        id: 'import-1',
        name: 'Imported Workout',
        intervals: [makeInterval({ id: 'imp-int-1' })],
      });

      const result = useSequenceStore.getState().importSequences([incoming]);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(0);

      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(1);
      expect(state.sequences[0].name).toBe('Imported Workout');
      // Interval ID should be reassigned
      expect(state.sequences[0].intervals[0].id).not.toBe('imp-int-1');
    });

    it('assigns new UUID to sequences with duplicate IDs', () => {
      const existing = makeSequence({ id: 'dup-id', name: 'Existing' });
      useSequenceStore.setState({ sequences: [existing] });

      const incoming = makeSequence({ id: 'dup-id', name: 'Incoming' });

      const result = useSequenceStore.getState().importSequences([incoming]);

      expect(result.added).toBe(1);
      const state = useSequenceStore.getState();
      expect(state.sequences).toHaveLength(2);

      // Original keeps its ID
      expect(state.sequences[0].id).toBe('dup-id');
      // Imported gets a new UUID
      expect(state.sequences[1].id).not.toBe('dup-id');
      expect(state.sequences[1].name).toBe('Incoming');
    });

    it('skips entries with missing name', () => {
      const malformed = { id: 'bad-1', intervals: [] } as any;

      const result = useSequenceStore.getState().importSequences([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
      expect(useSequenceStore.getState().sequences).toHaveLength(0);
    });

    it('skips entries with missing intervals', () => {
      const malformed = { id: 'bad-2', name: 'No Intervals' } as any;

      const result = useSequenceStore.getState().importSequences([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips null/undefined entries', () => {
      const result = useSequenceStore.getState().importSequences([null as any, undefined as any]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it('handles a mix of valid and invalid entries', () => {
      const valid = makeSequence({ id: 'valid-1', name: 'Good' });
      const malformed = { id: 'bad-3' } as any;

      const result = useSequenceStore.getState().importSequences([valid, malformed]);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(useSequenceStore.getState().sequences).toHaveLength(1);
    });

    it('persists after import', () => {
      const incoming = makeSequence({ id: 'persist-import', name: 'Persist Test' });

      useSequenceStore.getState().importSequences([incoming]);

      expect(saveSequences).toHaveBeenCalled();
    });
  });

  describe('exportSequences', () => {
    it('returns a JSON string of all sequences', () => {
      const seq1 = makeSequence({ id: 'exp-1', name: 'Export A' });
      const seq2 = makeSequence({ id: 'exp-2', name: 'Export B' });
      useSequenceStore.setState({ sequences: [seq1, seq2] });

      const json = useSequenceStore.getState().exportSequences();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('Export A');
      expect(parsed[1].name).toBe('Export B');
    });

    it('returns empty array JSON when no sequences exist', () => {
      useSequenceStore.setState({ sequences: [] });

      const json = useSequenceStore.getState().exportSequences();

      expect(JSON.parse(json)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  describe('getSortedSequences', () => {
    describe('alphabetical sort', () => {
      it('sorts sequences by name (case-insensitive)', () => {
        const seqC = makeSequence({ id: 'c', name: 'Charlie' });
        const seqA = makeSequence({ id: 'a', name: 'Alpha' });
        const seqB = makeSequence({ id: 'b', name: 'Bravo' });
        useSequenceStore.setState({
          sequences: [seqC, seqA, seqB],
          sortOrder: 'alphabetical',
        });

        const sorted = useSequenceStore.getState().getSortedSequences();

        expect(sorted[0].name).toBe('Alpha');
        expect(sorted[1].name).toBe('Bravo');
        expect(sorted[2].name).toBe('Charlie');
      });
    });

    describe('lastUsed sort', () => {
      it('sorts most recently used first', () => {
        const seqOld = makeSequence({
          id: 'old',
          name: 'Old',
          last_used_at: '2025-01-01T00:00:00.000Z',
        });
        const seqNew = makeSequence({
          id: 'new',
          name: 'New',
          last_used_at: '2025-06-01T00:00:00.000Z',
        });
        useSequenceStore.setState({
          sequences: [seqOld, seqNew],
          sortOrder: 'lastUsed',
        });

        const sorted = useSequenceStore.getState().getSortedSequences();

        expect(sorted[0].name).toBe('New');
        expect(sorted[1].name).toBe('Old');
      });

      it('places never-used sequences (null last_used_at) at the end', () => {
        const used = makeSequence({
          id: 'used',
          name: 'Used',
          last_used_at: '2025-03-01T00:00:00.000Z',
        });
        const neverUsed = makeSequence({
          id: 'never',
          name: 'Never Used',
          last_used_at: null,
        });
        useSequenceStore.setState({
          sequences: [neverUsed, used],
          sortOrder: 'lastUsed',
        });

        const sorted = useSequenceStore.getState().getSortedSequences();

        expect(sorted[0].name).toBe('Used');
        expect(sorted[1].name).toBe('Never Used');
      });

      it('sorts never-used sequences by created_at (newest first)', () => {
        const older = makeSequence({
          id: 'older',
          name: 'Older',
          last_used_at: null,
          created_at: '2025-01-01T00:00:00.000Z',
        });
        const newer = makeSequence({
          id: 'newer',
          name: 'Newer',
          last_used_at: null,
          created_at: '2025-06-01T00:00:00.000Z',
        });
        useSequenceStore.setState({
          sequences: [older, newer],
          sortOrder: 'lastUsed',
        });

        const sorted = useSequenceStore.getState().getSortedSequences();

        expect(sorted[0].name).toBe('Newer');
        expect(sorted[1].name).toBe('Older');
      });
    });
  });

  describe('setSortOrder', () => {
    it('updates the sort order', () => {
      useSequenceStore.getState().setSortOrder('alphabetical');
      expect(useSequenceStore.getState().sortOrder).toBe('alphabetical');

      useSequenceStore.getState().setSortOrder('lastUsed');
      expect(useSequenceStore.getState().sortOrder).toBe('lastUsed');
    });
  });

  // -----------------------------------------------------------------------
  // Interval mutations
  // -----------------------------------------------------------------------

  describe('addInterval', () => {
    it('appends an interval to the end by default', () => {
      const seq = makeSequence({
        id: 'int-seq-1',
        intervals: [makeInterval({ id: 'existing', name: 'Existing' })],
      });
      useSequenceStore.setState({ sequences: [seq] });

      const newInterval = makeInterval({ id: 'new-int', name: 'New' });
      useSequenceStore.getState().addInterval('int-seq-1', newInterval);

      const updated = useSequenceStore.getState().sequences[0];
      expect(updated.intervals).toHaveLength(2);
      expect(updated.intervals[1].name).toBe('New');
    });

    it('inserts after specified index', () => {
      const seq = makeSequence({
        id: 'int-seq-2',
        intervals: [
          makeInterval({ id: 'a', name: 'A' }),
          makeInterval({ id: 'c', name: 'C' }),
        ],
      });
      useSequenceStore.setState({ sequences: [seq] });

      const newInterval = makeInterval({ id: 'b', name: 'B' });
      useSequenceStore.getState().addInterval('int-seq-2', newInterval, 0);

      const updated = useSequenceStore.getState().sequences[0];
      expect(updated.intervals).toHaveLength(3);
      expect(updated.intervals[0].name).toBe('A');
      expect(updated.intervals[1].name).toBe('B');
      expect(updated.intervals[2].name).toBe('C');
    });
  });

  describe('updateInterval', () => {
    it('updates the correct interval within a sequence', () => {
      const seq = makeSequence({
        id: 'upd-int-seq',
        intervals: [
          makeInterval({ id: 'ui-1', name: 'Original', duration_seconds: 30 }),
        ],
      });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().updateInterval('upd-int-seq', 'ui-1', {
        name: 'Updated',
        duration_seconds: 60,
      });

      const interval = useSequenceStore.getState().sequences[0].intervals[0];
      expect(interval.name).toBe('Updated');
      expect(interval.duration_seconds).toBe(60);
    });
  });

  describe('deleteInterval', () => {
    it('removes the correct interval', () => {
      const seq = makeSequence({
        id: 'del-int-seq',
        intervals: [
          makeInterval({ id: 'di-1', name: 'Keep' }),
          makeInterval({ id: 'di-2', name: 'Remove' }),
        ],
      });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().deleteInterval('del-int-seq', 'di-2');

      const updated = useSequenceStore.getState().sequences[0];
      expect(updated.intervals).toHaveLength(1);
      expect(updated.intervals[0].name).toBe('Keep');
    });
  });

  describe('reorderIntervals', () => {
    it('moves an interval from one position to another', () => {
      const seq = makeSequence({
        id: 'reorder-seq',
        intervals: [
          makeInterval({ id: 'r-1', name: 'A' }),
          makeInterval({ id: 'r-2', name: 'B' }),
          makeInterval({ id: 'r-3', name: 'C' }),
        ],
      });
      useSequenceStore.setState({ sequences: [seq] });

      // Move 'A' (index 0) to index 2
      useSequenceStore.getState().reorderIntervals('reorder-seq', 0, 2);

      const intervals = useSequenceStore.getState().sequences[0].intervals;
      expect(intervals[0].name).toBe('B');
      expect(intervals[1].name).toBe('C');
      expect(intervals[2].name).toBe('A');
    });

    it('does nothing for out-of-bounds indices', () => {
      const seq = makeSequence({
        id: 'reorder-oob',
        intervals: [
          makeInterval({ id: 'ro-1', name: 'A' }),
          makeInterval({ id: 'ro-2', name: 'B' }),
        ],
      });
      useSequenceStore.setState({ sequences: [seq] });

      useSequenceStore.getState().reorderIntervals('reorder-oob', -1, 5);

      const intervals = useSequenceStore.getState().sequences[0].intervals;
      expect(intervals[0].name).toBe('A');
      expect(intervals[1].name).toBe('B');
    });
  });
});

// ============================================================================
// SettingsStore
// ============================================================================

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(INITIAL_SETTINGS_STATE);
    storageMock.__reset();
    jest.clearAllMocks();
  });

  describe('loadFromStorage', () => {
    it('hydrates settings from storage and sets isLoaded', () => {
      storageMock.getSettings.mockReturnValueOnce({
        beepsEnabled: false,
        voiceCountdownEnabled: false,
        workoutTheme: 'interval-color',
        keepScreenAwake: false,
        defaultAutoAdvance: false,
        beepVolume: 0.5,
        beepPitch: 1.5,
        defaultHalfwayAlert: true,
        defaultAnnounceNames: true,
        getReadySeconds: 5,
        reduceMotion: false,
      });

      useSettingsStore.getState().loadFromStorage();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.beepsEnabled).toBe(false);
      expect(state.settings.voiceCountdownEnabled).toBe(false);
      expect(state.settings.workoutTheme).toBe('interval-color');
      expect(state.settings.keepScreenAwake).toBe(false);
      expect(state.settings.defaultAutoAdvance).toBe(false);
      expect(state.settings.beepVolume).toBe(0.5);
      expect(state.settings.beepPitch).toBe(1.5);
    });

    it('uses default settings when storage returns defaults', () => {
      // When settings is null, the mock returns the default object.
      useSettingsStore.getState().loadFromStorage();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.beepsEnabled).toBe(true);
      expect(state.settings.keepScreenAwake).toBe(true);
    });
  });

  describe('updateSetting', () => {
    it('changes a single setting key', () => {
      useSettingsStore.getState().updateSetting('beepsEnabled', false);

      const settings = useSettingsStore.getState().settings;
      expect(settings.beepsEnabled).toBe(false);
      // Other settings remain unchanged
      expect(settings.voiceCountdownEnabled).toBe(true);
    });

    it('persists after update', () => {
      useSettingsStore.getState().updateSetting('workoutTheme', 'light');

      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ workoutTheme: 'light' }),
      );
    });

    it('can update numeric settings', () => {
      useSettingsStore.getState().updateSetting('beepVolume', 0.3);

      expect(useSettingsStore.getState().settings.beepVolume).toBe(0.3);
    });

    it('can update string settings', () => {
      useSettingsStore.getState().updateSetting('workoutTheme', 'interval-color');

      expect(useSettingsStore.getState().settings.workoutTheme).toBe('interval-color');
    });
  });

  describe('resetToDefaults', () => {
    it('resets all settings to factory defaults', () => {
      // Modify several settings first
      useSettingsStore.getState().updateSetting('beepsEnabled', false);
      useSettingsStore.getState().updateSetting('workoutTheme', 'interval-color');
      useSettingsStore.getState().updateSetting('beepVolume', 0.2);

      useSettingsStore.getState().resetToDefaults();

      const settings = useSettingsStore.getState().settings;
      expect(settings.beepsEnabled).toBe(true);
      expect(settings.workoutTheme).toBe('dark');
      expect(settings.beepVolume).toBe(1.0);
      expect(settings.keepScreenAwake).toBe(true);
      expect(settings.voiceCountdownEnabled).toBe(true);
      expect(settings.defaultAutoAdvance).toBe(true);
      expect(settings.beepPitch).toBe(1.0);
    });

    it('persists the defaults to storage', () => {
      useSettingsStore.getState().resetToDefaults();

      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          beepsEnabled: true,
          workoutTheme: 'dark',
          beepVolume: 1.0,
        }),
      );
    });
  });
});

// ============================================================================
// TimerStore
// ============================================================================

describe('TimerStore', () => {
  beforeEach(() => {
    useTimerStore.setState(INITIAL_TIMER_STATE);
  });

  describe('setActive', () => {
    it('sets isActive to true and records sequenceId', () => {
      useTimerStore.getState().setActive('seq-123');

      const state = useTimerStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.activeSequenceId).toBe('seq-123');
    });

    it('resets isExpanded to false', () => {
      // Start with expanded = true
      useTimerStore.setState({ isExpanded: true });

      useTimerStore.getState().setActive('seq-456');

      expect(useTimerStore.getState().isExpanded).toBe(false);
    });

    it('clears any previous tickData', () => {
      useTimerStore.setState({ tickData: makeTickData() });

      useTimerStore.getState().setActive('seq-789');

      expect(useTimerStore.getState().tickData).toBeNull();
    });
  });

  describe('setInactive', () => {
    it('clears all active workout state', () => {
      // Set up an active state
      useTimerStore.setState({
        isActive: true,
        activeSequenceId: 'seq-active',
        isExpanded: true,
        tickData: makeTickData(),
      });

      useTimerStore.getState().setInactive();

      const state = useTimerStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.activeSequenceId).toBeNull();
      expect(state.isExpanded).toBe(false);
      expect(state.tickData).toBeNull();
    });
  });

  describe('updateTick', () => {
    it('stores tickData', () => {
      const tick = makeTickData({
        remainingMs: 15000,
        formattedTime: '00:15',
        progress: 0.5,
      });

      useTimerStore.getState().updateTick(tick);

      const state = useTimerStore.getState();
      expect(state.tickData).toBeDefined();
      expect(state.tickData!.remainingMs).toBe(15000);
      expect(state.tickData!.formattedTime).toBe('00:15');
      expect(state.tickData!.progress).toBe(0.5);
    });

    it('overwrites previous tickData', () => {
      const tick1 = makeTickData({ remainingMs: 20000 });
      const tick2 = makeTickData({ remainingMs: 10000 });

      useTimerStore.getState().updateTick(tick1);
      useTimerStore.getState().updateTick(tick2);

      expect(useTimerStore.getState().tickData!.remainingMs).toBe(10000);
    });
  });

  describe('toggleExpanded', () => {
    it('toggles isExpanded from false to true', () => {
      expect(useTimerStore.getState().isExpanded).toBe(false);

      useTimerStore.getState().toggleExpanded();

      expect(useTimerStore.getState().isExpanded).toBe(true);
    });

    it('toggles isExpanded from true to false', () => {
      useTimerStore.setState({ isExpanded: true });

      useTimerStore.getState().toggleExpanded();

      expect(useTimerStore.getState().isExpanded).toBe(false);
    });

    it('toggles back and forth correctly', () => {
      useTimerStore.getState().toggleExpanded();
      expect(useTimerStore.getState().isExpanded).toBe(true);

      useTimerStore.getState().toggleExpanded();
      expect(useTimerStore.getState().isExpanded).toBe(false);

      useTimerStore.getState().toggleExpanded();
      expect(useTimerStore.getState().isExpanded).toBe(true);
    });
  });
});

// ============================================================================
// SessionStore
// ============================================================================

describe('SessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState(INITIAL_SESSION_STATE);
    storageMock.__reset();
    mockUuidCounter = 0;
    jest.clearAllMocks();
  });

  describe('importSessions', () => {
    it('adds new sessions that are not in the store', () => {
      const incoming = makeSession({ id: 'import-s1', status: 'completed' });

      const result = useSessionStore.getState().importSessions([incoming]);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(0);

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe('import-s1');
      expect(state.sessions[0].status).toBe('completed');
    });

    it('assigns new UUID to sessions with duplicate IDs', () => {
      const existing = makeSession({ id: 'dup-session', status: 'completed' });
      useSessionStore.setState({ sessions: [existing] });

      const incoming = makeSession({ id: 'dup-session', status: 'stopped' });

      const result = useSessionStore.getState().importSessions([incoming]);

      expect(result.added).toBe(1);
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);

      // Original keeps its ID
      expect(state.sessions[0].id).toBe('dup-session');
      // Imported gets a new UUID
      expect(state.sessions[1].id).not.toBe('dup-session');
      expect(state.sessions[1].id).toBe('test-uuid-1');
      expect(state.sessions[1].status).toBe('stopped');
    });

    it('skips entries with invalid shape (missing id)', () => {
      const malformed = { sequence_id: 'seq-1', started_at: '2025-01-01T00:00:00Z', status: 'completed' } as any;

      const result = useSessionStore.getState().importSessions([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
      expect(useSessionStore.getState().sessions).toHaveLength(0);
    });

    it('skips entries with invalid shape (missing sequence_id)', () => {
      const malformed = { id: 'bad-1', started_at: '2025-01-01T00:00:00Z', status: 'completed' } as any;

      const result = useSessionStore.getState().importSessions([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips entries with invalid shape (missing started_at)', () => {
      const malformed = { id: 'bad-2', sequence_id: 'seq-1', status: 'completed' } as any;

      const result = useSessionStore.getState().importSessions([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips entries with invalid shape (missing status)', () => {
      const malformed = { id: 'bad-3', sequence_id: 'seq-1', started_at: '2025-01-01T00:00:00Z' } as any;

      const result = useSessionStore.getState().importSessions([malformed]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips null/undefined entries', () => {
      const result = useSessionStore.getState().importSessions([null as any, undefined as any]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it('returns 0 added and 0 skipped for empty array', () => {
      const result = useSessionStore.getState().importSessions([]);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(useSessionStore.getState().sessions).toHaveLength(0);
    });

    it('handles a mix of valid and invalid entries', () => {
      const valid = makeSession({ id: 'valid-s1' });
      const malformed = { id: 'bad-4' } as any;

      const result = useSessionStore.getState().importSessions([valid, malformed]);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it('persists after import', () => {
      const incoming = makeSession({ id: 'persist-session' });

      useSessionStore.getState().importSessions([incoming]);

      expect(saveSessions).toHaveBeenCalled();
    });

    it('sets updated_at to the current timestamp', () => {
      const incoming = makeSession({ id: 'ts-session', updated_at: '2024-01-01T00:00:00.000Z' });

      const before = new Date().toISOString();
      useSessionStore.getState().importSessions([incoming]);
      const after = new Date().toISOString();

      const imported = useSessionStore.getState().sessions[0];
      expect(imported.updated_at >= before).toBe(true);
      expect(imported.updated_at <= after).toBe(true);
    });
  });
});
