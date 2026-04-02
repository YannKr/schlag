/**
 * AnimatedCountdown component for Schlag.
 *
 * Wraps the countdown timer display with scale-pulse animations at the 3-2-1
 * thresholds and haptic feedback on native platforms. During the 'climax' act
 * of the intensity engine, applies a glow text shadow using the provided
 * glowColor.
 *
 * Uses react-native-reanimated for performant, worklet-driven animations and
 * expo-haptics for tactile feedback (guarded to native-only).
 */

import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnimatedCountdownProps {
  /** Pre-formatted time string, e.g. "01:23" or "1:05:30". */
  formattedTime: string;
  /** Milliseconds remaining in the current interval. */
  remainingMs: number;
  /** Text color driven by the current theme / interval palette. */
  textColor: string;
  /** Glow color from the intensity engine (used for text shadow in climax). */
  glowColor: string;
  /** Current narrative act from the intensity engine. */
  act: 'opening' | 'rising' | 'climax' | 'release';
  /** Font size override. Defaults to FONT_SIZE.countdownMedium (80). */
  fontSize?: number;
  /** When true, disables scale animation and haptic feedback. */
  reduceMotion?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Thresholds (in ms) at which we pulse + haptic. */
const COUNTDOWN_THRESHOLDS = [3000, 2000, 1000] as const;

/** Threshold for the final "done" haptic at 0 ms. */
const ZERO_THRESHOLD = 0;

/** Spring config matching the spec: damping 8, stiffness 150. */
const SPRING_CONFIG = { damping: 8, stiffness: 150 } as const;

/** Scale factor for the pulse animation. */
const PULSE_SCALE = 1.2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fire haptic feedback on native platforms only.
 * This is a no-op on web where expo-haptics is unavailable.
 */
function fireHaptic(style: Haptics.ImpactFeedbackStyle): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnimatedCountdown({
  formattedTime,
  remainingMs,
  textColor,
  glowColor,
  act,
  fontSize = FONT_SIZE.countdownMedium,
  reduceMotion = false,
}: AnimatedCountdownProps) {
  // -------------------------------------------------------------------------
  // Shared values
  // -------------------------------------------------------------------------

  const scale = useSharedValue(1);

  // -------------------------------------------------------------------------
  // Threshold tracking
  //
  // We track which thresholds have already fired for the current interval so
  // that we don't re-trigger on every render while remainingMs stays below a
  // threshold. When remainingMs jumps back up (indicating a new interval has
  // started), we reset the set.
  // -------------------------------------------------------------------------

  const firedThresholds = useRef(new Set<number>());
  const prevRemainingMs = useRef(remainingMs);

  useEffect(() => {
    const prev = prevRemainingMs.current;

    // Detect new interval: remainingMs jumped significantly upward.
    // A jump of more than 500ms upward is a reliable signal that we moved to
    // a new interval (normal countdown ticks are always downward or very small
    // upward jitter from timer precision).
    if (remainingMs > prev + 500) {
      firedThresholds.current.clear();
    }

    // Check countdown thresholds (3s, 2s, 1s)
    for (const threshold of COUNTDOWN_THRESHOLDS) {
      if (
        !firedThresholds.current.has(threshold) &&
        prev > threshold &&
        remainingMs <= threshold
      ) {
        firedThresholds.current.add(threshold);

        if (!reduceMotion) {
          // Pulse: scale up then spring back to 1
          scale.value = PULSE_SCALE;
          scale.value = withSpring(1, SPRING_CONFIG);

          // Haptic: rigid impact for countdown beats
          fireHaptic(Haptics.ImpactFeedbackStyle.Rigid);
        }
      }
    }

    // Check zero crossing (interval complete)
    if (
      !firedThresholds.current.has(ZERO_THRESHOLD) &&
      prev > 0 &&
      remainingMs <= ZERO_THRESHOLD
    ) {
      firedThresholds.current.add(ZERO_THRESHOLD);

      if (!reduceMotion) {
        // Pulse at zero as well
        scale.value = PULSE_SCALE;
        scale.value = withSpring(1, SPRING_CONFIG);

        // Haptic: heavy impact for interval completion
        fireHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }

    prevRemainingMs.current = remainingMs;
  }, [remainingMs, reduceMotion, scale]);

  // -------------------------------------------------------------------------
  // Animated styles
  // -------------------------------------------------------------------------

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // -------------------------------------------------------------------------
  // Climax glow
  //
  // During the 'climax' act, we apply a subtle text shadow glow using the
  // intensity engine's glowColor. On web we use textShadow (CSS string),
  // on native we use textShadowColor/Offset/Radius.
  // -------------------------------------------------------------------------

  const glowStyle =
    act === 'climax'
      ? {
          textShadowColor: glowColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }
      : undefined;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Animated.Text
      style={[
        styles.timer,
        { fontSize, lineHeight: fontSize * 1.1, color: textColor },
        glowStyle,
        animatedStyle,
      ]}
      accessibilityRole="timer"
      accessibilityLabel={`Time remaining: ${formattedTime}`}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {formattedTime}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  timer: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.countdownMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FONT_SIZE.countdownMedium * 1.1,
    fontVariant: ['tabular-nums'],
  },
});
