/**
 * EmptyState component for Schlag.
 *
 * Displays a centered message with a CTA button. Used on the library
 * screen when no sequences exist.
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Message displayed above the CTA button. */
  message: string;
  /** Label for the CTA button. */
  actionLabel: string;
  /** Called when the CTA button is pressed. */
  onAction: () => void;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed ? 0.7 : 1 },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        ]}
      >
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  message: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: FONT_SIZE.body * 1.5,
  },
  button: {
    minHeight: LAYOUT.buttonMinHeight,
    backgroundColor: APP_COLORS.primary,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    maxWidth: 240,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
