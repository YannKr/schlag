/**
 * Floating Action Button (FAB) for Schlag.
 *
 * 56px diameter circle in Schlag Red positioned at the bottom-right corner
 * of its parent (requires the parent to have `position: 'relative'` or be
 * the screen root). Renders a white "+" icon.
 *
 * Shadow uses iOS shadow props and Android elevation per the platform.
 */

import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FABProps {
  /** Press handler. */
  onPress: () => void;
  /** Additional styles (mainly for positioning overrides). */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label. @default 'Add' */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FAB({
  onPress,
  style,
  accessibilityLabel = 'Add',
}: FABProps) {
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fab,
        { opacity: pressed ? 0.8 : 1 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        style,
      ]}
    >
      <Text style={styles.icon}>+</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: LAYOUT.fabSize,
    height: LAYOUT.fabSize,
    borderRadius: LAYOUT.fabSize / 2,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    // Android elevation
    elevation: 6,
    zIndex: 10,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    // Shift slightly up for optical centering of the "+" glyph
    marginTop: -2,
  },
});
