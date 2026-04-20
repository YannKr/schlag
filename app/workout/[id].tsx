/**
 * Workout Screen — Signal direction.
 *
 * Full-bleed interval-color background. Three-up header (sequence · interval
 * glyph+name · round count) above a huge DSEG7 MM:SS timer, slim progress
 * line with elapsed/remaining row, and a "Next" + circular controls footer.
 *
 * All timer logic (state machine, rest transitions, session persistence,
 * camera rep tracking, keyboard shortcuts) is unchanged — this file redresses
 * the visual layer only.
 *
 * Route: /workout/[id]
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path, Polygon, Rect } from 'react-native-svg';

import { AnimatedCountdown } from '@/components/AnimatedCountdown';
import { Glyph } from '@/components/Glyph';
import { useIntensity } from '@/hooks/useIntensity';
import { useRepTracking } from '@/hooks/useRepTracking';
import { CameraPreview } from '@/components/CameraPreview';
import { RepCountDisplay } from '@/components/RepCountDisplay';

import {
  SIGNAL,
  getIntervalByHex,
  getTextColorForInterval,
  normalizeIntervalHex,
} from '@/constants/colors';
import { LAYOUT, SPACING } from '@/constants/layout';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  LINE_HEIGHT,
} from '@/constants/typography';

import { useTimerLoop } from '@/hooks/useTimerLoop';
import { useSequenceStore } from '@/stores/sequenceStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';

import type { Interval, TimelineEntry } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTimeline(
  intervals: Interval[],
  currentIntervalIndex: number,
  currentRound: number,
  totalRounds: number,
  restBetweenSets: number,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (let i = currentIntervalIndex + 1; i < intervals.length; i++) {
    entries.push({
      interval: intervals[i],
      round: currentRound,
      indexInRound: i,
      isRestBetweenSets: false,
    });
  }

  if (totalRounds > 0) {
    for (let round = currentRound + 1; round <= totalRounds; round++) {
      if (restBetweenSets > 0) {
        entries.push({
          interval: {
            id: `rest-${round}`,
            name: 'Rest',
            duration_seconds: restBetweenSets,
            color: '#5F6877',
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
// Sub-views
// ---------------------------------------------------------------------------

function HeaderGrid({
  sequenceName,
  interval,
  currentRound,
  totalRounds,
  textColor,
  mutedOnColor,
  isRest,
}: {
  sequenceName: string;
  interval: Interval;
  currentRound: number;
  totalRounds: number;
  textColor: string;
  mutedOnColor: string;
  isRest: boolean;
}) {
  const paletteEntry = getIntervalByHex(interval.color);
  const glyph = paletteEntry?.glyph ?? 'circle';
  const intervalLabel = isRest
    ? 'REST'
    : (paletteEntry?.label ?? interval.name).toUpperCase();
  const roundLabel =
    totalRounds === 0
      ? `${String(currentRound).padStart(2, '0')} / ∞`
      : `${String(currentRound).padStart(2, '0')} / ${String(totalRounds).padStart(2, '0')}`;

  return (
    <View style={[styles.headerGrid, { borderBottomColor: mutedOnColor }]}>
      <Text
        style={[styles.headerLeft, { color: textColor }]}
        numberOfLines={1}
      >
        {sequenceName}
      </Text>
      <View style={styles.headerCenter}>
        <Glyph kind={glyph} size={10} color={textColor} opacity={0.9} />
        <Text style={[styles.headerCenterText, { color: textColor }]}>
          {intervalLabel}
        </Text>
      </View>
      <Text style={[styles.headerRight, { color: textColor }]}>
        {roundLabel}
      </Text>
    </View>
  );
}

function NextUp({
  nextInterval,
  textColor,
  mutedOnColor,
}: {
  nextInterval: Interval | null;
  textColor: string;
  mutedOnColor: string;
}) {
  if (!nextInterval) {
    return (
      <View style={styles.nextColumn}>
        <Text style={[styles.nextLabel, { color: mutedOnColor }]}>NEXT</Text>
        <Text style={[styles.nextValue, { color: textColor }]}>Last set</Text>
      </View>
    );
  }
  return (
    <View style={styles.nextColumn}>
      <Text style={[styles.nextLabel, { color: mutedOnColor }]}>NEXT</Text>
      <Text
        style={[styles.nextValue, { color: textColor }]}
        numberOfLines={1}
      >
        {nextInterval.name.toUpperCase()} · {formatDuration(nextInterval.duration_seconds)}
      </Text>
    </View>
  );
}

type RingIcon = 'play' | 'pause' | 'skip' | 'stop' | 'expand' | 'finish-round';

function RingGlyph({ icon, color, size }: { icon: RingIcon; color: string; size: number }) {
  // Icon artwork normalized to a 24x24 viewBox.
  const s = size;
  switch (icon) {
    case 'play':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Polygon points="8,5 20,12 8,19" fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x="7" y="5" width="3.5" height="14" fill={color} />
          <Rect x="13.5" y="5" width="3.5" height="14" fill={color} />
        </Svg>
      );
    case 'skip':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Polygon points="5,5 15,12 5,19" fill={color} />
          <Rect x="16.5" y="5" width="2.5" height="14" fill={color} />
        </Svg>
      );
    case 'stop':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path
            d="M6.2 6.2 L17.8 17.8 M17.8 6.2 L6.2 17.8"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'expand':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path
            d="M12 4 L12 16 M7 11 L12 16 L17 11"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Rect x="5" y="18.5" width="14" height="1.8" fill={color} />
        </Svg>
      );
    case 'finish-round':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path
            d="M18 4 L18 10 Q18 14 14 14 L7 14 M11 10 L7 14 L11 18"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
  }
}

function RingButton({
  icon,
  onPress,
  accessibilityLabel,
  solid = false,
  textColor,
  size = 44,
}: {
  icon: RingIcon;
  onPress: () => void;
  accessibilityLabel: string;
  solid?: boolean;
  textColor: string;
  size?: number;
}) {
  const iconSize = size * 0.5;
  const iconColor = solid ? '#141416' : textColor;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: solid ? '#FFFFFF' : 'transparent',
          borderWidth: solid ? 0 : 1.5,
          borderColor: 'rgba(255,255,255,0.75)',
          opacity: pressed ? 0.65 : 1,
        },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
    >
      <RingGlyph icon={icon} color={iconColor} size={iconSize} />
    </Pressable>
  );
}

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

function WorkoutCompleteScreen({
  onDone,
  elapsedSeconds,
  totalIntervals,
  roundsCompleted,
  totalRounds,
}: {
  onDone: () => void;
  elapsedSeconds: number;
  totalIntervals: number;
  roundsCompleted: number;
  totalRounds: number;
}) {
  const [visibleStats, setVisibleStats] = useState(0);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setVisibleStats(1), 600));
    timers.push(setTimeout(() => setVisibleStats(2), 800));
    timers.push(setTimeout(() => setVisibleStats(3), 1000));
    timers.push(setTimeout(() => setVisibleStats(4), 1200));
    timers.push(setTimeout(() => setShowButton(true), 1400));
    return () => timers.forEach(clearTimeout);
  }, []);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const stats = [
    { label: 'TOTAL TIME', value: formatElapsed(elapsedSeconds) },
    { label: 'ROUNDS', value: totalRounds > 0 ? `${roundsCompleted}/${totalRounds}` : String(roundsCompleted) },
    { label: 'INTERVALS', value: String(totalIntervals) },
    { label: 'COMPLETED', value: '100%' },
  ];

  return (
    <View style={styles.completeContainer}>
      <Text style={styles.completeEyebrow}>WORKOUT</Text>
      <Text style={styles.completeTitle}>Complete.</Text>
      <Text style={styles.completeSubtitle}>Great work. You crushed it.</Text>

      <View style={styles.statsGrid}>
        {stats.map((stat, i) => (
          <View
            key={stat.label}
            style={[styles.statItem, { opacity: i < visibleStats ? 1 : 0 }]}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {showButton && (
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Return to library"
          style={({ pressed }) => [
            styles.completeButton,
            pressed && styles.completeButtonPressed,
          ]}
        >
          <Text style={styles.completeButtonText}>＋ DONE</Text>
        </Pressable>
      )}
    </View>
  );
}

function TimelineRow({
  entry,
  textColor,
  mutedOnColor,
}: {
  entry: TimelineEntry;
  textColor: string;
  mutedOnColor: string;
}) {
  const paletteEntry = getIntervalByHex(entry.interval.color);
  const glyph = paletteEntry?.glyph ?? 'circle';
  const label = entry.isRestBetweenSets ? 'REST' : entry.interval.name;
  return (
    <View style={[styles.timelineRow, { borderBottomColor: mutedOnColor }]}>
      <View
        style={[
          styles.timelineColorBar,
          { backgroundColor: normalizeIntervalHex(entry.interval.color) },
        ]}
      />
      <Glyph kind={glyph} size={8} color={textColor} opacity={0.7} />
      <Text
        style={[styles.timelineName, { color: textColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {entry.round > 0 && (
        <Text style={[styles.timelineRound, { color: mutedOnColor }]}>
          R{entry.round}
        </Text>
      )}
      <Text style={[styles.timelineDuration, { color: textColor }]}>
        {formatDuration(entry.interval.duration_seconds)}
      </Text>
    </View>
  );
}

function TimelineList({
  entries,
  textColor,
  mutedOnColor,
}: {
  entries: TimelineEntry[];
  textColor: string;
  mutedOnColor: string;
}) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TimelineEntry>) => (
      <TimelineRow entry={item} textColor={textColor} mutedOnColor={mutedOnColor} />
    ),
    [textColor, mutedOnColor],
  );

  const keyExtractor = useCallback(
    (item: TimelineEntry, index: number) =>
      `${item.interval.id}-${item.round}-${index}`,
    [],
  );

  if (entries.length === 0) {
    return (
      <View style={styles.timelineEmpty}>
        <Text style={[styles.timelineEmptyText, { color: mutedOnColor }]}>
          Last interval
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.timelineContainer, { borderTopColor: mutedOnColor }]}>
      <Text style={[styles.timelineHeader, { color: mutedOnColor }]}>UP NEXT</Text>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.timelineListFlat}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
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

  useWakeLock(true);

  const settings = useSettingsStore((s) => s.settings);
  const getSequenceById = useSequenceStore((s) => s.getSequenceById);
  const updateSequence = useSequenceStore((s) => s.updateSequence);
  const setActive = useTimerStore((s) => s.setActive);
  const setInactive = useTimerStore((s) => s.setInactive);
  const storeUpdateTick = useTimerStore((s) => s.updateTick);
  const toggleExpanded = useTimerStore((s) => s.toggleExpanded);
  const isExpanded = useTimerStore((s) => s.isExpanded);

  const startSession = useSessionStore((s) => s.startSession);
  const completeSession = useSessionStore((s) => s.completeSession);
  const stopSessionLog = useSessionStore((s) => s.stopSession);
  const addPause = useSessionStore((s) => s.addPause);
  const recordResume = useSessionStore((s) => s.recordResume);

  const timerLoop = useTimerLoop();
  const intensity = useIntensity(timerLoop.tickData);
  const repTracking = useRepTracking(timerLoop.tickData);

  const [showTapToContinue, setShowTapToContinue] = useState(false);
  const [getReadyRemaining, setGetReadyRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const sequenceRef = useRef(getSequenceById(id ?? ''));
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  // Startup.
  useEffect(() => {
    if (hasStartedRef.current || !id) return;

    const sequence = getSequenceById(id);
    if (!sequence) {
      setError('Sequence not found.');
      return;
    }

    hasStartedRef.current = true;
    sequenceRef.current = sequence;

    setActive(id);
    updateSequence(id, { last_used_at: new Date().toISOString() });

    sessionIdRef.current = startSession(sequence);
    startedAtRef.current = Date.now();

    timerLoop
      .restore(sequence)
      .then((restored) => {
        if (!restored) {
          const readySecs = settings.getReadySeconds;
          if (readySecs > 0) {
            setGetReadyRemaining(readySecs);
          } else {
            return timerLoop.start(sequence);
          }
        }
      })
      .catch(() => setError('Failed to start workout.'));

    return () => {
      setInactive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Get-ready countdown.
  useEffect(() => {
    if (getReadyRemaining === null || getReadyRemaining < 0) return;

    if (getReadyRemaining === 0) {
      setGetReadyRemaining(null);
      const sequence = sequenceRef.current;
      if (sequence) timerLoop.start(sequence);
      return;
    }

    const timer = setTimeout(() => {
      setGetReadyRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [getReadyRemaining, timerLoop]);

  const { tickData } = timerLoop;
  const tickDataRef = useRef(tickData);
  useEffect(() => {
    tickDataRef.current = tickData;
  }, [tickData]);

  useEffect(() => {
    if (tickData) storeUpdateTick(tickData);
  }, [tickData, storeUpdateTick]);

  // Web: update document.title with countdown.
  useEffect(() => {
    if (Platform.OS !== 'web' || !tickData) return;

    if (tickData.status === 'running' || tickData.status === 'paused') {
      const statusSuffix = tickData.status === 'paused' ? ' (Paused)' : '';
      document.title = `${tickData.formattedTime} – ${tickData.currentInterval.name}${statusSuffix} | Schlag`;
    } else if (tickData.status === 'completed') {
      document.title = 'Workout Complete | Schlag';
    }

    return () => {
      document.title = 'Schlag';
    };
  }, [tickData]);

  // Auto-advance OFF: show tap overlay when remaining hits 0.
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

  // Controls.
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
      const td = tickDataRef.current;
      if (sessionIdRef.current && td) {
        const elapsedSeconds = Math.floor(
          (Date.now() - startedAtRef.current) / 1000,
        );
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
      if (window.confirm('Stop this workout? All progress will be lost.')) {
        doStop();
      }
    } else {
      Alert.alert('Stop Workout', 'Are you sure? All progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: doStop },
      ]);
    }
  }, [timerLoop, setInactive, router, stopSessionLog]);

  const handleFinishAfterRound = useCallback(() => {
    timerLoop.finishAfterRound();
  }, [timerLoop]);

  const handleToggleExpanded = useCallback(() => {
    toggleExpanded();
  }, [toggleExpanded]);

  const handleDone = useCallback(() => {
    const td = tickDataRef.current;
    if (sessionIdRef.current && td) {
      const elapsedSeconds = Math.floor(
        (Date.now() - startedAtRef.current) / 1000,
      );
      completeSession(sessionIdRef.current, {
        intervals_completed: td.totalIntervals,
        rounds_completed:
          td.totalRounds > 0 ? td.totalRounds : td.currentRound,
        total_active_seconds: elapsedSeconds,
        total_rest_seconds: 0,
      });
    }
    timerLoop.stop();
    setInactive();
    router.back();
  }, [timerLoop, setInactive, router, completeSession]);

  // Full-bleed interval color — Signal drops the old theme options.
  const intervalHex = normalizeIntervalHex(
    tickData?.currentInterval.color ?? SIGNAL.accent,
  );
  const backgroundColor = intervalHex;
  const textColor = getTextColorForInterval(intervalHex);
  const mutedOnColor =
    textColor === '#FFFFFF' ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)';
  const statusBarStyle =
    textColor === '#FFFFFF' ? ('light-content' as const) : ('dark-content' as const);

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

  const isDesktopWeb =
    Platform.OS === 'web' && windowWidth >= LAYOUT.webBreakpoint;
  const webContainerStyle: StyleProp<ViewStyle> = isDesktopWeb
    ? {
        maxWidth: LAYOUT.webMaxWidth,
        alignSelf: 'center' as const,
        width: '100%' as unknown as number,
      }
    : undefined;

  // Error.
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: SIGNAL.ink }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.errorButton,
              pressed && styles.errorButtonPressed,
            ]}
          >
            <Text style={styles.errorButtonText}>BACK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Get-ready.
  if (getReadyRemaining !== null && getReadyRemaining > 0) {
    const sequenceName = sequenceRef.current?.name ?? '';
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: SIGNAL.ink, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.getReadyContainer}>
          <Text style={styles.getReadyEyebrow}>GET READY</Text>
          <Text style={styles.getReadyCountdown}>{getReadyRemaining}</Text>
          <Text style={styles.getReadySequenceName}>{sequenceName}</Text>
        </View>
      </View>
    );
  }

  // Loading.
  if (!tickData) {
    return (
      <View style={[styles.container, { backgroundColor: SIGNAL.ink }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Starting workout…</Text>
        </View>
      </View>
    );
  }

  // Complete.
  if (tickData.status === 'completed') {
    const elapsedSeconds = Math.floor(
      (Date.now() - startedAtRef.current) / 1000,
    );
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: SIGNAL.paper, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle="dark-content" />
        <WorkoutCompleteScreen
          onDone={handleDone}
          elapsedSeconds={elapsedSeconds}
          totalIntervals={tickData.totalIntervals}
          roundsCompleted={
            tickData.totalRounds > 0 ? tickData.totalRounds : tickData.currentRound
          }
          totalRounds={tickData.totalRounds}
        />
      </View>
    );
  }

  // Active.
  const {
    currentInterval,
    currentRound,
    totalRounds,
    progress,
    formattedTime,
    nextInterval,
    isRestBetweenSets,
    status,
  } = tickData;

  const isRunningOrPaused = status === 'running' || status === 'paused';
  const isPaused = status === 'paused';
  const isInfinite = totalRounds === 0;
  const intervalNameBig = isRestBetweenSets
    ? 'REST'
    : (currentInterval.name || 'WORK').toUpperCase();

  const timerFontSize = isDesktopWeb
    ? FONT_SIZE.countdownLarge
    : FONT_SIZE.countdownMedium;
  const intervalNameSize = isDesktopWeb
    ? FONT_SIZE.intervalNameLarge
    : FONT_SIZE.intervalNameSmall;

  // Compute elapsed/remaining timestamps for the progress meta row.
  const totalSec = currentInterval.duration_seconds;
  const elapsedSec = Math.max(0, totalSec - Math.ceil(tickData.remainingMs / 1000));
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const pct = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle={statusBarStyle} />

      <View style={[styles.contentArea, webContainerStyle]}>
        {/* Camera overlay (unchanged) */}
        <CameraPreview
          videoRef={repTracking.videoRef}
          isTracking={repTracking.isTracking}
          showNoPoseHint={repTracking.showNoPoseHint}
          visible={
            settings.cameraEnabled &&
            settings.showCameraPreview &&
            !!tickData?.currentInterval?.exercise_type &&
            !tickData?.isRestBetweenSets
          }
          isMirrored={settings.cameraPosition === 'front'}
        />

        <HeaderGrid
          sequenceName={sequenceRef.current?.name ?? ''}
          interval={currentInterval}
          currentRound={currentRound}
          totalRounds={totalRounds}
          textColor={textColor}
          mutedOnColor={mutedOnColor}
          isRest={isRestBetweenSets}
        />

        {/* Center: huge DSEG7 + interval name */}
        <View style={styles.centerSection}>
          <AnimatedCountdown
            formattedTime={formattedTime}
            remainingMs={tickData.remainingMs}
            textColor={textColor}
            glowColor={textColor}
            act={intensity.act}
            fontSize={timerFontSize}
            fontFamily={FONT_FAMILY.seven}
            letterSpacing={
              isDesktopWeb ? LETTER_SPACING.sevenLarge : LETTER_SPACING.seven
            }
            reduceMotion={intensity.reduceMotion}
          />

          <Text
            style={[
              styles.intervalName,
              {
                color: textColor,
                fontSize: intervalNameSize,
                lineHeight: intervalNameSize * LINE_HEIGHT.intervalName,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            accessibilityLabel={`Current interval: ${currentInterval.name}`}
          >
            {intervalNameBig}
          </Text>

          {/* Rep count from camera tracking */}
          <RepCountDisplay
            repCount={repTracking.repCount}
            isTracking={repTracking.isTracking}
            visible={
              settings.cameraEnabled &&
              !!tickData?.currentInterval?.exercise_type &&
              !tickData?.isRestBetweenSets
            }
          />

          {!!currentInterval.note && (
            <Text
              style={[styles.coachingNote, { color: mutedOnColor }]}
              numberOfLines={2}
            >
              {currentInterval.note}
            </Text>
          )}
        </View>

        {/* Progress line + elapsed/remaining */}
        <View style={styles.progressBlock}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: 'rgba(255,255,255,0.3)' },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${pct * 100}%`, backgroundColor: textColor },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[styles.progressMetaText, { color: mutedOnColor }]}>
              {formatDuration(elapsedSec)}
            </Text>
            <Text style={[styles.progressMetaText, { color: mutedOnColor }]}>
              −{formatDuration(remainingSec)}
            </Text>
          </View>
        </View>

        {/* Expanded timeline list */}
        {isExpanded && (
          <TimelineList
            entries={timelineEntries}
            textColor={textColor}
            mutedOnColor={mutedOnColor}
          />
        )}

        {/* Footer: next + ring controls */}
        {isRunningOrPaused && (
          <View style={[styles.footer, { borderTopColor: mutedOnColor }]}>
            <NextUp
              nextInterval={nextInterval}
              textColor={textColor}
              mutedOnColor={mutedOnColor}
            />
            <View style={styles.ringGroup}>
              <RingButton
                icon="expand"
                onPress={handleToggleExpanded}
                accessibilityLabel={
                  isExpanded ? 'Switch to compact view' : 'Switch to expanded view'
                }
                textColor={textColor}
              />
              <RingButton
                icon={isPaused ? 'play' : 'pause'}
                onPress={isPaused ? handleResume : handlePause}
                accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}
                solid
                textColor={textColor}
              />
              {isInfinite ? (
                <RingButton
                  icon="finish-round"
                  onPress={handleFinishAfterRound}
                  accessibilityLabel="Finish after current round"
                  textColor={textColor}
                />
              ) : (
                <RingButton
                  icon="skip"
                  onPress={handleSkip}
                  accessibilityLabel="Skip to next interval"
                  textColor={textColor}
                />
              )}
              <RingButton
                icon="stop"
                onPress={handleStop}
                accessibilityLabel="Stop workout"
                textColor={textColor}
              />
            </View>
          </View>
        )}
      </View>

      {showTapToContinue && <TapToContinueOverlay onTap={handleTapToContinue} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1, overflow: 'hidden' },

  // Header grid
  headerGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerCenterText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 1.5,
    opacity: 0.95,
  },
  headerRight: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.5,
    opacity: 0.9,
  },

  // Center
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  intervalName: {
    fontFamily: FONT_FAMILY.display,
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
    letterSpacing: LETTER_SPACING.displayTight,
    textTransform: 'uppercase',
  },
  coachingNote: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
  },

  // Progress
  progressBlock: {
    paddingHorizontal: SPACING.xl,
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  progressMetaText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow + 1,
    letterSpacing: 0.5,
    opacity: 0.85,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  nextColumn: {
    flexShrink: 1,
    minWidth: 0,
  },
  nextLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: 2,
  },
  nextValue: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body + 1,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.2,
  },
  ringGroup: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },

  // Tap-to-continue overlay
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,22,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  tapOverlayContent: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  tapOverlayText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayLarge,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#FFFFFF',
    letterSpacing: LETTER_SPACING.displayTight,
  },
  tapOverlaySubtext: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    color: 'rgba(255,255,255,0.7)',
  },

  // Complete screen
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  completeEyebrow: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    color: SIGNAL.accent,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.md,
  },
  completeTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayHero,
    fontWeight: FONT_WEIGHT.semibold,
    color: SIGNAL.ink,
    textAlign: 'center',
    letterSpacing: LETTER_SPACING.displayHero,
  },
  completeSubtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: SIGNAL.mutedInk,
    textAlign: 'center',
    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
  },
  completeButton: {
    marginTop: SPACING.xl,
    borderWidth: 1.5,
    borderColor: SIGNAL.ink,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  completeButtonPressed: { backgroundColor: SIGNAL.ink },
  completeButtonText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.5,
    color: SIGNAL.ink,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginTop: SPACING.xl,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statValue: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.displayMedium,
    color: SIGNAL.ink,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    color: SIGNAL.mutedInk,
    letterSpacing: LETTER_SPACING.eyebrow,
    marginTop: 2,
  },

  // Timeline
  timelineContainer: {
    maxHeight: 200,
    marginTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  timelineHeader: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: LETTER_SPACING.eyebrow,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  timelineListFlat: { flex: 1 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timelineColorBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 20,
  },
  timelineName: {
    flex: 1,
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.2,
  },
  timelineRound: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.caption,
  },
  timelineDuration: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.body,
    letterSpacing: 0.5,
  },
  timelineEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  timelineEmptyText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    fontStyle: 'italic',
  },

  // Error
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
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorButton: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    minWidth: 160,
    alignItems: 'center',
  },
  errorButtonPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  errorButtonText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    color: '#FFFFFF',
  },

  // Get-ready
  getReadyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  getReadyEyebrow: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    fontWeight: FONT_WEIGHT.semibold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: LETTER_SPACING.eyebrow,
    textTransform: 'uppercase',
  },
  getReadyCountdown: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.countdownLarge,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FONT_SIZE.countdownLarge * LINE_HEIGHT.countdown,
    letterSpacing: LETTER_SPACING.sevenLarge,
  },
  getReadySequenceName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
