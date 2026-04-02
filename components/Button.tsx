/**
 * Button component for Schlag.
 *
 * Supports four visual variants and a loading state. All variants meet the
 * 44px minimum tap-target requirement and use 8px border radius per the
 * design system.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  /** Button label. */
  title: string;
  /** Press handler. */
  onPress: () => void;
  /** Visual variant. @default 'primary' */
  variant?: ButtonVariant;
  /** Disables the button and reduces opacity. */
  disabled?: boolean;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  /** Additional styles applied to the outer Pressable. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label override. Falls back to title. */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Variant style maps
// ---------------------------------------------------------------------------

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: APP_COLORS.primary,
  secondary: 'transparent',
  danger: APP_COLORS.primary,
  ghost: 'transparent',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: APP_COLORS.primary,
  danger: '#FFFFFF',
  ghost: APP_COLORS.textMuted,
};

const VARIANT_BORDER: Record<ButtonVariant, string | undefined> = {
  primary: undefined,
  secondary: APP_COLORS.primary,
  danger: undefined,
  ghost: undefined,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = useCallback(() => {
    if (!isDisabled) {
      onPress();
    }
  }, [isDisabled, onPress]);

  const borderColor = VARIANT_BORDER[variant];
  const textColor = VARIANT_TEXT[variant];

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: VARIANT_BG[variant],
          opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
        },
        borderColor != null && { borderWidth: 1.5, borderColor },
        Platform.OS === 'web' && ({ cursor: isDisabled ? 'not-allowed' : 'pointer' } as ViewStyle),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[styles.label, { color: textColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    minHeight: LAYOUT.buttonMinHeight,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  label: {
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
