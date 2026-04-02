/**
 * Pure intensity engine for the Schlag workout screen.
 *
 * Computes visual intensity outputs (glow, pulse, color temperature)
 * from the current workout state. Drives the "dramatic arc" of the
 * workout -- opening calm, rising tension, climax energy, and release.
 *
 * All functions are pure and stateless. No side effects, no DOM access.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntensityInput {
  totalIntervals: number;
  currentIntervalIndex: number;
  totalRounds: number; // 0 = infinite mode
  currentRound: number; // 1-based
  intervalProgress: number; // 0-1 within current interval
  isRestBetweenSets: boolean;
  remainingMs: number;
}

export type Act = 'opening' | 'rising' | 'climax' | 'release';

export interface IntensityOutput {
  overall: number; // 0-1
  pulse: number; // 0-1, maps to breathing Hz
  colorTemp: number; // 0-1, cool(0) to hot(1)
  glowRadius: number; // px
  glowOpacity: number; // 0-1
  act: Act;
}

// ---------------------------------------------------------------------------
// Color palette constants
// ---------------------------------------------------------------------------

export const INTENSITY_COLORS = {
  cool: { bg: '#1A1A2E', glow: '#00B4D8', accent: '#2563EB' },
  hot: { bg: '#2A0A0A', glow: '#E63946', accent: '#F4722B' },
  rest: { glow: '#475569' },
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Zero-output sentinel for degenerate inputs. */
const ZERO_OUTPUT: IntensityOutput = {
  overall: 0,
  pulse: 0,
  colorTemp: 0,
  glowRadius: 0,
  glowOpacity: 0,
  act: 'opening',
};

/**
 * Compute overallProgress based on workout mode.
 *
 * Finite mode (totalRounds > 0):
 *   ((currentRound - 1) * totalIntervals + currentIntervalIndex + intervalProgress)
 *     / (totalRounds * totalIntervals)
 *
 * Infinite mode (totalRounds === 0):
 *   (currentIntervalIndex + intervalProgress) / totalIntervals
 *   Cycles per round.
 */
function computeOverallProgress(input: IntensityInput): number {
  const {
    totalIntervals,
    currentIntervalIndex,
    totalRounds,
    currentRound,
    intervalProgress,
  } = input;

  if (totalRounds > 0) {
    // Finite mode
    const numerator =
      (currentRound - 1) * totalIntervals +
      currentIntervalIndex +
      intervalProgress;
    const denominator = totalRounds * totalIntervals;
    return denominator > 0 ? numerator / denominator : 0;
  }

  // Infinite mode -- cycles per round
  return (currentIntervalIndex + intervalProgress) / totalIntervals;
}

/**
 * Determine the dramatic act for a standard workout (>= 3 intervals).
 *
 * Act boundaries based on overallProgress:
 *   - Opening: 0.00 - 0.25
 *   - Rising:  0.25 - 0.60
 *   - Climax:  0.60 - 1.00
 */
function resolveActStandard(progress: number): Act {
  if (progress < 0.25) return 'opening';
  if (progress < 0.60) return 'rising';
  return 'climax';
}

/**
 * Determine the dramatic act for a 2-interval sequence.
 *
 * Collapsed acts:
 *   - Opening: 0 - 40%
 *   - Climax:  40 - 100%
 */
function resolveActTwoIntervals(progress: number): Act {
  if (progress < 0.40) return 'opening';
  return 'climax';
}

/**
 * Compute base overall intensity for short workouts.
 *
 * 2 intervals: uses standard progress.
 * 1 interval:  linear ramp from 0.3 to 1.0.
 */
function computeShortWorkoutOverall(
  input: IntensityInput,
): { overall: number; act: Act } {
  const progress = computeOverallProgress(input);

  if (input.totalIntervals === 2) {
    return { overall: progress, act: resolveActTwoIntervals(progress) };
  }

  // 1 interval: linear ramp 0.3 -> 1.0
  const overall = 0.3 + progress * 0.7;
  return { overall, act: 'climax' };
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute the full intensity output for the current workout state.
 *
 * Pure function -- no side effects, deterministic for the same input.
 */
export function computeIntensity(input: IntensityInput): IntensityOutput {
  const { totalIntervals } = input;

  // Edge case: zero intervals
  if (totalIntervals === 0) {
    return { ...ZERO_OUTPUT };
  }

  // -----------------------------------------------------------------------
  // Step 1: Base overall + act
  // -----------------------------------------------------------------------

  let overall: number;
  let act: Act;

  if (totalIntervals < 3) {
    // Short workout path
    const result = computeShortWorkoutOverall(input);
    overall = result.overall;
    act = result.act;
  } else {
    // Standard workout path
    const progress = computeOverallProgress(input);
    overall = progress;
    act = resolveActStandard(progress);
  }

  // -----------------------------------------------------------------------
  // Step 2: Apply multiplicative modifiers
  // -----------------------------------------------------------------------

  // Rest between sets: dampen intensity
  if (input.isRestBetweenSets) {
    overall *= 0.7;
  }

  // Last interval in round: energy boost
  if (input.currentIntervalIndex === totalIntervals - 1) {
    overall *= 1.15;
  }

  // Final round (finite mode only): climax boost
  if (input.totalRounds > 0 && input.currentRound === input.totalRounds) {
    overall *= 1.20;
  }

  // 3-2-1 countdown: additive urgency
  if (input.remainingMs <= 3000) {
    overall += ((3000 - input.remainingMs) / 3000) * 0.2;
  }

  // Clamp to valid range
  overall = clamp(overall, 0, 1);

  // -----------------------------------------------------------------------
  // Step 3: Derive outputs
  // -----------------------------------------------------------------------

  const pulse = clamp(0.3 + overall * 0.7, 0, 1);
  const colorTemp = clamp(overall, 0, 1);
  const glowRadius = 80 + overall * 120;
  const glowOpacity = clamp(0.15 + overall * 0.30, 0, 1);

  return {
    overall,
    pulse,
    colorTemp,
    glowRadius,
    glowOpacity,
    act,
  };
}
