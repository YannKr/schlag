import type { ExerciseProfile, ExerciseType } from './types';

export const EXERCISE_PROFILES: ExerciseProfile[] = [
  {
    type: 'squat',
    displayName: 'Squat',
    trackedJoints: [
      { pointA: 23, pointB: 25, pointC: 27 }, // left hip-knee-ankle
      { pointA: 24, pointB: 26, pointC: 28 }, // right hip-knee-ankle
    ],
    repThresholds: { extended: 170, contracted: 90, hysteresis: 15 },
    primarySide: 'average',
  },
  {
    type: 'deadlift',
    displayName: 'Deadlift',
    trackedJoints: [
      { pointA: 11, pointB: 23, pointC: 25 }, // left shoulder-hip-knee
      { pointA: 12, pointB: 24, pointC: 26 }, // right shoulder-hip-knee
    ],
    repThresholds: { extended: 170, contracted: 90, hysteresis: 15 },
    primarySide: 'average',
  },
  {
    type: 'bench',
    displayName: 'Bench / Push-up',
    trackedJoints: [
      { pointA: 11, pointB: 13, pointC: 15 }, // left shoulder-elbow-wrist
      { pointA: 12, pointB: 14, pointC: 16 }, // right shoulder-elbow-wrist
    ],
    repThresholds: { extended: 170, contracted: 80, hysteresis: 15 },
    primarySide: 'average',
  },
  {
    type: 'curl',
    displayName: 'Curl',
    trackedJoints: [
      { pointA: 12, pointB: 14, pointC: 16 }, // right shoulder-elbow-wrist
    ],
    repThresholds: { extended: 160, contracted: 40, hysteresis: 15 },
    primarySide: 'right',
  },
  {
    type: 'overhead_press',
    displayName: 'Overhead Press',
    trackedJoints: [
      { pointA: 11, pointB: 13, pointC: 15 },
      { pointA: 12, pointB: 14, pointC: 16 },
    ],
    repThresholds: { extended: 80, contracted: 170, hysteresis: 15 },
    primarySide: 'average',
  },
  {
    type: 'row',
    displayName: 'Row',
    trackedJoints: [
      { pointA: 11, pointB: 13, pointC: 15 },
      { pointA: 12, pointB: 14, pointC: 16 },
    ],
    repThresholds: { extended: 170, contracted: 80, hysteresis: 15 },
    primarySide: 'average',
  },
];

export function getProfileByType(type: ExerciseType): ExerciseProfile | undefined {
  return EXERCISE_PROFILES.find(p => p.type === type);
}
