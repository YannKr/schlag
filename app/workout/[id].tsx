/**
 * Workout Screen — the heart of Schlag.
 *
 * Renders the active workout timer with countdown, progress bar, interval
 * info, and controls. Supports compact and expanded modes, three background
 * themes (dark / light / interval-color), auto-advance off overlay, and
 * a workout-complete celebration screen.
 *
 * Route: /workout/[id]
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CountdownTimer } from '@/components/CountdownTimer';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';

import { APP_COLORS, getTextColorForInterval } from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
} from '@/constants/typography';

import { useTimerLoop } from '@/hooks/useTimerLoop';
import { useSequenceStore } from '@/stores/sequenceStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';

import type { Interval, TimerTickData, TimelineEntry } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DARK_BG = APP_COLORS.backgroundDark;
const LIGHT_BG = '#FFFFFF';
const INTERVAL_COLOR_TINT_OPACITY = 0.2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Blend an interval color with the dark background at the given opacity.
 * Returns an `rgba()` string for use as a tint overlay.
 */
function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build the list of upcoming timeline entries for the expanded view.
 * Includes remaining intervals in the current round and all subsequent rounds.
 */
function buildTimeline(
  intervals: Interval[],
  currentIntervalIndex: number,
  currentRound: number,
  totalRounds: number,
  restBetweenSets: number,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Remaining intervals in the current round (excluding the currently active one).
  for (let i = currentIntervalIndex + 1; i < intervals.length; i++) {
    entries.push({
      interval: intervals[i],
      round: currentRound,
      indexInRound: i,
      isRestBetweenSets: false,
    });
  }

  // Future rounds (only for finite repeats with more rounds left).
  if (totalRounds > 0) {
    for (let round = currentRound + 1; round <= totalRounds; round++) {
      // Rest between sets.
      if (restBetweenSets > 0) {
        entries.push({
          interval: {
            id: `rest-${round}`,
            name: 'Rest',
            duration_seconds: restBetweenSets,
            color: '#475569',
            note: '',
          },
          round,
          indexInRound: -1,
          isRestBetweenSets: true,
        });
      }

      for (let i = 0; i < intervals.length; i++) {
        entries.push({
          interval: intervals[i],
          round,
          indexInRound: i,
          isRestBetweenSets: false,
        });
      }
    }
  }

  return entries;
}

/**
 * Format seconds into MM:SS or H:MM:SS for the timeline list.
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Icon components (inline SVG-like text icons for cross-platform compat)
// ---------------------------------------------------------------------------

function PauseIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'| |'}
    </Text>
  );
}

function PlayIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u25B6'}
    </Text>
  );
}

function SkipIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u23ED'}
    </Text>
  );
}

function StopIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u25A0'}
    </Text>
  );
}

function ExpandIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u2195'}
    </Text>
  );
}

function CollapseIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u2194'}
    </Text>
  );
}

function FinishRoundIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text
      style={{ fontSize: size, color, fontWeight: FONT_WEIGHT.bold }}
      accessibilityElementsHidden
    >
      {'\u21B5'}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

/** Round indicator label, e.g. "Round 2 of 5" or "Round 3 (infinite)". */
function RoundIndicator({
  currentRound,
  totalRounds,
  textColor,
}: {
  currentRound: number;
  totalRounds: number;
  textColor: string;
}) {
  const label =
    totalRounds === 0
      ? `Round ${currentRound} (\u221E)`
      : `Round ${currentRound} of ${totalRounds}`;

  return (
    <Text
      style={[styles.roundLabel, { color: textColor }]}
      accessibilityLabel={
        totalRounds === 0
          ? `Round ${currentRound}, infinite mode`
          : `Round ${currentRound} of ${totalRounds}`
      }
    >
      {label}
    </Text>
  );
}

/** Interval index indicator, e.g. "3 / 8". */
function IntervalIndicator({
  currentIndex,
  total,
  textColor,
}: {
  currentIndex: number;
  total: number;
  textColor: string;
}) {
  return (
    <Text
      style={[styles.intervalIndicator, { color: textColor }]}
      accessibilityLabel={`Interval ${currentIndex + 1} of ${total}`}
    >
      {currentIndex + 1} / {total}
    </Text>
  );
}

/** Preview of the next interval. */
function NextIntervalPreview({
  nextInterval,
  textColor,
  mutedColor,
}: {
  nextInterval: Interval | null;
  textColor: string;
  mutedColor: string;
}) {
  if (!nextInterval) return null;

  return (
    <View style={styles.nextPreviewContainer}>
      <Text style={[styles.nextLabel, { color: mutedColor }]}>NEXT</Text>
      <View style={styles.nextRow}>
        <View
          style={[styles.nextColorDot, { backgroundColor: nextInterval.color }]}
        />
        <Text
          style={[styles.nextName, { color: textColor }]}
          numberOfLines={1}
        >
          {nextInterval.name}
        </Text>
        <Text style={[styles.nextDuration, { color: mutedColor }]}>
          {formatDuration(nextInterval.duration_seconds)}
        </Text>
      </View>
    </View>
  );
}

/** Coaching note displayed below the progress bar. */
function CoachingNote({
  note,
  textColor,
}: {
  note: string;
  textColor: string;
}) {
  if (!note) return null;

  return (
    <Text
      style={[styles.coachingNote, { color: textColor }]}
      numberOfLines={2}
      accessibilityLabel={`Coaching note: ${note}`}
    >
      {note}
    </Text>
  );
}

/** Rest between sets indicator. */
function RestBetweenSetsLabel({ textColor }: { textColor: string }) {
  return (
    <View style={styles.restBadge}>
      <Text style={[styles.restBadgeText, { color: textColor }]}>
        REST BETWEEN SETS
      </Text>
    </View>
  );
}

/** Full-screen "Tap to Continue" overlay when auto_advance is off. */
function TapToContinueOverlay({ onTap }: { onTap: () => void }) {
  return (
    <Pressable
      style={styles.tapOverlay}
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel="Tap to continue to next interval"
    >
      <View style={styles.tapOverlayContent}>
        <Text style={styles.tapOverlayText}>TAP TO CONTINUE</Text>
        <Text style={styles.tapOverlaySubtext}>
          Interval complete. Tap anywhere to proceed.
        </Text>
      </View>
    </Pressable>
  );
}

/** Workout complete celebration screen. */
function WorkoutCompleteScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.completeContainer}>
      <Text style={styles.completeTitle}>WORKOUT COMPLETE</Text>
      <Text style={styles.completeSubtitle}>Great work! You crushed it.</Text>
      <Button
        title="Done"
        onPress={onDone}
        variant="primary"
        style={styles.completeButton}
        accessibilityLabel="Return to library"
      />
    </View>
  );
}

/** Single row in the expanded timeline list. */
function TimelineRow({
  entry,
  isCurrentlyActive,
  textColor,
  mutedColor,
}: {
  entry: TimelineEntry;
  isCurrentlyActive: boolean;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View
      style={[
        styles.timelineRow,
        isCurrentlyActive && styles.timelineRowActive,
      ]}
    >
      <View
        style={[
          styles.timelineColorDot,
          { backgroundColor: entry.interval.color },
        ]}
      />
      <View style={styles.timelineInfo}>
        <Text
          style={[
            styles.timelineName,
            {
              color: isCurrentlyActive ? APP_COLORS.primary : textColor,
            },
          ]}
          numberOfLines={1}
        >
          {entry.isRestBetweenSets ? 'REST' : entry.interval.name}
        </Text>
        {entry.round > 0 && (
          <Text style={[styles.timelineRound, { color: mutedColor }]}>
            R{entry.round}
          </Text>
        )}
      </View>
      <Text style={[styles.timelineDuration, { color: mutedColor }]}>
        {formatDuration(entry.interval.duration_seconds)}
      </Text>
    </View>
  );
}

/** Expanded timeline list of upcoming intervals. */
function TimelineList({
  entries,
  textColor,
  mutedColor,
}: {
  entries: TimelineEntry[];
  textColor: string;
  mutedColor: string;
}) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TimelineEntry>) => (
      <TimelineRow
        entry={item}
        isCurrentlyActive={false}
        textColor={textColor}
        mutedColor={mutedColor}
      />
    ),
    [textColor, mutedColor],
  );

  const keyExtractor = useCallback(
    (item: TimelineEntry, index: number) =>
      `${item.interval.id}-${item.round}-${index}`,
    [],
  );

  if (entries.length === 0) {
    return (
      <View style={styles.timelineEmpty}>
        <Text style={[styles.timelineEmptyText, { color: mutedColor }]}>
          Last interval
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      <Text style={[styles.timelineHeader, { color: mutedColor }]}>
        UP NEXT
      </Text>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.timelineList}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}

/** Bottom control toolbar. */
function ControlToolbar({
  status,
  totalRounds,
  isExpanded,
  textColor,
  onPause,
  onResume,
  onSkip,
  onStop,
  onToggleExpanded,
  onFinishAfterRound,
}: {
  status: 'running' | 'paused';
  totalRounds: number;
  isExpanded: boolean;
  textColor: string;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onToggleExpanded: () => void;
  onFinishAfterRound: () => void;
}) {
  const isPaused = status === 'paused';
  const isInfinite = totalRounds === 0;
  const iconSize = 20;
  const iconColor = textColor;

  return (
    <View style={styles.controlBar}>
      {/* Stop */}
      <IconButton
        icon={<StopIcon color={iconColor} size={iconSize} />}
        onPress={onStop}
        size={LAYOUT.minTapTarget}
        accessibilityLabel="Stop workout"
        style={styles.controlButton}
      />

      {/* Skip */}
      <IconButton
        icon={<SkipIcon color={iconColor} size={iconSize} />}
        onPress={onSkip}
        size={LAYOUT.minTapTarget}
        accessibilityLabel="Skip to next interval"
        style={styles.controlButton}
      />

      {/* Pause / Resume — large center button */}
      <Pressable
        onPress={isPaused ? onResume : onPause}
        accessibilityRole="button"
        accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}
        style={({ pressed }) => [
          styles.pauseResumeButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {isPaused ? (
          <PlayIcon color="#FFFFFF" size={28} />
        ) : (
          <PauseIcon color="#FFFFFF" size={28} />
        )}
      </Pressable>

      {/* Finish After Round (infinite mode only) */}
      {isInfinite ? (
        <IconButton
          icon={<FinishRoundIcon color={iconColor} size={iconSize} />}
          onPress={onFinishAfterRound}
          size={LAYOUT.minTapTarget}
          accessibilityLabel="Finish after current round"
          style={styles.controlButton}
        />
      ) : (
        <View style={{ width: LAYOUT.minTapTarget }} />
      )}

      {/* Expand / Collapse */}
      <IconButton
        icon={
          isExpanded ? (
            <CollapseIcon color={iconColor} size={iconSize} />
          ) : (
            <ExpandIcon color={iconColor} size={iconSize} />
          )
        }
        onPress={onToggleExpanded}
        size={LAYOUT.minTapTarget}
        accessibilityLabel={
          isExpanded ? 'Switch to compact view' : 'Switch to expanded view'
        }
        style={styles.controlButton}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen Component
// ---------------------------------------------------------------------------

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // Keep screen awake during workout (always appropriate on the workout screen).
  useWakeLock(true);

  // Stores.
  const settings = useSettingsStore((s) => s.settings);
  const getSequenceById = useSequenceStore((s) => s.getSequenceById);
  const updateSequence = useSequenceStore((s) => s.updateSequence);
  const setActive = useTimerStore((s) => s.setActive);
  const setInactive = useTimerStore((s) => s.setInactive);
  const storeUpdateTick = useTimerStore((s) => s.updateTick);
  const toggleExpanded = useTimerStore((s) => s.toggleExpanded);
  const isExpanded = useTimerStore((s) => s.isExpanded);

  // Session store (v2 history logging).
  const startSession = useSessionStore((s) => s.startSession);
  const completeSession = useSessionStore((s) => s.completeSession);
  const stopSessionLog = useSessionStore((s) => s.stopSession);
  const addPause = useSessionStore((s) => s.addPause);
  const recordResume = useSessionStore((s) => s.recordResume);

  // Timer loop hook.
  const timerLoop = useTimerLoop();

  // Local state.
  const [showTapToContinue, setShowTapToContinue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const sequenceRef = useRef(getSequenceById(id ?? ''));
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  // ---------------------------------------------------------------------------
  // Startup: load sequence, activate timer, start loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (hasStartedRef.current || !id) return;

    const sequence = getSequenceById(id);
    if (!sequence) {
      setError('Sequence not found.');
      return;
    }

    hasStartedRef.current = true;
    sequenceRef.current = sequence;

    // Mark active in the timer store (for the Active tab).
    setActive(id);

    // Update last_used_at timestamp.
    updateSequence(id, { last_used_at: new Date().toISOString() });

    // v2: Start a session log for history.
    sessionIdRef.current = startSession(sequence);
    startedAtRef.current = Date.now();

    // Attempt to restore a saved session (process kill recovery), else start fresh.
    timerLoop.restore(sequence).then((restored) => {
      if (!restored) {
        return timerLoop.start(sequence);
      }
    }).catch(() => {
      setError('Failed to start workout.');
    });

    // Cleanup on unmount.
    return () => {
      setInactive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------------------
  // Sync tick data to the timer store on every update
  // ---------------------------------------------------------------------------

  const { tickData } = timerLoop;

  // Keep a ref to the latest tickData so callbacks don't need it in deps.
  const tickDataRef = useRef(tickData);
  useEffect(() => { tickDataRef.current = tickData; }, [tickData]);

  useEffect(() => {
    if (tickData) {
      storeUpdateTick(tickData);
    }
  }, [tickData, storeUpdateTick]);

  // ---------------------------------------------------------------------------
  // Web: update document.title with countdown
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'web' || !tickData) return;

    if (tickData.status === 'running' || tickData.status === 'paused') {
      const statusSuffix = tickData.status === 'paused' ? ' (Paused)' : '';
      document.title = `${tickData.formattedTime} - ${tickData.currentInterval.name}${statusSuffix} | Schlag`;
    } else if (tickData.status === 'completed') {
      document.title = 'Workout Complete | Schlag';
    }

    return () => {
      document.title = 'Schlag';
    };
  }, [tickData]);

  // ---------------------------------------------------------------------------
  // Auto-advance OFF: show tap overlay when remaining hits 0
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!tickData || !sequenceRef.current) return;

    const seq = sequenceRef.current;

    if (
      !seq.auto_advance &&
      tickData.status === 'running' &&
      tickData.remainingMs <= 0
    ) {
      setShowTapToContinue(true);
    }
  }, [tickData]);

  const handleTapToContinue = useCallback(() => {
    setShowTapToContinue(false);
    timerLoop.skip();
  }, [timerLoop]);

  // ---------------------------------------------------------------------------
  // Control handlers
  // ---------------------------------------------------------------------------

  const handlePause = useCallback(() => {
    timerLoop.pause();
    if (sessionIdRef.current) addPause(sessionIdRef.current);
  }, [timerLoop, addPause]);

  const handleResume = useCallback(() => {
    timerLoop.resume();
    if (sessionIdRef.current) recordResume(sessionIdRef.current);
  }, [timerLoop, recordResume]);

  const handleSkip = useCallback(() => {
    setShowTapToContinue(false);
    timerLoop.skip();
  }, [timerLoop]);

  const handleStop = useCallback(() => {
    const doStop = () => {
      // v2: Log the stopped session.
      const td = tickDataRef.current;
      if (sessionIdRef.current && td) {
        const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        stopSessionLog(sessionIdRef.current, {
          stopped_at_interval: td.currentIntervalIndex,
          stopped_at_round: td.currentRound,
          intervals_completed: td.currentIntervalIndex,
          rounds_completed: Math.max(0, td.currentRound - 1),
          total_active_seconds: elapsedSeconds,
          total_rest_seconds: 0,
        });
      }
      timerLoop.stop();
      setInactive();
      router.back();
    };

    if (Platform.OS === 'web') {
      // Web: use confirm dialog.
      if (window.confirm('Stop this workout? All progress will be lost.')) {
        doStop();
      }
    } else {
      // Native: use Alert.
      Alert.alert(
        'Stop Workout',
        'Are you sure? All progress will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: doStop,
          },
        ],
      );
    }
  }, [timerLoop, setInactive, router, stopSessionLog]);

  const handleFinishAfterRound = useCallback(() => {
    timerLoop.finishAfterRound();
  }, [timerLoop]);

  const handleToggleExpanded = useCallback(() => {
    toggleExpanded();
  }, [toggleExpanded]);

  const handleDone = useCallback(() => {
    // v2: Log completed session.
    const td = tickDataRef.current;
    if (sessionIdRef.current && td) {
      const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      completeSession(sessionIdRef.current, {
        intervals_completed: td.totalIntervals,
        rounds_completed: td.totalRounds > 0 ? td.totalRounds : td.currentRound,
        total_active_seconds: elapsedSeconds,
        total_rest_seconds: 0,
      });
    }
    timerLoop.stop();
    setInactive();
    router.back();
  }, [timerLoop, setInactive, router, completeSession]);

  // ---------------------------------------------------------------------------
  // Derived theme values
  // ---------------------------------------------------------------------------

  const theme = settings.workoutTheme;
  const intervalColor = tickData?.currentInterval.color ?? APP_COLORS.primary;

  const { backgroundColor, textColor, mutedColor, statusBarStyle } =
    useMemo(() => {
      switch (theme) {
        case 'light':
          return {
            backgroundColor: LIGHT_BG,
            textColor: APP_COLORS.textPrimary,
            mutedColor: APP_COLORS.textMuted,
            statusBarStyle: 'dark-content' as const,
          };
        case 'interval-color':
          return {
            backgroundColor: intervalColor,
            textColor: getTextColorForInterval(intervalColor),
            mutedColor:
              getTextColorForInterval(intervalColor) === '#FFFFFF'
                ? 'rgba(255, 255, 255, 0.6)'
                : 'rgba(26, 26, 46, 0.5)',
            statusBarStyle:
              getTextColorForInterval(intervalColor) === '#FFFFFF'
                ? ('light-content' as const)
                : ('dark-content' as const),
          };
        case 'dark':
        default:
          return {
            backgroundColor: DARK_BG,
            textColor: APP_COLORS.textOnDark,
            mutedColor: 'rgba(255, 255, 255, 0.5)',
            statusBarStyle: 'light-content' as const,
          };
      }
    }, [theme, intervalColor]);

  // Dark theme tint overlay color.
  const tintOverlayColor =
    theme === 'dark'
      ? hexToRgba(intervalColor, INTERVAL_COLOR_TINT_OPACITY)
      : undefined;

  // ---------------------------------------------------------------------------
  // Timeline entries for expanded view
  // ---------------------------------------------------------------------------

  const timelineEntries = useMemo(() => {
    if (!isExpanded || !tickData || !sequenceRef.current) return [];

    return buildTimeline(
      sequenceRef.current.intervals,
      tickData.currentIntervalIndex,
      tickData.currentRound,
      tickData.totalRounds,
      sequenceRef.current.rest_between_sets_seconds,
    );
  }, [isExpanded, tickData]);

  // ---------------------------------------------------------------------------
  // Web centering: max-width 480px when viewport >= 768px
  // ---------------------------------------------------------------------------

  const webContainerStyle: StyleProp<ViewStyle> =
    Platform.OS === 'web' && windowWidth >= LAYOUT.webBreakpoint
      ? {
          maxWidth: LAYOUT.webMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as unknown as number,
        }
      : undefined;

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: DARK_BG }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="primary"
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state (before first tick arrives)
  // ---------------------------------------------------------------------------

  if (!tickData) {
    return (
      <View style={[styles.container, { backgroundColor: DARK_BG }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Starting workout...</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Workout complete state
  // ---------------------------------------------------------------------------

  if (tickData.status === 'completed') {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: DARK_BG, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle="light-content" />
        <WorkoutCompleteScreen onDone={handleDone} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Active workout render
  // ---------------------------------------------------------------------------

  const {
    currentInterval,
    currentIntervalIndex,
    totalIntervals,
    currentRound,
    totalRounds,
    progress,
    formattedTime,
    nextInterval,
    isRestBetweenSets,
    status,
  } = tickData;

  const isRunningOrPaused = status === 'running' || status === 'paused';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle={statusBarStyle} />

      {/* Dark theme tint overlay */}
      {tintOverlayColor && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: tintOverlayColor },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Main content area */}
      <View style={[styles.contentArea, webContainerStyle]}>
        {/* Top section: round + interval indicators */}
        <View style={styles.topSection}>
          {isRestBetweenSets && <RestBetweenSetsLabel textColor={textColor} />}

          <RoundIndicator
            currentRound={currentRound}
            totalRounds={totalRounds}
            textColor={mutedColor}
          />

          <IntervalIndicator
            currentIndex={currentIntervalIndex}
            total={totalIntervals}
            textColor={mutedColor}
          />
        </View>

        {/* Center section: interval name + countdown */}
        <View style={styles.centerSection}>
          {/* Current interval name */}
          <Text
            style={[
              isExpanded
                ? styles.intervalNameExpanded
                : styles.intervalName,
              { color: textColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            accessibilityLabel={`Current interval: ${currentInterval.name}`}
          >
            {currentInterval.name.toUpperCase()}
          </Text>

          {/* Countdown timer */}
          <CountdownTimer
            formattedTime={formattedTime}
            style={[
              isExpanded && styles.countdownSmaller,
              { color: textColor },
            ]}
          />

          {/* Progress bar */}
          <View style={styles.progressBarWrapper}>
            <ProgressBar
              progress={progress}
              color={
                theme === 'interval-color'
                  ? getTextColorForInterval(intervalColor) === '#FFFFFF'
                    ? 'rgba(255, 255, 255, 0.8)'
                    : 'rgba(26, 26, 46, 0.4)'
                  : intervalColor
              }
              style={styles.progressBar}
            />
          </View>

          {/* Coaching note */}
          <CoachingNote
            note={currentInterval.note}
            textColor={mutedColor}
          />

          {/* Next interval preview */}
          <NextIntervalPreview
            nextInterval={nextInterval}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </View>

        {/* Expanded: timeline of upcoming intervals */}
        {isExpanded && (
          <TimelineList
            entries={timelineEntries}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        )}

        {/* Bottom controls */}
        {isRunningOrPaused && (
          <ControlToolbar
            status={status as 'running' | 'paused'}
            totalRounds={totalRounds}
            isExpanded={isExpanded}
            textColor={textColor}
            onPause={handlePause}
            onResume={handleResume}
            onSkip={handleSkip}
            onStop={handleStop}
            onToggleExpanded={handleToggleExpanded}
            onFinishAfterRound={handleFinishAfterRound}
          />
        )}
      </View>

      {/* Tap to Continue overlay (auto_advance OFF, interval complete) */}
      {showTapToContinue && (
        <TapToContinueOverlay onTap={handleTapToContinue} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'space-between',
  },

  // Top section
  topSection: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    gap: SPACING.xs,
  },
  roundLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  intervalIndicator: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 1,
  },

  // Center section
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  intervalName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.intervalNameLarge,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    lineHeight: FONT_SIZE.intervalNameLarge * LINE_HEIGHT.intervalName,
    paddingHorizontal: SPACING.sm,
  },
  intervalNameExpanded: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.intervalNameSmall,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    lineHeight: FONT_SIZE.intervalNameSmall * LINE_HEIGHT.intervalName,
    paddingHorizontal: SPACING.sm,
  },
  countdownSmaller: {
    fontSize: FONT_SIZE.countdownSmall,
    lineHeight: FONT_SIZE.countdownSmall * 1.1,
  },

  // Progress bar
  progressBarWrapper: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
  },
  progressBar: {
    // Inherits default 12px height from ProgressBar component.
  },

  // Coaching note
  coachingNote: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.regular,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
  },

  // Next interval preview
  nextPreviewContainer: {
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  nextLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nextColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nextName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.medium,
  },
  nextDuration: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.regular,
  },

  // Rest between sets badge
  restBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: LAYOUT.borderRadius,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  restBadgeText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.5,
  },

  // Control toolbar
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pauseResumeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as ViewStyle)
      : {}),
  },

  // Tap to Continue overlay
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  tapOverlayContent: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  tapOverlayText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  tapOverlaySubtext: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Workout complete screen
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },
  completeTitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.intervalNameLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.primary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  completeSubtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textOnDark,
    textAlign: 'center',
    lineHeight: FONT_SIZE.headingMedium * LINE_HEIGHT.heading,
  },
  completeButton: {
    minWidth: 200,
    marginTop: SPACING.xl,
  },

  // Timeline (expanded view)
  timelineContainer: {
    maxHeight: 200,
    marginTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: SPACING.md,
  },
  timelineHeader: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  timelineList: {
    flex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: LAYOUT.borderRadius,
    gap: SPACING.sm,
  },
  timelineRowActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  timelineColorDot: {
    width: LAYOUT.colorSwatchSize,
    height: LAYOUT.colorSwatchSize,
    borderRadius: LAYOUT.colorSwatchSize / 2,
  },
  timelineInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timelineName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  timelineRound: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.regular,
  },
  timelineDuration: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.regular,
  },
  timelineEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  timelineEmptyText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    fontStyle: 'italic',
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },
  errorText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textOnDark,
    textAlign: 'center',
  },
  errorButton: {
    minWidth: 160,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textOnDark,
  },
});
