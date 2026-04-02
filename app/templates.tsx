/**
 * Template Gallery Screen for Schlag v2.
 *
 * Displays all developer-authored workout templates in a filterable gallery.
 * Users can filter by category, preview template details, and import a
 * template into their library as a new customizable sequence.
 *
 * Pro-gated templates show a lock badge and a disabled button when the user
 * has not purchased Schlag Pro.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

import { useSequenceStore } from '@/stores/sequenceStore';
import { useProStore } from '@/stores/proStore';
import {
  WORKOUT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  CATEGORY_LABELS,
  type WorkoutTemplate,
  type TemplateCategory,
} from '@/constants/templates';
import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { LAYOUT, SPACING } from '@/constants/layout';
import { ProBadge } from '@/components/ProBadge';
import type { Sequence } from '@/types/sequence';

// ---------------------------------------------------------------------------
// Duration formatting (mirrors library screen helper)
// ---------------------------------------------------------------------------

function formatTotalDuration(sequence: Sequence): string {
  const singleSetSeconds = sequence.intervals.reduce(
    (sum, interval) => sum + interval.duration_seconds,
    0,
  );

  if (sequence.repeat_count === 0) {
    return `${formatSeconds(singleSetSeconds)} x \u221E`;
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

// ---------------------------------------------------------------------------
// Category filter pill
// ---------------------------------------------------------------------------

interface CategoryPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function CategoryPill({ label, isActive, onPress }: CategoryPillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.pill,
        isActive && styles.pillActive,
        pressed && styles.pillPressed,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
    >
      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: WorkoutTemplate;
  isPro: boolean;
  onUse: (template: WorkoutTemplate) => void;
}

const TemplateCard = React.memo<TemplateCardProps>(
  ({ template, isPro, onUse }) => {
    const { sequence, is_free } = template;
    const isLocked = !is_free && !isPro;
    const totalDuration = formatTotalDuration(sequence);
    const colorStrip = sequence.intervals.slice(0, 6);

    const repeatLabel =
      sequence.repeat_count === 0
        ? '\u221E repeats'
        : sequence.repeat_count === 1
          ? '1 round'
          : `${sequence.repeat_count} rounds`;

    const handleUse = useCallback(() => {
      if (!isLocked) {
        onUse(template);
      }
    }, [isLocked, onUse, template]);

    return (
      <View style={styles.card}>
        {/* Color strip preview */}
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

        {/* Card body */}
        <View style={styles.cardContent}>
          {/* Header row: name + Pro badge */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>
              {sequence.name}
            </Text>
            {!is_free && <ProBadge style={styles.proBadge} />}
          </View>

          {/* Description */}
          {sequence.description.length > 0 && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {sequence.description}
            </Text>
          )}

          {/* Meta row */}
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>{totalDuration}</Text>
            <Text style={styles.cardMetaDot}>{'\u00B7'}</Text>
            <Text style={styles.cardMetaText}>
              {sequence.intervals.length}{' '}
              {sequence.intervals.length === 1 ? 'interval' : 'intervals'}
            </Text>
            <Text style={styles.cardMetaDot}>{'\u00B7'}</Text>
            <Text style={styles.cardMetaText}>{repeatLabel}</Text>
          </View>

          {/* Action button */}
          <Pressable
            onPress={handleUse}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel={
              isLocked
                ? `${sequence.name} requires Pro`
                : `Use ${sequence.name} template`
            }
            accessibilityState={{ disabled: isLocked }}
            style={({ pressed }) => [
              styles.useButton,
              isLocked && styles.useButtonLocked,
              !isLocked && pressed && styles.useButtonPressed,
              Platform.OS === 'web' &&
                ({ cursor: isLocked ? 'not-allowed' : 'pointer' } as any),
            ]}
          >
            {isLocked && <Text style={styles.lockIconSmall}>{'\uD83D\uDD12'}</Text>}
            <Text
              style={[
                styles.useButtonText,
                isLocked && styles.useButtonTextLocked,
              ]}
            >
              {isLocked ? 'Unlock with Pro' : 'Use Template'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// Templates Screen
// ---------------------------------------------------------------------------

export default function TemplatesScreen() {
  const router = useRouter();
  const addSequence = useSequenceStore((s) => s.addSequence);
  const loadProStatus = useProStore((s) => s.loadFromStorage);
  const proLoaded = useProStore((s) => s.isLoaded);
  const isPro = useProStore((s) => s.isPro);

  // Selected category filter (null = "All")
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);

  // Hydrate Pro store if not loaded yet
  useEffect(() => {
    if (!proLoaded) {
      loadProStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory == null) return WORKOUT_TEMPLATES;
    return WORKOUT_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  // Import template into library
  const handleUseTemplate = useCallback(
    (template: WorkoutTemplate) => {
      const now = new Date().toISOString();
      const newSequence: Sequence = {
        ...template.sequence,
        id: uuidv4(),
        created_at: now,
        updated_at: now,
        last_used_at: null,
        intervals: template.sequence.intervals.map((interval) => ({
          ...interval,
          id: uuidv4(),
        })),
        audio_config: { ...template.sequence.audio_config },
      };

      addSequence(newSequence);
      router.push(`/builder/${newSequence.id}` as any);
    },
    [addSequence, router],
  );

  // Render a template card
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkoutTemplate>) => (
      <TemplateCard
        template={item}
        isPro={isPro()}
        onUse={handleUseTemplate}
      />
    ),
    [isPro, handleUseTemplate],
  );

  const keyExtractor = useCallback(
    (item: WorkoutTemplate) => item.sequence.id,
    [],
  );

  const handleCategoryPress = useCallback((category: TemplateCategory | null) => {
    setSelectedCategory(category);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
        >
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Templates</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContainer}
        style={styles.pillScroll}
      >
        <CategoryPill
          label="All"
          isActive={selectedCategory === null}
          onPress={() => handleCategoryPress(null)}
        />
        {TEMPLATE_CATEGORIES.map((category) => (
          <CategoryPill
            key={category}
            label={CATEGORY_LABELS[category]}
            isActive={selectedCategory === category}
            onPress={() => handleCategoryPress(category)}
          />
        ))}
      </ScrollView>

      {/* Template list */}
      <FlatList
        data={filteredTemplates}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No templates in this category.
            </Text>
          </View>
        }
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: APP_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  backButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LAYOUT.borderRadius,
  },
  backButtonPressed: {
    backgroundColor: APP_COLORS.divider,
  },
  backArrow: {
    fontSize: 24,
    color: APP_COLORS.textPrimary,
  },
  headerTitle: {
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
  },
  headerSpacer: {
    width: LAYOUT.minTapTarget,
  },

  // Category pills
  pillScroll: {
    flexGrow: 0,
    backgroundColor: APP_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  pillContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: APP_COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: APP_COLORS.divider,
  },
  pillActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    color: APP_COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Template list
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  // Template card
  card: {
    flexDirection: 'row',
    backgroundColor: APP_COLORS.surface,
    borderRadius: LAYOUT.cardRadius,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  proBadge: {
    marginLeft: SPACING.sm,
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

  // Use template button
  useButton: {
    flexDirection: 'row',
    backgroundColor: APP_COLORS.primary,
    borderRadius: LAYOUT.borderRadius,
    height: LAYOUT.startButtonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  useButtonLocked: {
    backgroundColor: APP_COLORS.divider,
  },
  useButtonPressed: {
    opacity: 0.8,
  },
  useButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: FONT_WEIGHT.semibold,
  },
  useButtonTextLocked: {
    color: APP_COLORS.textMuted,
  },
  lockIconSmall: {
    fontSize: 14,
  },

  // Empty state
  emptyContainer: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
  },
});
