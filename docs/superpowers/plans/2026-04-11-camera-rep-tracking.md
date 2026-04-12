# Camera Rep Tracking (Web-First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add camera-based rep counting to the workout screen using MediaPipe pose estimation, web-first. The camera watches the user during work intervals and displays a rep count. Exercise types are mapped per interval in the sequence builder.

**Architecture:** MediaPipe JS (`@mediapipe/tasks-vision`) processes webcam frames at 15fps, extracting 33 body landmarks. A pure-function rep counter engine computes joint angles and detects rep cycles (extended-contracted-extended) using per-exercise threshold profiles. A `useRepTracking` hook bridges camera frames to UI state. Camera is web-only in phase 1; native support deferred.

**Tech Stack:** `@mediapipe/tasks-vision` (pose estimation), Web `getUserMedia` API (camera), existing Zustand stores + MMKV (settings), React Native Web components (UI)

**Design Doc:** `~/.gstack/projects/YannKr-schlag/ypk-main-design-20260411-220718.md`

---

## File Map

### New files (create)

| File | Responsibility |
|------|---------------|
| `lib/repTracking/types.ts` | ExerciseType, ExerciseProfile, JointAngle, RepPhase, RepState types |
| `lib/repTracking/angleCalculation.ts` | Calculate angle between three landmarks (atan2-based) |
| `lib/repTracking/exerciseProfiles.ts` | 6 exercise profile definitions with joint indices and thresholds |
| `lib/repTracking/repCounter.ts` | Rep counting state machine (pure function, no platform deps) |
| `hooks/useCamera.web.ts` | Web camera hook: getUserMedia + MediaPipe pose landmarker |
| `hooks/useRepTracking.ts` | Bridge hook: camera landmarks -> rep counter -> React state |
| `components/CameraPreview.web.tsx` | Camera pip overlay for web workout screen |
| `components/RepCountDisplay.tsx` | Large green rep count display below progress bar |
| `components/ExerciseTypePicker.tsx` | Bottom sheet for picking exercise type in the builder |
| `__tests__/angleCalculation.test.ts` | Unit tests for angle math |
| `__tests__/repCounter.test.ts` | Unit tests for rep counting state machine |
| `__tests__/exerciseProfiles.test.ts` | Validation tests for exercise profile definitions |

### Modified files

| File | Change |
|------|--------|
| `types/interval.ts` | Add `exercise_type?: ExerciseType \| null` field |
| `types/settings.ts` | Add `cameraEnabled`, `cameraPosition`, `showCameraPreview` fields |
| `types/index.ts` | Re-export new types |
| `constants/defaults.ts` | Add camera setting defaults |
| `app/workout/[id].tsx` | Integrate CameraPreview + RepCountDisplay |
| `components/IntervalEditSheet.tsx` | Add exercise type picker trigger |
| `app/(tabs)/settings.tsx` | Add camera settings section |
| `package.json` | Add `@mediapipe/tasks-vision` dependency |

---

### Task 1: Types and Angle Calculation

**Files:**
- Create: `lib/repTracking/types.ts`
- Create: `lib/repTracking/angleCalculation.ts`
- Create: `__tests__/angleCalculation.test.ts`

- [ ] **Step 1: Write the rep tracking types**

```typescript
// lib/repTracking/types.ts

/**
 * Types for the camera rep tracking system.
 *
 * ExerciseType is the union of supported exercises.
 * ExerciseProfile defines which joints to track and the rep detection thresholds.
 * RepState is the output of the rep counter state machine.
 */

/** Supported exercise types for rep tracking. */
export type ExerciseType = 'squat' | 'deadlift' | 'bench' | 'curl' | 'overhead_press' | 'row';

/** MediaPipe landmark index (0-32). */
export type LandmarkIndex = number;

/** Three landmarks that form an angle, with pointB as the vertex. */
export interface JointAngle {
  pointA: LandmarkIndex;
  pointB: LandmarkIndex;
  pointC: LandmarkIndex;
}

/** Defines how to track reps for a specific exercise. */
export interface ExerciseProfile {
  type: ExerciseType;
  displayName: string;
  trackedJoints: JointAngle[];
  repThresholds: {
    /** Angle (degrees) at the extended/start position of the rep. */
    extended: number;
    /** Angle (degrees) at the contracted/bottom position of the rep. */
    contracted: number;
    /** Deadband (degrees) to prevent double-counting. */
    hysteresis: number;
  };
  /** Which body side to track. 'average' uses the mean of left and right. */
  primarySide: 'left' | 'right' | 'average';
}

/** Phase of the rep counting state machine. */
export type RepPhase = 'idle' | 'contracting' | 'extending';

/** Output of the rep counter on each frame. */
export interface RepState {
  repCount: number;
  phase: RepPhase;
  currentAngle: number | null;
  isTracking: boolean;
  /** Consecutive frames with low-confidence landmarks. */
  lowConfidenceFrames: number;
}

/**
 * A single normalized landmark from MediaPipe.
 * x, y are in [0, 1] normalized coordinates.
 * visibility is confidence (0-1).
 */
export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
```

- [ ] **Step 2: Write the failing angle calculation test**

```typescript
// __tests__/angleCalculation.test.ts

import { calculateAngle } from '@/lib/repTracking/angleCalculation';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

function makeLandmark(x: number, y: number): NormalizedLandmark {
  return { x, y, z: 0, visibility: 1.0 };
}

describe('calculateAngle', () => {
  it('returns 180 for three collinear points', () => {
    const a = makeLandmark(0, 0);
    const b = makeLandmark(0.5, 0);
    const c = makeLandmark(1, 0);
    expect(calculateAngle(a, b, c)).toBeCloseTo(180, 0);
  });

  it('returns 90 for a right angle', () => {
    const a = makeLandmark(0, 0);
    const b = makeLandmark(0, 0.5);
    const c = makeLandmark(0.5, 0.5);
    expect(calculateAngle(a, b, c)).toBeCloseTo(90, 0);
  });

  it('returns ~45 for a 45-degree angle', () => {
    const a = makeLandmark(0, 0);
    const b = makeLandmark(0.5, 0.5);
    const c = makeLandmark(1, 0.5);
    expect(calculateAngle(a, b, c)).toBeCloseTo(45, 0);
  });

  it('is symmetric (swapping a and c gives the same angle)', () => {
    const a = makeLandmark(0, 0);
    const b = makeLandmark(0.5, 0.3);
    const c = makeLandmark(1, 0.1);
    expect(calculateAngle(a, b, c)).toBeCloseTo(calculateAngle(c, b, a), 5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/angleCalculation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/repTracking/angleCalculation'`

- [ ] **Step 4: Implement angle calculation**

```typescript
// lib/repTracking/angleCalculation.ts

/**
 * Calculate the angle (in degrees) at vertex B formed by points A-B-C.
 *
 * Uses atan2 for robust angle computation across all quadrants.
 * Returns a value in [0, 180].
 */

import type { NormalizedLandmark } from './types';

export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) -
                  Math.atan2(a.y - b.y, a.x - b.x);

  let degrees = Math.abs(radians * (180 / Math.PI));

  if (degrees > 180) {
    degrees = 360 - degrees;
  }

  return degrees;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/angleCalculation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/repTracking/types.ts lib/repTracking/angleCalculation.ts __tests__/angleCalculation.test.ts
git commit -m "feat: add rep tracking types and angle calculation"
```

---

### Task 2: Exercise Profiles

**Files:**
- Create: `lib/repTracking/exerciseProfiles.ts`
- Create: `__tests__/exerciseProfiles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/exerciseProfiles.test.ts

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/exerciseProfiles.test.ts`
Expected: FAIL — `Cannot find module '@/lib/repTracking/exerciseProfiles'`

- [ ] **Step 3: Implement exercise profiles**

MediaPipe Pose landmark indices reference:
- 11: left shoulder, 12: right shoulder
- 13: left elbow, 14: right elbow
- 15: left wrist, 16: right wrist
- 23: left hip, 24: right hip
- 25: left knee, 26: right knee
- 27: left ankle, 28: right ankle

```typescript
// lib/repTracking/exerciseProfiles.ts

import type { ExerciseProfile, ExerciseType } from './types';

/**
 * Exercise profiles defining which joints to track and the angle thresholds
 * for rep detection. Each profile maps to a specific exercise type.
 *
 * Landmark indices follow the MediaPipe Pose model (33 landmarks).
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 *
 * For "normal" exercises: extended > contracted (angle decreases during contraction).
 * For "inverted" exercises (overhead press): extended < contracted (angle increases).
 * The rep counter handles both directions automatically.
 */
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
      { pointA: 11, pointB: 13, pointC: 15 }, // left shoulder-elbow-wrist
      { pointA: 12, pointB: 14, pointC: 16 }, // right shoulder-elbow-wrist
    ],
    // Inverted: angle starts low (~80) and increases to ~170 during the press.
    repThresholds: { extended: 80, contracted: 170, hysteresis: 15 },
    primarySide: 'average',
  },
  {
    type: 'row',
    displayName: 'Row',
    trackedJoints: [
      { pointA: 11, pointB: 13, pointC: 15 }, // left shoulder-elbow-wrist
      { pointA: 12, pointB: 14, pointC: 16 }, // right shoulder-elbow-wrist
    ],
    repThresholds: { extended: 170, contracted: 80, hysteresis: 15 },
    primarySide: 'average',
  },
];

/** Look up an exercise profile by type. Returns undefined if not found. */
export function getProfileByType(type: ExerciseType): ExerciseProfile | undefined {
  return EXERCISE_PROFILES.find(p => p.type === type);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/exerciseProfiles.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/repTracking/exerciseProfiles.ts __tests__/exerciseProfiles.test.ts
git commit -m "feat: add 6 exercise profiles for rep tracking"
```

---

### Task 3: Rep Counter State Machine

**Files:**
- Create: `lib/repTracking/repCounter.ts`
- Create: `__tests__/repCounter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/repCounter.test.ts

import { RepCounter } from '@/lib/repTracking/repCounter';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a full 33-landmark array with all points at (0.5, 0.5). */
function makeBlankLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 1.0,
  }));
}

/**
 * Set a specific joint angle by positioning three landmarks.
 * Places pointB at center, pointA straight left, pointC at the desired angle.
 */
function setAngle(
  landmarks: NormalizedLandmark[],
  pointA: number,
  pointB: number,
  pointC: number,
  angleDeg: number,
): void {
  const rad = angleDeg * (Math.PI / 180);
  landmarks[pointB] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
  landmarks[pointA] = { x: 0.5 - 0.2, y: 0.5, z: 0, visibility: 1.0 };
  landmarks[pointC] = {
    x: 0.5 + 0.2 * Math.cos(Math.PI - rad),
    y: 0.5 + 0.2 * Math.sin(Math.PI - rad),
    z: 0,
    visibility: 1.0,
  };
}

/** Simulate N frames of a given angle for the squat profile. */
function feedSquatAngle(counter: RepCounter, angleDeg: number, frames: number = 6): void {
  const profile = getProfileByType('squat')!;
  const joint = profile.trackedJoints[0]; // left hip-knee-ankle
  for (let i = 0; i < frames; i++) {
    const lm = makeBlankLandmarks();
    setAngle(lm, joint.pointA, joint.pointB, joint.pointC, angleDeg);
    // Also set right side for average
    const joint2 = profile.trackedJoints[1];
    setAngle(lm, joint2.pointA, joint2.pointB, joint2.pointC, angleDeg);
    counter.processFrame(lm);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RepCounter', () => {
  it('starts in idle state with 0 reps', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    const state = counter.getState();
    expect(state.repCount).toBe(0);
    expect(state.phase).toBe('idle');
    expect(state.isTracking).toBe(false);
  });

  it('transitions from idle to contracting on valid frame', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    // Feed frames at the extended position (170 deg)
    feedSquatAngle(counter, 170, 6);
    const state = counter.getState();
    expect(state.phase).toBe('contracting');
    expect(state.isTracking).toBe(true);
  });

  it('counts one rep after a full extend-contract-extend cycle', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    // Start at extended position
    feedSquatAngle(counter, 170, 6);
    expect(counter.getState().phase).toBe('contracting');

    // Contract to bottom of squat
    feedSquatAngle(counter, 85, 6);
    expect(counter.getState().phase).toBe('extending');

    // Extend back up
    feedSquatAngle(counter, 170, 6);
    expect(counter.getState().repCount).toBe(1);
  });

  it('counts multiple reps', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    for (let rep = 0; rep < 3; rep++) {
      feedSquatAngle(counter, 170, 6);
      feedSquatAngle(counter, 85, 6);
    }
    feedSquatAngle(counter, 170, 6); // final extension
    expect(counter.getState().repCount).toBe(3);
  });

  it('does not count partial reps (no full contraction)', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    feedSquatAngle(counter, 170, 6); // extended
    feedSquatAngle(counter, 120, 6); // partial squat (not below 90)
    feedSquatAngle(counter, 170, 6); // back up
    expect(counter.getState().repCount).toBe(0);
  });

  it('skips low-confidence frames', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    // Feed a frame with low visibility
    const lm = makeBlankLandmarks();
    lm[23].visibility = 0.3; // left hip below threshold
    counter.processFrame(lm);
    expect(counter.getState().isTracking).toBe(false);
  });

  it('preserves rep count when user exits frame', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    // Complete one rep
    feedSquatAngle(counter, 170, 6);
    feedSquatAngle(counter, 85, 6);
    feedSquatAngle(counter, 170, 6);
    expect(counter.getState().repCount).toBe(1);

    // User exits frame (low confidence)
    const badLm = makeBlankLandmarks();
    badLm[23].visibility = 0.1;
    for (let i = 0; i < 10; i++) counter.processFrame(badLm);

    // Rep count preserved
    expect(counter.getState().repCount).toBe(1);
  });

  it('resets state correctly', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);

    feedSquatAngle(counter, 170, 6);
    feedSquatAngle(counter, 85, 6);
    feedSquatAngle(counter, 170, 6);
    expect(counter.getState().repCount).toBe(1);

    counter.reset();
    expect(counter.getState().repCount).toBe(0);
    expect(counter.getState().phase).toBe('idle');
  });

  it('handles inverted exercises (overhead press)', () => {
    const profile = getProfileByType('overhead_press')!;
    const counter = new RepCounter(profile);
    const joint = profile.trackedJoints[0];
    const joint2 = profile.trackedJoints[1];

    function feedPressAngle(angle: number, frames: number = 6) {
      for (let i = 0; i < frames; i++) {
        const lm = makeBlankLandmarks();
        setAngle(lm, joint.pointA, joint.pointB, joint.pointC, angle);
        setAngle(lm, joint2.pointA, joint2.pointB, joint2.pointC, angle);
        counter.processFrame(lm);
      }
    }

    // Start at "extended" (low position, 80 deg for OHP)
    feedPressAngle(80, 6);
    // Press up to contracted (high position, 175 deg for OHP)
    feedPressAngle(175, 6);
    // Back down to extended
    feedPressAngle(80, 6);
    expect(counter.getState().repCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/repCounter.test.ts`
Expected: FAIL — `Cannot find module '@/lib/repTracking/repCounter'`

- [ ] **Step 3: Implement the rep counter**

```typescript
// lib/repTracking/repCounter.ts

/**
 * Rep counting state machine.
 *
 * Pure logic, no platform dependencies. Processes a stream of MediaPipe
 * landmark frames and detects rep cycles using angle-based threshold crossing.
 *
 * State machine: IDLE -> CONTRACTING -> EXTENDING -> (rep counted) -> CONTRACTING -> ...
 *
 * For "inverted" exercises where extended < contracted (e.g. overhead press),
 * the direction check is automatically inverted. No special-case code needed.
 */

import { calculateAngle } from './angleCalculation';
import type { ExerciseProfile, NormalizedLandmark, RepPhase, RepState } from './types';

/** Minimum landmark visibility to consider a frame valid. */
const MIN_VISIBILITY = 0.7;

/** Number of frames in the smoothing window. */
const SMOOTHING_WINDOW = 5;

/** Consecutive high-confidence frames needed to recover from lost tracking. */
const RECOVERY_FRAMES = 3;

export class RepCounter {
  private profile: ExerciseProfile;
  private phase: RepPhase = 'idle';
  private repCount = 0;
  private angleBuffer: number[] = [];
  private lowConfidenceFrames = 0;
  private highConfidenceStreak = 0;
  private lostTracking = false;

  constructor(profile: ExerciseProfile) {
    this.profile = profile;
  }

  /** Process a single frame of landmarks. */
  processFrame(landmarks: NormalizedLandmark[]): RepState {
    // Check confidence for all tracked joints
    if (!this.areJointsVisible(landmarks)) {
      this.lowConfidenceFrames++;
      this.highConfidenceStreak = 0;
      if (this.lowConfidenceFrames > 0) {
        this.lostTracking = true;
      }
      return this.getState();
    }

    // Recovering from lost tracking: require consecutive good frames
    this.highConfidenceStreak++;
    if (this.lostTracking && this.highConfidenceStreak < RECOVERY_FRAMES) {
      return this.getState();
    }
    this.lostTracking = false;
    this.lowConfidenceFrames = 0;

    // Calculate the tracked angle
    const rawAngle = this.computeAngle(landmarks);
    this.angleBuffer.push(rawAngle);
    if (this.angleBuffer.length > SMOOTHING_WINDOW) {
      this.angleBuffer.shift();
    }

    // Need enough samples for smoothing
    if (this.angleBuffer.length < SMOOTHING_WINDOW) {
      return this.getState();
    }

    const smoothedAngle = this.angleBuffer.reduce((a, b) => a + b, 0) / this.angleBuffer.length;
    const { extended, contracted, hysteresis } = this.profile.repThresholds;
    const isInverted = extended < contracted;

    this.updatePhase(smoothedAngle, extended, contracted, hysteresis, isInverted);

    return this.getState();
  }

  /** Get the current state without processing a frame. */
  getState(): RepState {
    const lastAngle = this.angleBuffer.length > 0
      ? this.angleBuffer[this.angleBuffer.length - 1]
      : null;

    return {
      repCount: this.repCount,
      phase: this.phase,
      currentAngle: lastAngle,
      isTracking: this.phase !== 'idle' && !this.lostTracking,
      lowConfidenceFrames: this.lowConfidenceFrames,
    };
  }

  /** Reset the counter (e.g. on interval change). */
  reset(): void {
    this.phase = 'idle';
    this.repCount = 0;
    this.angleBuffer = [];
    this.lowConfidenceFrames = 0;
    this.highConfidenceStreak = 0;
    this.lostTracking = false;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private areJointsVisible(landmarks: NormalizedLandmark[]): boolean {
    for (const joint of this.profile.trackedJoints) {
      if (
        landmarks[joint.pointA].visibility < MIN_VISIBILITY ||
        landmarks[joint.pointB].visibility < MIN_VISIBILITY ||
        landmarks[joint.pointC].visibility < MIN_VISIBILITY
      ) {
        return false;
      }
    }
    return true;
  }

  private computeAngle(landmarks: NormalizedLandmark[]): number {
    const joints = this.profile.trackedJoints;

    if (this.profile.primarySide === 'average' && joints.length >= 2) {
      const left = calculateAngle(
        landmarks[joints[0].pointA],
        landmarks[joints[0].pointB],
        landmarks[joints[0].pointC],
      );
      const right = calculateAngle(
        landmarks[joints[1].pointA],
        landmarks[joints[1].pointB],
        landmarks[joints[1].pointC],
      );
      return (left + right) / 2;
    }

    // Single side (e.g. curl)
    const joint = joints[0];
    return calculateAngle(
      landmarks[joint.pointA],
      landmarks[joint.pointB],
      landmarks[joint.pointC],
    );
  }

  private updatePhase(
    angle: number,
    extended: number,
    contracted: number,
    hysteresis: number,
    isInverted: boolean,
  ): void {
    // For normal exercises: extended > contracted, angle decreases during contraction.
    // For inverted exercises: extended < contracted, angle increases during contraction.
    // We normalize by checking "has the angle crossed the threshold in the right direction."

    const pastExtended = isInverted
      ? angle <= extended + hysteresis
      : angle >= extended - hysteresis;

    const pastContracted = isInverted
      ? angle >= contracted - hysteresis
      : angle <= contracted + hysteresis;

    switch (this.phase) {
      case 'idle':
        if (pastExtended) {
          this.phase = 'contracting';
        }
        break;

      case 'contracting':
        if (pastContracted) {
          this.phase = 'extending';
        }
        break;

      case 'extending':
        if (pastExtended) {
          this.repCount++;
          this.phase = 'contracting';
        }
        break;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/repCounter.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/repTracking/repCounter.ts __tests__/repCounter.test.ts
git commit -m "feat: add rep counter state machine with angle-based detection"
```

---

### Task 4: Data Model Extension (Interval + Settings)

**Files:**
- Modify: `types/interval.ts`
- Modify: `types/settings.ts`
- Modify: `types/index.ts`
- Modify: `constants/defaults.ts`

- [ ] **Step 1: Add ExerciseType to the Interval type**

In `types/interval.ts`, add after the `custom_audio_url` field:

```typescript
  /** Exercise type for camera rep tracking. null/undefined = no tracking. */
  exercise_type?: import('./repTracking').ExerciseType | null;
```

Wait — we already have the ExerciseType in `lib/repTracking/types.ts`. Since the Interval type is in `types/`, let's just inline the type union there to avoid circular deps:

In `types/interval.ts`, add at the top (after the `IntervalColorHex` type):

```typescript
/** Supported exercise types for camera rep tracking. */
export type ExerciseType = 'squat' | 'deadlift' | 'bench' | 'curl' | 'overhead_press' | 'row';
```

And add to the `Interval` interface (after `custom_audio_url`):

```typescript
  /** Exercise type for camera rep tracking. null/undefined = no tracking. */
  exercise_type?: ExerciseType | null;
```

Then update `lib/repTracking/types.ts` to import from the canonical location:

```typescript
// At the top of lib/repTracking/types.ts, replace the ExerciseType definition:
export type { ExerciseType } from '@/types/interval';
```

- [ ] **Step 2: Add camera settings to AppSettings**

In `types/settings.ts`, add three fields to `AppSettings` (after `reduceMotion`):

```typescript
  /** Global toggle for camera rep tracking. Off by default. Web-only in phase 1. */
  cameraEnabled: boolean;

  /** Which camera to use. Default: user-facing. */
  cameraPosition: 'front' | 'back';

  /** Show/hide the camera pip overlay on the workout screen. */
  showCameraPreview: boolean;
```

- [ ] **Step 3: Update barrel exports**

In `types/index.ts`, add to the interval export:

```typescript
export type { IntervalColorHex, Interval, ExerciseType } from './interval';
```

- [ ] **Step 4: Update default settings**

In `constants/defaults.ts`, add to `DEFAULT_SETTINGS`:

```typescript
  cameraEnabled: false,
  cameraPosition: 'front' as const,
  showCameraPreview: true,
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add types/interval.ts types/settings.ts types/index.ts constants/defaults.ts lib/repTracking/types.ts
git commit -m "feat: add exercise_type to Interval and camera settings to AppSettings"
```

---

### Task 5: Web Camera Hook

**Files:**
- Create: `hooks/useCamera.web.ts`

This hook is web-only (`.web.ts` suffix, used by React Native Web's platform resolution). It manages the webcam stream, initializes MediaPipe PoseLandmarker, and emits landmarks at 15fps.

- [ ] **Step 1: Install MediaPipe dependency**

Run: `npm install @mediapipe/tasks-vision`

- [ ] **Step 2: Implement the web camera hook**

```typescript
// hooks/useCamera.web.ts

/**
 * Web-specific camera hook using getUserMedia + MediaPipe PoseLandmarker.
 *
 * Manages the webcam stream lifecycle and runs pose estimation at ~15fps.
 * Emits normalized landmarks via a callback. Platform-specific: this file
 * is only loaded on web via React Native's .web.ts resolution.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

const FRAME_INTERVAL_MS = 1000 / 15; // 15fps

export interface UseCameraWebOptions {
  enabled: boolean;
  facingMode: 'user' | 'environment';
  onLandmarks: (landmarks: NormalizedLandmark[]) => void;
}

export interface UseCameraWebReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

export function useCameraWeb({
  enabled,
  facingMode,
  onLandmarks,
}: UseCameraWebOptions): UseCameraWebReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastProcessedRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  // Initialize MediaPipe PoseLandmarker
  const initLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (e) {
      setError('Rep tracking unavailable: model failed to load.');
      return null;
    }
  }, []);

  // Start webcam + processing loop
  useEffect(() => {
    if (!enabled) {
      // Cleanup
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      setIsReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        // Init MediaPipe
        const landmarker = await initLandmarker();
        if (!landmarker || cancelled) return;

        setIsReady(true);

        // Processing loop at ~15fps
        function processFrame() {
          if (cancelled) return;
          animFrameRef.current = requestAnimationFrame(processFrame);

          const now = performance.now();
          if (now - lastProcessedRef.current < FRAME_INTERVAL_MS) return;
          lastProcessedRef.current = now;

          const video = videoRef.current;
          const landmarker = landmarkerRef.current;
          if (!video || !landmarker || video.readyState < 2) return;

          try {
            const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now);
            if (result.landmarks && result.landmarks.length > 0) {
              // Convert to our NormalizedLandmark format
              const landmarks: NormalizedLandmark[] = result.landmarks[0].map(
                (lm, i) => ({
                  x: lm.x,
                  y: lm.y,
                  z: lm.z,
                  visibility: result.landmarks[0][i].visibility ?? 0,
                }),
              );
              onLandmarksRef.current(landmarks);
            }
          } catch {
            // Frame processing error — skip this frame silently
          }
        }

        processFrame();
      } catch (e) {
        if (!cancelled) {
          setError('Camera access denied.');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [enabled, facingMode, initLandmarker]);

  return { videoRef, isReady, error };
}
```

- [ ] **Step 3: Create a native stub**

Create `hooks/useCamera.ts` as a no-op stub for native platforms (phase 1 is web-only):

```typescript
// hooks/useCamera.ts

/**
 * Native camera hook stub. Camera rep tracking is web-only in phase 1.
 * This file exists so native builds don't fail on import.
 */

import { useRef } from 'react';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

export interface UseCameraWebOptions {
  enabled: boolean;
  facingMode: 'user' | 'environment';
  onLandmarks: (landmarks: NormalizedLandmark[]) => void;
}

export interface UseCameraWebReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

export function useCameraWeb(_options: UseCameraWebOptions): UseCameraWebReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  return { videoRef, isReady: false, error: null };
}
```

- [ ] **Step 4: Commit**

```bash
git add hooks/useCamera.web.ts hooks/useCamera.ts package.json package-lock.json
git commit -m "feat: add web camera hook with MediaPipe PoseLandmarker"
```

---

### Task 6: useRepTracking Hook

**Files:**
- Create: `hooks/useRepTracking.ts`

- [ ] **Step 1: Implement the bridge hook**

```typescript
// hooks/useRepTracking.ts

/**
 * useRepTracking — bridges camera landmarks to the rep counter engine.
 *
 * Responsibilities:
 *   1. Initialize RepCounter with the current interval's exercise profile.
 *   2. Feed camera landmarks to the counter on each frame.
 *   3. Reset rep count when the interval changes.
 *   4. Pause tracking during rest intervals.
 *   5. Expose rep count and tracking status to the workout screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { TimerTickData } from '@/types';
import type { ExerciseType } from '@/types/interval';
import type { NormalizedLandmark } from '@/lib/repTracking/types';
import { RepCounter } from '@/lib/repTracking/repCounter';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';
import { useCameraWeb } from './useCamera';
import { useSettingsStore } from '@/stores/settingsStore';

export interface UseRepTrackingReturn {
  repCount: number;
  isTracking: boolean;
  isWebOnly: boolean;
  cameraError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showNoPoseHint: boolean;
}

/** Seconds with no valid pose before showing the "position camera" hint. */
const NO_POSE_HINT_THRESHOLD_MS = 5000;

export function useRepTracking(
  tickData: TimerTickData | null,
): UseRepTrackingReturn {
  const settings = useSettingsStore((s) => s.settings);
  const [repCount, setRepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [showNoPoseHint, setShowNoPoseHint] = useState(false);

  const counterRef = useRef<RepCounter | null>(null);
  const prevIntervalIndexRef = useRef<number>(-1);
  const noPoseTimerRef = useRef<number>(0);
  const hadPoseRef = useRef(false);

  // Determine if camera should be active
  const isWeb = Platform.OS === 'web';
  const exerciseType = tickData?.currentInterval?.exercise_type as ExerciseType | undefined;
  const isRestInterval = tickData?.isRestBetweenSets ?? true;
  const shouldTrack = isWeb && settings.cameraEnabled && !!exerciseType && !isRestInterval && tickData?.status === 'running';

  // Reset counter on interval change
  useEffect(() => {
    if (!tickData) return;
    const currentIndex = tickData.currentIntervalIndex;
    if (currentIndex !== prevIntervalIndexRef.current) {
      prevIntervalIndexRef.current = currentIndex;

      // Get profile for new interval
      const profile = exerciseType ? getProfileByType(exerciseType) : null;
      if (profile) {
        counterRef.current = new RepCounter(profile);
      } else {
        counterRef.current = null;
      }
      setRepCount(0);
      setIsTracking(false);
      setShowNoPoseHint(false);
      hadPoseRef.current = false;
      noPoseTimerRef.current = 0;
    }
  }, [tickData, exerciseType]);

  // Landmark callback
  const onLandmarks = useCallback((landmarks: NormalizedLandmark[]) => {
    const counter = counterRef.current;
    if (!counter) return;

    const state = counter.processFrame(landmarks);
    setRepCount(state.repCount);
    setIsTracking(state.isTracking);

    if (state.isTracking) {
      hadPoseRef.current = true;
      noPoseTimerRef.current = 0;
      setShowNoPoseHint(false);
    } else if (hadPoseRef.current || noPoseTimerRef.current === 0) {
      // Start or continue no-pose timer
      noPoseTimerRef.current = noPoseTimerRef.current || Date.now();
      if (Date.now() - noPoseTimerRef.current > NO_POSE_HINT_THRESHOLD_MS) {
        setShowNoPoseHint(true);
      }
    }
  }, []);

  // Camera hook
  const { videoRef, isReady, error: cameraError } = useCameraWeb({
    enabled: shouldTrack,
    facingMode: settings.cameraPosition === 'back' ? 'environment' : 'user',
    onLandmarks,
  });

  return {
    repCount,
    isTracking: isTracking && isReady,
    isWebOnly: true,
    cameraError,
    videoRef,
    showNoPoseHint,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useRepTracking.ts
git commit -m "feat: add useRepTracking hook bridging camera to rep counter"
```

---

### Task 7: UI Components (RepCountDisplay + CameraPreview)

**Files:**
- Create: `components/RepCountDisplay.tsx`
- Create: `components/CameraPreview.web.tsx`

- [ ] **Step 1: Implement RepCountDisplay**

```typescript
// components/RepCountDisplay.tsx

/**
 * Displays the current rep count on the workout screen.
 * Green (#00ff88) to visually distinguish from the white countdown timer.
 * Only visible when the current interval has an exercise type and camera is active.
 */

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
```

- [ ] **Step 2: Implement CameraPreview (web-only)**

```typescript
// components/CameraPreview.web.tsx

/**
 * Camera pip overlay for the workout screen (web-only).
 *
 * Shows the webcam feed in a small overlay in the top-right corner.
 * Displays a "tracking" or "position camera" status indicator.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  showNoPoseHint: boolean;
  repCount: number;
  visible: boolean;
}

export function CameraPreview({
  videoRef,
  isTracking,
  showNoPoseHint,
  repCount,
  visible,
}: CameraPreviewProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* The video element is rendered via a raw HTML ref */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 12,
          transform: 'scaleX(-1)', // Mirror front-facing camera
        }}
        playsInline
        muted
        autoPlay
      />
      {/* Status indicator */}
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {showNoPoseHint
            ? 'Position camera'
            : isTracking
              ? `${repCount} reps`
              : 'Starting...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00ff88',
  },
});
```

- [ ] **Step 3: Create a native CameraPreview stub**

```typescript
// components/CameraPreview.tsx

/**
 * Native camera preview stub. Camera rep tracking is web-only in phase 1.
 */

import React from 'react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  showNoPoseHint: boolean;
  repCount: number;
  visible: boolean;
}

export function CameraPreview(_props: CameraPreviewProps) {
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/RepCountDisplay.tsx components/CameraPreview.web.tsx components/CameraPreview.tsx
git commit -m "feat: add RepCountDisplay and CameraPreview components"
```

---

### Task 8: Integrate into Workout Screen

**Files:**
- Modify: `app/workout/[id].tsx`

- [ ] **Step 1: Add imports and hook to WorkoutScreen**

At the top of the file, add imports:

```typescript
import { useRepTracking } from '@/hooks/useRepTracking';
import { CameraPreview } from '@/components/CameraPreview';
import { RepCountDisplay } from '@/components/RepCountDisplay';
```

Inside `WorkoutScreen()`, after the `useIntensity` call (line ~765), add:

```typescript
  // Camera rep tracking (web-only in phase 1).
  const repTracking = useRepTracking(timerLoop.tickData);
```

- [ ] **Step 2: Add CameraPreview to the render**

Inside the `{/* Main content area */}` View (around line 1197), add the CameraPreview as the first child inside the `contentArea` View:

```typescript
        {/* Camera rep tracking overlay (web-only) */}
        <CameraPreview
          videoRef={repTracking.videoRef}
          isTracking={repTracking.isTracking}
          showNoPoseHint={repTracking.showNoPoseHint}
          repCount={repTracking.repCount}
          visible={settings.cameraEnabled && settings.showCameraPreview && !!tickData?.currentInterval?.exercise_type && !tickData?.isRestBetweenSets}
        />
```

- [ ] **Step 3: Add RepCountDisplay after the progress bar**

After the `{/* Coaching note */}` section (around line 1261), insert the RepCountDisplay:

```typescript
          {/* Rep count from camera tracking */}
          <RepCountDisplay
            repCount={repTracking.repCount}
            isTracking={repTracking.isTracking}
            visible={settings.cameraEnabled && !!tickData?.currentInterval?.exercise_type && !tickData?.isRestBetweenSets}
          />
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/workout/[id].tsx
git commit -m "feat: integrate camera rep tracking into workout screen"
```

---

### Task 9: Exercise Type Picker + Builder Integration

**Files:**
- Create: `components/ExerciseTypePicker.tsx`
- Modify: `components/IntervalEditSheet.tsx`

- [ ] **Step 1: Implement ExerciseTypePicker**

```typescript
// components/ExerciseTypePicker.tsx

/**
 * Bottom sheet for selecting an exercise type for an interval.
 * Used in the sequence builder's IntervalEditSheet.
 */

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
            {/* No tracking option */}
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

            {/* Exercise options */}
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
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: APP_COLORS.backgroundDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
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
```

- [ ] **Step 2: Add exercise type field to IntervalEditSheet**

In `components/IntervalEditSheet.tsx`:

Add import at the top:

```typescript
import { ExerciseTypePicker } from '@/components/ExerciseTypePicker';
import type { ExerciseType } from '@/types/interval';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';
```

Inside the component, add state (after existing `useState` calls around line 82):

```typescript
  const [exerciseType, setExerciseType] = useState<ExerciseType | null | undefined>(
    interval?.exercise_type ?? null,
  );
  const [showExercisePicker, setShowExercisePicker] = useState(false);
```

Update the `useEffect` that syncs state from the interval prop to also sync `exerciseType`:

```typescript
  setExerciseType(interval?.exercise_type ?? null);
```

Update `handleSave` to include `exercise_type` in the saved interval:

```typescript
    onSave({
      ...interval,
      name: trimmedName,
      duration_seconds: totalSeconds,
      color,
      note: note.trim(),
      exercise_type: exerciseType,
    });
```

Add the exercise type picker trigger in the form (after the color picker section). Add a Pressable that shows the current exercise type and opens the picker:

```typescript
          {/* Exercise Type (for camera rep tracking) */}
          <Text style={styles.fieldLabel}>Rep Tracking</Text>
          <Pressable
            style={styles.exerciseTypeButton}
            onPress={() => setShowExercisePicker(true)}
          >
            <Text style={styles.exerciseTypeText}>
              {exerciseType
                ? getProfileByType(exerciseType)?.displayName ?? exerciseType
                : 'No tracking'}
            </Text>
            <Text style={styles.exerciseTypeChevron}>›</Text>
          </Pressable>

          <ExerciseTypePicker
            visible={showExercisePicker}
            selected={exerciseType}
            onSelect={setExerciseType}
            onClose={() => setShowExercisePicker(false)}
          />
```

Add styles for the exercise type button (add to the StyleSheet):

```typescript
  exerciseTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  exerciseTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  exerciseTypeChevron: {
    fontSize: 18,
    color: '#94a3b8',
  },
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/ExerciseTypePicker.tsx components/IntervalEditSheet.tsx
git commit -m "feat: add exercise type picker to sequence builder"
```

---

### Task 10: Camera Settings in Settings Screen

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add camera settings section**

In `app/(tabs)/settings.tsx`, find where the existing settings toggle handlers are defined (around line 310-350). Add handlers:

```typescript
  const handleCameraToggle = useCallback(
    (val: boolean) => updateSetting('cameraEnabled', val),
    [updateSetting],
  );
  const handleCameraPositionToggle = useCallback(
    () => updateSetting(
      'cameraPosition',
      settings.cameraPosition === 'front' ? 'back' : 'front',
    ),
    [updateSetting, settings.cameraPosition],
  );
  const handleCameraPreviewToggle = useCallback(
    (val: boolean) => updateSetting('showCameraPreview', val),
    [updateSetting],
  );
```

Then find where the setting rows are rendered and add a new "Camera" section (after the existing "Display" or "Audio" section):

```typescript
        {/* Camera Rep Tracking */}
        {Platform.OS === 'web' && (
          <>
            <Text style={styles.sectionTitle}>Camera Rep Tracking</Text>
            <SettingRow
              label="Enable Camera"
              description="Use webcam to count reps during workouts"
              value={settings.cameraEnabled}
              onToggle={handleCameraToggle}
            />
            {settings.cameraEnabled && (
              <>
                <SettingRow
                  label="Show Camera Preview"
                  description="Display camera feed on workout screen"
                  value={settings.showCameraPreview}
                  onToggle={handleCameraPreviewToggle}
                />
              </>
            )}
          </>
        )}
```

Note: The `Platform.OS === 'web'` gate hides camera settings on native since it's web-only in phase 1.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: add camera rep tracking settings (web-only)"
```

---

### Task 11: Final Integration Test

**Files:** None (manual testing)

- [ ] **Step 1: Run all unit tests**

Run: `npx jest`
Expected: All existing tests pass plus new angleCalculation, exerciseProfiles, and repCounter tests.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build for web**

Run: `npx expo export --platform web`
Expected: Build succeeds with no errors. Verify `@mediapipe/tasks-vision` is bundled.

- [ ] **Step 4: Manual smoke test**

Run: `npx expo start --web`

Test checklist:
1. Go to Settings. Verify "Camera Rep Tracking" section appears (web only).
2. Enable "Enable Camera." Browser should prompt for camera permission.
3. Create a new sequence. Add an interval. Open the interval editor.
4. Verify "Rep Tracking" field appears. Tap it. Verify exercise type picker opens.
5. Select "Squat." Save the interval.
6. Start the workout.
7. Verify the camera pip appears in the top-right corner.
8. Verify the rep count display shows below the progress bar.
9. Perform squats in front of the camera. Verify reps are counted.
10. Skip to a rest interval. Verify camera stays active but rep count hides.
11. Skip to an interval with no exercise type. Verify camera pip hides.
12. Pause and resume. Verify rep count is preserved.

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: camera rep tracking — web-first, 6 exercise profiles, MediaPipe pose estimation"
```
