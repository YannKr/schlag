/**
 * SequenceCard component for Schlag.
 *
 * Displays a saved sequence in the library list. Shows the sequence name,
 * description, metadata (total duration, interval count, repeat count),
 * a color strip previewing interval colors, and a full-width Start button.
 *
 * Tap on the card body opens the editor (onPress). The Start button
 * launches the workout screen (onStart). On web, a delete icon appears
 * on hover.
 */

import React, { useMemo, useState } from 'react';
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
import type { Sequence } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SequenceCardProps {
  /** The sequence to display. */
  sequence: Sequence;
  /** Called when the Start button is pressed. */
  onStart: () => void;
  /** Called when the card body is pressed (opens editor). */
  onPress: () => void;
  /** Called when duplicate action is triggered. */
  onDuplicate?: () => void;
  /** Called when delete action is triggered. */
  onDelete?: () => void;
  /** Additional styles applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration in seconds to a human-readable string.
 * Returns "Xh Ym Zs" with leading zeros omitted for hours.
 */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Compute total workout duration including repeats and inter-set rest.
 */
function computeTotalDuration(seq: Sequence): number {
  const singleRound = seq.intervals.reduce(
    (sum, iv) => sum + iv.duration_seconds,
    0,
  );
  const repeats = seq.repeat_count === 0 ? 1 : seq.repeat_count; // infinite shows 1x
  const restTotal =
    repeats > 1 ? (repeats - 1) * seq.rest_between_sets_seconds : 0;
  return singleRound * repeats + restTotal;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SequenceCard({
  sequence,
  onStart,
  onPress,
  onDuplicate,
  onDelete,
  style,
}: SequenceCardProps) {
  const [hovered, setHovered] = useState(false);

  const totalDuration = useMemo(
    () => computeTotalDuration(sequence),
    [sequence],
  );

  const repeatLabel = useMemo(() => {
    if (sequence.repeat_count === 0) return 'Infinite';
    if (sequence.repeat_count === 1) return '1 round';
    return `${sequence.repeat_count} rounds`;
  }, [sequence.repeat_count]);

  // Collect unique interval colors for the left strip
  const stripColors = useMemo(
    () => sequence.intervals.map((iv) => iv.color),
    [sequence.intervals],
  );

  const webHoverHandlers =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <View
      accessibilityLabel={`Sequence: ${sequence.name}`}
      // @ts-expect-error — onClick/onMouseEnter/onMouseLeave valid on web but not typed in RN
      onClick={Platform.OS === 'web' ? onPress : undefined}
      onStartShouldSetResponder={Platform.OS !== 'web' ? () => true : undefined}
      onResponderRelease={Platform.OS !== 'web' ? onPress : undefined}
      style={[
        styles.card,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        style,
      ]}
      {...webHoverHandlers}
    >
      {/* Color strip */}
      <View style={styles.colorStrip}>
        {stripColors.map((color, i) => (
          <View
            key={`${color}-${i}`}
            style={[
              styles.colorSegment,
              {
                backgroundColor: color,
                flex: 1,
              },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {sequence.name}
          </Text>

          {/* Web: trash icon on hover */}
          {Platform.OS === 'web' && hovered && onDelete && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onDelete();
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete sequence"
              style={({ pressed: p }) => [
                styles.deleteButton,
                { opacity: p ? 0.6 : 1 },
              ]}
              hitSlop={8}
            >
              <Text style={styles.deleteIcon}>{'🗑'}</Text>
            </Pressable>
          )}
        </View>

        {/* Description */}
        {sequence.description !== '' && (
          <Text style={styles.description} numberOfLines={2}>
            {sequence.description}
          </Text>
        )}

        {/* Metadata */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {formatDuration(totalDuration)}
          </Text>
          <Text style={styles.metaSeparator}>{'  ·  '}</Text>
          <Text style={styles.metaText}>
            {sequence.intervals.length}{' '}
            {sequence.intervals.length === 1 ? 'interval' : 'intervals'}
          </Text>
          <Text style={styles.metaSeparator}>{'  ·  '}</Text>
          <Text style={styles.metaText}>{repeatLabel}</Text>
        </View>

        {/* Start button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onStart();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Start ${sequence.name}`}
          style={({ pressed }) => [
            styles.startButton,
            { opacity: pressed ? 0.7 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.startButtonText}>Start</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  colorStrip: {
    width: 4,
    flexDirection: 'column',
  },
  colorSegment: {
    // flex: 1 applied inline
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    flex: 1,
  },
  deleteButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  deleteIcon: {
    fontSize: 16,
  },
  description: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  metaText: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
  },
  metaSeparator: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
  },
  startButton: {
    marginTop: SPACING.md,
    height: LAYOUT.startButtonHeight,
    backgroundColor: APP_COLORS.primary,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
