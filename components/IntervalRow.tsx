/**
 * IntervalRow component for Schlag.
 *
 * Renders a single interval as a horizontal row in the sequence builder.
 * Shows a drag handle (reorder placeholder), color swatch, name, formatted
 * duration, move-up/move-down arrows, and a trash button.
 *
 * Min height 56px. Tap calls onPress to open the interval edit sheet.
 */

import React, { useCallback, useMemo } from 'react';
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
import type { Interval } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntervalRowProps {
  /** The interval to display. */
  interval: Interval;
  /** Zero-based index in the list. */
  index: number;
  /** Total number of intervals in the sequence. */
  totalCount: number;
  /** Called when the row body is tapped (opens edit sheet). */
  onPress: () => void;
  /** Called when the user taps the move-up arrow. */
  onMoveUp: () => void;
  /** Called when the user taps the move-down arrow. */
  onMoveDown: () => void;
  /** Called when the user taps the delete button. */
  onDelete: () => void;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntervalRow({
  interval,
  index,
  totalCount,
  onPress,
  onMoveUp,
  onMoveDown,
  onDelete,
  style,
}: IntervalRowProps) {
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  const formattedDuration = useMemo(
    () => formatDuration(interval.duration_seconds),
    [interval.duration_seconds],
  );

  const handleMoveUp = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      if (!isFirst) onMoveUp();
    },
    [isFirst, onMoveUp],
  );

  const handleMoveDown = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      if (!isLast) onMoveDown();
    },
    [isLast, onMoveDown],
  );

  const handleDelete = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      onDelete();
    },
    [onDelete],
  );

  return (
    <View
      accessibilityLabel={`Interval ${index + 1}: ${interval.name}, ${formattedDuration}. Tap to edit.`}
      // @ts-expect-error — onClick is valid on web but not typed in RN
      onClick={Platform.OS === 'web' ? onPress : undefined}
      onStartShouldSetResponder={Platform.OS !== 'web' ? () => true : undefined}
      onResponderRelease={Platform.OS !== 'web' ? onPress : undefined}
      style={[
        styles.container,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        style,
      ]}
    >
      {/* Drag handle placeholder */}
      <Text
        style={styles.dragHandle}
        accessibilityLabel="Drag to reorder"
      >
        {'\u2261'}
      </Text>

      {/* Color swatch */}
      <View
        style={[
          styles.colorSwatch,
          { backgroundColor: interval.color },
        ]}
        accessibilityLabel={`Color: ${interval.color}`}
      />

      {/* Name and duration */}
      <View style={styles.infoSection}>
        <Text style={styles.name} numberOfLines={1}>
          {interval.name}
        </Text>
        <Text style={styles.duration}>{formattedDuration}</Text>
      </View>

      {/* Reorder arrows */}
      <View style={styles.arrowGroup}>
        <Pressable
          onPress={handleMoveUp}
          disabled={isFirst}
          accessibilityRole="button"
          accessibilityLabel="Move interval up"
          accessibilityState={{ disabled: isFirst }}
          hitSlop={4}
          style={({ pressed }) => [
            styles.arrowButton,
            {
              opacity: isFirst ? 0.25 : pressed ? 0.6 : 1,
            },
            Platform.OS === 'web' &&
              ({
                cursor: isFirst ? 'not-allowed' : 'pointer',
              } as ViewStyle),
          ]}
        >
          <Text style={styles.arrowText}>{'\u25B2'}</Text>
        </Pressable>

        <Pressable
          onPress={handleMoveDown}
          disabled={isLast}
          accessibilityRole="button"
          accessibilityLabel="Move interval down"
          accessibilityState={{ disabled: isLast }}
          hitSlop={4}
          style={({ pressed }) => [
            styles.arrowButton,
            {
              opacity: isLast ? 0.25 : pressed ? 0.6 : 1,
            },
            Platform.OS === 'web' &&
              ({
                cursor: isLast ? 'not-allowed' : 'pointer',
              } as ViewStyle),
          ]}
        >
          <Text style={styles.arrowText}>{'\u25BC'}</Text>
        </Pressable>
      </View>

      {/* Delete button */}
      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete interval: ${interval.name}`}
        hitSlop={4}
        style={({ pressed }) => [
          styles.deleteButton,
          { opacity: pressed ? 0.5 : 1 },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        ]}
      >
        <Text style={styles.deleteIcon}>{'\u2715'}</Text>
      </Pressable>
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
    minHeight: 56,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: APP_COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_COLORS.divider,
  },
  dragHandle: {
    fontSize: 22,
    color: APP_COLORS.textMuted,
    marginRight: SPACING.md,
    width: 24,
    textAlign: 'center',
  },
  colorSwatch: {
    width: LAYOUT.colorSwatchSize,
    height: LAYOUT.colorSwatchSize,
    borderRadius: LAYOUT.colorSwatchSize / 2,
    marginRight: SPACING.md,
  },
  infoSection: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textPrimary,
  },
  duration: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  arrowGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  arrowButton: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 10,
    color: APP_COLORS.textSecondary,
  },
  deleteButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 16,
    color: APP_COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
});
