/**
 * IconButton component for Schlag.
 *
 * A circular pressable that wraps an icon element. Enforces the 44x44 minimum
 * tap-target size defined in the design system.
 */

import React, { type ReactNode, useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LAYOUT } from '@/constants/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IconButtonProps {
  /** The icon content to render inside the button. */
  icon: ReactNode;
  /** Press handler. */
  onPress: () => void;
  /** Diameter of the circular button. @default 44 */
  size?: number;
  /** Disables the button and reduces opacity. */
  disabled?: boolean;
  /** Additional styles applied to the outer Pressable. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IconButton({
  icon,
  onPress,
  size = LAYOUT.minTapTarget,
  disabled = false,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        Platform.OS === 'web' && ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle),
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
