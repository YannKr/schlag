/**
 * Active Workout Tab for Schlag.
 *
 * Shows a "Return to Workout" button when a workout session is active,
 * or an empty state prompting the user to start one from the library.
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTimerStore } from '@/stores/timerStore';
import { APP_COLORS } from '@/constants/colors';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';
import { SPACING } from '@/constants/layout';
import { Button } from '@/components/Button';

export default function ActiveScreen() {
  const router = useRouter();

  const isActive = useTimerStore((s) => s.isActive);
  const activeSequenceId = useTimerStore((s) => s.activeSequenceId);
  const tickData = useTimerStore((s) => s.tickData);

  const handleReturnToWorkout = useCallback(() => {
    if (activeSequenceId) {
      router.push(`/workout/${activeSequenceId}` as any);
    }
  }, [router, activeSequenceId]);

  if (isActive && activeSequenceId) {
    return (
      <View style={styles.container}>
        <View style={styles.activeContent}>
          {tickData && (
            <>
              <Text style={styles.activeIntervalName}>
                {tickData.currentInterval.name}
              </Text>
              <Text style={styles.activeTimer}>{tickData.formattedTime}</Text>
              <Text style={styles.activeRound}>
                {tickData.totalRounds > 0
                  ? `Round ${tickData.currentRound} of ${tickData.totalRounds}`
                  : `Round ${tickData.currentRound}`}
              </Text>
            </>
          )}
          {!tickData && (
            <Text style={styles.activeHint}>Workout in progress</Text>
          )}
          <Button
            title="Return to Workout"
            onPress={handleReturnToWorkout}
            style={styles.returnButton}
            accessibilityLabel="Return to active workout"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emptyIcon}>{'\u23F1'}</Text>
      <Text style={styles.text}>No active workout</Text>
      <Text style={styles.hint}>Start a workout from your library</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_COLORS.backgroundLight,
    paddingHorizontal: SPACING.xxl,
  },

  // Empty state
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  text: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.textSecondary,
  },
  hint: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textMuted,
    marginTop: SPACING.sm,
  },

  // Active state
  activeContent: {
    alignItems: 'center',
    width: '100%',
  },
  activeIntervalName: {
    fontSize: FONT_SIZE.headingLarge,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.textPrimary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  activeTimer: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.primary,
    marginVertical: SPACING.lg,
    fontVariant: ['tabular-nums'],
  },
  activeRound: {
    fontSize: FONT_SIZE.body,
    color: APP_COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  activeHint: {
    fontSize: FONT_SIZE.bodyLarge,
    color: APP_COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  returnButton: {
    width: '100%',
    maxWidth: 320,
  },
});
