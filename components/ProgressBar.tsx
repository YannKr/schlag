/**
 * ProgressBar component for Schlag.
 *
 * Displays a horizontal progress bar with smooth animated fill. Designed
 * for the dark workout screen -- the track uses a translucent white and the
 * fill color is configurable (typically the active interval color).
 *
 * Uses React Native's Animated API for 60fps animation.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LAYOUT } from '@/constants/layout';

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
  /** Animation duration in ms for progress changes. @default 150 */
  animationDuration?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({
  progress,
  color = '#FFFFFF',
  style,
  animationDuration = 150,
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const animatedValue = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedProgress,
      duration: animationDuration,
      useNativeDriver: false, // width animation cannot use native driver
    }).start();
  }, [clampedProgress, animatedValue, animationDuration]);

  const widthPercent = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
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
          {
            backgroundColor: color,
            width: widthPercent,
          },
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
