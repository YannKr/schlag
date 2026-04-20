/**
 * Sequence Builder — Signal direction.
 *
 * Editorial header (back · save · big name with cursor bar · three-up
 * meta grid · one-round timeline preview) above an indexed step list.
 * All advanced settings (description, audio, auto-advance, rest between
 * sets) live below the step list to keep the builder focused on the
 * sequence's shape.
 *
 * Route: /builder/[id]
 *   - id === 'new'  -> create a new sequence with defaults
 *   - id === UUID   -> load existing sequence from the store
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIGNAL, normalizeIntervalHex } from '@/constants/colors';
import { SPACING } from '@/constants/layout';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
} from '@/constants/typography';
import {
  INTERVAL_NAME_MAX_LENGTH,
  SEQUENCE_DESCRIPTION_MAX_LENGTH,
  SEQUENCE_REPEAT_MAX,
} from '@/constants/validation';
import { createDefaultInterval, createDefaultSequence } from '@/constants/defaults';
import { useSequenceStore } from '@/stores/sequenceStore';
import { IntervalRow } from '@/components/IntervalRow';
import { IntervalEditSheet } from '@/components/IntervalEditSheet';
import { DurationPicker } from '@/components/DurationPicker';
import type { Interval, Sequence } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatMMSS(totalSeconds: number): string {
  if (totalSeconds < 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function computeTotalDuration(
  intervals: Interval[],
  repeatCount: number,
  restBetweenSets: number,
): number {
  const singleRound = intervals.reduce(
    (sum, iv) => sum + iv.duration_seconds,
    0,
  );
  const repeats = repeatCount === 0 ? 1 : repeatCount;
  const restTotal = repeats > 1 ? (repeats - 1) * restBetweenSets : 0;
  return singleRound * repeats + restTotal;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BuilderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const addSequence = useSequenceStore((s) => s.addSequence);
  const updateSequence = useSequenceStore((s) => s.updateSequence);
  const getSequenceById = useSequenceStore((s) => s.getSequenceById);

  const isNew = id === 'new';

  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [editingInterval, setEditingInterval] = useState<Interval | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (isNew) {
      const newSeq = createDefaultSequence();
      setSequence(newSeq);
      setIsInfinite(newSeq.repeat_count === 0);
    } else if (id) {
      const existing = getSequenceById(id);
      if (existing) {
        setSequence(JSON.parse(JSON.stringify(existing)) as Sequence);
        setIsInfinite(existing.repeat_count === 0);
      } else {
        router.back();
      }
    }
  }, [id, isNew, getSequenceById, router]);

  const totalDuration = useMemo(() => {
    if (!sequence) return 0;
    return computeTotalDuration(
      sequence.intervals,
      sequence.repeat_count,
      sequence.rest_between_sets_seconds,
    );
  }, [sequence]);

  const singleRoundDuration = useMemo(() => {
    if (!sequence) return 0;
    return sequence.intervals.reduce((a, iv) => a + iv.duration_seconds, 0);
  }, [sequence]);

  const showRestBetweenSets = useMemo(() => {
    if (!sequence) return false;
    return isInfinite || sequence.repeat_count > 1;
  }, [sequence, isInfinite]);

  // Handlers — sequence-level fields.
  const handleNameChange = useCallback((text: string) => {
    setSequence((prev) =>
      prev ? { ...prev, name: text.slice(0, INTERVAL_NAME_MAX_LENGTH) } : prev,
    );
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setSequence((prev) =>
      prev
        ? {
            ...prev,
            description: text.slice(0, SEQUENCE_DESCRIPTION_MAX_LENGTH),
          }
        : prev,
    );
  }, []);

  const handleRepeatIncrement = useCallback(() => {
    setSequence((prev) =>
      prev
        ? { ...prev, repeat_count: Math.min(prev.repeat_count + 1, SEQUENCE_REPEAT_MAX) }
        : prev,
    );
  }, []);

  const handleRepeatDecrement = useCallback(() => {
    setSequence((prev) =>
      prev
        ? { ...prev, repeat_count: Math.max(prev.repeat_count - 1, 1) }
        : prev,
    );
  }, []);

  const handleInfiniteToggle = useCallback((value: boolean) => {
    setIsInfinite(value);
    setSequence((prev) =>
      prev ? { ...prev, repeat_count: value ? 0 : 1 } : prev,
    );
  }, []);

  const handleRestChange = useCallback((seconds: number) => {
    setSequence((prev) =>
      prev ? { ...prev, rest_between_sets_seconds: seconds } : prev,
    );
  }, []);

  const handleAutoAdvanceToggle = useCallback((value: boolean) => {
    setSequence((prev) => (prev ? { ...prev, auto_advance: value } : prev));
  }, []);

  const handleHalfwayAlertToggle = useCallback((value: boolean) => {
    setSequence((prev) =>
      prev
        ? {
            ...prev,
            audio_config: { ...prev.audio_config, halfway_alert: value },
          }
        : prev,
    );
  }, []);

  const handleAnnounceNamesToggle = useCallback((value: boolean) => {
    setSequence((prev) =>
      prev
        ? {
            ...prev,
            audio_config: {
              ...prev.audio_config,
              announce_interval_names: value,
            },
          }
        : prev,
    );
  }, []);

  // Handlers — interval CRUD.
  const handleAddInterval = useCallback(() => {
    setSequence((prev) =>
      prev
        ? { ...prev, intervals: [...prev.intervals, createDefaultInterval()] }
        : prev,
    );
  }, []);

  const handleIntervalPress = useCallback((interval: Interval) => {
    setEditingInterval(interval);
    setEditSheetVisible(true);
  }, []);

  const handleIntervalSave = useCallback((updated: Interval) => {
    setSequence((prev) =>
      prev
        ? {
            ...prev,
            intervals: prev.intervals.map((iv) =>
              iv.id === updated.id ? updated : iv,
            ),
          }
        : prev,
    );
    setEditSheetVisible(false);
    setEditingInterval(null);
  }, []);

  const handleEditSheetClose = useCallback(() => {
    setEditSheetVisible(false);
    setEditingInterval(null);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setSequence((prev) => {
      if (!prev) return prev;
      const intervals = [...prev.intervals];
      [intervals[index - 1], intervals[index]] = [intervals[index], intervals[index - 1]];
      return { ...prev, intervals };
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setSequence((prev) => {
      if (!prev) return prev;
      if (index >= prev.intervals.length - 1) return prev;
      const intervals = [...prev.intervals];
      [intervals[index + 1], intervals[index]] = [intervals[index], intervals[index + 1]];
      return { ...prev, intervals };
    });
  }, []);

  const handleDeleteInterval = useCallback((index: number) => {
    setSequence((prev) => {
      if (!prev) return prev;
      if (prev.intervals.length === 1) {
        const msg =
          'Cannot delete the last interval. A sequence must have at least one interval.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Cannot Delete', 'A sequence must have at least one interval.');
        }
        return prev;
      }
      const intervals = prev.intervals.filter((_, i) => i !== index);
      return { ...prev, intervals };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!sequence) return;

    const trimmedName = sequence.name.trim();
    if (trimmedName.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Sequence name is required.');
      } else {
        Alert.alert('Missing Name', 'Sequence name is required.');
      }
      return;
    }

    const now = new Date().toISOString();
    const finalSequence: Sequence = {
      ...sequence,
      name: trimmedName,
      description: sequence.description.trim(),
      updated_at: now,
    };

    if (isNew) {
      addSequence(finalSequence);
    } else {
      updateSequence(finalSequence.id, finalSequence);
    }

    router.back();
  }, [sequence, isNew, addSequence, updateSequence, router]);

  const renderIntervalRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Interval>) => {
      if (!sequence) return null;
      return (
        <IntervalRow
          interval={item}
          index={index}
          totalCount={sequence.intervals.length}
          onPress={() => handleIntervalPress(item)}
          onMoveUp={() => handleMoveUp(index)}
          onMoveDown={() => handleMoveDown(index)}
          onDelete={() => handleDeleteInterval(index)}
        />
      );
    },
    [sequence, handleIntervalPress, handleMoveUp, handleMoveDown, handleDeleteInterval],
  );

  const keyExtractor = useCallback((item: Interval) => item.id, []);

  if (!sequence) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // Timeline preview blocks (one round, proportional).
  const timelineBlocks = sequence.intervals.map((iv) => ({
    hex: normalizeIntervalHex(iv.color),
    dur: iv.duration_seconds,
  }));

  const roundsLabel = isInfinite ? '×∞' : `×${sequence.repeat_count}`;
  const restLabel = showRestBetweenSets
    ? formatMMSS(sequence.rest_between_sets_seconds)
    : '—';
  const totalLabel = formatMMSS(totalDuration);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Top bar: back · save */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [
            styles.topBarButton,
            { opacity: pressed ? 0.6 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.topBarBack}>← Library</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save sequence"
          hitSlop={8}
          style={({ pressed }) => [
            styles.topBarButton,
            { opacity: pressed ? 0.6 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.topBarSave}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={sequence.intervals}
          keyExtractor={keyExtractor}
          renderItem={renderIntervalRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {/* Editorial heading */}
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>Sequence</Text>
                <View style={styles.nameRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={sequence.name}
                    onChangeText={handleNameChange}
                    placeholder="Untitled sequence"
                    placeholderTextColor={SIGNAL.mutedInk}
                    maxLength={INTERVAL_NAME_MAX_LENGTH}
                    returnKeyType="done"
                    accessibilityLabel="Sequence name"
                    multiline
                  />
                  <Text style={styles.cursorBar}>│</Text>
                </View>
              </View>

              {/* Three-up meta grid */}
              <View style={styles.metaGrid}>
                <View style={[styles.metaCell, styles.metaCellBorder]}>
                  <Text style={styles.metaLabel}>Total</Text>
                  <Text style={styles.metaValue}>{totalLabel}</Text>
                </View>
                <Pressable
                  onPress={handleRepeatIncrement}
                  onLongPress={handleRepeatDecrement}
                  accessibilityRole="button"
                  accessibilityLabel={`Rounds ${roundsLabel}. Tap to increase, long press to decrease.`}
                  style={({ pressed }) => [
                    styles.metaCell,
                    styles.metaCellBorder,
                    pressed && styles.metaCellPressed,
                  ]}
                >
                  <Text style={styles.metaLabel}>Rounds</Text>
                  <Text style={styles.metaValue}>{roundsLabel}</Text>
                </Pressable>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>Rest/set</Text>
                  <Text style={styles.metaValue}>{restLabel}</Text>
                </View>
              </View>

              {/* Timeline preview */}
              <View style={styles.timelineBlock}>
                <View style={styles.timelineLegend}>
                  <Text style={styles.eyebrow}>Timeline — one round</Text>
                  <Text style={styles.eyebrowRight}>
                    {formatMMSS(singleRoundDuration)}
                  </Text>
                </View>
                <View style={styles.timelineStrip}>
                  {timelineBlocks.length === 0 ? (
                    <View
                      style={[
                        styles.timelineEmptyBlock,
                        { backgroundColor: SIGNAL.divider },
                      ]}
                    />
                  ) : (
                    timelineBlocks.map((b, i) => (
                      <View
                        key={i}
                        style={[
                          styles.timelineSegment,
                          {
                            backgroundColor: b.hex,
                            flexGrow: b.dur,
                            flexShrink: 1,
                            flexBasis: 0,
                            marginLeft: i === 0 ? 0 : 2,
                          },
                        ]}
                      >
                        <Text style={styles.timelineSegmentText}>{b.dur}s</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* Steps list label */}
              <View style={styles.stepsHeader}>
                <Text style={styles.eyebrow}>
                  Steps · {sequence.intervals.length}
                </Text>
                <Text style={styles.eyebrowHint}>tap to edit</Text>
              </View>
            </View>
          }
          ListFooterComponent={
            <View>
              {/* Add step accent CTA */}
              <Pressable
                onPress={handleAddInterval}
                accessibilityRole="button"
                accessibilityLabel="Add interval"
                style={({ pressed }) => [
                  styles.addStep,
                  pressed && styles.addStepPressed,
                ]}
              >
                <Text style={styles.addStepText}>＋ Add step</Text>
              </Pressable>

              {/* Infinite toggle + rest (visible when applicable) */}
              <View style={styles.sectionBlock}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Repeat infinitely</Text>
                  <Switch
                    value={isInfinite}
                    onValueChange={handleInfiniteToggle}
                    trackColor={{ false: SIGNAL.divider, true: SIGNAL.accent }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Infinite repeat mode"
                  />
                </View>

                {showRestBetweenSets && (
                  <View style={styles.subBlock}>
                    <Text style={styles.subBlockLabel}>Rest between sets</Text>
                    <DurationPicker
                      value={sequence.rest_between_sets_seconds}
                      onChange={handleRestChange}
                    />
                  </View>
                )}
              </View>

              {/* Advanced (collapsible) */}
              <Pressable
                onPress={() => setAdvancedOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={
                  advancedOpen ? 'Hide advanced settings' : 'Show advanced settings'
                }
                style={styles.advancedHeader}
              >
                <Text style={styles.eyebrow}>
                  Advanced {advancedOpen ? '−' : '+'}
                </Text>
              </Pressable>

              {advancedOpen && (
                <View style={styles.sectionBlock}>
                  <View style={styles.subBlock}>
                    <Text style={styles.subBlockLabel}>Description</Text>
                    <TextInput
                      style={[styles.textInput, styles.descriptionInput]}
                      value={sequence.description}
                      onChangeText={handleDescriptionChange}
                      placeholder="Optional"
                      placeholderTextColor={SIGNAL.mutedInk}
                      maxLength={SEQUENCE_DESCRIPTION_MAX_LENGTH}
                      multiline
                      numberOfLines={2}
                      blurOnSubmit
                      accessibilityLabel="Sequence description"
                    />
                    <Text style={styles.charCount}>
                      {sequence.description.length}/
                      {SEQUENCE_DESCRIPTION_MAX_LENGTH}
                    </Text>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Auto-advance</Text>
                    <Switch
                      value={sequence.auto_advance}
                      onValueChange={handleAutoAdvanceToggle}
                      trackColor={{ false: SIGNAL.divider, true: SIGNAL.accent }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel="Auto-advance between intervals"
                    />
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Halfway alert</Text>
                    <Switch
                      value={sequence.audio_config.halfway_alert}
                      onValueChange={handleHalfwayAlertToggle}
                      trackColor={{ false: SIGNAL.divider, true: SIGNAL.accent }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel="Play an alert at the halfway point of each interval"
                    />
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Announce interval names</Text>
                    <Switch
                      value={sequence.audio_config.announce_interval_names}
                      onValueChange={handleAnnounceNamesToggle}
                      trackColor={{ false: SIGNAL.divider, true: SIGNAL.accent }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel="Announce the interval name at the start of each interval"
                    />
                  </View>
                </View>
              )}
            </View>
          }
        />
      </KeyboardAvoidingView>

      <IntervalEditSheet
        visible={editSheetVisible}
        interval={editingInterval}
        onSave={handleIntervalSave}
        onClose={handleEditSheetClose}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SIGNAL.paper },
  flex: { flex: 1 },

  loadingText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: SIGNAL.mutedInk,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  topBarButton: { minHeight: 28, justifyContent: 'center' },
  topBarBack: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodySmall,
    color: SIGNAL.mutedInk,
    fontWeight: FONT_WEIGHT.medium,
  },
  topBarSave: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodySmall,
    color: SIGNAL.accent,
    fontWeight: FONT_WEIGHT.semibold,
  },

  listContent: { paddingBottom: 80 },

  // Heading block
  headingBlock: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  eyebrow: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: SPACING.sm,
  },
  eyebrowRight: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.caption,
    color: SIGNAL.mutedInk,
    letterSpacing: 0.5,
  },
  eyebrowHint: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    color: SIGNAL.mutedInk,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end' },
  nameInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayMedium,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: LETTER_SPACING.display,
    color: SIGNAL.ink,
    padding: 0,
    lineHeight: FONT_SIZE.displayMedium * 1.1,
    minHeight: FONT_SIZE.displayMedium * 1.1,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  cursorBar: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayMedium,
    color: SIGNAL.accent,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.displayMedium * 1.1,
    marginLeft: 2,
  },

  // Meta grid
  metaGrid: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  metaCell: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  metaCellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SIGNAL.divider,
  },
  metaCellPressed: { backgroundColor: '#F2EFE8' },
  metaLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.caption,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
  },
  metaValue: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.headingMedium,
    color: SIGNAL.ink,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Timeline
  timelineBlock: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  timelineLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  timelineStrip: {
    flexDirection: 'row',
    height: 44,
    overflow: 'hidden',
  },
  timelineSegment: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  timelineEmptyBlock: { flex: 1, height: '100%' },
  timelineSegmentText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Steps
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  addStep: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  addStepPressed: { backgroundColor: '#F2EFE8' },
  addStepText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodySmall,
    color: SIGNAL.accent,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Sections below steps
  sectionBlock: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  subBlock: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  subBlockLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.caption,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: SPACING.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SIGNAL.divider,
  },
  toggleLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body + 1,
    color: SIGNAL.ink,
    fontWeight: FONT_WEIGHT.medium,
  },

  textInput: {
    fontFamily: FONT_FAMILY.sans,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.ink,
    fontSize: FONT_SIZE.bodyLarge,
    color: SIGNAL.ink,
    paddingVertical: SPACING.sm,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  descriptionInput: { minHeight: 56, textAlignVertical: 'top' },
  charCount: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow,
    color: SIGNAL.mutedInk,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Advanced header
  advancedHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
});
