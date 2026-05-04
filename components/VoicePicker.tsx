/**
 * VoicePicker — modal for selecting the TTS voice used for countdown
 * announcements and "Next: …" callouts.
 *
 * Lists voices returned by Speech.getAvailableVoicesAsync(), filtered to
 * English locales. The first row is always "System default" (null).
 * Tapping a voice persists the selection and previews it with the user's
 * chosen voice via expo-speech.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import * as Speech from 'expo-speech';

import { APP_COLORS } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoicePickerProps {
  visible: boolean;
  /** Currently saved voice identifier; null = system default. */
  selectedVoiceId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

interface VoiceRow {
  /** Voice identifier or null for "system default". */
  id: string | null;
  label: string;
  sublabel?: string;
}

const PREVIEW_TEXT = '3, 2, 1';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoicePicker({
  visible,
  selectedVoiceId,
  onSelect,
  onClose,
}: VoicePickerProps) {
  const [voices, setVoices] = useState<Speech.Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch voices when the picker opens (and forget them when it closes,
  // since the platform list can change e.g. when a user installs a voice).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setVoices(null);

    Speech.getAvailableVoicesAsync()
      .then((list) => {
        if (cancelled) return;
        setVoices(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load voices');
        setVoices([]);
      });

    return () => {
      cancelled = true;
      Speech.stop();
    };
  }, [visible]);

  const rows = useMemo<VoiceRow[]>(() => {
    const base: VoiceRow[] = [{ id: null, label: 'System default' }];
    if (!voices) return base;

    const englishVoices = voices.filter((v) =>
      v.language?.toLowerCase().startsWith('en'),
    );
    // Sort: enhanced quality first, then by name.
    englishVoices.sort((a, b) => {
      if (a.quality !== b.quality) {
        return a.quality === 'Enhanced' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return base.concat(
      englishVoices.map((v) => ({
        id: v.identifier,
        label: v.name,
        sublabel: `${v.language}${v.quality === 'Enhanced' ? ' · Enhanced' : ''}`,
      })),
    );
  }, [voices]);

  const handleSelect = useCallback(
    (id: string | null) => {
      onSelect(id);
      // Preview at natural rate. Errors are swallowed by expo-speech.
      try {
        Speech.stop();
        Speech.speak(PREVIEW_TEXT, {
          language: 'en-US',
          rate: 1.0,
          voice: id ?? undefined,
        });
      } catch {
        // Audio failures must never crash the app.
      }
    },
    [onSelect],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.card}
          onPress={() => {
            /* prevent backdrop close */
          }}
          accessibilityRole="menu"
          accessibilityLabel="Voice picker"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Voice</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={({ pressed }) => [
                styles.doneButton,
                { opacity: pressed ? 0.7 : 1 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
              ]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          {voices === null && !error ? (
            <View style={styles.loading}>
              <ActivityIndicator color={APP_COLORS.primary} />
              <Text style={styles.loadingText}>Loading voices…</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id ?? '__default__'}
              ItemSeparatorComponent={Divider}
              renderItem={({ item }) => (
                <VoiceRowItem
                  row={item}
                  isSelected={item.id === selectedVoiceId}
                  onPress={() => handleSelect(item.id)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    No English voices available on this device.
                  </Text>
                </View>
              }
              ListFooterComponent={
                error ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>{error}</Text>
                  </View>
                ) : null
              }
              style={styles.list}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function VoiceRowItem({
  row,
  isSelected,
  onPress,
}: {
  row: VoiceRow;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={`${row.label}${row.sublabel ? `, ${row.sublabel}` : ''}`}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        {row.sublabel && <Text style={styles.rowSublabel}>{row.sublabel}</Text>}
      </View>
      {isSelected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_COLORS.divider,
  },
  title: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
  doneButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  doneText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.primary,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    minHeight: LAYOUT.startButtonHeight,
  },
  rowPressed: {
    backgroundColor: APP_COLORS.divider,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textPrimary,
  },
  rowSublabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: APP_COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
    marginLeft: SPACING.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_COLORS.divider,
    marginLeft: SPACING.xl,
  },
  loading: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  empty: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    fontStyle: 'italic',
  },
});
