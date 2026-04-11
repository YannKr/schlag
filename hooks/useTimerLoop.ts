/**
 * useTimerLoop — React hook that drives the Schlag workout timer.
 *
 * Platform-adaptive tick loop:
 *   - Web: `requestAnimationFrame` for smooth 60fps progress bars.
 *   - Native: `setInterval` at 100ms with drift correction via absolute time.
 *
 * Responsibilities:
 *   1. Create and manage TimerEngine + AudioEngine instances.
 *   2. Run the tick loop, updating state each frame.
 *   3. Fire audio cues detected by the engine.
 *   4. Handle AppState transitions (save session on background, restore on foreground).
 *   5. Expose imperative controls (start, pause, resume, skip, stop, finishAfterRound).
 *
 * All timing uses absolute timestamps — see TimerEngine for details.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import type { Sequence, TimerTickData, ToneName } from '@/types';
import { TimerEngine } from '@/lib/timer/timerEngine';
import { AudioEngine } from '@/lib/audio/audioEngine';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  saveTimerSession,
  clearTimerSession,
  getTimerSession,
} from '@/lib/storage';

// ---------------------------------------------------------------------------
// Tick interval for native (ms).
// 100ms balances battery life with responsive display updates.
// ---------------------------------------------------------------------------

const NATIVE_TICK_INTERVAL_MS = 100;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

/** Max age of a saved session before it's considered stale (24 hours). */
const SESSION_STALE_MS = 24 * 60 * 60 * 1000;

export interface UseTimerLoopReturn {
  /** Current timer snapshot, or null when no workout is active. */
  tickData: TimerTickData | null;

  /** Start a new workout with the given sequence. */
  start: (sequence: Sequence) => Promise<void>;

  /**
   * Attempt to restore a saved session from MMKV.
   * Returns true if a valid session was restored, false otherwise.
   * The caller should fall back to start() if this returns false.
   */
  restore: (sequence: Sequence) => Promise<boolean>;

  /** Pause the running timer. */
  pause: () => void;

  /** Resume from paused state. */
  resume: () => void;

  /** Skip to the next interval. */
  skip: () => void;

  /** Stop the workout entirely. */
  stop: () => void;

  /** In infinite mode, finish after the current round. */
  finishAfterRound: () => void;

  /** Whether the timer is actively running or paused. */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTimerLoop(): UseTimerLoopReturn {
  // -----------------------------------------------------------------------
  // Refs — mutable values that persist across renders without triggering
  // re-renders. The engine and audio system are intentionally NOT in state.
  // -----------------------------------------------------------------------

  const engineRef = useRef<TimerEngine>(new TimerEngine());
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const loopIdRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const sequenceRef = useRef<Sequence | null>(null);

  // -----------------------------------------------------------------------
  // State — drives UI re-renders.
  // -----------------------------------------------------------------------

  const [tickData, setTickData] = useState<TimerTickData | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Global voice countdown setting (overrides per-sequence config when off).
  const globalVoiceEnabled = useSettingsStore((s) => s.settings.voiceCountdownEnabled);

  // -----------------------------------------------------------------------
  // Audio cue dispatcher
  // -----------------------------------------------------------------------

  const dispatchAudioCues = useCallback(
    (cues: ToneName[], sequence: Sequence | null) => {
      if (!sequence) return;

      const audio = audioRef.current;
      // Voice is only enabled if BOTH the global setting AND the per-sequence
      // setting are true. The global toggle in Settings is the master switch.
      const voiceEnabled = globalVoiceEnabled && sequence.audio_config.use_voice_countdown;
      const beepsEnabled = sequence.audio_config.use_builtin_beeps;

      for (const cue of cues) {
        switch (cue) {
          case 'intervalStart':
            if (beepsEnabled) audio.playIntervalStart();
            break;

          case 'countdown3':
            if (beepsEnabled || voiceEnabled) {
              audio.playCountdown(3, voiceEnabled);
            }
            break;

          case 'countdown2':
            if (beepsEnabled || voiceEnabled) {
              audio.playCountdown(2, voiceEnabled);
            }
            break;

          case 'countdown1':
            if (beepsEnabled || voiceEnabled) {
              audio.playCountdown(1, voiceEnabled);
            }
            break;

          case 'intervalEnd':
            if (beepsEnabled) audio.playIntervalEnd();
            break;

          case 'workoutComplete':
            // Cannot be disabled per PRD.
            audio.playWorkoutComplete();
            break;

          case 'pauseClick':
            audio.playPauseClick();
            break;

          case 'halfway':
            if (sequence.audio_config.halfway_alert) {
              audio.playHalfway(voiceEnabled);
            }
            break;
        }
      }
    },
    [globalVoiceEnabled],
  );

  // -----------------------------------------------------------------------
  // Tick function (called every frame or interval)
  // -----------------------------------------------------------------------

  const performTick = useCallback(() => {
    const engine = engineRef.current;
    const data = engine.tick();

    if (!data) {
      setTickData(null);
      setIsActive(false);
      return;
    }

    // Check for audio cues to fire.
    if (data.status === 'running') {
      const cues = engine.getAudioCuesToFire(data.remainingMs);
      if (cues.length > 0) {
        // During rest, suppress the intervalEnd double-beep (the voice
        // announcement still fires below). This prevents a burst of
        // beeps at the rest-to-work transition.
        if (data.isRestBetweenSets) {
          const filtered = cues.filter((c) => c !== 'intervalEnd');
          if (filtered.length > 0) {
            dispatchAudioCues(filtered, sequenceRef.current);
          }
        } else {
          dispatchAudioCues(cues, sequenceRef.current);
        }
      }

      // Speak next interval name when the interval-end cue fires.
      if (cues.includes('intervalEnd') && data.nextInterval) {
        const seq = sequenceRef.current;
        if (globalVoiceEnabled && seq?.audio_config.use_voice_countdown) {
          audioRef.current.speakNextInterval(
            data.nextInterval.name,
            true,
          );
        }
      }

      // v2: Announce current interval name at the start.
      if (cues.includes('intervalStart')) {
        const seq = sequenceRef.current;
        if (globalVoiceEnabled && seq?.audio_config.announce_interval_names && seq.audio_config.use_voice_countdown) {
          audioRef.current.speakNextInterval(
            data.currentInterval.name,
            true,
          );
        }
      }
    }

    // Update state for UI.
    setTickData(data);
    setIsActive(data.status === 'running' || data.status === 'paused');

    // If workout just completed, stop the loop.
    if (data.status === 'completed') {
      stopLoop();
      clearTimerSession();
    }
  }, [dispatchAudioCues]);

  // -----------------------------------------------------------------------
  // Loop management
  // -----------------------------------------------------------------------

  const startLoop = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    if (Platform.OS === 'web') {
      // requestAnimationFrame loop for smooth 60fps progress bar.
      const rafLoop = () => {
        if (!isRunningRef.current) return;
        performTick();
        loopIdRef.current = requestAnimationFrame(rafLoop);
      };
      loopIdRef.current = requestAnimationFrame(rafLoop);
    } else {
      // setInterval at 100ms for native — absolute time prevents drift.
      loopIdRef.current = setInterval(performTick, NATIVE_TICK_INTERVAL_MS);
    }
  }, [performTick]);

  const stopLoop = useCallback(() => {
    isRunningRef.current = false;

    if (loopIdRef.current !== null) {
      if (Platform.OS === 'web') {
        cancelAnimationFrame(loopIdRef.current as number);
      } else {
        clearInterval(loopIdRef.current as ReturnType<typeof setInterval>);
      }
      loopIdRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Public controls
  // -----------------------------------------------------------------------

  const start = useCallback(
    async (sequence: Sequence) => {
      const audio = audioRef.current;
      const engine = engineRef.current;

      // Initialize audio (pre-load tones, set audio mode).
      await audio.initialize();

      // Unlock Web Audio on the gesture that starts the workout.
      if (Platform.OS === 'web') {
        audio.unlockWebAudio();
      }

      sequenceRef.current = sequence;
      engine.startWorkout(sequence);

      startLoop();
    },
    [startLoop],
  );

  const restore = useCallback(
    async (sequence: Sequence): Promise<boolean> => {
      const saved = getTimerSession();
      if (!saved) return false;

      // Validate the session matches this sequence.
      if (saved.sequenceId !== sequence.id) {
        clearTimerSession();
        return false;
      }

      // Discard stale sessions (> 24 hours old).
      if (Date.now() - saved.savedAt > SESSION_STALE_MS) {
        clearTimerSession();
        return false;
      }

      // Only restore running/paused sessions.
      if (saved.state.status !== 'running' && saved.state.status !== 'paused') {
        clearTimerSession();
        return false;
      }

      const audio = audioRef.current;
      const engine = engineRef.current;

      await audio.initialize();
      if (Platform.OS === 'web') {
        audio.unlockWebAudio();
      }

      sequenceRef.current = sequence;
      engine.restoreSession(saved, sequence);

      startLoop();
      return true;
    },
    [startLoop],
  );

  const pause = useCallback(() => {
    const engine = engineRef.current;
    engine.pause();
    audioRef.current.playPauseClick();

    // Perform one final tick to update UI to paused state.
    performTick();
  }, [performTick]);

  const resume = useCallback(() => {
    const engine = engineRef.current;
    engine.resume();
    audioRef.current.playPauseClick();

    // Ensure the loop is running (it may have been stopped during background).
    if (!isRunningRef.current) {
      startLoop();
    }
  }, [startLoop]);

  const skip = useCallback(() => {
    engineRef.current.skip();
    // Tick immediately to update UI and fire the new interval's start cue.
    performTick();
  }, [performTick]);

  const stop = useCallback(() => {
    stopLoop();
    engineRef.current.stop();
    audioRef.current.stopSpeech();
    clearTimerSession();
    sequenceRef.current = null;
    setTickData(null);
    setIsActive(false);
  }, [stopLoop]);

  const finishAfterRound = useCallback(() => {
    engineRef.current.requestFinishAfterRound();
  }, []);

  // -----------------------------------------------------------------------
  // AppState handling (background / foreground)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const engine = engineRef.current;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Save session to MMKV so the workout survives a process kill.
        const session = engine.saveSession();
        if (session) {
          saveTimerSession(session);
        }

        // On native, keep the interval running so audio cues continue
        // firing in the background (foreground service handles this).
        // On web, the browser may throttle timers but the absolute-time
        // approach ensures correct display when the tab re-focuses.
      }

      if (nextAppState === 'active') {
        // Coming back to foreground.
        if (engine.isActive()) {
          // The absolute-time approach means tick() will automatically
          // compute the correct remaining time — no adjustment needed.
          // Just ensure the loop is running.
          if (!isRunningRef.current) {
            startLoop();
          }

          // Perform an immediate tick to snap the display.
          performTick();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [startLoop, performTick]);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      stopLoop();
      audioRef.current.cleanup().catch(() => {});
    };
  }, [stopLoop]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    tickData,
    start,
    restore,
    pause,
    resume,
    skip,
    stop,
    finishAfterRound,
    isActive,
  };
}
