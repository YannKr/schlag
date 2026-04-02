/**
 * ColorPicker component for Schlag.
 *
 * Renders a 3-column grid of the 12 interval palette colors as tappable
 * circles. The currently selected color shows a white checkmark overlay
 * and a 3px white border.
 */

import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { INTERVAL_COLORS } from '@/constants/colors';
import { SPACING } from '@/constants/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorPickerProps {
  /** Currently selected hex color. */
  selectedColor: string;
  /** Called when the user selects a color. */
  onSelect: (hex: string) => void;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 44;
const COLUMNS = 3;
const GAP = SPACING.md;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorPicker({
  selectedColor,
  onSelect,
  style,
}: ColorPickerProps) {
  const handleSelect = useCallback(
    (hex: string) => {
      onSelect(hex);
    },
    [onSelect],
  );

  return (
    <View
      style={[styles.grid, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Interval color picker"
    >
      {INTERVAL_COLORS.map((color) => {
        const isSelected =
          color.hex.toLowerCase() === selectedColor.toLowerCase();

        return (
          <Pressable
            key={color.hex}
            onPress={() => handleSelect(color.hex)}
            accessibilityRole="radio"
            accessibilityLabel={color.label}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.swatch,
              {
                backgroundColor: color.hex,
                opacity: pressed ? 0.7 : 1,
              },
              isSelected && styles.swatchSelected,
              Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
            ]}
          >
            {isSelected && (
              <Text style={styles.checkmark} accessibilityElementsHidden>
                {'✓'}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    // Constrain width to exactly 3 columns + 2 gaps
    maxWidth: SWATCH_SIZE * COLUMNS + GAP * (COLUMNS - 1),
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
