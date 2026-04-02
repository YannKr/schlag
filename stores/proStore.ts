/**
 * Zustand store for Pro status.
 *
 * Manages whether the user has unlocked Schlag Pro. Every mutation persists
 * the full ProStatus object to MMKV immediately. Includes a togglePro()
 * helper for development/testing.
 */

import { create } from 'zustand';
import type { ProStatus } from '@/types/pro';
import { DEFAULT_PRO_STATUS } from '@/constants/defaults';
import { getProStatus, saveProStatus } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ProStore {
  proStatus: ProStatus;
  isLoaded: boolean;

  /** Hydrate Pro status from MMKV. Call once on app start. */
  loadFromStorage: () => void;

  /** Returns true when Pro features are unlocked. */
  isPro: () => boolean;

  /** Toggle Pro on/off for development and testing. */
  togglePro: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProStore = create<ProStore>((set, get) => ({
  proStatus: { ...DEFAULT_PRO_STATUS },
  isLoaded: false,

  loadFromStorage: () => {
    const proStatus = getProStatus();
    set({ proStatus, isLoaded: true });
  },

  isPro: () => {
    return get().proStatus.pro_unlocked;
  },

  togglePro: () => {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
    set((state) => {
      const wasUnlocked = state.proStatus.pro_unlocked;
      const proStatus: ProStatus = {
        ...state.proStatus,
        pro_unlocked: !wasUnlocked,
        pro_purchased_at: !wasUnlocked ? new Date().toISOString() : null,
      };
      saveProStatus(proStatus);
      return { proStatus };
    });
  },
}));
