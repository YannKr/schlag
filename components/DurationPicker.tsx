/**
 * DurationPicker component for Schlag.
 *
 * Inline display shows the formatted duration (e.g. "01:30"). Tapping it
 * opens a modal with three numeric TextInput fields for HH, MM, SS.
 *
 * Validates: min 1 second, max 359 999 seconds (99:59:59).
 * Returns total seconds to the consumer via onChange.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DurationPickerProps {
  /** Current value in seconds. */
  value: number;
  /** Called with the new total seconds when the user confirms. */
  onChange: (seconds: number) => void;
  /** Additional styles applied to the inline display. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SECONDS = 1;
const MAX_SECONDS = 359999; // 99:59:59

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

  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

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

export function DurationPicker({
  value,
  onChange,
  style,
}: DurationPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');

  const formattedValue = useMemo(() => formatDuration(value), [value]);

  const openModal = useCallback(() => {
    const { h, m, s } = decompose(value);
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setModalVisible(true);
  }, [value]);

  const handleConfirm = useCallback(() => {
    let total = compose(hours, minutes, seconds);
    // Clamp
    if (total < MIN_SECONDS) total = MIN_SECONDS;
    if (total > MAX_SECONDS) total = MAX_SECONDS;
    onChange(total);
    setModalVisible(false);
  }, [hours, minutes, seconds, onChange]);

  const handleCancel = useCallback(() => {
    setModalVisible(false);
  }, []);

  return (
    <>
      {/* Inline tappable display */}
      <Pressable
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel={`Duration: ${formattedValue}. Tap to edit.`}
        style={({ pressed }) => [
          styles.inlineDisplay,
          { opacity: pressed ? 0.7 : 1 },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          style,
        ]}
      >
        <Text style={styles.inlineText}>{formattedValue}</Text>
      </Pressable>

      {/* Edit modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={handleCancel}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable
              style={styles.modalCard}
              onPress={() => {
                /* prevent backdrop close */
              }}
            >
              <Text style={styles.modalTitle}>Set Duration</Text>

              <View style={styles.inputRow}>
                {/* Hours */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>HH</Text>
                  <TextInput
                    style={styles.input}
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    accessibilityLabel="Hours"
                  />
                </View>

                <Text style={styles.colon}>:</Text>

                {/* Minutes */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MM</Text>
                  <TextInput
                    style={styles.input}
                    value={minutes}
                    onChangeText={setMinutes}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    accessibilityLabel="Minutes"
                  />
                </View>

                <Text style={styles.colon}>:</Text>

                {/* Seconds */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>SS</Text>
                  <TextInput
                    style={styles.input}
                    value={seconds}
                    onChangeText={setSeconds}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    accessibilityLabel="Seconds"
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={({ pressed }) => [
                    styles.modalButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm duration"
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.confirmButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.confirmText}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // -- Inline display -------------------------------------------------------
  inlineDisplay: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: LAYOUT.borderRadius,
    backgroundColor: APP_COLORS.divider,
    alignSelf: 'flex-start',
  },
  inlineText: {
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textPrimary,
  },

  // -- Modal ----------------------------------------------------------------
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },

  // -- Input row ------------------------------------------------------------
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontWeight: FONT_WEIGHT.medium,
  },
  input: {
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
  colon: {
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textMuted,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.lg, // offset for label above inputs
  },

  // -- Button row -----------------------------------------------------------
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  modalButton: {
    minHeight: LAYOUT.buttonMinHeight,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: APP_COLORS.primary,
  },
  cancelText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  confirmText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.semibold,
  },
});
