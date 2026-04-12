import { calculateAngle } from './angleCalculation';
import type { ExerciseProfile, NormalizedLandmark, RepPhase, RepState } from './types';

const MIN_VISIBILITY = 0.7;
const SMOOTHING_WINDOW = 5;
const RECOVERY_FRAMES = 3;
const LOST_TRACKING_THRESHOLD = 3;

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

  processFrame(landmarks: NormalizedLandmark[]): RepState {
    // 1. Check confidence for all tracked joints
    if (!this.areJointsVisible(landmarks)) {
      this.lowConfidenceFrames++;
      this.highConfidenceStreak = 0;
      if (this.lowConfidenceFrames >= LOST_TRACKING_THRESHOLD) this.lostTracking = true;
      return this.getState();
    }

    // 2. Recovery from lost tracking needs consecutive good frames
    this.highConfidenceStreak++;
    if (this.lostTracking && this.highConfidenceStreak < RECOVERY_FRAMES) {
      return this.getState();
    }
    if (this.lostTracking) {
      this.lostTracking = false;
      this.angleBuffer = []; // Clear stale pre-dropout angles
    }
    this.lowConfidenceFrames = 0;

    // 3. Compute angle, add to smoothing buffer
    const rawAngle = this.computeAngle(landmarks);
    this.angleBuffer.push(rawAngle);
    if (this.angleBuffer.length > SMOOTHING_WINDOW) this.angleBuffer.shift();
    if (this.angleBuffer.length < SMOOTHING_WINDOW) return this.getState();

    // 4. Smoothed angle
    const smoothedAngle = this.angleBuffer.reduce((a, b) => a + b, 0) / this.angleBuffer.length;

    // 5. Update phase
    const { extended, contracted, hysteresis } = this.profile.repThresholds;
    const isInverted = extended < contracted;
    this.updatePhase(smoothedAngle, extended, contracted, hysteresis, isInverted);

    return this.getState();
  }

  getState(): RepState {
    return {
      repCount: this.repCount,
      phase: this.phase,
      currentAngle: this.angleBuffer.length > 0 ? this.angleBuffer[this.angleBuffer.length - 1] : null,
      isTracking: this.phase !== 'idle' && !this.lostTracking,
      lowConfidenceFrames: this.lowConfidenceFrames,
    };
  }

  reset(): void {
    this.phase = 'idle';
    this.repCount = 0;
    this.angleBuffer = [];
    this.lowConfidenceFrames = 0;
    this.highConfidenceStreak = 0;
    this.lostTracking = false;
  }

  private areJointsVisible(landmarks: NormalizedLandmark[]): boolean {
    for (const joint of this.profile.trackedJoints) {
      const maxIdx = Math.max(joint.pointA, joint.pointB, joint.pointC);
      if (maxIdx >= landmarks.length) return false;
      if (
        landmarks[joint.pointA].visibility < MIN_VISIBILITY ||
        landmarks[joint.pointB].visibility < MIN_VISIBILITY ||
        landmarks[joint.pointC].visibility < MIN_VISIBILITY
      ) {
        return false;
      }
      // Also check for NaN/Infinity coordinates
      for (const idx of [joint.pointA, joint.pointB, joint.pointC]) {
        if (!isFinite(landmarks[idx].x) || !isFinite(landmarks[idx].y)) return false;
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
    // Normal (extended > contracted): e.g. squat extended=170, contracted=90
    //   pastExtended  = angle >= extended - hysteresis  (e.g. >= 155)
    //   pastContracted = angle <= contracted + hysteresis (e.g. <= 105)
    // Inverted (extended < contracted): e.g. OHP extended=80, contracted=170
    //   pastExtended  = angle <= extended + hysteresis  (e.g. <= 95)
    //   pastContracted = angle >= contracted - hysteresis (e.g. >= 155)
    const pastExtended = isInverted
      ? angle <= extended + hysteresis
      : angle >= extended - hysteresis;
    const pastContracted = isInverted
      ? angle >= contracted - hysteresis
      : angle <= contracted + hysteresis;

    switch (this.phase) {
      case 'idle':
        if (pastExtended) this.phase = 'contracting';
        break;
      case 'contracting':
        if (pastContracted) this.phase = 'extending';
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
