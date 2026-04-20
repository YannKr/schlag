import React, { useCallback, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text, View, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { useTimerStore } from '@/stores/timerStore';
import { SIGNAL, normalizeIntervalHex } from '@/constants/colors';
import {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
} from '@/constants/typography';

// ---------------------------------------------------------------------------
// Floating Active Workout Pill — Signal styling
// ---------------------------------------------------------------------------

function ActiveWorkoutPill() {
  const router = useRouter();
  const isActive = useTimerStore((s) => s.isActive);
  const activeSequenceId = useTimerStore((s) => s.activeSequenceId);
  const tickData = useTimerStore((s) => s.tickData);

  const handlePress = useCallback(() => {
    if (activeSequenceId) {
      router.push(`/workout/${activeSequenceId}` as any);
    }
  }, [router, activeSequenceId]);

  if (!isActive || !activeSequenceId) return null;

  const intervalHex = tickData
    ? normalizeIntervalHex(tickData.currentInterval.color)
    : SIGNAL.accent;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        tickData
          ? `Active workout: ${tickData.currentInterval.name}, ${tickData.formattedTime} remaining. Tap to return.`
          : 'Active workout in progress. Tap to return.'
      }
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: intervalHex },
        pressed && styles.pillPressed,
      ]}
    >
      <View style={styles.pillDot} />
      <Text style={styles.pillText} numberOfLines={1}>
        {tickData
          ? `${tickData.currentInterval.name.toUpperCase()}  ${tickData.formattedTime}`
          : 'WORKOUT IN PROGRESS'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Tab Layout
// ---------------------------------------------------------------------------

/**
 * Expo Router's bottom tab bar on web ignores tabBarStyle.height because
 * React Native Web's dynamically-injected stylesheet has higher specificity
 * than our JS styles. Inject a high-specificity override at runtime.
 */
function useWebTabBarFix() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'schlag-tabbar-fix';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body, #root, body > div:first-child {
        height: 100% !important;
      }
      div[role="tablist"] {
        min-height: 72px !important;
        padding-top: 10px !important;
        padding-bottom: 16px !important;
        flex: 0 0 auto !important;
      }
      div[role="tablist"] > [role="tab"] {
        padding-top: 4px !important;
        padding-bottom: 6px !important;
      }
      div[role="tablist"] > [role="tab"] * {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function TabLayout() {
  useWebTabBarFix();
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: SIGNAL.ink,
          tabBarInactiveTintColor: SIGNAL.mutedInk,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarShowLabel: true,
          tabBarLabelPosition: 'below-icon',
          tabBarActiveBackgroundColor: 'transparent',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Library',
            tabBarIcon: ({ focused }) => (
              <TabIndicator focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ focused }) => (
              <TabIndicator focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <TabIndicator focused={focused} />
            ),
          }}
        />
        <Tabs.Screen name="active" options={{ href: null }} />
      </Tabs>

      <ActiveWorkoutPill />
    </View>
  );
}

/**
 * Top-border active indicator — Signal uses a thin top rule rather than a
 * filled pill or background shading.
 */
function TabIndicator({ focused }: { focused: boolean }) {
  return (
    <View
      style={[
        styles.tabIndicator,
        focused && { backgroundColor: SIGNAL.ink },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SIGNAL.paper },
  tabBar: {
    backgroundColor: SIGNAL.paper,
    borderTopColor: SIGNAL.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    height:
      Platform.OS === 'ios' ? 86 : Platform.OS === 'android' ? 72 : 88,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.2,
    marginTop: 4,
    lineHeight: FONT_SIZE.caption * 1.2,
  },
  tabBarItem: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabIndicator: {
    width: 24,
    height: 2,
    marginTop: 2,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },

  // Active workout pill
  pill: {
    position: 'absolute',
    bottom:
      (Platform.OS === 'ios' ? 86 : Platform.OS === 'android' ? 72 : 88) + 8,
    alignSelf: 'center',
    left: '12%',
    right: '12%',
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  pillPressed: { opacity: 0.92 },
  pillDot: {
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: LETTER_SPACING.caption,
    flexShrink: 1,
  },
});
