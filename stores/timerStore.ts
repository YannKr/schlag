/**
 * Zustand store for active workout (timer) state.
 *
 * This store is the single source of truth for the current workout tick
 * data that the UI renders. It is intentionally read-only from the UI
 * perspective -- the timer engine (lib/timer) owns the clock and calls
 * `updateTick()` on every frame.
 *
 * The store also tracks compact/expanded view state and whether a workout
 * is currently active.
 */

import { create } from 'zustand';
import type { TimerTickData } from '@/types/timer';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface TimerStore {
  /** Current tick data emitted by the timer engine. Null when idle. */
  tickData: TimerTickData | null;

  /** Whether a workout session is currently running or paused. */
  isActive: boolean;

  /** Compact (false) vs expanded (true) workout view. NOT persisted. */
  isExpanded: boolean;

  /** ID of the sequence being run. Null when no workout is active. */
  activeSequenceId: string | null;

  /** Called by the timer engine on every tick (~100ms). */
  updateTick: (data: TimerTickData) => void;

  /** Mark a workout as active for a given sequence. */
  setActive: (sequenceId: string) => void;

  /** Clear all active workout state (workout ended or stopped). */
  setInactive: () => void;

  /** Toggle between compact and expanded workout view. */
  toggleExpanded: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerStore>((set) => ({
  tickData: null,
  isActive: false,
  isExpanded: false,
  activeSequenceId: null,

  updateTick: (data) => {
    set({ tickData: data });
  },

  setActive: (sequenceId) => {
    set({
      isActive: true,
      activeSequenceId: sequenceId,
      // Always start in compact mode per PRD requirement.
      isExpanded: false,
      tickData: null,
    });
  },

  setInactive: () => {
    set({
      isActive: false,
      activeSequenceId: null,
      isExpanded: false,
      tickData: null,
    });
  },

  toggleExpanded: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },
}));
