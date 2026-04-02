/**
 * Sequence Builder / Editor screen for Schlag.
 *
 * Route: /builder/[id]
 *   - id === 'new'  -> create a new sequence with defaults
 *   - id === UUID   -> load existing sequence from the store
 *
 * All edits are held in local state until the user presses "Save".
 * On save the sequence is written to the Zustand store (add or update)
 * and the screen navigates back.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import {
  INTERVAL_NAME_MAX_LENGTH,
  SEQUENCE_DESCRIPTION_MAX_LENGTH,
  SEQUENCE_REPEAT_MIN,
  SEQUENCE_REPEAT_MAX,
} from '@/constants/validation';
import { createDefaultInterval, createDefaultSequence } from '@/constants/defaults';
import { useSequenceStore } from '@/stores/sequenceStore';
import { FAB } from '@/components/FAB';
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

/** Format a total-seconds value to a human-readable string. */
function formatTotalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Compute total workout duration from intervals, repeat count, and rest.
 * Infinite mode (repeat_count === 0) shows duration of a single round.
 */
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
// Screen component
// ---------------------------------------------------------------------------

export default function BuilderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Store actions
  const addSequence = useSequenceStore((s) => s.addSequence);
  const updateSequence = useSequenceStore((s) => s.updateSequence);
  const getSequenceById = useSequenceStore((s) => s.getSequenceById);

  const isNew = id === 'new';

  // -----------------------------------------------------------------------
  // Local editable state -- populated once on mount
  // -----------------------------------------------------------------------

  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [editingInterval, setEditingInterval] = useState<Interval | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const didInit = useRef(false);

  // Initialize local state from store or defaults
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
        // Deep-clone so mutations don't touch the store directly
        setSequence(JSON.parse(JSON.stringify(existing)) as Sequence);
        setIsInfinite(existing.repeat_count === 0);
      } else {
        // ID not found -- go back
        router.back();
      }
    }
  }, [id, isNew, getSequenceById, router]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const totalDuration = useMemo(() => {
    if (!sequence) return 0;
    return computeTotalDuration(
      sequence.intervals,
      sequence.repeat_count,
      sequence.rest_between_sets_seconds,
    );
  }, [sequence]);

  const showRestBetweenSets = useMemo(() => {
    if (!sequence) return false;
    return isInfinite || sequence.repeat_count > 1;
  }, [sequence, isInfinite]);

  // -----------------------------------------------------------------------
  // Handlers -- sequence-level fields
  // -----------------------------------------------------------------------

  const handleNameChange = useCallback((text: string) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return { ...prev, name: text.slice(0, INTERVAL_NAME_MAX_LENGTH) };
    });
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        description: text.slice(0, SEQUENCE_DESCRIPTION_MAX_LENGTH),
      };
    });
  }, []);

  const handleRepeatIncrement = useCallback(() => {
    setSequence((prev) => {
      if (!prev) return prev;
      const next = Math.min(prev.repeat_count + 1, SEQUENCE_REPEAT_MAX);
      return { ...prev, repeat_count: next };
    });
  }, []);

  const handleRepeatDecrement = useCallback(() => {
    setSequence((prev) => {
      if (!prev) return prev;
      const next = Math.max(prev.repeat_count - 1, 1);
      return { ...prev, repeat_count: next };
    });
  }, []);

  const handleInfiniteToggle = useCallback(
    (value: boolean) => {
      setIsInfinite(value);
      setSequence((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          repeat_count: value ? 0 : 1,
        };
      });
    },
    [],
  );

  const handleRestChange = useCallback((seconds: number) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return { ...prev, rest_between_sets_seconds: seconds };
    });
  }, []);

  const handleAutoAdvanceToggle = useCallback((value: boolean) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return { ...prev, auto_advance: value };
    });
  }, []);

  const handleHalfwayAlertToggle = useCallback((value: boolean) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audio_config: { ...prev.audio_config, halfway_alert: value },
      };
    });
  }, []);

  const handleAnnounceNamesToggle = useCallback((value: boolean) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audio_config: { ...prev.audio_config, announce_interval_names: value },
      };
    });
  }, []);

  // -----------------------------------------------------------------------
  // Handlers -- interval CRUD
  // -----------------------------------------------------------------------

  const handleAddInterval = useCallback(() => {
    setSequence((prev) => {
      if (!prev) return prev;
      const newInterval = createDefaultInterval();
      return {
        ...prev,
        intervals: [...prev.intervals, newInterval],
      };
    });
  }, []);

  const handleIntervalPress = useCallback((interval: Interval) => {
    setEditingInterval(interval);
    setEditSheetVisible(true);
  }, []);

  const handleIntervalSave = useCallback((updated: Interval) => {
    setSequence((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        intervals: prev.intervals.map((iv) =>
          iv.id === updated.id ? updated : iv,
        ),
      };
    });
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
      const temp = intervals[index - 1];
      intervals[index - 1] = intervals[index];
      intervals[index] = temp;
      return { ...prev, intervals };
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setSequence((prev) => {
      if (!prev) return prev;
      if (index >= prev.intervals.length - 1) return prev;
      const intervals = [...prev.intervals];
      const temp = intervals[index + 1];
      intervals[index + 1] = intervals[index];
      intervals[index] = temp;
      return { ...prev, intervals };
    });
  }, []);

  const handleDeleteInterval = useCallback((index: number) => {
    setSequence((prev) => {
      if (!prev) return prev;

      // Confirm if it's the last interval
      if (prev.intervals.length === 1) {
        const doDelete = () => {
          // Cannot delete the last interval -- show warning
        };

        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-alert
          window.alert(
            'Cannot delete the last interval. A sequence must have at least one interval.',
          );
        } else {
          Alert.alert(
            'Cannot Delete',
            'A sequence must have at least one interval.',
          );
        }
        return prev;
      }

      const intervals = prev.intervals.filter((_, i) => i !== index);
      return { ...prev, intervals };
    });
  }, []);

  // -----------------------------------------------------------------------
  // Save handler
  // -----------------------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!sequence) return;

    // Validate name
    const trimmedName = sequence.name.trim();
    if (trimmedName.length === 0) {
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
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

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Loading / error guard
  // -----------------------------------------------------------------------

  if (!sequence) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.6 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.headerButtonText}>{'\u2190'} Back</Text>
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {isNew ? 'New Sequence' : 'Edit Sequence'}
        </Text>

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save sequence"
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: pressed ? 0.7 : 1 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* Body (scrollable properties + interval list)                      */}
      {/* ----------------------------------------------------------------- */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={sequence.intervals}
          keyExtractor={keyExtractor}
          renderItem={renderIntervalRow}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: LAYOUT.fabSize + SPACING.xl + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.propertiesSection}>
              {/* ----------------------------------------------------------- */}
              {/* Total duration summary                                       */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.durationSummary}>
                <Text style={styles.durationSummaryLabel}>Total Duration</Text>
                <Text style={styles.durationSummaryValue}>
                  {formatTotalDuration(totalDuration)}
                  {isInfinite ? ' per round' : ''}
                </Text>
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Sequence Name                                                */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={sequence.name}
                  onChangeText={handleNameChange}
                  placeholder="Sequence name"
                  placeholderTextColor={APP_COLORS.textMuted}
                  maxLength={INTERVAL_NAME_MAX_LENGTH}
                  returnKeyType="done"
                  accessibilityLabel="Sequence name"
                />
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Description                                                  */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.descriptionInput]}
                  value={sequence.description}
                  onChangeText={handleDescriptionChange}
                  placeholder="Optional description"
                  placeholderTextColor={APP_COLORS.textMuted}
                  maxLength={SEQUENCE_DESCRIPTION_MAX_LENGTH}
                  multiline
                  numberOfLines={2}
                  blurOnSubmit
                  accessibilityLabel="Sequence description"
                />
                <Text style={styles.charCount}>
                  {sequence.description.length}/{SEQUENCE_DESCRIPTION_MAX_LENGTH}
                </Text>
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Repeat Count                                                 */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Repeat Count</Text>

                <View style={styles.repeatRow}>
                  {/* Infinite toggle */}
                  <View style={styles.infiniteToggle}>
                    <Text style={styles.toggleLabel}>Infinite</Text>
                    <Switch
                      value={isInfinite}
                      onValueChange={handleInfiniteToggle}
                      trackColor={{
                        false: APP_COLORS.divider,
                        true: APP_COLORS.primary,
                      }}
                      accessibilityLabel="Infinite repeat mode"
                    />
                  </View>

                  {/* Stepper (hidden when infinite) */}
                  {!isInfinite && (
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={handleRepeatDecrement}
                        disabled={sequence.repeat_count <= 1}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease repeat count"
                        style={({ pressed }) => [
                          styles.stepperButton,
                          {
                            opacity:
                              sequence.repeat_count <= 1
                                ? 0.3
                                : pressed
                                  ? 0.6
                                  : 1,
                          },
                          Platform.OS === 'web' &&
                            ({
                              cursor:
                                sequence.repeat_count <= 1
                                  ? 'not-allowed'
                                  : 'pointer',
                            } as ViewStyle),
                        ]}
                      >
                        <Text style={styles.stepperButtonText}>{'\u2212'}</Text>
                      </Pressable>

                      <Text
                        style={styles.stepperValue}
                        accessibilityLabel={`Repeat count: ${sequence.repeat_count}`}
                      >
                        {sequence.repeat_count}
                      </Text>

                      <Pressable
                        onPress={handleRepeatIncrement}
                        disabled={sequence.repeat_count >= SEQUENCE_REPEAT_MAX}
                        accessibilityRole="button"
                        accessibilityLabel="Increase repeat count"
                        style={({ pressed }) => [
                          styles.stepperButton,
                          {
                            opacity:
                              sequence.repeat_count >= SEQUENCE_REPEAT_MAX
                                ? 0.3
                                : pressed
                                  ? 0.6
                                  : 1,
                          },
                          Platform.OS === 'web' &&
                            ({
                              cursor:
                                sequence.repeat_count >= SEQUENCE_REPEAT_MAX
                                  ? 'not-allowed'
                                  : 'pointer',
                            } as ViewStyle),
                        ]}
                      >
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Rest Between Sets (shown only when repeats > 1 or infinite)  */}
              {/* ----------------------------------------------------------- */}
              {showRestBetweenSets && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Rest Between Sets</Text>
                  <DurationPicker
                    value={sequence.rest_between_sets_seconds}
                    onChange={handleRestChange}
                  />
                </View>
              )}

              {/* ----------------------------------------------------------- */}
              {/* Auto-advance                                                 */}
              {/* ----------------------------------------------------------- */}
              <View style={[styles.fieldGroup, styles.toggleRow]}>
                <Text style={styles.fieldLabel}>Auto-Advance</Text>
                <Switch
                  value={sequence.auto_advance}
                  onValueChange={handleAutoAdvanceToggle}
                  trackColor={{
                    false: APP_COLORS.divider,
                    true: APP_COLORS.primary,
                  }}
                  accessibilityLabel="Auto-advance between intervals"
                />
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Audio settings (v2)                                          */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.audioSection}>
                <Text style={styles.audioSectionTitle}>Audio</Text>

                <View style={[styles.fieldGroup, styles.toggleRow]}>
                  <Text style={styles.fieldLabel}>Halfway Alert</Text>
                  <Switch
                    value={sequence.audio_config.halfway_alert}
                    onValueChange={handleHalfwayAlertToggle}
                    trackColor={{
                      false: APP_COLORS.divider,
                      true: APP_COLORS.primary,
                    }}
                    accessibilityLabel="Play an alert at the halfway point of each interval"
                  />
                </View>

                <View style={[styles.fieldGroup, styles.toggleRow]}>
                  <Text style={styles.fieldLabel}>Announce Interval Names</Text>
                  <Switch
                    value={sequence.audio_config.announce_interval_names}
                    onValueChange={handleAnnounceNamesToggle}
                    trackColor={{
                      false: APP_COLORS.divider,
                      true: APP_COLORS.primary,
                    }}
                    accessibilityLabel="Announce the interval name at the start of each interval"
                  />
                </View>
              </View>

              {/* ----------------------------------------------------------- */}
              {/* Interval list header                                         */}
              {/* ----------------------------------------------------------- */}
              <View style={styles.intervalListHeader}>
                <Text style={styles.intervalListTitle}>
                  Intervals ({sequence.intervals.length})
                </Text>
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* ----------------------------------------------------------------- */}
      {/* FAB: Add interval                                                 */}
      {/* ----------------------------------------------------------------- */}
      <FAB
        onPress={handleAddInterval}
        accessibilityLabel="Add interval"
        style={{ bottom: SPACING.lg + insets.bottom }}
      />

      {/* ----------------------------------------------------------------- */}
      {/* Interval Edit Sheet                                               */}
      {/* ----------------------------------------------------------------- */}
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
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.backgroundLight,
  },
  flex: {
    flex: 1,
  },
  loadingText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },

  // -- Header ---------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_COLORS.divider,
    backgroundColor: APP_COLORS.surface,
  },
  headerButton: {
    minWidth: LAYOUT.minTapTarget,
    minHeight: LAYOUT.minTapTarget,
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  headerTitle: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  saveButton: {
    minWidth: LAYOUT.minTapTarget,
    minHeight: LAYOUT.minTapTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: SPACING.lg,
    borderRadius: LAYOUT.borderRadius,
  },
  saveButtonText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.semibold,
  },

  // -- List content ---------------------------------------------------------
  listContent: {
    // paddingBottom set dynamically to account for FAB + safe area
  },

  // -- Properties section (list header) -------------------------------------
  propertiesSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  // -- Duration summary -----------------------------------------------------
  durationSummary: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  durationSummaryLabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    fontWeight: FONT_WEIGHT.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  durationSummaryValue: {
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },

  // -- Field groups ---------------------------------------------------------
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.divider,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textPrimary,
    backgroundColor: APP_COLORS.surface,
    minHeight: LAYOUT.buttonMinHeight,
  },
  descriptionInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // -- Repeat count stepper -------------------------------------------------
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infiniteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  toggleLabel: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.borderRadius,
    borderWidth: 1.5,
    borderColor: APP_COLORS.divider,
    overflow: 'hidden',
  },
  stepperButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: FONT_SIZE.headingMedium,
    color: APP_COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  stepperValue: {
    width: 44,
    textAlign: 'center',
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },

  // -- Auto-advance toggle row ----------------------------------------------
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // -- Audio section (v2) ---------------------------------------------------
  audioSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_COLORS.divider,
  },
  audioSectionTitle: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  // -- Interval list header -------------------------------------------------
  intervalListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_COLORS.divider,
  },
  intervalListTitle: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
});
