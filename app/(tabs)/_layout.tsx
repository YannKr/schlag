import React, { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useTimerStore } from '@/stores/timerStore';

// ---------------------------------------------------------------------------
// Floating Active Workout Pill
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
        pressed && styles.pillPressed,
      ]}
    >
      <View style={styles.pillDot} />
      <Text style={styles.pillText} numberOfLines={1}>
        {tickData
          ? `${tickData.currentInterval.name}  ${tickData.formattedTime}`
          : 'Workout in progress'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Tab Layout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#E63946',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: '#1A1A2E',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Library',
            headerTitle: 'Schlag',
            tabBarIcon: ({ color }) => (
              <Text style={[styles.tabIcon, { color }]}>{'\u25B6'}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => (
              <Text style={[styles.tabIcon, { color }]}>{'\uD83D\uDCCA'}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <Text style={[styles.tabIcon, { color }]}>{'\u2699'}</Text>
            ),
          }}
        />

        {/* Hide the legacy active tab from the tab bar (file still exists for deep links). */}
        <Tabs.Screen
          name="active"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Floating pill above the tab bar */}
      <ActiveWorkoutPill />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    height: 56,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
  },
  header: {
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 20,
    color: '#1A1A2E',
  },

  // Active workout pill
  pill: {
    position: 'absolute',
    bottom: 56 + 8, // tab bar height + gap
    alignSelf: 'center',
    left: '15%',
    right: '15%',
    height: 48,
    backgroundColor: '#E63946',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    // Shadow
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    opacity: 0.9,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
