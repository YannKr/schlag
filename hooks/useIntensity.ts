/**
 * useIntensity — Bridges React timer state to Reanimated shared values.
 *
 * Consumes `TimerTickData` from the timer store/loop, runs it through the
 * pure `computeIntensity()` engine, and stores every output as a Reanimated
 * shared value so downstream components (AmbientBackground, ProgressBar,
 * AnimatedCountdown) can read them on the UI thread without crossing the
 * JS-UI bridge every frame.
 *
 * Tick data arrives at ~10Hz on native and ~60Hz on web.  Each shared value
 * update is wrapped in `withTiming({ duration: 150 })` to interpolate
 * smoothly between ticks, preventing visual stutter.
 *
 * Special states:
 *   - null tickData  -> all zeros, act = 'opening', isPaused = false.
 *   - paused         -> shared values frozen at current level, isPaused = true.
 *   - completed      -> act = 'release', overall animates to 0 over 1500ms.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { computeIntensity } from '@/lib/intensity';
import type { Act } from '@/lib/intensity';
import type { TimerTickData } from '@/types/timer';
import { useSettingsStore } from '@/stores/settingsStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntensityValues {
  /** Overall intensity 0-1. SharedValue for UI-thread consumption. */
  overall: { value: number };

  /** Pulse / breathing rate 0-1. SharedValue for UI-thread consumption. */
  pulse: { value: number };

  /** Color temperature 0-1 (cool to hot). SharedValue for UI-thread consumption. */
  colorTemp: { value: number };

  /** Glow radius in px. SharedValue for UI-thread consumption. */
  glowRadius: { value: number };

  /** Glow opacity 0-1. SharedValue for UI-thread consumption. */
  glowOpacity: { value: number };

  /** Dramatic act — plain JS value, not animated. */
  act: Act;

  /** Whether the timer is paused — plain JS value, not animated. */
  isPaused: boolean;

  /** Whether reduce-motion is active (app setting or system accessibility). */
  reduceMotion: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration for smooth interpolation between normal ticks. */
const TICK_TRANSITION_MS = 150;

/** Duration for the fade-out animation when the workout completes. */
const COMPLETION_FADE_MS = 1500;

/**
 * On web, the tick loop runs at 60Hz via rAF. Updating 5 shared values
 * every frame (300 withTiming calls/sec) floods the animation scheduler
 * and blocks the main thread, causing timer skips and Firefox jank.
 * Throttle to ~10Hz on web — CSS transitions handle interpolation.
 */
const WEB_THROTTLE_MS = Platform.OS === 'web' ? 100 : 0;

/**
 * When reduce-motion is active (app setting or system accessibility),
 * clamp shared values to these low constants for a barely-there ambient
 * effect without shaders, breathing, or scale animations.
 */
const REDUCED_OVERALL = 0.1;
const REDUCED_PULSE = 0.2;
const REDUCED_COLOR_TEMP = 0;
const REDUCED_GLOW_RADIUS = 80;
const REDUCED_GLOW_OPACITY = 0.05;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIntensity(tickData: TimerTickData | null): IntensityValues {
  // -----------------------------------------------------------------------
  // Shared values — live on the UI thread. Created once, updated in-place.
  // -----------------------------------------------------------------------

  const overall = useSharedValue(0);
  const pulse = useSharedValue(0);
  const colorTemp = useSharedValue(0);
  const glowRadius = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  // -----------------------------------------------------------------------
  // Plain React state — read in JS, not on the UI thread.
  // -----------------------------------------------------------------------

  const [act, setAct] = useState<Act>('opening');
  const [isPaused, setIsPaused] = useState(false);

  // -----------------------------------------------------------------------
  // Reduce-motion: app setting + system accessibility preference.
  // -----------------------------------------------------------------------

  const appReduceMotion = useSettingsStore((s) => s.settings.reduceMotion);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    // Check initial system setting.
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setSystemReduceMotion(enabled);
    });

    // Listen for changes while the hook is alive.
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setSystemReduceMotion(enabled);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const reduceMotion = appReduceMotion || systemReduceMotion;

  // Throttle timestamp for web (skip updates that arrive faster than 10Hz).
  const lastUpdateRef = useRef(0);

  // -----------------------------------------------------------------------
  // Effect: compute intensity and push to shared values on every tick.
  // -----------------------------------------------------------------------

  useEffect(() => {
    // -- Null tick data: reset everything to defaults -------------------

    if (tickData === null) {
      overall.value = withTiming(0, { duration: TICK_TRANSITION_MS });
      pulse.value = withTiming(0, { duration: TICK_TRANSITION_MS });
      colorTemp.value = withTiming(0, { duration: TICK_TRANSITION_MS });
      glowRadius.value = withTiming(0, { duration: TICK_TRANSITION_MS });
      glowOpacity.value = withTiming(0, { duration: TICK_TRANSITION_MS });
      setAct('opening');
      setIsPaused(false);
      return;
    }

    // -- Paused: freeze shared values, flip the flag -------------------

    if (tickData.status === 'paused') {
      setIsPaused(true);
      // Don't update shared values — keep them at the last running level.
      // Components read isPaused to dim the glow / slow breathing.
      return;
    }

    setIsPaused(false);

    // -- Completed: fade out gracefully --------------------------------

    if (tickData.status === 'completed') {
      setAct('release');
      overall.value = withTiming(0, { duration: COMPLETION_FADE_MS });
      pulse.value = withTiming(0, { duration: COMPLETION_FADE_MS });
      colorTemp.value = withTiming(0, { duration: COMPLETION_FADE_MS });
      glowRadius.value = withTiming(0, { duration: COMPLETION_FADE_MS });
      glowOpacity.value = withTiming(0, { duration: COMPLETION_FADE_MS });
      return;
    }

    // -- Running / idle: compute and animate ---------------------------

    // On web, throttle shared value updates to ~10Hz to avoid flooding
    // the animation scheduler. The timer display itself updates at 60Hz
    // via the normal React state pipeline — only the ambient visual
    // effects are throttled.
    if (WEB_THROTTLE_MS > 0) {
      const now = Date.now();
      if (now - lastUpdateRef.current < WEB_THROTTLE_MS) {
        // Still update act (discrete, cheap) but skip shared value animations.
        const output = computeIntensity({
          totalIntervals: tickData.totalIntervals,
          currentIntervalIndex: tickData.currentIntervalIndex,
          totalRounds: tickData.totalRounds,
          currentRound: tickData.currentRound,
          intervalProgress: tickData.progress,
          isRestBetweenSets: tickData.isRestBetweenSets,
          remainingMs: tickData.remainingMs,
        });
        setAct(output.act);
        return;
      }
      lastUpdateRef.current = now;
    }

    const output = computeIntensity({
      totalIntervals: tickData.totalIntervals,
      currentIntervalIndex: tickData.currentIntervalIndex,
      totalRounds: tickData.totalRounds,
      currentRound: tickData.currentRound,
      intervalProgress: tickData.progress,
      isRestBetweenSets: tickData.isRestBetweenSets,
      remainingMs: tickData.remainingMs,
    });

    // Act is a discrete label — always update (used for logic even in reduce-motion).
    setAct(output.act);

    // When reduce-motion is active, clamp visual shared values to low constants
    // instead of the full intensity engine output. This gives a barely-there
    // ambient effect without shaders, breathing, or scale animations.
    if (reduceMotion) {
      overall.value = REDUCED_OVERALL;
      pulse.value = REDUCED_PULSE;
      colorTemp.value = REDUCED_COLOR_TEMP;
      glowRadius.value = REDUCED_GLOW_RADIUS;
      glowOpacity.value = REDUCED_GLOW_OPACITY;
      return;
    }

    // Update shared values with smooth timing to interpolate between ticks.
    overall.value = withTiming(output.overall, { duration: TICK_TRANSITION_MS });
    pulse.value = withTiming(output.pulse, { duration: TICK_TRANSITION_MS });
    colorTemp.value = withTiming(output.colorTemp, { duration: TICK_TRANSITION_MS });
    glowRadius.value = withTiming(output.glowRadius, { duration: TICK_TRANSITION_MS });
    glowOpacity.value = withTiming(output.glowOpacity, { duration: TICK_TRANSITION_MS });
  }, [tickData, reduceMotion, overall, pulse, colorTemp, glowRadius, glowOpacity]);

  // -----------------------------------------------------------------------
  // Return the shared values and plain state for component consumption.
  // -----------------------------------------------------------------------

  return {
    overall,
    pulse,
    colorTemp,
    glowRadius,
    glowOpacity,
    act,
    isPaused,
    reduceMotion,
  };
}
