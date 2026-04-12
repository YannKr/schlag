/**
 * IntervalEditSheet component for Schlag.
 *
 * A modal overlay (bottom-sheet style on mobile, centered modal on web)
 * for editing a single interval's properties: name, duration, color,
 * and note/cue.
 *
 * Validates on save: name is required, duration must be >= 1 second.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import {
  INTERVAL_NAME_MAX_LENGTH,
  INTERVAL_NOTE_MAX_LENGTH,
  INTERVAL_DURATION_MIN_SECONDS,
  INTERVAL_DURATION_MAX_SECONDS,
} from '@/constants/validation';
import { ColorPicker } from '@/components/ColorPicker';
import { ExerciseTypePicker } from '@/components/ExerciseTypePicker';
import type { Interval } from '@/types';
import type { ExerciseType } from '@/types/interval';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntervalEditSheetProps {
  /** Whether the sheet is visible. */
  visible: boolean;
  /** The interval to edit, or null if none selected. */
  interval: Interval | null;
  /** Called with the updated interval when the user presses Done. */
  onSave: (updated: Interval) => void;
  /** Called when the sheet is dismissed without saving. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decompose(totalSeconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: h.toString(), m: m.toString(), s: s.toString() };
}

function compose(h: string, m: string, s: string): number {
  const hours = parseInt(h, 10) || 0;
  const minutes = parseInt(m, 10) || 0;
  const seconds = parseInt(s, 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntervalEditSheet({
  visible,
  interval,
  onSave,
  onClose,
}: IntervalEditSheetProps) {
  // Local state for form fields
  const [name, setName] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('1');
  const [seconds, setSeconds] = useState('0');
  const [color, setColor] = useState('#E63946');
  const [note, setNote] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseType | null | undefined>(
    interval?.exercise_type ?? null,
  );
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Sync local state when the interval changes or the sheet opens
  useEffect(() => {
    if (interval && visible) {
      setName(interval.name);
      const { h, m, s } = decompose(interval.duration_seconds);
      setHours(h);
      setMinutes(m);
      setSeconds(s);
      setColor(interval.color);
      setNote(interval.note);
      setExerciseType(interval?.exercise_type ?? null);
    }
  }, [interval, visible]);

  const handleSave = useCallback(() => {
    if (!interval) return;

    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        window.alert('Interval name is required.');
      } else {
        Alert.alert('Missing Name', 'Interval name is required.');
      }
      return;
    }

    // Validate and clamp duration
    let totalSeconds = compose(hours, minutes, seconds);
    if (totalSeconds < INTERVAL_DURATION_MIN_SECONDS) {
      totalSeconds = INTERVAL_DURATION_MIN_SECONDS;
    }
    if (totalSeconds > INTERVAL_DURATION_MAX_SECONDS) {
      totalSeconds = INTERVAL_DURATION_MAX_SECONDS;
    }

    onSave({
      ...interval,
      name: trimmedName,
      duration_seconds: totalSeconds,
      color,
      note: note.trim(),
      exercise_type: exerciseType,
    });
  }, [interval, name, hours, minutes, seconds, color, note, exerciseType, onSave]);

  // Don't render content if no interval
  if (!interval) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable
            style={[
              styles.sheet,
              Platform.OS === 'web' && styles.sheetWeb,
            ]}
            onPress={() => {
              /* prevent backdrop close */
            }}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Interval</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  { opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <Text style={styles.closeText}>{'\u2715'}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={(text) =>
                    setName(text.slice(0, INTERVAL_NAME_MAX_LENGTH))
                  }
                  placeholder="Interval name"
                  placeholderTextColor={APP_COLORS.textMuted}
                  maxLength={INTERVAL_NAME_MAX_LENGTH}
                  returnKeyType="done"
                  accessibilityLabel="Interval name"
                />
                <Text style={styles.charCount}>
                  {name.length}/{INTERVAL_NAME_MAX_LENGTH}
                </Text>
              </View>

              {/* Duration */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Duration</Text>
                <View style={styles.durationRow}>
                  {/* Hours */}
                  <View style={styles.durationInputGroup}>
                    <Text style={styles.durationLabel}>HH</Text>
                    <TextInput
                      style={styles.durationInput}
                      value={hours}
                      onChangeText={setHours}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      accessibilityLabel="Hours"
                    />
                  </View>

                  <Text style={styles.durationColon}>:</Text>

                  {/* Minutes */}
                  <View style={styles.durationInputGroup}>
                    <Text style={styles.durationLabel}>MM</Text>
                    <TextInput
                      style={styles.durationInput}
                      value={minutes}
                      onChangeText={setMinutes}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      accessibilityLabel="Minutes"
                    />
                  </View>

                  <Text style={styles.durationColon}>:</Text>

                  {/* Seconds */}
                  <View style={styles.durationInputGroup}>
                    <Text style={styles.durationLabel}>SS</Text>
                    <TextInput
                      style={styles.durationInput}
                      value={seconds}
                      onChangeText={setSeconds}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      accessibilityLabel="Seconds"
                    />
                  </View>
                </View>
              </View>

              {/* Color */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Color</Text>
                <ColorPicker
                  selectedColor={color}
                  onSelect={setColor}
                  style={styles.colorPicker}
                />
              </View>

              {/* Exercise Type (for camera rep tracking) — web only */}
              {Platform.OS === 'web' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Rep Tracking</Text>
                  <Pressable
                    style={styles.exerciseTypeButton}
                    onPress={() => setShowExercisePicker(true)}
                  >
                    <Text style={styles.exerciseTypeText}>
                      {exerciseType
                        ? getProfileByType(exerciseType)?.displayName ?? exerciseType
                        : 'No tracking'}
                    </Text>
                    <Text style={styles.exerciseTypeChevron}>›</Text>
                  </Pressable>

                  <ExerciseTypePicker
                    visible={showExercisePicker}
                    selected={exerciseType}
                    onSelect={setExerciseType}
                    onClose={() => setShowExercisePicker(false)}
                  />
                </View>
              )}

              {/* Note / Cue */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Note / Cue</Text>
                <TextInput
                  style={[styles.textInput, styles.noteInput]}
                  value={note}
                  onChangeText={(text) =>
                    setNote(text.slice(0, INTERVAL_NOTE_MAX_LENGTH))
                  }
                  placeholder="Optional coaching note"
                  placeholderTextColor={APP_COLORS.textMuted}
                  maxLength={INTERVAL_NOTE_MAX_LENGTH}
                  multiline
                  numberOfLines={2}
                  returnKeyType="done"
                  blurOnSubmit
                  accessibilityLabel="Interval note or coaching cue"
                />
                <Text style={styles.charCount}>
                  {note.length}/{INTERVAL_NOTE_MAX_LENGTH}
                </Text>
              </View>
            </ScrollView>

            {/* Done button */}
            <View style={styles.footer}>
              <Pressable
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Save interval changes"
                style={({ pressed }) => [
                  styles.doneButton,
                  { opacity: pressed ? 0.7 : 1 },
                  Platform.OS === 'web' &&
                    ({ cursor: 'pointer' } as ViewStyle),
                ]}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: APP_COLORS.surface,
    borderTopLeftRadius: LAYOUT.cardRadius,
    borderTopRightRadius: LAYOUT.cardRadius,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.lg,
  },
  sheetWeb: {
    // On web, center the modal rather than bottom-sheet style
    alignSelf: 'center',
    maxWidth: 480,
    width: '100%',
    borderRadius: LAYOUT.cardRadius,
    marginBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_COLORS.divider,
  },
  title: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
  closeButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: APP_COLORS.textSecondary,
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollContentContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  fieldGroup: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.divider,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textPrimary,
    minHeight: LAYOUT.buttonMinHeight,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Duration inputs
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationInputGroup: {
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontWeight: FONT_WEIGHT.medium,
  },
  durationInput: {
    width: 60,
    height: 52,
    borderWidth: 1.5,
    borderColor: APP_COLORS.divider,
    borderRadius: LAYOUT.borderRadius,
    textAlign: 'center',
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
  durationColon: {
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textMuted,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.lg,
  },

  // Color picker
  colorPicker: {
    alignSelf: 'flex-start',
  },

  // Exercise type picker
  exerciseTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  exerciseTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  exerciseTypeChevron: {
    fontSize: 18,
    color: '#94a3b8',
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_COLORS.divider,
  },
  doneButton: {
    height: LAYOUT.startButtonHeight,
    backgroundColor: APP_COLORS.primary,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
