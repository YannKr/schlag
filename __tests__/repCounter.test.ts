import { RepCounter } from '@/lib/repTracking/repCounter';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

function makeBlankLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 1.0,
  }));
}

/**
 * Position three landmarks to create a specific angle at pointB.
 * Uses the same geometry as the calculateAngle function (dot product / arccos).
 */
function setAngle(
  landmarks: NormalizedLandmark[],
  pointA: number,
  pointB: number,
  pointC: number,
  angleDeg: number,
): void {
  const rad = angleDeg * (Math.PI / 180);
  // Place B at center, A straight to the right, C at the desired angle
  landmarks[pointB] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
  landmarks[pointA] = { x: 0.7, y: 0.5, z: 0, visibility: 1.0 }; // right of B
  landmarks[pointC] = {
    x: 0.5 + 0.2 * Math.cos(rad),
    y: 0.5 + 0.2 * Math.sin(rad),
    z: 0,
    visibility: 1.0,
  };
}

function feedAngleForProfile(
  counter: RepCounter,
  profileType: string,
  angleDeg: number,
  frames: number = 6,
): void {
  const profile = getProfileByType(profileType as any)!;
  for (let i = 0; i < frames; i++) {
    const lm = makeBlankLandmarks();
    for (const joint of profile.trackedJoints) {
      setAngle(lm, joint.pointA, joint.pointB, joint.pointC, angleDeg);
    }
    counter.processFrame(lm);
  }
}

describe('RepCounter', () => {
  it('starts in idle state with 0 reps', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    const state = counter.getState();
    expect(state.repCount).toBe(0);
    expect(state.phase).toBe('idle');
    expect(state.isTracking).toBe(false);
  });

  it('transitions from idle to contracting on valid frame at extended position', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    feedAngleForProfile(counter, 'squat', 170, 6);
    const state = counter.getState();
    expect(state.phase).toBe('contracting');
    expect(state.isTracking).toBe(true);
  });

  it('counts one rep after a full extend-contract-extend cycle', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    feedAngleForProfile(counter, 'squat', 170, 6); // extended
    feedAngleForProfile(counter, 'squat', 85, 6);  // contracted
    feedAngleForProfile(counter, 'squat', 170, 6); // back to extended
    expect(counter.getState().repCount).toBe(1);
  });

  it('counts multiple reps', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    for (let rep = 0; rep < 3; rep++) {
      feedAngleForProfile(counter, 'squat', 170, 6);
      feedAngleForProfile(counter, 'squat', 85, 6);
    }
    feedAngleForProfile(counter, 'squat', 170, 6);
    expect(counter.getState().repCount).toBe(3);
  });

  it('does not count partial reps (no full contraction)', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    feedAngleForProfile(counter, 'squat', 170, 6); // extended
    feedAngleForProfile(counter, 'squat', 120, 6); // partial (not past 90+15)
    feedAngleForProfile(counter, 'squat', 170, 6); // back up
    expect(counter.getState().repCount).toBe(0);
  });

  it('skips low-confidence frames', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    const lm = makeBlankLandmarks();
    lm[23].visibility = 0.3; // left hip below 0.7 threshold
    counter.processFrame(lm);
    expect(counter.getState().isTracking).toBe(false);
  });

  it('preserves rep count when user exits frame', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    feedAngleForProfile(counter, 'squat', 170, 6);
    feedAngleForProfile(counter, 'squat', 85, 6);
    feedAngleForProfile(counter, 'squat', 170, 6);
    expect(counter.getState().repCount).toBe(1);

    // User exits frame
    const badLm = makeBlankLandmarks();
    badLm[23].visibility = 0.1;
    for (let i = 0; i < 10; i++) counter.processFrame(badLm);
    expect(counter.getState().repCount).toBe(1); // preserved
  });

  it('resets state correctly', () => {
    const profile = getProfileByType('squat')!;
    const counter = new RepCounter(profile);
    feedAngleForProfile(counter, 'squat', 170, 6);
    feedAngleForProfile(counter, 'squat', 85, 6);
    feedAngleForProfile(counter, 'squat', 170, 6);
    expect(counter.getState().repCount).toBe(1);
    counter.reset();
    expect(counter.getState().repCount).toBe(0);
    expect(counter.getState().phase).toBe('idle');
  });

  it('handles inverted exercises (overhead press)', () => {
    const profile = getProfileByType('overhead_press')!;
    const counter = new RepCounter(profile);
    // OHP: extended=80 (arms low), contracted=170 (arms high)
    feedAngleForProfile(counter, 'overhead_press', 80, 6);  // start position
    feedAngleForProfile(counter, 'overhead_press', 175, 6); // pressed up
    feedAngleForProfile(counter, 'overhead_press', 80, 6);  // back down
    expect(counter.getState().repCount).toBe(1);
  });
});
