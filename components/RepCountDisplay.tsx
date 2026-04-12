import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface RepCountDisplayProps {
  repCount: number;
  isTracking: boolean;
  visible: boolean;
}

export function RepCountDisplay({ repCount, isTracking, visible }: RepCountDisplayProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.count}>{repCount}</Text>
      <Text style={styles.label}>
        {isTracking ? 'reps detected' : 'waiting for pose...'}
      </Text>
    </View>
  );
}

const REP_GREEN = '#00ff88';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  count: {
    fontFamily: 'JetBrainsMono',
    fontSize: 32,
    fontWeight: '700',
    color: REP_GREEN,
    lineHeight: 38,
  },
  label: {
    fontSize: 11,
    color: 'rgba(0, 255, 136, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
