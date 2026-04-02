/**
 * Typography constants for Schlag.
 *
 * Font families are platform-aware (SF Pro on iOS, Roboto on Android,
 * Inter/system on web).  Font sizes follow the PRD design system
 * (Section 6.1.2).
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Font families
// ---------------------------------------------------------------------------

const PLATFORM_SANS = Platform.select({
  ios: 'System', // resolves to SF Pro via React Native
  android: 'Roboto',
  web: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: 'System',
}) as string;

const PLATFORM_MONO = Platform.select({
  ios: 'Menlo', // SF Mono is not available by default in RN; Menlo is the fallback
  android: 'monospace',
  web: '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
  default: 'monospace',
}) as string;

export const FONT_FAMILY = {
  /** Default sans-serif used for headings, body, and labels. */
  sans: PLATFORM_SANS,

  /** Monospace used for the countdown timer on the workout screen. */
  mono: PLATFORM_MONO,
} as const;

// ---------------------------------------------------------------------------
// Font sizes
// ---------------------------------------------------------------------------

export const FONT_SIZE = {
  /** Countdown timer on the workout screen: 72--96 pt. */
  countdownLarge: 96,
  countdownMedium: 80,
  countdownSmall: 72,

  /** Interval name on the workout screen: 32--40 pt, bold, ALL CAPS. */
  intervalNameLarge: 40,
  intervalNameSmall: 32,

  /** Headings in the library and settings. */
  headingLarge: 24,
  headingMedium: 20,
  headingSmall: 18,

  /** Body text and labels. */
  bodyLarge: 16,
  body: 14,

  /** Small / caption text. */
  caption: 12,
} as const;

// ---------------------------------------------------------------------------
// Font weights (numeric values for cross-platform consistency)
// ---------------------------------------------------------------------------

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
} as const;

// ---------------------------------------------------------------------------
// Line heights (multiplied from font size for comfortable reading)
// ---------------------------------------------------------------------------

export const LINE_HEIGHT = {
  countdown: 1.0,
  intervalName: 1.1,
  heading: 1.3,
  body: 1.5,
} as const;
