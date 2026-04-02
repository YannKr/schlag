/**
 * Library (Home) Screen for Schlag.
 *
 * Displays the user's sequence library as a scrollable card list with search,
 * sort toggling, pull-to-refresh, and a FAB for creating new sequences.
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
import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { LAYOUT, SPACING } from '@/constants/layout';
import { FAB } from '@/components/FAB';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import type { Sequence } from '@/types';

// ---------------------------------------------------------------------------
// Duration formatting helper
// ---------------------------------------------------------------------------

/**
 * Computes the total workout duration for a sequence including repeats and
 * rest between sets, and returns a human-readable string.
 *
 * Formula:
 *   singleSetDuration = sum of all interval durations
 *   totalRestDuration = restBetweenSets * (repeats - 1)   [no rest after last set]
 *   total = singleSetDuration * repeats + totalRestDuration
 *
 * For infinite mode (repeat_count === 0), shows the single-set duration with
 * an infinity symbol.
 */
export function formatTotalDuration(sequence: Sequence): string {
  const singleSetSeconds = sequence.intervals.reduce(
    (sum, interval) => sum + interval.duration_seconds,
    0,
  );

  if (sequence.repeat_count === 0) {
    // Infinite mode -- show single set duration with infinity indicator
    return `${formatSeconds(singleSetSeconds)} x \u221E`;
  }

  const totalRestSeconds =
    sequence.rest_between_sets_seconds * Math.max(0, sequence.repeat_count - 1);
  const totalSeconds = singleSetSeconds * sequence.repeat_count + totalRestSeconds;

  return formatSeconds(totalSeconds);
}

/** Format a number of seconds into H:MM:SS or MM:SS. */
function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sequence Card component
// ---------------------------------------------------------------------------

interface SequenceCardProps {
  sequence: Sequence;
  onStart: (id: string) => void;
  onEdit: (id: string) => void;
  onLongPress: (sequence: Sequence) => void;
}

const SequenceCard = React.memo<SequenceCardProps>(
  ({ sequence, onStart, onEdit, onLongPress }) => {
    const colorStrip = sequence.intervals.slice(0, 5);
    const totalDuration = formatTotalDuration(sequence);

    const handlePress = useCallback(() => {
      onEdit(sequence.id);
    }, [onEdit, sequence.id]);

    const handleStart = useCallback(() => {
      onStart(sequence.id);
    }, [onStart, sequence.id]);

    const handleLongPress = useCallback(() => {
      onLongPress(sequence);
    }, [onLongPress, sequence]);

    const repeatLabel =
      sequence.repeat_count === 0
        ? '\u221E repeats'
        : sequence.repeat_count === 1
          ? '1 round'
          : `${sequence.repeat_count} rounds`;

    return (
      <View
        accessibilityLabel={`${sequence.name}. ${totalDuration}. Tap to edit, long press for options.`}
        // @ts-expect-error — onClick is valid on web but not typed in RN
        onClick={Platform.OS === 'web' ? handlePress : undefined}
        onStartShouldSetResponder={Platform.OS !== 'web' ? () => true : undefined}
        onResponderRelease={Platform.OS !== 'web' ? handlePress : undefined}
        style={[
          styles.card,
          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
        ]}
      >
        {/* Color strip on left edge */}
        <View style={styles.colorStrip} accessibilityLabel="Interval colors">
          {colorStrip.map((interval, index) => (
            <View
              key={interval.id}
              style={[
                styles.colorStripSegment,
                { backgroundColor: interval.color },
                index === 0 && styles.colorStripTop,
                index === colorStrip.length - 1 && styles.colorStripBottom,
              ]}
            />
          ))}
        </View>

        {/* Card content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardName} numberOfLines={1}>
            {sequence.name}
          </Text>

          {sequence.description.length > 0 && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {sequence.description}
            </Text>
          )}

          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>
              {totalDuration}
            </Text>
            <Text style={styles.cardMetaDot}>{'\u00B7'}</Text>
            <Text style={styles.cardMetaText}>
              {sequence.intervals.length}{' '}
              {sequence.intervals.length === 1 ? 'interval' : 'intervals'}
            </Text>
            <Text style={styles.cardMetaDot}>{'\u00B7'}</Text>
            <Text style={styles.cardMetaText}>{repeatLabel}</Text>
          </View>

          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={`Start ${sequence.name}`}
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.startButtonPressed,
            ]}
          >
            <Text style={styles.startButtonText}>Start</Text>
          </Pressable>
        </View>
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// Empty state component
// ---------------------------------------------------------------------------

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.emptyTitle}>No sequences yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first sequence to get started
      </Text>
      <Button
        title="Create your first sequence"
        onPress={onCreatePress}
        style={styles.emptyCta}
        accessibilityLabel="Create your first sequence"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Library Screen
// ---------------------------------------------------------------------------

export default function LibraryScreen() {
  const router = useRouter();

  // Store access
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

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Hydrate stores on mount
  useEffect(() => {
    if (!isLoaded) {
      loadSequences();
    }
    if (!settingsLoaded) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive sorted + filtered list
  const sortedSequences = useMemo(() => {
    // We depend on `sequences` so that the memo recomputes on mutations.
    // `getSortedSequences` reads from the store directly.
    void sequences;
    return getSortedSequences();
  }, [sequences, getSortedSequences, sortOrder]);

  const filteredSequences = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedSequences;
    const query = searchQuery.toLowerCase();
    return sortedSequences.filter((seq) =>
      seq.name.toLowerCase().includes(query),
    );
  }, [sortedSequences, searchQuery]);

  // Callbacks
  const handleStartWorkout = useCallback(
    (id: string) => {
      router.push(`/workout/${id}` as any);
    },
    [router],
  );

  const handleEditSequence = useCallback(
    (id: string) => {
      router.push(`/builder/${id}` as any);
    },
    [router],
  );

  const handleCreateSequence = useCallback(() => {
    router.push('/builder/new' as any);
  }, [router]);

  const handleLongPress = useCallback(
    (sequence: Sequence) => {
      if (Platform.OS === 'web') {
        // On web, use a simple approach -- no native action sheets.
        // We'll show an alert-style confirm for each option.
        const action = prompt(
          `"${sequence.name}"\n\nType "duplicate" to duplicate or "delete" to delete:`,
        );
        if (action === 'duplicate') {
          duplicateSequence(sequence.id);
        } else if (action === 'delete') {
          deleteSequence(sequence.id);
        }
        return;
      }

      Alert.alert(sequence.name, 'Choose an action', [
        {
          text: 'Duplicate',
          onPress: () => {
            duplicateSequence(sequence.id);
          },
        },
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
    [duplicateSequence, deleteSequence],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSequences();
    // Simulate a brief delay so the spinner is visible
    setTimeout(() => setRefreshing(false), 300);
  }, [loadSequences]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder(sortOrder === 'lastUsed' ? 'alphabetical' : 'lastUsed');
  }, [sortOrder, setSortOrder]);

  const handleOpenTemplates = useCallback(() => {
    router.push('/templates' as any);
  }, [router]);

  // Render
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Sequence>) => (
      <SequenceCard
        sequence={item}
        onStart={handleStartWorkout}
        onEdit={handleEditSequence}
        onLongPress={handleLongPress}
      />
    ),
    [handleStartWorkout, handleEditSequence, handleLongPress],
  );

  const keyExtractor = useCallback((item: Sequence) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>{'🔍'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search sequences..."
            placeholderTextColor={APP_COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search sequences"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <IconButton
              icon={<Text style={styles.clearIcon}>{'✕'}</Text>}
              onPress={() => setSearchQuery('')}
              size={32}
              accessibilityLabel="Clear search"
            />
          )}
        </View>

        {/* Sort toggle + Templates button */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>
            {filteredSequences.length}{' '}
            {filteredSequences.length === 1 ? 'sequence' : 'sequences'}
          </Text>
          <View style={styles.sortRowActions}>
            <Pressable
              onPress={handleOpenTemplates}
              accessibilityRole="button"
              accessibilityLabel="Browse workout templates"
              style={({ pressed }) => [
                styles.templatesButton,
                pressed && styles.templatesButtonPressed,
              ]}
            >
              <Text style={styles.templatesButtonText}>Templates</Text>
            </Pressable>
            <Pressable
              onPress={toggleSortOrder}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sortOrder === 'lastUsed' ? 'alphabetical' : 'last used'}`}
              style={({ pressed }) => [
                styles.sortButton,
                pressed && styles.sortButtonPressed,
              ]}
            >
              <Text style={styles.sortButtonText}>
                {sortOrder === 'lastUsed' ? 'Last Used' : 'A-Z'}
              </Text>
              <Text style={styles.sortArrow}>{'\u21C5'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [searchQuery, filteredSequences.length, sortOrder, toggleSortOrder, handleOpenTemplates],
  );

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
                No sequences match "{searchQuery}"
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={APP_COLORS.primary}
              colors={[APP_COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FAB
        onPress={handleCreateSequence}
        accessibilityLabel="Create new sequence"
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
    paddingBottom: 100, // room for FAB
  },

  // List header (search + sort)
  listHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderWidth: 1,
    borderColor: APP_COLORS.divider,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textPrimary,
    height: '100%',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  clearIcon: {
    fontSize: 14,
    color: APP_COLORS.textMuted,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  sortLabel: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    fontWeight: FONT_WEIGHT.medium,
  },
  sortRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: LAYOUT.borderRadius,
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  templatesButtonPressed: {
    backgroundColor: APP_COLORS.primary,
  },
  templatesButtonText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: LAYOUT.borderRadius,
  },
  sortButtonPressed: {
    backgroundColor: APP_COLORS.divider,
  },
  sortButtonText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  sortArrow: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    marginLeft: 4,
  },

  // Sequence card
  card: {
    flexDirection: 'row',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    marginTop: SPACING.md,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  colorStrip: {
    width: 4,
    flexDirection: 'column',
  },
  colorStripSegment: {
    flex: 1,
    minHeight: 8,
  },
  colorStripTop: {
    borderTopLeftRadius: LAYOUT.cardRadius,
  },
  colorStripBottom: {
    borderBottomLeftRadius: LAYOUT.cardRadius,
  },
  cardContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  cardName: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
  cardDescription: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: FONT_SIZE.body * 1.4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  cardMetaText: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
  },
  cardMetaDot: {
    fontSize: FONT_SIZE.caption,
    color: APP_COLORS.textMuted,
    marginHorizontal: 6,
  },
  startButton: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: LAYOUT.borderRadius,
    height: LAYOUT.startButtonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  startButtonPressed: {
    opacity: 0.8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 56,
    color: APP_COLORS.divider,
    marginBottom: SPACING.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.headingMedium,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: FONT_SIZE.body * 1.5,
  },
  emptyCta: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },

  // No results (search returned nothing)
  noResultsContainer: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
  },
});
