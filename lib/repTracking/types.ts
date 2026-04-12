export type ExerciseType = 'squat' | 'deadlift' | 'bench' | 'curl' | 'overhead_press' | 'row';
export type LandmarkIndex = number;

export interface JointAngle {
  pointA: LandmarkIndex;
  pointB: LandmarkIndex;  // vertex
  pointC: LandmarkIndex;
}

export interface ExerciseProfile {
  type: ExerciseType;
  displayName: string;
  trackedJoints: JointAngle[];
  repThresholds: {
    extended: number;
    contracted: number;
    hysteresis: number;
  };
  primarySide: 'left' | 'right' | 'average';
}

export type RepPhase = 'idle' | 'contracting' | 'extending';

export interface RepState {
  repCount: number;
  phase: RepPhase;
  currentAngle: number | null;
  isTracking: boolean;
  lowConfidenceFrames: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
