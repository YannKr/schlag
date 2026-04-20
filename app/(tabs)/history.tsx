/**
 * History Tab — Signal direction.
 *
 * Editorial dashboard (streak eyebrow + four-up meta grid) above an indexed
 * session list grouped by Today / Yesterday / This Week / Earlier. Flat rows,
 * tracked eyebrows, DSEG7 durations — matches Library/Builder language.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewStyle,
} from 'react-native';

import { useSessionStore } from '@/stores/sessionStore';
import { SIGNAL } from '@/constants/colors';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
} from '@/constants/typography';
import { SPACING } from '@/constants/layout';
import type { WorkoutSession } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getDateGroup(dateKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().substring(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().substring(0, 10);

  const weekStart = new Date(today);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  const weekStartKey = weekStart.toISOString().substring(0, 10);

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  if (dateKey >= weekStartKey) return 'This Week';
  return 'Earlier';
}

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

interface SectionItem {
  type: 'header' | 'session';
  key: string;
  title?: string;
  session?: WorkoutSession;
  indexInGroup?: number;
}

function buildSectionData(
  grouped: Map<string, WorkoutSession[]>,
): SectionItem[] {
  const items: SectionItem[] = [];
  const groups = new Map<string, { dateKey: string; sessions: WorkoutSession[] }[]>();

  for (const [dateKey, sessions] of grouped) {
    const group = getDateGroup(dateKey);
    const existing = groups.get(group);
    if (existing) {
      existing.push({ dateKey, sessions });
    } else {
      groups.set(group, [{ dateKey, sessions }]);
    }
  }

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

  for (const groupName of groupOrder) {
    const dateEntries = groups.get(groupName);
    if (!dateEntries || dateEntries.length === 0) continue;

    items.push({ type: 'header', key: `header-${groupName}`, title: groupName });

    dateEntries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    let idx = 0;
    for (const { sessions } of dateEntries) {
      for (const session of sessions) {
        items.push({
          type: 'session',
          key: session.id,
          session,
          indexInGroup: idx++,
        });
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Dashboard — four-up Signal meta grid
// ---------------------------------------------------------------------------

interface DashboardProps {
  streak: number;
  weekSummary: { sessions: number; activeSeconds: number; restSeconds: number };
  workRestRatio: number;
  mostUsed: { name: string; count: number } | null;
}

function AnalyticsDashboard({
  streak,
  weekSummary,
  workRestRatio,
  mostUsed,
}: DashboardProps) {
  const ratioText =
    workRestRatio === Infinity
      ? 'ALL WORK'
      : workRestRatio === 0
        ? '—'
        : `${workRestRatio}:1`;

  return (
    <View>
      {/* Streak — eyebrow row */}
      <View style={styles.streakRow}>
        <Text style={styles.streakLabel}>
          {streak > 0 ? `${streak}-day streak` : 'No current streak'}
        </Text>
      </View>

      {/* Four-up meta grid */}
      <View style={styles.metaGrid}>
        <View style={[styles.metaCell, styles.metaCellBorder]}>
          <Text style={styles.metaLabel}>Sessions</Text>
          <Text style={styles.metaValue}>{weekSummary.sessions}</Text>
          <Text style={styles.metaUnit}>this week</Text>
        </View>
        <View style={[styles.metaCell, styles.metaCellBorder]}>
          <Text style={styles.metaLabel}>Work</Text>
          <Text style={styles.metaValue}>
            {formatDuration(weekSummary.activeSeconds)}
          </Text>
          <Text style={styles.metaUnit}>active time</Text>
        </View>
        <View style={[styles.metaCell, styles.metaCellBorder]}>
          <Text style={styles.metaLabel}>Rest</Text>
          <Text style={styles.metaValue}>
            {formatDuration(weekSummary.restSeconds)}
          </Text>
          <Text style={styles.metaUnit}>rest time</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Work:Rest</Text>
          <Text style={styles.metaValue}>{ratioText}</Text>
          <Text style={styles.metaUnit}>this week</Text>
        </View>
      </View>

      {/* Most-used row */}
      <View style={styles.mostUsedRow}>
        <Text style={styles.eyebrow}>Most used</Text>
        <Text style={styles.mostUsedValue} numberOfLines={1}>
          {mostUsed ? mostUsed.name : '—'}
        </Text>
        <Text style={styles.mostUsedMeta}>
          {mostUsed ? `×${mostUsed.count} this month` : ''}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Session Row — indexed list row
// ---------------------------------------------------------------------------

interface SessionRowProps {
  session: WorkoutSession;
  index: number;
  onLongPress: (session: WorkoutSession) => void;
}

const SessionRow = React.memo<SessionRowProps>(({ session, index, onLongPress }) => {
  const totalSeconds =
    session.total_active_seconds + session.total_rest_seconds;
  const isCompleted = session.status === 'completed';
  const name = session.sequence_snapshot?.name ?? '(deleted sequence)';

  const handleLongPress = useCallback(() => onLongPress(session), [
    onLongPress,
    session,
  ]);

  return (
    <Pressable
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${formatDuration(totalSeconds)}. ${isCompleted ? 'Completed' : 'Stopped early'}. Long press to delete.`}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
      ]}
    >
      <Text style={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>
      <View
        style={[
          styles.rowAccent,
          { backgroundColor: isCompleted ? SIGNAL.accent : SIGNAL.mutedInk },
        ]}
      />

      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowMeta}>
            {formatTime(session.started_at)}
          </Text>
          {session.rounds_completed > 0 && (
            <>
              <Text style={styles.rowMetaDot}>·</Text>
              <Text style={styles.rowMeta}>
                {session.rounds_completed}{' '}
                {session.rounds_completed === 1 ? 'round' : 'rounds'}
              </Text>
            </>
          )}
        </View>
      </View>

      <Text
        style={[
          styles.rowStatus,
          isCompleted ? styles.rowStatusDone : styles.rowStatusStopped,
        ]}
      >
        {isCompleted ? 'DONE' : 'STOP'}
      </Text>
      <Text style={styles.rowDuration}>{formatDuration(totalSeconds)}</Text>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>∅</Text>
      <Text style={styles.emptyTitle}>No sessions yet</Text>
      <Text style={styles.emptySubtitle}>
        Finish a workout and it'll log here.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HistoryScreen() {
  const loadSessions = useSessionStore((s) => s.loadFromStorage);
  const isLoaded = useSessionStore((s) => s.isLoaded);
  const sessions = useSessionStore((s) => s.sessions);
  const getActiveSessions = useSessionStore((s) => s.getActiveSessions);
  const getSessionsGroupedByDate = useSessionStore(
    (s) => s.getSessionsGroupedByDate,
  );
  const getCurrentStreak = useSessionStore((s) => s.getCurrentStreak);
  const getWeekSummary = useSessionStore((s) => s.getWeekSummary);
  const getWorkRestRatio = useSessionStore((s) => s.getWorkRestRatio);
  const getMostUsedSequence = useSessionStore((s) => s.getMostUsedSequence);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  useEffect(() => {
    if (!isLoaded) loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSessions = useMemo(() => {
    void sessions;
    return getActiveSessions();
  }, [sessions, getActiveSessions]);

  const streak = useMemo(() => {
    void sessions;
    return getCurrentStreak();
  }, [sessions, getCurrentStreak]);

  const weekSummary = useMemo(() => {
    void sessions;
    return getWeekSummary();
  }, [sessions, getWeekSummary]);

  const workRestRatio = useMemo(() => {
    void sessions;
    return getWorkRestRatio();
  }, [sessions, getWorkRestRatio]);

  const mostUsed = useMemo(() => {
    void sessions;
    return getMostUsedSequence();
  }, [sessions, getMostUsedSequence]);

  const sectionData = useMemo(() => {
    void sessions;
    const grouped = getSessionsGroupedByDate();
    return buildSectionData(grouped);
  }, [sessions, getSessionsGroupedByDate]);

  const handleLongPress = useCallback(
    (session: WorkoutSession) => {
      const name = session.sequence_snapshot?.name ?? 'this session';
      if (Platform.OS === 'web') {
        const confirmed = confirm(`Delete "${name}" session?`);
        if (confirmed) deleteSession(session.id);
        return;
      }
      Alert.alert(
        'Delete Session',
        `Delete "${name}" session from ${formatShortDate(session.started_at)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteSession(session.id),
          },
        ],
      );
    },
    [deleteSession],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SectionItem>) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
          </View>
        );
      }

      if (item.session) {
        return (
          <SessionRow
            session={item.session}
            index={item.indexInGroup ?? 0}
            onLongPress={handleLongPress}
          />
        );
      }
      return null;
    },
    [handleLongPress],
  );

  const keyExtractor = useCallback((item: SectionItem) => item.key, []);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Editorial header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>
          {activeSessions.length === 0
            ? 'No sessions logged yet.'
            : `${activeSessions.length} ${activeSessions.length === 1 ? 'session' : 'sessions'} logged.`}
        </Text>
      </View>

      {activeSessions.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={sectionData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <AnalyticsDashboard
              streak={streak}
              weekSummary={weekSummary}
              workRestRatio={workRestRatio}
              mostUsed={mostUsed}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SIGNAL.paper },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SIGNAL.paper,
  },
  loadingText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: SIGNAL.mutedInk,
  },
  listContent: { paddingBottom: 40 },

  // Editorial header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  headerTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayHero,
    fontWeight: FONT_WEIGHT.semibold,
    color: SIGNAL.ink,
    letterSpacing: -1.5,
    lineHeight: FONT_SIZE.displayHero * 1.0,
  },
  headerSubtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodySmall,
    color: SIGNAL.mutedInk,
    marginTop: SPACING.xs,
  },

  // Streak
  streakRow: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  streakLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    color: SIGNAL.accent,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Four-up meta grid
  metaGrid: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  metaCell: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minWidth: 0,
  },
  metaCellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SIGNAL.divider,
  },
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
  metaUnit: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    color: SIGNAL.mutedInk,
    marginTop: 2,
  },

  // Most used
  mostUsedRow: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
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
    marginBottom: 4,
  },
  mostUsedValue: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.medium,
    color: SIGNAL.ink,
    letterSpacing: -0.3,
  },
  mostUsedMeta: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    marginTop: 2,
  },

  // Section headers
  sectionHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  sectionHeaderText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
  },

  // Session row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md - 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SIGNAL.divider,
    gap: SPACING.md,
    backgroundColor: SIGNAL.paper,
  },
  rowPressed: { backgroundColor: '#F2EFE8' },
  rowIndex: {
    width: 24,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
  },
  rowAccent: { width: 4, alignSelf: 'stretch', minHeight: 32 },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body + 1,
    fontWeight: FONT_WEIGHT.medium,
    color: SIGNAL.ink,
    letterSpacing: -0.1,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rowMeta: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    letterSpacing: 0.2,
  },
  rowMetaDot: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    marginHorizontal: 2,
  },
  rowStatus: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    fontWeight: FONT_WEIGHT.semibold,
  },
  rowStatusDone: { color: SIGNAL.mutedInk },
  rowStatusStopped: { color: SIGNAL.accent, opacity: 0.8 },
  rowDuration: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.body + 1,
    color: SIGNAL.ink,
    letterSpacing: 0.5,
    minWidth: 56,
    textAlign: 'right',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIcon: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 72,
    color: SIGNAL.divider,
    marginBottom: SPACING.lg,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: 72,
  },
  emptyTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.displayMedium,
    fontWeight: FONT_WEIGHT.semibold,
    color: SIGNAL.ink,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  emptySubtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: SIGNAL.mutedInk,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: FONT_SIZE.body * 1.5,
    maxWidth: 280,
  },
});
