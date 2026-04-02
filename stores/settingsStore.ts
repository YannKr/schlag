/**
 * Zustand store for app settings.
 *
 * Manages global preferences such as audio toggles, workout theme, and
 * screen-awake behaviour. Every mutation persists to MMKV immediately.
 */

import { create } from 'zustand';
import type { AppSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { getSettings, saveSettings } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;

  /** Hydrate settings from MMKV. Call once on app start. */
  loadFromStorage: () => void;

  /** Update a single setting by key. Persists the full object to MMKV. */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

  /** Reset all settings to factory defaults and persist. */
  resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoaded: false,

  loadFromStorage: () => {
    const settings = getSettings();
    set({ settings, isLoaded: true });
  },

  updateSetting: (key, value) => {
    set((state) => {
      const settings: AppSettings = { ...state.settings, [key]: value };
      saveSettings(settings);
      return { settings };
    });
  },

  resetToDefaults: () => {
    const settings = { ...DEFAULT_SETTINGS };
    saveSettings(settings);
    set({ settings });
  },
}));
