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
    // a=(1,0), b=(0.5,0.5), c=(1,0.5): BA points down-right at -45°, BC points right at 0° → 45° at vertex b
    const a = makeLandmark(1, 0);
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
