/**
 * SearchBar component for Schlag.
 *
 * A rounded text input with a search icon on the left and a clear button
 * on the right when the input has text. Debouncing is handled by the
 * consumer -- this component fires onChangeText on every keystroke.
 */

import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_SIZE } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  /** Current search text value. */
  value: string;
  /** Called on every keystroke. */
  onChangeText: (text: string) => void;
  /** Placeholder text. @default 'Search sequences...' */
  placeholder?: string;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search sequences...',
  style,
}: SearchBarProps) {
  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  const hasText = value.length > 0;

  return (
    <View style={[styles.container, style]}>
      {/* Search icon */}
      <Text
        style={styles.searchIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {'\u{1F50D}'}
      </Text>

      {/* Text input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={APP_COLORS.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
        accessibilityRole="search"
      />

      {/* Clear button */}
      {hasText && (
        <Pressable
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          style={({ pressed }) => [
            styles.clearButton,
            { opacity: pressed ? 0.5 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.clearIcon}>{'✕'}</Text>
        </Pressable>
      )}
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
    backgroundColor: APP_COLORS.divider,
    borderRadius: LAYOUT.borderRadius * 2.5, // 20px -- fully rounded
    paddingHorizontal: SPACING.md,
    height: LAYOUT.buttonMinHeight,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textPrimary,
    height: '100%',
    paddingVertical: 0, // Remove default padding on Android
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  clearButton: {
    marginLeft: SPACING.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    fontWeight: '600',
  },
});
