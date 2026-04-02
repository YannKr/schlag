/**
 * Zustand store for sequence management.
 *
 * Handles CRUD operations on the user's sequence library, interval-level
 * mutations within a sequence, import/export, and sort ordering. Every
 * mutation automatically persists the full sequence list to MMKV.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Sequence } from '@/types/sequence';
import type { Interval } from '@/types/interval';
import { getSequences, saveSequences } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface SequenceStore {
  sequences: Sequence[];
  isLoaded: boolean;
  sortOrder: 'lastUsed' | 'alphabetical';

  // Lifecycle
  loadFromStorage: () => void;

  // Sequence CRUD
  addSequence: (sequence: Sequence) => void;
  updateSequence: (id: string, updates: Partial<Sequence>) => void;
  deleteSequence: (id: string) => void;
  duplicateSequence: (id: string) => Sequence;
  getSequenceById: (id: string) => Sequence | undefined;

  // Interval mutations (within a sequence)
  addInterval: (sequenceId: string, interval: Interval, afterIndex?: number) => void;
  updateInterval: (sequenceId: string, intervalId: string, updates: Partial<Interval>) => void;
  deleteInterval: (sequenceId: string, intervalId: string) => void;
  reorderIntervals: (sequenceId: string, fromIndex: number, toIndex: number) => void;

  // Import / Export
  importSequences: (data: Sequence[]) => { added: number; skipped: number };
  exportSequences: () => string;

  // Sorting
  setSortOrder: (order: 'lastUsed' | 'alphabetical') => void;
  getSortedSequences: () => Sequence[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist the full sequence array to MMKV and return it (for chaining). */
function persist(sequences: Sequence[]): Sequence[] {
  saveSequences(sequences);
  return sequences;
}

/** Deep-clone a sequence by round-tripping through JSON. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/** Return current ISO-8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSequenceStore = create<SequenceStore>((set, get) => ({
  sequences: [],
  isLoaded: false,
  sortOrder: 'lastUsed',

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  loadFromStorage: () => {
    const sequences = getSequences();
    set({ sequences, isLoaded: true });
  },

  // -------------------------------------------------------------------------
  // Sequence CRUD
  // -------------------------------------------------------------------------

  addSequence: (sequence) => {
    set((state) => ({
      sequences: persist([...state.sequences, sequence]),
    }));
  },

  updateSequence: (id, updates) => {
    set((state) => {
      const sequences = state.sequences.map((seq) =>
        seq.id === id
          ? { ...seq, ...updates, updated_at: now() }
          : seq,
      );
      return { sequences: persist(sequences) };
    });
  },

  deleteSequence: (id) => {
    set((state) => {
      const sequences = state.sequences.filter((seq) => seq.id !== id);
      return { sequences: persist(sequences) };
    });
  },

  duplicateSequence: (id) => {
    const state = get();
    const original = state.sequences.find((seq) => seq.id === id);
    if (!original) {
      throw new Error(`Sequence not found: ${id}`);
    }

    const duplicate: Sequence = {
      ...deepClone(original),
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      created_at: now(),
      updated_at: now(),
      last_used_at: null,
      // Assign new IDs to all intervals in the duplicate.
      intervals: original.intervals.map((interval) => ({
        ...deepClone(interval),
        id: uuidv4(),
      })),
    };

    set((state) => ({
      sequences: persist([...state.sequences, duplicate]),
    }));

    return duplicate;
  },

  getSequenceById: (id) => {
    return get().sequences.find((seq) => seq.id === id);
  },

  // -------------------------------------------------------------------------
  // Interval mutations
  // -------------------------------------------------------------------------

  addInterval: (sequenceId, interval, afterIndex) => {
    set((state) => {
      const sequences = state.sequences.map((seq) => {
        if (seq.id !== sequenceId) return seq;

        const intervals = [...seq.intervals];
        if (afterIndex != null && afterIndex >= 0 && afterIndex < intervals.length) {
          // Insert after the specified index.
          intervals.splice(afterIndex + 1, 0, interval);
        } else {
          // Append to the end.
          intervals.push(interval);
        }

        return { ...seq, intervals, updated_at: now() };
      });
      return { sequences: persist(sequences) };
    });
  },

  updateInterval: (sequenceId, intervalId, updates) => {
    set((state) => {
      const sequences = state.sequences.map((seq) => {
        if (seq.id !== sequenceId) return seq;

        const intervals = seq.intervals.map((interval) =>
          interval.id === intervalId
            ? { ...interval, ...updates }
            : interval,
        );

        return { ...seq, intervals, updated_at: now() };
      });
      return { sequences: persist(sequences) };
    });
  },

  deleteInterval: (sequenceId, intervalId) => {
    set((state) => {
      const sequences = state.sequences.map((seq) => {
        if (seq.id !== sequenceId) return seq;

        const intervals = seq.intervals.filter((i) => i.id !== intervalId);
        return { ...seq, intervals, updated_at: now() };
      });
      return { sequences: persist(sequences) };
    });
  },

  reorderIntervals: (sequenceId, fromIndex, toIndex) => {
    set((state) => {
      const sequences = state.sequences.map((seq) => {
        if (seq.id !== sequenceId) return seq;

        const intervals = [...seq.intervals];
        if (
          fromIndex < 0 ||
          fromIndex >= intervals.length ||
          toIndex < 0 ||
          toIndex >= intervals.length
        ) {
          return seq;
        }

        const [moved] = intervals.splice(fromIndex, 1);
        intervals.splice(toIndex, 0, moved);

        return { ...seq, intervals, updated_at: now() };
      });
      return { sequences: persist(sequences) };
    });
  },

  // -------------------------------------------------------------------------
  // Import / Export
  // -------------------------------------------------------------------------

  importSequences: (data) => {
    const state = get();
    const existingIds = new Set(state.sequences.map((s) => s.id));

    let added = 0;
    let skipped = 0;
    const newSequences: Sequence[] = [];

    for (const incoming of data) {
      // Validate minimum shape -- skip garbage entries silently.
      if (!incoming || typeof incoming.name !== 'string' || !Array.isArray(incoming.intervals)) {
        skipped++;
        continue;
      }

      // If the ID already exists locally, assign a fresh UUID (merge, never overwrite).
      const sequence: Sequence = {
        ...deepClone(incoming),
        id: existingIds.has(incoming.id) ? uuidv4() : incoming.id,
        // Ensure intervals also have unique IDs.
        intervals: incoming.intervals.map((interval) => ({
          ...deepClone(interval),
          id: uuidv4(),
        })),
        updated_at: now(),
      };

      newSequences.push(sequence);
      existingIds.add(sequence.id);
      added++;
    }

    if (newSequences.length > 0) {
      set((state) => ({
        sequences: persist([...state.sequences, ...newSequences]),
      }));
    }

    return { added, skipped };
  },

  exportSequences: () => {
    return JSON.stringify(get().sequences, null, 2);
  },

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  setSortOrder: (order) => {
    set({ sortOrder: order });
  },

  getSortedSequences: () => {
    const { sequences, sortOrder } = get();

    const sorted = [...sequences];

    if (sortOrder === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // 'lastUsed' -- most recently used first, never-used sequences at the end.
      sorted.sort((a, b) => {
        const aTime = a.last_used_at ?? '';
        const bTime = b.last_used_at ?? '';

        if (aTime && bTime) return bTime.localeCompare(aTime);
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;

        // Both null -- fall back to creation date (newest first).
        return b.created_at.localeCompare(a.created_at);
      });
    }

    return sorted;
  },
}));
