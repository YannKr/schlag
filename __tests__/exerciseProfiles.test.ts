import { EXERCISE_PROFILES, getProfileByType } from '@/lib/repTracking/exerciseProfiles';
import type { ExerciseType } from '@/lib/repTracking/types';

describe('exerciseProfiles', () => {
  it('defines exactly 6 profiles', () => {
    expect(EXERCISE_PROFILES).toHaveLength(6);
  });

  it('each profile has valid thresholds (extended != contracted)', () => {
    for (const profile of EXERCISE_PROFILES) {
      expect(profile.repThresholds.extended).not.toBe(profile.repThresholds.contracted);
      expect(profile.repThresholds.hysteresis).toBeGreaterThan(0);
    }
  });

  it('each profile has at least one tracked joint', () => {
    for (const profile of EXERCISE_PROFILES) {
      expect(profile.trackedJoints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each profile has unique type', () => {
    const types = EXERCISE_PROFILES.map(p => p.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('getProfileByType returns the correct profile', () => {
    const squat = getProfileByType('squat');
    expect(squat).toBeDefined();
    expect(squat!.type).toBe('squat');
  });

  it('getProfileByType returns undefined for unknown type', () => {
    expect(getProfileByType('unknown' as ExerciseType)).toBeUndefined();
  });
});
