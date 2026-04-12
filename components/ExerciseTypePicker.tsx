import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EXERCISE_PROFILES } from '@/lib/repTracking/exerciseProfiles';
import type { ExerciseType } from '@/types/interval';
import { APP_COLORS } from '@/constants/colors';
import { SPACING } from '@/constants/layout';
import { FONT_SIZE, FONT_WEIGHT } from '@/constants/typography';

interface ExerciseTypePickerProps {
  visible: boolean;
  selected: ExerciseType | null | undefined;
  onSelect: (type: ExerciseType | null) => void;
  onClose: () => void;
}

const JOINTS_LABEL: Record<string, string> = {
  squat: 'Tracks: hip + knee angle',
  deadlift: 'Tracks: hip angle',
  bench: 'Tracks: elbow angle',
  curl: 'Tracks: elbow angle',
  overhead_press: 'Tracks: shoulder + elbow angle',
  row: 'Tracks: elbow angle',
};

export function ExerciseTypePicker({
  visible,
  selected,
  onSelect,
  onClose,
}: ExerciseTypePickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Exercise Type</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'web'
              ? 'Select what you\'re doing so the camera can count reps'
              : 'Camera rep tracking is coming soon to mobile'}
          </Text>

          <ScrollView style={styles.list}>
            <Pressable
              style={[styles.option, !selected && styles.optionSelected]}
              onPress={() => { onSelect(null); onClose(); }}
            >
              <Text style={styles.optionEmoji}>—</Text>
              <View style={styles.optionDetails}>
                <Text style={styles.optionName}>No tracking</Text>
                <Text style={styles.optionJoints}>Camera disabled for this interval</Text>
              </View>
              {!selected && <Text style={styles.check}>✓</Text>}
            </Pressable>

            {EXERCISE_PROFILES.map((profile) => (
              <Pressable
                key={profile.type}
                style={[styles.option, selected === profile.type && styles.optionSelected]}
                onPress={() => { onSelect(profile.type); onClose(); }}
              >
                <Text style={styles.optionEmoji}>
                  {profile.type === 'curl' || profile.type === 'bench' || profile.type === 'row' ? '💪' : '🏋️'}
                </Text>
                <View style={styles.optionDetails}>
                  <Text style={styles.optionName}>{profile.displayName}</Text>
                  <Text style={styles.optionJoints}>
                    {JOINTS_LABEL[profile.type] ?? ''}
                  </Text>
                </View>
                {selected === profile.type && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SPACING.lg,
    maxHeight: '60%',
  },
  title: {
    fontSize: FONT_SIZE.headingSmall,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.backgroundDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.caption,
    color: '#94a3b8',
    marginBottom: SPACING.md,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  optionDetails: {
    flex: 1,
    marginLeft: 10,
  },
  optionName: {
    fontSize: 13,
    fontWeight: FONT_WEIGHT.semibold,
    color: APP_COLORS.backgroundDark,
  },
  optionJoints: {
    fontSize: 10,
    color: '#94a3b8',
  },
  check: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: FONT_WEIGHT.bold,
  },
});
