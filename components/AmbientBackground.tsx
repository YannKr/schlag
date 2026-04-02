/**
 * AmbientBackground -- native (Skia) implementation for Schlag.
 *
 * Renders a GPU-accelerated radial glow behind the workout screen using
 * @shopify/react-native-skia.  A breathing animation oscillates the glow
 * radius via react-native-reanimated shared values that drive Skia
 * rendering directly (no React re-renders).
 *
 * The web counterpart lives in AmbientBackground.web.tsx and uses pure
 * CSS/RN View styles instead of Skia.
 */

import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';

import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AmbientBackgroundProps {
  /** 0-1, cool (teal) to hot (red). */
  colorTemp: number;
  /** Radius of the glow in px. */
  glowRadius: number;
  /** Glow opacity, 0-1. */
  glowOpacity: number;
  /** Breathing speed in Hz (0.3-1.0). */
  pulse: number;
  /** Whether the workout is paused. */
  isPaused: boolean;
  /** Current dramatic arc of the workout. */
  act: 'opening' | 'rising' | 'climax' | 'release';
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Cool end-point colors (colorTemp = 0). */
const COOL_BG = '#1A1A2E';
const COOL_GLOW = '#00B4D8';

/** Hot end-point colors (colorTemp = 1). */
const HOT_BG = '#2A0A0A';
const HOT_GLOW = '#E63946';

/**
 * Parse a 6-digit hex color into [r, g, b] in 0-255 range.
 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Linearly interpolate between two hex colors by factor `t` (0-1).
 */
function lerpColor(colorA: string, colorB: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = parseHex(colorA);
  const [r2, g2, b2] = parseHex(colorB);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert a hex color + alpha (0-1) to an rgba() string for Skia.
 */
function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AmbientBackground({
  colorTemp,
  glowRadius,
  glowOpacity,
  pulse,
  isPaused,
}: AmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();

  // -----------------------------------------------------------------------
  // Resolve effective values based on paused state
  // -----------------------------------------------------------------------

  const effectiveOpacity = isPaused ? glowOpacity * 0.5 : glowOpacity;
  const effectivePulseHz = isPaused ? 0.2 : Math.min(1.0, Math.max(0.3, pulse));
  const brightnessFactor = isPaused ? 0.7 : 1.0;

  // -----------------------------------------------------------------------
  // Interpolate colors
  // -----------------------------------------------------------------------

  const bgColor = lerpColor(COOL_BG, HOT_BG, colorTemp);
  const glowColor = lerpColor(COOL_GLOW, HOT_GLOW, colorTemp);

  // Apply brightness dimming to background when paused
  const dimmedBg = isPaused ? lerpColor(bgColor, '#000000', 1 - brightnessFactor) : bgColor;

  // -----------------------------------------------------------------------
  // Breathing animation via reanimated shared values
  // -----------------------------------------------------------------------

  // The breathing cycle oscillates between 0 and 1
  const breathingCycle = useSharedValue(0);

  useEffect(() => {
    const durationMs = (1 / effectivePulseHz) * 1000;

    breathingCycle.value = 0;
    breathingCycle.value = withRepeat(
      withTiming(1, {
        duration: durationMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1, // infinite repeats
      true, // reverse on each cycle
    );
  }, [effectivePulseHz, breathingCycle]);

  // Derive the animated radius: oscillate +/-10% of glowRadius
  const animatedRadius = useDerivedValue(() => {
    const delta = glowRadius * 0.1;
    return glowRadius - delta + breathingCycle.value * delta * 2;
  }, [glowRadius]);

  // -----------------------------------------------------------------------
  // Glow center coordinates (50% width, 40% height)
  // -----------------------------------------------------------------------

  const cx = width * 0.5;
  const cy = height * 0.4;

  // -----------------------------------------------------------------------
  // Gradient colors: glow color at center fading to transparent at edge
  // -----------------------------------------------------------------------

  const centerColor = hexToRgba(glowColor, effectiveOpacity);
  const edgeColor = hexToRgba(glowColor, 0);

  return (
    <Canvas style={[StyleSheet.absoluteFillObject, { backgroundColor: dimmedBg }]} pointerEvents="none">
      <Group>
        <Circle cx={cx} cy={cy} r={animatedRadius}>
          <RadialGradient
            c={vec(cx, cy)}
            r={animatedRadius}
            colors={[centerColor, edgeColor]}
          />
        </Circle>
      </Group>
    </Canvas>
  );
}
