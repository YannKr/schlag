/**
 * CountdownTimer component for Schlag.
 *
 * Renders the formatted time string in a large monospace bold font suitable
 * for the workout screen. Designed for readability at arm's length (2m+).
 *
 * The caller is responsible for formatting the time string (e.g. "01:23")
 * and driving updates at the desired refresh rate.
 */

import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { FONT_FAMILY } from '@/constants/typography';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CountdownTimerProps {
  /** Pre-formatted time string, e.g. "01:23" or "1:05:30". */
  formattedTime: string;
  /** Additional styles applied to the Text element. */
  style?: StyleProp<TextStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CountdownTimer({ formattedTime, style }: CountdownTimerProps) {
  return (
    <Text
      style={[styles.timer, style]}
      accessibilityRole="timer"
      accessibilityLabel={`Time remaining: ${formattedTime}`}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {formattedTime}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  timer: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.countdownMedium, // 80pt
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    // Tight line height prevents extra vertical space around the digits
    lineHeight: FONT_SIZE.countdownMedium * 1.1,
    // Use tabular (monospaced) figures for stable width during countdown
    fontVariant: ['tabular-nums'],
  },
});
