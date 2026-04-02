/**
 * History Tab for Schlag (v2).
 *
 * Displays an analytics dashboard (streak, weekly stats, work:rest ratio,
 * most-used sequence) and a chronological list of workout sessions grouped
 * by date. Sessions can be soft-deleted via long-press.
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
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSessionStore } from '@/stores/sessionStore';
import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { LAYOUT, SPACING } from '@/constants/layout';
import type { WorkoutSession } from '@/types';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format seconds into MM:SS or H:MM:SS. */
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

/** Format an ISO date string to a short time like "2:34 PM". */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/** Format an ISO date string to a short date like "Mar 7". */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** Categorize a YYYY-MM-DD date key into a display group. */
function getDateGroup(dateKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().substring(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().substring(0, 10);

  // Start of week (Monday).
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
// Section list data builder
// ---------------------------------------------------------------------------

interface SectionItem {
  type: 'header' | 'session';
  key: string;
  title?: string;
  session?: WorkoutSession;
}

function buildSectionData(
  grouped: Map<string, WorkoutSession[]>,
): SectionItem[] {
  const items: SectionItem[] = [];

  // Group date keys by display group.
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

  // Render in order: Today, Yesterday, This Week, Earlier.
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

  for (const groupName of groupOrder) {
    const dateEntries = groups.get(groupName);
    if (!dateEntries || dateEntries.length === 0) continue;

    items.push({ type: 'header', key: `header-${groupName}`, title: groupName });

    // Sort date entries within the group (most recent first).
    dateEntries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    for (const { sessions } of dateEntries) {
      for (const session of sessions) {
        items.push({ type: 'session', key: session.id, session });
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Analytics Dashboard
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
  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardRow}>
        {/* Streak */}
        <View style={[styles.statCard, styles.statCardWide]}>
          <Text style={styles.statEmoji}>{'\uD83D\uDD25'}</Text>
          <Text style={styles.statValue}>
            {streak > 0 ? `${streak}-day streak` : 'No streak'}
          </Text>
        </View>
      </View>

      <View style={styles.dashboardRow}>
        {/* Sessions this week */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>{weekSummary.sessions}</Text>
          <Text style={styles.statUnit}>
            {weekSummary.sessions === 1 ? 'session' : 'sessions'}
          </Text>
        </View>

        {/* Active time */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>
            {formatDuration(weekSummary.activeSeconds)}
          </Text>
          <Text style={styles.statUnit}>work time</Text>
        </View>

        {/* Rest time */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rest</Text>
          <Text style={styles.statValue}>
            {formatDuration(weekSummary.restSeconds)}
          </Text>
          <Text style={styles.statUnit}>rest time</Text>
        </View>
      </View>

      <View style={styles.dashboardRow}>
        {/* Work:Rest ratio */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Work:Rest</Text>
          <Text style={styles.statValue}>
            {workRestRatio === Infinity
              ? 'All work'
              : workRestRatio === 0
                ? '--'
                : `${workRestRatio}:1`}
          </Text>
          <Text style={styles.statUnit}>this week</Text>
        </View>

        {/* Most used sequence */}
        <View style={[styles.statCard, styles.statCardFlex2]}>
          <Text style={styles.statLabel}>Most Used</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {mostUsed ? mostUsed.name : '--'}
          </Text>
          <Text style={styles.statUnit}>
            {mostUsed ? `${mostUsed.count}x this month` : 'this month'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Session Card
// ---------------------------------------------------------------------------

interface SessionCardProps {
  session: WorkoutSession;
  onLongPress: (session: WorkoutSession) => void;
}

const SessionCard = React.memo<SessionCardProps>(
  ({ session, onLongPress }) => {
    const totalSeconds = session.total_active_seconds + session.total_rest_seconds;
    const isCompleted = session.status === 'completed';

    const handleLongPress = useCallback(() => {
      onLongPress(session);
    }, [onLongPress, session]);

    return (
      <Pressable
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${session.sequence_snapshot.name}. ${formatDuration(totalSeconds)}. ${isCompleted ? 'Completed' : 'Stopped early'}. Long press to delete.`}
        style={({ pressed }) => [
          styles.sessionCard,
          pressed && styles.sessionCardPressed,
          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
        ]}
      >
        {/* Left accent bar */}
        <View
          style={[
            styles.sessionAccent,
            {
              backgroundColor: isCompleted
                ? APP_COLORS.primary
                : APP_COLORS.textMuted,
            },
          ]}
        />

        {/* Content */}
        <View style={styles.sessionContent}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionName} numberOfLines={1}>
              {session.sequence_snapshot.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isCompleted ? styles.statusCompleted : styles.statusStopped,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isCompleted
                    ? styles.statusTextCompleted
                    : styles.statusTextStopped,
                ]}
              >
                {isCompleted ? 'Completed' : 'Stopped'}
              </Text>
            </View>
          </View>

          <View style={styles.sessionMeta}>
            <Text style={styles.sessionMetaText}>
              {formatShortDate(session.started_at)} at{' '}
              {formatTime(session.started_at)}
            </Text>
            <Text style={styles.sessionMetaDot}>{'\u00B7'}</Text>
            <Text style={styles.sessionMetaText}>
              {formatDuration(totalSeconds)}
            </Text>
            {session.rounds_completed > 0 && (
              <>
                <Text style={styles.sessionMetaDot}>{'\u00B7'}</Text>
                <Text style={styles.sessionMetaText}>
                  {session.rounds_completed}{' '}
                  {session.rounds_completed === 1 ? 'round' : 'rounds'}
                </Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
    );
  },
);

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{'\uD83D\uDCCA'}</Text>
      <Text style={styles.emptyTitle}>No workout history yet</Text>
      <Text style={styles.emptySubtitle}>
        Complete a workout to see it here.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// History Screen
// ---------------------------------------------------------------------------

export default function HistoryScreen() {
  const router = useRouter();

  // Store access
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

  // Hydrate on mount
  useEffect(() => {
    if (!isLoaded) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived analytics (recompute when sessions change)
  const activeSessions = useMemo(() => {
    void sessions; // depend on sessions for reactivity
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

  // Callbacks
  const handleLongPress = useCallback(
    (session: WorkoutSession) => {
      if (Platform.OS === 'web') {
        const confirmed = confirm(
          `Delete "${session.sequence_snapshot.name}" session?`,
        );
        if (confirmed) {
          deleteSession(session.id);
        }
        return;
      }

      Alert.alert(
        'Delete Session',
        `Delete "${session.sequence_snapshot.name}" session from ${formatShortDate(session.started_at)}?`,
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

  // Render
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
          <SessionCard session={item.session} onLongPress={handleLongPress} />
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
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (activeSessions.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_COLORS.backgroundLight,
  },
  loadingText: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textMuted,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  dashboardRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    padding: SPACING.md,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardWide: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  statCardFlex2: {
    flex: 2,
  },
  statEmoji: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
  },
  statUnit: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginTop: 1,
  },

  // ---------------------------------------------------------------------------
  // Section headers
  // ---------------------------------------------------------------------------
  sectionHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sectionHeaderText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ---------------------------------------------------------------------------
  // Session card
  // ---------------------------------------------------------------------------
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionCardPressed: {
    opacity: 0.85,
  },
  sessionAccent: {
    width: 4,
  },
  sessionContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionName: {
    flex: 1,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: LAYOUT.borderRadius,
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusStopped: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
  },
  statusTextCompleted: {
    color: '#166534',
  },
  statusTextStopped: {
    color: '#92400E',
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  sessionMetaText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
  },
  sessionMetaDot: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginHorizontal: 6,
  },

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: FONT_SIZE.body * 1.5,
  },
});
