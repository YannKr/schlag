/**
 * ProgressBar component for Schlag.
 *
 * Displays a horizontal progress bar with smooth animated fill, optional
 * glow on the leading edge, and a pulse effect during the climax act.
 * Migrated to Reanimated shared values for UI-thread animation.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

import { LAYOUT } from '@/constants/layout';
import type { Act } from '@/lib/intensity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressBarProps {
  /** Current progress value between 0 and 1. */
  progress: number;
  /** Fill color. @default '#FFFFFF' */
  color?: string;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Current narrative arc act for visual effects. */
  act?: Act;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({
  progress,
  color = '#FFFFFF',
  style,
  act,
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Shared values for smooth animation
  const animatedProgress = useSharedValue(clampedProgress);
  const pulseOpacity = useSharedValue(1);

  // Update progress with smooth timing
  React.useEffect(() => {
    animatedProgress.value = withTiming(clampedProgress, {
      duration: 150,
      easing: Easing.out(Easing.ease),
    });
  }, [clampedProgress, animatedProgress]);

  // Climax pulse: oscillate opacity 0.8-1.0
  React.useEffect(() => {
    if (act === 'climax') {
      pulseOpacity.value = withRepeat(
        withTiming(0.8, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [act, pulseOpacity]);

  const fillStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedProgress.value * 100}%` as any,
      opacity: pulseOpacity.value,
    };
  });

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedProgress * 100),
      }}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color },
          fillStyle,
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HALF_HEIGHT = LAYOUT.progressBarHeight / 2;

const styles = StyleSheet.create({
  track: {
    height: LAYOUT.progressBarHeight,
    borderRadius: HALF_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: HALF_HEIGHT,
  },
});
