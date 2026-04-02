/**
 * ConfirmDialog component for Schlag.
 *
 * A modal overlay with a semi-transparent black backdrop and a centered
 * card containing a title, message, and Cancel / Confirm buttons.
 *
 * When `destructive` is true the confirm button uses danger styling
 * (Schlag Red background).
 */

import React from 'react';
import {
  Modal,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  /** Controls modal visibility. */
  visible: boolean;
  /** Dialog title. */
  title: string;
  /** Dialog body message. */
  message: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** Called when the confirm button is pressed. */
  onConfirm: () => void;
  /** Called when the cancel button or backdrop is pressed. */
  onCancel: () => void;
  /** Uses danger styling for the confirm button. @default false */
  destructive?: boolean;
  /** Additional styles applied to the card. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  style,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="none"
      >
        <Pressable
          style={[styles.card, style]}
          onPress={() => {
            /* prevent backdrop close */
          }}
          accessibilityRole="alert"
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            {/* Cancel */}
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed ? 0.7 : 1 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            {/* Confirm */}
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={({ pressed }) => [
                styles.button,
                destructive
                  ? styles.confirmDestructive
                  : styles.confirmDefault,
                { opacity: pressed ? 0.7 : 1 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
              ]}
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive && styles.confirmTextDestructive,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
    lineHeight: FONT_SIZE.body * 1.5,
    marginBottom: SPACING.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  button: {
    minHeight: LAYOUT.buttonMinHeight,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  confirmDefault: {
    backgroundColor: APP_COLORS.primary,
  },
  confirmDestructive: {
    backgroundColor: APP_COLORS.primary,
  },
  confirmText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.semibold,
  },
  confirmTextDestructive: {
    color: '#FFFFFF',
  },
});
