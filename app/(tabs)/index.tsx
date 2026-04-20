/**
 * Library (Home) Screen for Schlag — Signal direction.
 *
 * Editorial header with wordmark + date. Quick-start grid above an indexed
 * list of saved sequences (row per sequence, left color bar + glyph, tag +
 * rounds eyebrow, name, DSEG7 total duration on the right).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSequenceStore } from '@/stores/sequenceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SIGNAL, getIntervalByHex } from '@/constants/colors';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
} from '@/constants/typography';
import { SPACING } from '@/constants/layout';
import { Wordmark } from '@/components/Wordmark';
import { Glyph } from '@/components/Glyph';
import type { Sequence } from '@/types';

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

export function formatTotalDuration(sequence: Sequence): string {
  const singleSetSeconds = sequence.intervals.reduce(
    (sum, interval) => sum + interval.duration_seconds,
    0,
  );

  if (sequence.repeat_count === 0) {
    return `${formatSeconds(singleSetSeconds)} \u00d7 \u221E`;
  }

  const totalRestSeconds =
    sequence.rest_between_sets_seconds * Math.max(0, sequence.repeat_count - 1);
  const totalSeconds = singleSetSeconds * sequence.repeat_count + totalRestSeconds;

  return formatSeconds(totalSeconds);
}

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Heuristic tag derived from sequence shape. */
function tagFor(sequence: Sequence): string {
  const names = sequence.intervals.map((i) => i.name.toLowerCase());
  const hasWork = names.some((n) => n.includes('work') || n.includes('sprint') || n.includes('set'));
  const hasRest = names.some((n) => n.includes('rest') || n.includes('recover'));
  if (sequence.intervals.length === 2 && hasWork && hasRest) {
    const work = sequence.intervals.find((i) => /work|sprint|set/i.test(i.name));
    if (work?.duration_seconds === 20 && sequence.repeat_count === 8) return 'TABATA';
    if (sequence.rest_between_sets_seconds === 0 && work) return 'INTERVAL';
  }
  if (sequence.intervals.length === 1) return 'AMRAP';
  if (sequence.intervals.length > 2) return 'CIRCUIT';
  return 'INTERVAL';
}

function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.round((now - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function formatToday(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${weekday} ${day} ${month} · ${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Quick-start tiles
// ---------------------------------------------------------------------------

import type { IntervalGlyph } from '@/constants';

const QUICK_START_TILES: {
  label: string;
  color: string;
  glyph: IntervalGlyph;
  blurb: string;
}[] = [
  { label: 'Tabata', color: '#E5484D', glyph: 'circle',   blurb: '8 × 20/10s' },
  { label: 'EMOM',   color: '#F76B15', glyph: 'triangle', blurb: 'every minute' },
  { label: 'AMRAP',  color: '#12A594', glyph: 'hexagon',  blurb: 'as many rounds' },
  { label: 'Rest',   color: '#5B5BD6', glyph: 'star',     blurb: 'heavy-set timer' },
];

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface SequenceRowProps {
  sequence: Sequence;
  index: number;
  onStart: (id: string) => void;
  onLongPress: (sequence: Sequence) => void;
}

const SequenceRow = React.memo<SequenceRowProps>(
  ({ sequence, index, onStart, onLongPress }) => {
    const firstColor = sequence.intervals[0]?.color ?? '#E5484D';
    const glyph = getIntervalByHex(firstColor)?.glyph ?? 'circle';
    const displayHex = getIntervalByHex(firstColor)?.hex ?? firstColor;
    const totalDuration = formatTotalDuration(sequence);
    const tag = tagFor(sequence);
    const rounds = sequence.repeat_count === 0 ? '×∞' : `×${sequence.repeat_count}`;

    const handleStart = useCallback(() => onStart(sequence.id), [onStart, sequence.id]);
    const handleLongPress = useCallback(() => onLongPress(sequence), [onLongPress, sequence]);

    return (
      <Pressable
        onPress={handleStart}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${sequence.name}. ${totalDuration}. Tap to start, long press for edit/duplicate/delete.`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Text style={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>
        <View style={[styles.rowColorBar, { backgroundColor: displayHex }]}>
          <Glyph kind={glyph} size={10} color="#FFFFFF" />
        </View>

        <View style={styles.rowMain}>
          <Text style={styles.rowEyebrow}>{tag} · {rounds}</Text>
          <Text style={styles.rowName} numberOfLines={1}>{sequence.name}</Text>
        </View>

        <Text style={styles.rowDuration}>{totalDuration}</Text>
      </Pressable>
    );
  },
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.emptyTitle}>No sequences yet</Text>
      <Text style={styles.emptySubtitle}>
        Build your first sequence. Tabata, EMOM, heavy-set rest — your call.
      </Text>
      <Pressable
        onPress={onCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create your first sequence"
        style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
      >
        <Text style={styles.emptyCtaText}>＋ NEW SEQUENCE</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Library Screen
// ---------------------------------------------------------------------------

export default function LibraryScreen() {
  const router = useRouter();

  const loadSequences = useSequenceStore((s) => s.loadFromStorage);
  const isLoaded = useSequenceStore((s) => s.isLoaded);
  const getSortedSequences = useSequenceStore((s) => s.getSortedSequences);
  const sortOrder = useSequenceStore((s) => s.sortOrder);
  const setSortOrder = useSequenceStore((s) => s.setSortOrder);
  const deleteSequence = useSequenceStore((s) => s.deleteSequence);
  const duplicateSequence = useSequenceStore((s) => s.duplicateSequence);
  const sequences = useSequenceStore((s) => s.sequences);

  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!isLoaded) loadSequences();
    if (!settingsLoaded) loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedSequences = useMemo(() => {
    void sequences;
    return getSortedSequences();
  }, [sequences, getSortedSequences, sortOrder]);

  const filteredSequences = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedSequences;
    const query = searchQuery.toLowerCase();
    return sortedSequences.filter((seq) => seq.name.toLowerCase().includes(query));
  }, [sortedSequences, searchQuery]);

  const subtitle = useMemo(() => {
    const count = sequences.length;
    const last = sequences
      .filter((s) => s.last_used_at)
      .sort(
        (a, b) =>
          new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime(),
      )[0];
    if (count === 0) return 'No sequences yet.';
    const noun = count === 1 ? 'sequence' : 'sequences';
    if (!last) return `${count} ${noun}. No sessions logged yet.`;
    return `${count} ${noun}. Last session ${relativeDate(last.last_used_at)}, ${last.name}.`;
  }, [sequences]);

  const handleStartWorkout = useCallback(
    (id: string) => router.push(`/workout/${id}` as any),
    [router],
  );
  const handleCreateSequence = useCallback(() => {
    router.push('/builder/new' as any);
  }, [router]);

  const handleQuickStart = useCallback(
    (label: string) => {
      router.push(`/templates?seed=${encodeURIComponent(label)}` as any);
    },
    [router],
  );

  const handleLongPress = useCallback(
    (sequence: Sequence) => {
      if (Platform.OS === 'web') {
        const action = window.prompt(
          `"${sequence.name}"\n\nType "edit", "duplicate", or "delete":`,
        );
        if (action === 'edit') router.push(`/builder/${sequence.id}` as any);
        else if (action === 'duplicate') duplicateSequence(sequence.id);
        else if (action === 'delete') deleteSequence(sequence.id);
        return;
      }
      Alert.alert(sequence.name, 'Choose an action', [
        { text: 'Edit', onPress: () => router.push(`/builder/${sequence.id}` as any) },
        { text: 'Duplicate', onPress: () => duplicateSequence(sequence.id) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Sequence',
              `Are you sure you want to delete "${sequence.name}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteSequence(sequence.id),
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [duplicateSequence, deleteSequence, router],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSequences();
    setTimeout(() => setRefreshing(false), 300);
  }, [loadSequences]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder(sortOrder === 'lastUsed' ? 'alphabetical' : 'lastUsed');
  }, [sortOrder, setSortOrder]);

  const handleOpenTemplates = useCallback(() => {
    router.push('/templates' as any);
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Sequence>) => (
      <SequenceRow
        sequence={item}
        index={index}
        onStart={handleStartWorkout}
        onLongPress={handleLongPress}
      />
    ),
    [handleStartWorkout, handleLongPress],
  );

  const keyExtractor = useCallback((item: Sequence) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View>
        {/* Editorial header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Wordmark size={FONT_SIZE.displayHero} />
            <Text style={styles.headerMeta}>{formatToday()}</Text>
          </View>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>

        {/* Quick-start grid */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Quick start</Text>
          <View style={styles.quickStartGrid}>
            {QUICK_START_TILES.map((tile) => (
              <Pressable
                key={tile.label}
                onPress={() => handleQuickStart(tile.label)}
                accessibilityRole="button"
                accessibilityLabel={`Quick start ${tile.label}`}
                style={({ pressed }) => [
                  styles.quickTile,
                  pressed && styles.quickTilePressed,
                ]}
              >
                <View style={styles.quickTileTop}>
                  <View style={[styles.quickDot, { backgroundColor: tile.color }]} />
                  <Glyph kind={tile.glyph} size={16} color={tile.color} />
                </View>
                <View>
                  <Text style={styles.quickLabel}>{tile.label}</Text>
                  <Text style={styles.quickBlurb}>{tile.blurb}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Saved list header */}
        <View style={[styles.section, styles.savedHeader]}>
          <View style={styles.savedHeaderRow}>
            <Text style={styles.eyebrow}>
              Saved · {filteredSequences.length}
            </Text>
            <View style={styles.savedHeaderActions}>
              <Pressable
                onPress={() => setShowSearch((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showSearch ? 'Hide search' : 'Show search'}
                hitSlop={8}
              >
                <Text style={styles.savedAction}>{showSearch ? 'Hide' : 'Search'}</Text>
              </Pressable>
              <Pressable
                onPress={toggleSortOrder}
                accessibilityRole="button"
                accessibilityLabel="Toggle sort order"
                hitSlop={8}
              >
                <Text style={styles.savedAction}>
                  {sortOrder === 'lastUsed' ? 'Recent' : 'A–Z'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleOpenTemplates}
                accessibilityRole="button"
                accessibilityLabel="Open templates"
                hitSlop={8}
              >
                <Text style={styles.savedAction}>Templates</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateSequence}
                accessibilityRole="button"
                accessibilityLabel="Create new sequence"
                hitSlop={8}
              >
                <Text style={[styles.savedAction, styles.savedActionAccent]}>
                  ＋ New
                </Text>
              </Pressable>
            </View>
          </View>
          {showSearch && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search sequences"
                placeholderTextColor={SIGNAL.mutedInk}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search sequences"
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
              />
            </View>
          )}
        </View>
      </View>
    ),
    [
      subtitle,
      searchQuery,
      filteredSequences.length,
      sortOrder,
      showSearch,
      toggleSortOrder,
      handleOpenTemplates,
      handleCreateSequence,
      handleQuickStart,
    ],
  );

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sequences.length === 0 ? (
        <EmptyState onCreatePress={handleCreateSequence} />
      ) : (
        <FlatList
          data={filteredSequences}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                No sequences match “{searchQuery}”.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={SIGNAL.accent}
              colors={[SIGNAL.accent]}
            />
          }
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
  loadingText: { fontSize: FONT_SIZE.body, color: SIGNAL.mutedInk },
  listContent: { paddingBottom: 40 },

  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.divider,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headerMeta: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    color: SIGNAL.mutedInk,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodySmall,
    color: SIGNAL.mutedInk,
    marginTop: SPACING.xs,
    maxWidth: 320,
    lineHeight: FONT_SIZE.bodySmall * 1.4,
  },

  // Sections
  section: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  eyebrow: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: LETTER_SPACING.eyebrow,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Quick start tiles
  quickStartGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quickTile: {
    flex: 1,
    minWidth: 0,
    height: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SIGNAL.divider,
    padding: SPACING.md,
    justifyContent: 'space-between',
    backgroundColor: SIGNAL.paper,
  },
  quickTilePressed: { backgroundColor: '#F2EFE8' },
  quickTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickDot: { width: 10, height: 10, borderRadius: 5 },
  quickLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body + 2,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: -0.3,
    color: SIGNAL.ink,
  },
  quickBlurb: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow + 1,
    color: SIGNAL.mutedInk,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // Saved header
  savedHeader: { paddingTop: SPACING.xl },
  savedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  savedAction: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    color: SIGNAL.mutedInk,
  },
  savedActionAccent: { color: SIGNAL.accent, fontWeight: FONT_WEIGHT.semibold },

  // Search
  searchContainer: {
    marginTop: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SIGNAL.ink,
  },
  searchInput: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.bodyLarge,
    color: SIGNAL.ink,
    paddingVertical: SPACING.sm,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },

  // List row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SIGNAL.divider,
    gap: SPACING.md,
    backgroundColor: SIGNAL.paper,
  },
  rowPressed: { backgroundColor: '#F2EFE8' },
  rowIndex: {
    width: 24,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT_SIZE.eyebrow,
    color: SIGNAL.mutedInk,
  },
  rowColorBar: {
    width: 28,
    alignSelf: 'stretch',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowEyebrow: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.eyebrow,
    letterSpacing: 1.5,
    color: SIGNAL.mutedInk,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: 2,
  },
  rowName: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.medium,
    color: SIGNAL.ink,
    letterSpacing: -0.3,
  },
  rowDuration: {
    fontFamily: FONT_FAMILY.seven,
    fontSize: FONT_SIZE.bodyLarge,
    color: SIGNAL.ink,
    letterSpacing: 0.5,
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
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: 72,
  },
  emptyTitle: {
    fontFamily: FONT_FAMILY.sans,
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
  emptyCta: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderWidth: 1.5,
    borderColor: SIGNAL.ink,
  },
  emptyCtaPressed: { backgroundColor: SIGNAL.ink },
  emptyCtaText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    color: SIGNAL.ink,
    letterSpacing: 1.5,
  },

  // No results
  noResultsContainer: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  noResultsText: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.body,
    color: SIGNAL.mutedInk,
    textAlign: 'center',
  },
});
