/**
 * Comprehensive unit tests for the Schlag intensity engine.
 *
 * Covers: computeIntensity pure function, all act boundaries,
 * short workout paths, modifiers, clamping, and derived outputs.
 */

import {
  computeIntensity,
  INTENSITY_COLORS,
} from '@/lib/intensity';

import type { IntensityInput, IntensityOutput, Act } from '@/lib/intensity';

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<IntensityInput> = {}): IntensityInput {
  return {
    totalIntervals: 6,
    currentIntervalIndex: 0,
    totalRounds: 3,
    currentRound: 1,
    intervalProgress: 0,
    isRestBetweenSets: false,
    remainingMs: 30_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Finite mode: act boundaries
// ---------------------------------------------------------------------------

describe('finite mode: opening act (0-25%)', () => {
  it('returns opening act at the very start of the workout', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 0,
      totalRounds: 4,
      currentRound: 1,
      intervalProgress: 0,
    });
    // progress = 0 / 16 = 0.0
    const result = computeIntensity(input);
    expect(result.act).toBe('opening');
    expect(result.overall).toBeCloseTo(0, 5);
  });

  it('returns opening act at 20% progress', () => {
    const input = makeInput({
      totalIntervals: 5,
      currentIntervalIndex: 0,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 1.0,
      // progress = (0 + 0 + 1.0) / 5 = 0.20
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('opening');
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThan(0.30);
  });
});

describe('finite mode: rising act (25-60%)', () => {
  it('returns rising act at 40% progress', () => {
    const input = makeInput({
      totalIntervals: 10,
      currentIntervalIndex: 4,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      // progress = 4 / 10 = 0.40
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('rising');
  });

  it('returns rising act just past the opening boundary', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 1,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0.1,
      // progress = (1 + 0.1) / 4 = 0.275
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('rising');
  });
});

describe('finite mode: climax act (60-100%)', () => {
  it('returns climax act at 80% progress', () => {
    const input = makeInput({
      totalIntervals: 5,
      currentIntervalIndex: 4,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      // progress = 4 / 5 = 0.80
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('climax');
  });

  it('returns climax act at the very end of a workout', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 3,
      totalRounds: 2,
      currentRound: 2,
      intervalProgress: 1.0,
      // progress = ((2-1)*4 + 3 + 1.0) / (2*4) = 8/8 = 1.0
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('climax');
  });
});

// ---------------------------------------------------------------------------
// Infinite mode
// ---------------------------------------------------------------------------

describe('infinite mode: per-round cycling', () => {
  it('cycles progress within a single round', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 0,
      currentRound: 5, // arbitrary round, should not affect progress
      intervalProgress: 0.5,
      // progress = (2 + 0.5) / 4 = 0.625
    });
    const result = computeIntensity(input);
    // 0.625 >= 0.60 => climax
    expect(result.act).toBe('climax');
  });

  it('resets progress at the start of each round', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 0,
      totalRounds: 0,
      currentRound: 99,
      intervalProgress: 0,
      // progress = 0 / 4 = 0.0
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('opening');
    expect(result.overall).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// Short workouts
// ---------------------------------------------------------------------------

describe('short workout: 2 intervals (collapsed acts)', () => {
  it('returns opening act below 40% progress', () => {
    const input = makeInput({
      totalIntervals: 2,
      currentIntervalIndex: 0,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0.5,
      // progress = (0 + 0.5) / 2 = 0.25
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('opening');
  });

  it('returns climax act at and above 40% progress', () => {
    const input = makeInput({
      totalIntervals: 2,
      currentIntervalIndex: 0,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0.8,
      // progress = (0 + 0.8) / 2 = 0.40
    });
    const result = computeIntensity(input);
    expect(result.act).toBe('climax');
  });
});

describe('short workout: 1 interval (linear ramp)', () => {
  it('ramps from 0.3 at the start', () => {
    const input = makeInput({
      totalIntervals: 1,
      currentIntervalIndex: 0,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      // progress = 0/1 = 0, overall = 0.3 + 0*0.7 = 0.3
    });
    const result = computeIntensity(input);
    // Last interval boost: 0.3 * 1.15 = 0.345
    // Final round boost: 0.345 * 1.20 = 0.414
    expect(result.overall).toBeCloseTo(0.414, 2);
    expect(result.act).toBe('climax');
  });

  it('ramps to 1.0 at the end (before modifiers)', () => {
    const input = makeInput({
      totalIntervals: 1,
      currentIntervalIndex: 0,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 1.0,
      // progress = 1.0, overall = 0.3 + 1.0*0.7 = 1.0
      // Last interval: 1.0 * 1.15 = 1.15
      // Final round: 1.15 * 1.20 = 1.38
      // Clamped to 1.0
    });
    const result = computeIntensity(input);
    expect(result.overall).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

describe('rest between sets modifier (0.7x)', () => {
  it('dampens intensity during rest periods', () => {
    const base = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 2,
      currentRound: 1,
      intervalProgress: 0.5,
      isRestBetweenSets: false,
    });
    const rest = makeInput({
      ...base,
      isRestBetweenSets: true,
    });

    const baseResult = computeIntensity(base);
    const restResult = computeIntensity(rest);

    // Rest result overall should be 0.7x of the base (before other modifiers
    // that are identical between the two inputs)
    expect(restResult.overall).toBeLessThan(baseResult.overall);
    // Verify the ratio is approximately 0.7
    expect(restResult.overall / baseResult.overall).toBeCloseTo(0.7, 2);
  });
});

describe('last interval boost (1.15x)', () => {
  it('boosts intensity on the last interval of a round', () => {
    const notLast = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 2,
      currentRound: 1,
      intervalProgress: 0,
    });
    const last = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 3,
      totalRounds: 2,
      currentRound: 1,
      intervalProgress: 0,
    });

    const notLastResult = computeIntensity(notLast);
    const lastResult = computeIntensity(last);

    // Last interval is further along AND gets the 1.15x boost
    expect(lastResult.overall).toBeGreaterThan(notLastResult.overall);
  });
});

describe('final round boost (1.20x)', () => {
  it('boosts intensity during the final round', () => {
    const earlyRound = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 3,
      currentRound: 2,
      intervalProgress: 0.5,
    });
    const finalRound = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 3,
      currentRound: 3,
      intervalProgress: 0.5,
    });

    const earlyResult = computeIntensity(earlyRound);
    const finalResult = computeIntensity(finalRound);

    // Final round should have higher intensity (both from progress and 1.20x)
    expect(finalResult.overall).toBeGreaterThan(earlyResult.overall);
  });
});

describe('3-2-1 countdown boost', () => {
  it('adds urgency as remainingMs approaches zero', () => {
    const noCountdown = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 1,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0.5,
      remainingMs: 5_000,
    });
    const inCountdown = makeInput({
      ...noCountdown,
      remainingMs: 1_500,
    });
    const atZero = makeInput({
      ...noCountdown,
      remainingMs: 0,
    });

    const noResult = computeIntensity(noCountdown);
    const countdownResult = computeIntensity(inCountdown);
    const zeroResult = computeIntensity(atZero);

    // Countdown should progressively increase intensity
    expect(countdownResult.overall).toBeGreaterThan(noResult.overall);
    expect(zeroResult.overall).toBeGreaterThan(countdownResult.overall);

    // At 0ms remaining, the additive boost should be the full 0.2
    const baseOverall = noResult.overall;
    expect(zeroResult.overall).toBeCloseTo(baseOverall + 0.2, 2);
  });

  it('adds exactly 0 boost at remainingMs = 3000', () => {
    const at3000 = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 1,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0.5,
      remainingMs: 3_000,
    });
    const above3000 = makeInput({
      ...at3000,
      remainingMs: 3_001,
    });

    const result3000 = computeIntensity(at3000);
    const resultAbove = computeIntensity(above3000);

    // At exactly 3000ms, (3000 - 3000) / 3000 * 0.2 = 0
    expect(result3000.overall).toBeCloseTo(resultAbove.overall, 4);
  });
});

// ---------------------------------------------------------------------------
// Clamping
// ---------------------------------------------------------------------------

describe('clamp to 1.0 (all modifiers stacking)', () => {
  it('never exceeds 1.0 even when all boosts stack', () => {
    const input = makeInput({
      totalIntervals: 3,
      currentIntervalIndex: 2, // last interval (1.15x)
      totalRounds: 1,
      currentRound: 1, // final round (1.20x)
      intervalProgress: 0.95,
      isRestBetweenSets: false,
      remainingMs: 0, // full countdown boost (+0.2)
      // progress = (2 + 0.95) / 3 = 0.9833
      // * 1.15 = 1.1308
      // * 1.20 = 1.3570
      // + 0.20 = 1.5570
      // clamped to 1.0
    });
    const result = computeIntensity(input);
    expect(result.overall).toBe(1);
    expect(result.pulse).toBeLessThanOrEqual(1);
    expect(result.glowOpacity).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge case: zero intervals', () => {
  it('returns all zeros with opening act', () => {
    const input = makeInput({ totalIntervals: 0 });
    const result = computeIntensity(input);

    expect(result.overall).toBe(0);
    expect(result.pulse).toBe(0);
    expect(result.colorTemp).toBe(0);
    expect(result.glowRadius).toBe(0);
    expect(result.glowOpacity).toBe(0);
    expect(result.act).toBe('opening');
  });
});

describe('edge case: exact boundary values', () => {
  it('places progress exactly at 0.25 in rising act (not opening)', () => {
    const input = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 1,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      // progress = 1 / 4 = 0.25
    });
    const result = computeIntensity(input);
    // 0.25 is >= 0.25, so rising (< 0.25 is opening)
    expect(result.act).toBe('rising');
  });

  it('places progress exactly at 0.60 in climax act (not rising)', () => {
    const input = makeInput({
      totalIntervals: 5,
      currentIntervalIndex: 3,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      // progress = 3 / 5 = 0.60
    });
    const result = computeIntensity(input);
    // 0.60 is >= 0.60, so climax (< 0.60 is rising)
    expect(result.act).toBe('climax');
  });
});

// ---------------------------------------------------------------------------
// Derived outputs
// ---------------------------------------------------------------------------

describe('derived outputs (pulse, colorTemp, glowRadius, glowOpacity)', () => {
  it('computes correct derived values from overall intensity', () => {
    const input = makeInput({
      totalIntervals: 10,
      currentIntervalIndex: 5,
      totalRounds: 1,
      currentRound: 1,
      intervalProgress: 0,
      remainingMs: 30_000,
      // progress = 5 / 10 = 0.50
      // No modifiers that change multiplier (not last interval, not final round
      // with multiple rounds that matter -- wait, totalRounds=1, currentRound=1
      // so final round IS active: * 1.20 = 0.60)
    });
    const result = computeIntensity(input);

    // overall = 0.50 * 1.20 (final round) = 0.60
    const expectedOverall = 0.60;
    expect(result.overall).toBeCloseTo(expectedOverall, 2);

    // pulse = 0.3 + 0.60 * 0.7 = 0.72
    expect(result.pulse).toBeCloseTo(0.3 + expectedOverall * 0.7, 2);

    // colorTemp = overall = 0.60
    expect(result.colorTemp).toBeCloseTo(expectedOverall, 2);

    // glowRadius = 80 + 0.60 * 120 = 152
    expect(result.glowRadius).toBeCloseTo(80 + expectedOverall * 120, 1);

    // glowOpacity = 0.15 + 0.60 * 0.30 = 0.33
    expect(result.glowOpacity).toBeCloseTo(0.15 + expectedOverall * 0.30, 2);
  });

  it('produces minimum derived values when overall is 0', () => {
    const input = makeInput({
      totalIntervals: 10,
      currentIntervalIndex: 0,
      totalRounds: 4,
      currentRound: 1,
      intervalProgress: 0,
      remainingMs: 30_000,
      // progress = 0 / 40 = 0
    });
    const result = computeIntensity(input);

    expect(result.overall).toBeCloseTo(0, 2);
    expect(result.pulse).toBeCloseTo(0.3, 2);
    expect(result.colorTemp).toBeCloseTo(0, 2);
    expect(result.glowRadius).toBeCloseTo(80, 1);
    expect(result.glowOpacity).toBeCloseTo(0.15, 2);
  });
});

// ---------------------------------------------------------------------------
// Infinite mode: final round modifier NOT applied
// ---------------------------------------------------------------------------

describe('infinite mode: final round modifier not applied', () => {
  it('does not apply the 1.20x final round boost in infinite mode', () => {
    const finiteLastRound = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 3,
      currentRound: 3,
      intervalProgress: 0.5,
    });
    const infiniteAnyRound = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 0,
      currentRound: 3,
      intervalProgress: 0.5,
    });

    const finiteResult = computeIntensity(finiteLastRound);
    const infiniteResult = computeIntensity(infiniteAnyRound);

    // In infinite mode, progress = (2 + 0.5) / 4 = 0.625
    // In finite mode, progress = ((3-1)*4 + 2 + 0.5) / (3*4) = 10.5/12 = 0.875
    // Finite also gets 1.20x final round boost
    // Infinite does NOT get the 1.20x boost
    // Both differ in base progress AND modifier application
    // Key assertion: infinite mode never applies the 1.20x multiplier
    // Verify by constructing matched-progress inputs:

    const infiniteCheck = makeInput({
      totalIntervals: 4,
      currentIntervalIndex: 2,
      totalRounds: 0,
      currentRound: 999, // any round number -- should be ignored
      intervalProgress: 0.5,
    });
    const infiniteCheckResult = computeIntensity(infiniteCheck);

    // Changing currentRound in infinite mode should not change overall
    // (since final round boost checks totalRounds > 0)
    expect(infiniteCheckResult.overall).toBeCloseTo(infiniteResult.overall, 5);
  });
});

// ---------------------------------------------------------------------------
// Color palette constants
// ---------------------------------------------------------------------------

describe('INTENSITY_COLORS', () => {
  it('exports the expected color palette', () => {
    expect(INTENSITY_COLORS.cool.bg).toBe('#1A1A2E');
    expect(INTENSITY_COLORS.cool.glow).toBe('#00B4D8');
    expect(INTENSITY_COLORS.cool.accent).toBe('#2563EB');
    expect(INTENSITY_COLORS.hot.bg).toBe('#2A0A0A');
    expect(INTENSITY_COLORS.hot.glow).toBe('#E63946');
    expect(INTENSITY_COLORS.hot.accent).toBe('#F4722B');
    expect(INTENSITY_COLORS.rest.glow).toBe('#475569');
  });
});
