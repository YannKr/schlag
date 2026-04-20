/**
 * Settings Screen for Schlag.
 *
 * Displays all user-configurable preferences organized into sections:
 * Audio, Display, Sequences, History, Pro, and Account. Settings are
 * persisted via the settingsStore (MMKV).
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSettingsStore } from '@/stores/settingsStore';
import { useSequenceStore } from '@/stores/sequenceStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useProStore } from '@/stores/proStore';
import { getStorageUsageBytes } from '@/lib/storage';
import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { LAYOUT, SPACING } from '@/constants/layout';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { WorkoutTheme } from '@/types';

// ---------------------------------------------------------------------------
// Reusable row components
// ---------------------------------------------------------------------------

/** Section header with uppercase label. */
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

/** Divider line between rows. */
function Divider() {
  return <View style={styles.divider} />;
}

/** A row with a label and a toggle Switch. */
function ToggleRow({
  label,
  value,
  onValueChange,
  accessibilityLabel,
}: {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: APP_COLORS.divider, true: APP_COLORS.primary }}
        thumbColor="#FFFFFF"
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}

/** A row with a label and a pressable value on the right. */
function ActionRow({
  label,
  value,
  onPress,
  accessibilityLabel,
  destructive,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
    >
      <Text
        style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}
      >
        {label}
      </Text>
      {value != null && <Text style={styles.rowValue}>{value}</Text>}
      <Text style={styles.rowChevron}>{'\u203A'}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Segmented control for workout theme
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { label: string; value: WorkoutTheme }[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'Color', value: 'interval-color' },
];

const GET_READY_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
];

function ThemeSegmentedControl({
  selected,
  onChange,
}: {
  selected: WorkoutTheme;
  onChange: (theme: WorkoutTheme) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Workout theme</Text>
      <View style={styles.segmentedControl}>
        {THEME_OPTIONS.map((option, idx) => {
          const isActive = selected === option.value;
          const isLast = idx === THEME_OPTIONS.length - 1;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`Theme: ${option.label}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.segmentedOption,
                isLast && styles.segmentedOptionLast,
                isActive && styles.segmentedOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedOptionText,
                  isActive && styles.segmentedOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GetReadySegmentedControl({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Get ready countdown</Text>
      <View style={styles.segmentedControl}>
        {GET_READY_OPTIONS.map((option, idx) => {
          const isActive = selected === option.value;
          const isLast = idx === GET_READY_OPTIONS.length - 1;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`Get ready: ${option.label}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.segmentedOption,
                isLast && styles.segmentedOptionLast,
                isActive && styles.segmentedOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedOptionText,
                  isActive && styles.segmentedOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Volume slider (custom since we don't import @react-native-community/slider)
// ---------------------------------------------------------------------------

/**
 * Simple volume display with +/- buttons.
 * A proper Slider component should be installed for production.
 */
function VolumeRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (val: number) => void;
}) {
  const displayPercent = Math.round(value * 100);

  const decrease = useCallback(() => {
    onValueChange(Math.max(0, Math.round((value - 0.1) * 10) / 10));
  }, [value, onValueChange]);

  const increase = useCallback(() => {
    onValueChange(Math.min(1, Math.round((value + 0.1) * 10) / 10));
  }, [value, onValueChange]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.volumeControl}>
        <Pressable
          onPress={decrease}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [
            styles.volumeButton,
            pressed && styles.volumeButtonPressed,
          ]}
        >
          <Text style={styles.volumeButtonText}>{'\u2212'}</Text>
        </Pressable>
        <Text
          style={styles.volumeValue}
          accessibilityLabel={`${label}: ${displayPercent}%`}
        >
          {displayPercent}%
        </Text>
        <Pressable
          onPress={increase}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [
            styles.volumeButton,
            pressed && styles.volumeButtonPressed,
          ]}
        >
          <Text style={styles.volumeButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const router = useRouter();

  // Settings store
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Sequence store
  const exportSequences = useSequenceStore((s) => s.exportSequences);
  const importSequences = useSequenceStore((s) => s.importSequences);

  // Session store (v2 history)
  const sessions = useSessionStore((s) => s.sessions);
  const getActiveSessions = useSessionStore((s) => s.getActiveSessions);
  const importSessions = useSessionStore((s) => s.importSessions);

  // Pro store (v2)
  const proStatus = useProStore((s) => s.proStatus);
  const isPro = useProStore((s) => s.isPro);
  const togglePro = useProStore((s) => s.togglePro);

  // Local state for loading indicators and dialogs
  const [isExporting, setIsExporting] = useState(false);
  const [clearHistoryVisible, setClearHistoryVisible] = useState(false);

  // -----------------------------------------------------------------------
  // Audio handlers
  // -----------------------------------------------------------------------

  const handleBeepsToggle = useCallback(
    (val: boolean) => updateSetting('beepsEnabled', val),
    [updateSetting],
  );

  const handleVoiceToggle = useCallback(
    (val: boolean) => updateSetting('voiceCountdownEnabled', val),
    [updateSetting],
  );

  const handleVolumeChange = useCallback(
    (val: number) => updateSetting('beepVolume', val),
    [updateSetting],
  );

  const handleHalfwayAlertToggle = useCallback(
    (val: boolean) => updateSetting('defaultHalfwayAlert', val),
    [updateSetting],
  );

  const handleAnnounceNamesToggle = useCallback(
    (val: boolean) => updateSetting('defaultAnnounceNames', val),
    [updateSetting],
  );

  // -----------------------------------------------------------------------
  // Display handlers
  // -----------------------------------------------------------------------

  const handleThemeChange = useCallback(
    (theme: WorkoutTheme) => updateSetting('workoutTheme', theme),
    [updateSetting],
  );

  const handleKeepAwakeToggle = useCallback(
    (val: boolean) => updateSetting('keepScreenAwake', val),
    [updateSetting],
  );

  const handleGetReadyChange = useCallback(
    (seconds: number) => updateSetting('getReadySeconds', seconds),
    [updateSetting],
  );

  const handleReduceMotionToggle = useCallback(
    (val: boolean) => updateSetting('reduceMotion', val),
    [updateSetting],
  );

  // -----------------------------------------------------------------------
  // Camera handlers (web-only)
  // -----------------------------------------------------------------------

  const handleCameraToggle = useCallback(
    (val: boolean) => updateSetting('cameraEnabled', val),
    [updateSetting],
  );
  const handleCameraPreviewToggle = useCallback(
    (val: boolean) => updateSetting('showCameraPreview', val),
    [updateSetting],
  );

  // -----------------------------------------------------------------------
  // Sequences handlers
  // -----------------------------------------------------------------------

  const handleAutoAdvanceToggle = useCallback(
    (val: boolean) => updateSetting('defaultAutoAdvance', val),
    [updateSetting],
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const json = exportSequences();

      if (Platform.OS === 'web') {
        // Web: trigger file download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schlag-sequences-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Native: use Share sheet
        await Share.share({
          message: json,
          title: 'Schlag Sequences',
        });
      }
    } catch (error) {
      Alert.alert('Export Failed', 'An error occurred while exporting sequences.');
    } finally {
      setIsExporting(false);
    }
  }, [exportSequences]);

  const handleImport = useCallback(() => {
    // expo-document-picker is not installed yet. Show placeholder.
    Alert.alert(
      'Import Sequences',
      'Document picker is not yet available. Install expo-document-picker to enable JSON import.',
    );
  }, []);

  // -----------------------------------------------------------------------
  // History handlers (v2)
  // -----------------------------------------------------------------------

  const handleExportHistory = useCallback(async () => {
    try {
      const activeSessions = getActiveSessions();
      const json = JSON.stringify(activeSessions, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schlag-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: json,
          title: 'Schlag Workout History',
        });
      }
    } catch (error) {
      Alert.alert('Export Failed', 'An error occurred while exporting history.');
    }
  }, [getActiveSessions]);

  const handleImportHistory = useCallback(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!Array.isArray(data)) {
            Alert.alert('Import Failed', 'File does not contain a valid session array.');
            return;
          }
          const result = importSessions(data);
          Alert.alert(
            'Import Complete',
            `Imported ${result.added} sessions (${result.skipped} skipped)`,
          );
        } catch (error) {
          Alert.alert('Import Failed', 'An error occurred while importing history.');
        }
      };
      input.click();
    } else {
      Alert.alert(
        'Import History',
        'Document picker is not yet available. Install expo-document-picker to enable JSON import.',
      );
    }
  }, [importSessions]);

  const handleClearHistory = useCallback(() => {
    setClearHistoryVisible(true);
  }, []);

  const handleConfirmClearHistory = useCallback(() => {
    // Soft-delete all active sessions
    const activeSessions = getActiveSessions();
    const deleteSession = useSessionStore.getState().deleteSession;
    for (const session of activeSessions) {
      deleteSession(session.id);
    }
    setClearHistoryVisible(false);
    Alert.alert('History Cleared', 'All workout history has been removed.');
  }, [getActiveSessions]);

  const handleCancelClearHistory = useCallback(() => {
    setClearHistoryVisible(false);
  }, []);

  // -----------------------------------------------------------------------
  // Pro handlers (v2)
  // -----------------------------------------------------------------------

  const handleRestorePurchase = useCallback(() => {
    // Placeholder -- actual restore requires StoreKit / Google Play integration.
    Alert.alert(
      'Restore Purchase',
      'Purchase restoration is not yet available. Use the dev toggle below for testing.',
    );
  }, []);

  const handleTogglePro = useCallback(() => {
    togglePro();
  }, [togglePro]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ================================================================= */}
      {/* AUDIO */}
      {/* ================================================================= */}
      <SectionHeader title="AUDIO" />
      <View style={styles.section}>
        <ToggleRow
          label="Interval beeps"
          value={settings.beepsEnabled}
          onValueChange={handleBeepsToggle}
        />
        <Divider />
        <ToggleRow
          label="Voice countdown"
          value={settings.voiceCountdownEnabled}
          onValueChange={handleVoiceToggle}
        />
        <Divider />
        <VolumeRow
          label="Beep volume"
          value={settings.beepVolume}
          onValueChange={handleVolumeChange}
        />
        <Divider />
        <ToggleRow
          label="Halfway alert"
          value={settings.defaultHalfwayAlert}
          onValueChange={handleHalfwayAlertToggle}
          accessibilityLabel="Default halfway alert for new sequences"
        />
        <Divider />
        <ToggleRow
          label="Announce interval names"
          value={settings.defaultAnnounceNames}
          onValueChange={handleAnnounceNamesToggle}
          accessibilityLabel="Default announce interval names for new sequences"
        />
        {!settings.voiceCountdownEnabled && settings.defaultAnnounceNames && (
          <View style={styles.hintRow}>
            <Text style={styles.hintText}>
              Requires voice countdown to be enabled
            </Text>
          </View>
        )}
      </View>

      {/* ================================================================= */}
      {/* DISPLAY */}
      {/* ================================================================= */}
      <SectionHeader title="DISPLAY" />
      <View style={styles.section}>
        <ThemeSegmentedControl
          selected={settings.workoutTheme}
          onChange={handleThemeChange}
        />
        <Divider />
        <ToggleRow
          label="Keep screen awake"
          value={settings.keepScreenAwake}
          onValueChange={handleKeepAwakeToggle}
        />
        <Divider />
        <GetReadySegmentedControl
          selected={settings.getReadySeconds}
          onChange={handleGetReadyChange}
        />
        <Divider />
        <ToggleRow
          label="Reduce motion"
          value={settings.reduceMotion}
          onValueChange={handleReduceMotionToggle}
          accessibilityLabel="Reduce motion"
        />
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>
            Simplifies workout animations. Also respects system accessibility setting.
          </Text>
        </View>
      </View>

      {/* ================================================================= */}
      {/* CAMERA REP TRACKING (web-only)                                   */}
      {/* ================================================================= */}
      {Platform.OS === 'web' && (
        <>
          <SectionHeader title="CAMERA REP TRACKING" />
          <View style={styles.section}>
            <ToggleRow
              label="Enable Camera"
              value={settings.cameraEnabled}
              onValueChange={handleCameraToggle}
              accessibilityLabel="Enable camera for rep tracking"
            />
            {settings.cameraEnabled && (
              <>
                <Divider />
                <ToggleRow
                  label="Show Camera Preview"
                  value={settings.showCameraPreview}
                  onValueChange={handleCameraPreviewToggle}
                  accessibilityLabel="Display camera feed on workout screen"
                />
              </>
            )}
          </View>
        </>
      )}

      {/* ================================================================= */}
      {/* SEQUENCES */}
      {/* ================================================================= */}
      <SectionHeader title="SEQUENCES" />
      <View style={styles.section}>
        <ToggleRow
          label="Default auto-advance"
          value={settings.defaultAutoAdvance}
          onValueChange={handleAutoAdvanceToggle}
        />
        <Divider />
        <ActionRow
          label="Export sequences"
          value="JSON"
          onPress={handleExport}
        />
        <Divider />
        <ActionRow
          label="Import sequences"
          onPress={handleImport}
        />
      </View>

      {/* ================================================================= */}
      {/* HISTORY (v2)                                                     */}
      {/* ================================================================= */}
      <SectionHeader title="HISTORY" />
      <View style={styles.section}>
        {Platform.OS === 'web' && (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Storage used</Text>
              <Text style={styles.rowValue}>
                {(getStorageUsageBytes() / (1024 * 1024)).toFixed(1)} MB / 5 MB
              </Text>
            </View>
            <Divider />
          </>
        )}
        <ActionRow
          label="Export history"
          value="JSON"
          onPress={handleExportHistory}
        />
        <Divider />
        <ActionRow
          label="Import history"
          onPress={handleImportHistory}
        />
        <Divider />
        <ActionRow
          label="Clear history"
          onPress={handleClearHistory}
          destructive
        />
      </View>

      {/* ================================================================= */}
      {/* PRO (v2)                                                         */}
      {/* ================================================================= */}
      <SectionHeader title="PRO" />
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {isPro() ? 'Schlag Pro' : 'Unlock Schlag Pro'}
          </Text>
          <Text style={styles.proStatusIcon}>
            {isPro() ? '\u2713' : '\uD83D\uDD12'}
          </Text>
        </View>
        <Divider />
        <ActionRow
          label="Restore purchase"
          onPress={handleRestorePurchase}
        />
        <Divider />
        <ActionRow
          label="Toggle Pro (Dev)"
          value={isPro() ? 'ON' : 'OFF'}
          onPress={handleTogglePro}
        />
      </View>

      {/* Bottom spacing */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Schlag v1.0</Text>
      </View>

      {/* Clear History confirmation dialog */}
      <ConfirmDialog
        visible={clearHistoryVisible}
        title="Clear History"
        message="This will permanently delete all workout history. This action cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleConfirmClearHistory}
        onCancel={handleCancelClearHistory}
        destructive
      />
    </ScrollView>
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
  contentContainer: {
    paddingBottom: SPACING.xxxl,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  sectionHeaderText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textMuted,
    letterSpacing: 1,
  },

  // Section wrapper
  section: {
    backgroundColor: APP_COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: LAYOUT.cardRadius,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: LAYOUT.startButtonHeight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowPressed: {
    backgroundColor: APP_COLORS.divider,
  },
  rowLabel: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textPrimary,
    flex: 1,
  },
  rowLabelDestructive: {
    color: APP_COLORS.primary,
  },
  rowValue: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  rowChevron: {
    fontSize: 20,
    color: APP_COLORS.textMuted,
    marginLeft: SPACING.sm,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_COLORS.divider,
    marginLeft: SPACING.lg,
  },

  // Segmented control — Signal flat bordered pills
  segmentedControl: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: APP_COLORS.divider,
    flexShrink: 0,
  },
  segmentedOption: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: APP_COLORS.divider,
  },
  segmentedOptionLast: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: APP_COLORS.divider,
  },
  segmentedOptionActive: {
    backgroundColor: APP_COLORS.textPrimary,
  },
  segmentedOptionText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  segmentedOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Volume control
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeButtonPressed: {
    backgroundColor: APP_COLORS.textMuted,
  },
  volumeButtonText: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textPrimary,
  },
  volumeValue: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },

  // Hint row (e.g. "Requires voice countdown")
  hintRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  hintText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Pro status icon
  proStatusIcon: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.primary,
    marginLeft: SPACING.sm,
  },

  // Footer
  footer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
  },
});
