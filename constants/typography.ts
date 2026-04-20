/**
 * Typography — Signal direction.
 *
 * Display: Neue Haas Grotesk Display Pro → Inter → Helvetica (web-safe fallback).
 * Seven-segment: DSEG7 Classic (web CDN) → JetBrains Mono (native fallback).
 * Mono: JetBrains Mono (bundled).
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Font families
// ---------------------------------------------------------------------------

/**
 * Display/body sans. Neue Haas Grotesk is a licensed font; we ship Inter
 * (free, near-identical metrics) as the primary with Helvetica as system
 * fallback, and Neue Haas as first-preference when a user has it installed.
 */
const PLATFORM_SANS = Platform.select({
  ios: 'System', // SF Pro — close enough to Helvetica on Apple
  android: 'Roboto',
  web: '"Neue Haas Grotesk Display Pro", Inter, "Helvetica Neue", Helvetica, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: 'System',
}) as string;

/** Monospace — used for secondary tabular numerals. */
const PLATFORM_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  web: '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
  default: 'monospace',
}) as string;

/**
 * Seven-segment display — big timer digits.
 * Web pulls DSEG7 Classic from jsdelivr via index.html (see app/+html.tsx).
 * Native falls back to JetBrains Mono Bold (bundled).
 */
const PLATFORM_SEVEN = Platform.select({
  ios: 'JetBrainsMono-Bold',
  android: 'JetBrainsMono-Bold',
  web: '"DSEG7 Classic", "JetBrains Mono", "Share Tech Mono", ui-monospace, monospace',
  default: 'JetBrainsMono-Bold',
}) as string;

export const FONT_FAMILY = {
  /** Default sans-serif for headings, body, labels. */
  sans: PLATFORM_SANS,

  /** Display alias — same stack as sans; used intentionally for editorial type. */
  display: PLATFORM_SANS,

  /** Monospace for tabular numerals (elapsed/remaining, small durations). */
  mono: PLATFORM_MONO,

  /** Seven-segment face for the big countdown timer. */
  seven: PLATFORM_SEVEN,
} as const;

// ---------------------------------------------------------------------------
// Font sizes
// ---------------------------------------------------------------------------

export const FONT_SIZE = {
  /** Big timer — mobile 104px, desktop 150px per Signal spec. */
  countdownLarge: 150,
  countdownMedium: 104,
  countdownSmall: 72,

  /** Interval name on workout screen. */
  intervalNameLarge: 64,
  intervalNameMedium: 40,
  intervalNameSmall: 34,

  /** Editorial page titles ("Schlag", "Settings", "Now"). */
  displayHero: 52,
  displayLarge: 36,
  displayMedium: 26,

  /** Section / list headings. */
  headingLarge: 24,
  headingMedium: 20,
  headingSmall: 17,

  /** Body + labels. */
  bodyLarge: 16,
  body: 14,
  bodySmall: 13,

  /** Small / caption / eyebrow labels (uppercase, tracked). */
  caption: 12,
  eyebrow: 10,
} as const;

// ---------------------------------------------------------------------------
// Letter spacing — Signal is tracked on eyebrows, tight on display
// ---------------------------------------------------------------------------

export const LETTER_SPACING = {
  /** Eyebrow labels: 10px uppercase with ~2px tracking. */
  eyebrow: 2,
  caption: 1,
  body: 0,
  display: -1,
  displayTight: -1.2,
  displayTighter: -1.5,
  displayHero: -2,
  /** Seven-segment timer kerning (negative to tuck digits). */
  seven: -2,
  sevenLarge: -6,
} as const;

// ---------------------------------------------------------------------------
// Font weights
// ---------------------------------------------------------------------------

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
} as const;

// ---------------------------------------------------------------------------
// Line heights
// ---------------------------------------------------------------------------

export const LINE_HEIGHT = {
  countdown: 0.9,
  intervalName: 1.0,
  heading: 1.1,
  body: 1.5,
} as const;
