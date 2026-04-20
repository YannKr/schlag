/**
 * IntervalRow — Signal direction.
 *
 * Editorial list row: 01 index, colored bar, glyph + name, DSEG7 duration,
 * drag handle. Reorder arrows and delete are kept (mobile-friendly) but
 * styled as minimal text buttons on the right.
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

import { SIGNAL, getIntervalByHex, normalizeIntervalHex } from '@/constants/colors';
import { SPACING } from '@/constants/layout';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
} from '@/constants/typography';
import { Glyph } from '@/components/Glyph';
import type { Interval } from '@/types';

export interface IntervalRowProps {
  interval: Interval;
  index: number;
  totalCount: number;
  onPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
}

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
  const paletteEntry = getIntervalByHex(interval.color);
  const glyph = paletteEntry?.glyph ?? 'circle';
  const displayHex = normalizeIntervalHex(interval.color);

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
      // @ts-expect-error — onClick is valid on web
      onClick={Platform.OS === 'web' ? onPress : undefined}
      onStartShouldSetResponder={Platform.OS !== 'web' ? () => true : undefined}
      onResponderRelease={Platform.OS !== 'web' ? onPress : undefined}
      style={[
        styles.container,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        style,
      ]}
    >
      <Text style={styles.index}>{pad(index + 1)}</Text>

      <View style={[styles.colorBar, { backgroundColor: displayHex }]} />

      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <Glyph kind={glyph} size={9} color={displayHex} opacity={0.8} />
          <Text style={styles.name} numberOfLines={1}>{interval.name}</Text>
        </View>
        {!!interval.note && (
          <Text style={styles.note} numberOfLines={1}>{interval.note}</Text>
        )}
      </View>

      <Text style={styles.duration}>{formattedDuration}</Text>

      <View style={styles.arrowGroup}>
        <Pressable
          onPress={handleMoveUp}
          disabled={isFirst}
          accessibilityRole="button"
          accessibilityLabel="Move interval up"
          accessibilityState={{ disabled: isFirst }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.arrowButton,
            { opacity: isFirst ? 0.2 : pressed ? 0.5 : 0.8 },
            Platform.OS === 'web' &&
              ({ cursor: isFirst ? 'not-allowed' : 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.arrowText}>▲</Text>
        </Pressable>
        <Pressable
          onPress={handleMoveDown}
          disabled={isLast}
          accessibilityRole="button"
          accessibilityLabel="Move interval down"
          accessibilityState={{ disabled: isLast }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.arrowButton,
            { opacity: isLast ? 0.2 : pressed ? 0.5 : 0.8 },
            Platform.OS === 'web' &&
              ({ cursor: isLast ? 'not-allowed' : 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.arrowText}>▼</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete interval: ${interval.name}`}
        hitSlop={6}
        style={({ pressed }) => [
          styles.deleteButton,
          { opacity: pressed ? 0.4 : 0.7 },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
        ]}
      >
        <Text style={styles.deleteIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: SIGNAL.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
    gap: SPACING.sm,
  },
  index: {
    width: 24,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    letterSpacing: 0.5,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 28,
  },
  infoSection: {
    flex: 1,
    marginHorizontal: SPACING.xs,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body + 1,
    fontWeight: FONT_WEIGHT.medium,
    color: SIGNAL.ink,
    letterSpacing: -0.1,
  },
  note: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    marginTop: 2,
    marginLeft: 17,
    fontStyle: 'italic',
  },
  duration: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.body + 1,
    color: SIGNAL.ink,
    letterSpacing: LETTER_SPACING.caption,
  },
  arrowGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  arrowButton: {
    width: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 10,
    color: SIGNAL.mutedInk,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 14,
    color: SIGNAL.mutedInk,
    fontWeight: FONT_WEIGHT.medium,
  },
});
