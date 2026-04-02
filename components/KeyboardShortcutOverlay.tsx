/**
 * KeyboardShortcutOverlay — Web-only modal showing available keyboard shortcuts.
 *
 * Displays a dark semi-transparent backdrop with a centered card listing
 * every shortcut key and its action. Monospace key labels for visual clarity.
 *
 * No-op on native platforms (renders nothing).
 */

import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardShortcutOverlayProps {
  /** Controls overlay visibility. */
  visible: boolean;
  /** Called when the overlay should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

interface ShortcutEntry {
  keys: string;
  action: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Space / K', action: 'Pause / Resume' },
  { keys: 'N / \u2192', action: 'Skip interval' },
  { keys: 'Esc / Q', action: 'Stop workout' },
  { keys: 'E', action: 'Toggle expanded view' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: '?', action: 'Show this help' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutOverlay({
  visible,
  onClose,
}: KeyboardShortcutOverlayProps) {
  // No-op on native platforms
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="none"
      >
        <Pressable
          style={styles.card}
          onPress={() => {
            /* prevent backdrop close */
          }}
          accessibilityRole="alert"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Keyboard Shortcuts</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close shortcuts"
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.6 : 1 },
                { cursor: 'pointer' } as ViewStyle,
              ]}
            >
              <Text style={styles.closeButtonText}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Shortcut rows */}
          <View style={styles.shortcutList}>
            {SHORTCUTS.map((shortcut, index) => (
              <View
                key={shortcut.keys}
                style={[
                  styles.shortcutRow,
                  index < SHORTCUTS.length - 1 && styles.shortcutRowBorder,
                ]}
              >
                <View style={styles.keyBadgeContainer}>
                  {shortcut.keys.split(' / ').map((key, keyIndex) => (
                    <React.Fragment key={key}>
                      {keyIndex > 0 && (
                        <Text style={styles.keySeparator}>/</Text>
                      )}
                      <View style={styles.keyBadge}>
                        <Text style={styles.keyBadgeText}>{key.trim()}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <Text style={styles.actionText}>{shortcut.action}</Text>
              </View>
            ))}
          </View>

          {/* Footer hint */}
          <Text style={styles.footerHint}>
            Press ? or Esc to close
          </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: APP_COLORS.backgroundDark,
    borderRadius: LAYOUT.cardRadius,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textOnDark,
  },
  closeButton: {
    width: LAYOUT.closeButtonSize,
    height: LAYOUT.closeButtonSize,
    borderRadius: LAYOUT.closeButtonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textOnDark,
    fontWeight: FONT_WEIGHT.medium,
  },
  shortcutList: {
    marginBottom: SPACING.lg,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  shortcutRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  keyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // subtle inset shadow effect via border
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyBadgeText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textOnDark,
  },
  keySeparator: {
    fontSize: FONT_SIZE.caption,
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 2,
  },
  actionText: {
    fontSize: FONT_SIZE.body,
    color: 'rgba(255, 255, 255, 0.75)',
    marginLeft: SPACING.lg,
  },
  footerHint: {
    fontSize: FONT_SIZE.caption,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
  },
});
