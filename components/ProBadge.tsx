/**
 * ProBadge component for Schlag.
 *
 * Renders a compact inline badge with a lock icon and "Pro" label. Used
 * throughout the app to indicate features gated behind the Schlag Pro
 * purchase.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { SPACING } from '@/constants/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProBadgeProps {
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProBadge({ style }: ProBadgeProps) {
  return (
    <View style={[styles.container, style]} accessibilityLabel="Pro feature">
      <Text style={styles.lockIcon}>{'\uD83D\uDD12'}</Text>
      <Text style={styles.label}>Pro</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  lockIcon: {
    fontSize: 14,
  },
  label: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textMuted,
  },
});
