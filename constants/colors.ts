/**
 * Color palette and interval color definitions for Schlag.
 *
 * All values are sourced from the PRD design system (Section 6.1.1)
 * and the Interval Color Palette appendix.
 */

// ---------------------------------------------------------------------------
// App-level colors
// ---------------------------------------------------------------------------

export const APP_COLORS = {
  /** Primary accent -- Schlag Red. Used for FAB, CTAs, active states. */
  primary: '#E63946',

  /** Dark background used on the workout screen by default. */
  backgroundDark: '#1A1A2E',

  /** Light background used for the library and settings screens. */
  backgroundLight: '#F8FAFC',

  /** Primary text color (dark mode inverse is white). */
  textPrimary: '#1A1A2E',

  /** Secondary text color for labels and metadata. */
  textSecondary: '#475569',

  /** Muted text color for placeholders and disabled states. */
  textMuted: '#94A3B8',

  /** Text color used on dark backgrounds. */
  textOnDark: '#FFFFFF',

  /** Card / surface background. */
  surface: '#FFFFFF',

  /** Divider / separator lines. */
  divider: '#E2E8F0',
} as const;

// ---------------------------------------------------------------------------
// Interval color palette (12 colors)
// ---------------------------------------------------------------------------

export interface IntervalColor {
  /** Human-readable label shown in the color picker. */
  label: string;

  /** Hex color value. */
  hex: string;

  /** Text color to use when this color is the background (white or dark). */
  textColor: string;
}

/**
 * The 12 interval colors defined in the PRD appendix.
 * Order matches the PRD table and is the display order in the color picker.
 *
 * All colors use white text except Off-White which uses dark text
 * for WCAG AA contrast compliance.
 */
export const INTERVAL_COLORS: readonly IntervalColor[] = [
  { label: 'Schlag Red',    hex: '#E63946', textColor: '#FFFFFF' },
  { label: 'Ember Orange',  hex: '#F4722B', textColor: '#FFFFFF' },
  { label: 'Solar Yellow',  hex: '#F6AE2D', textColor: '#FFFFFF' },
  { label: 'Sprint Green',  hex: '#2DC653', textColor: '#FFFFFF' },
  { label: 'Teal',          hex: '#00B4D8', textColor: '#FFFFFF' },
  { label: 'Steel Blue',    hex: '#2563EB', textColor: '#FFFFFF' },
  { label: 'Indigo',        hex: '#4338CA', textColor: '#FFFFFF' },
  { label: 'Violet',        hex: '#7C3AED', textColor: '#FFFFFF' },
  { label: 'Pink',          hex: '#DB2777', textColor: '#FFFFFF' },
  { label: 'Slate',         hex: '#475569', textColor: '#FFFFFF' },
  { label: 'Zinc',          hex: '#71717A', textColor: '#FFFFFF' },
  { label: 'Off-White',     hex: '#E2E8F0', textColor: '#1A1A2E' },
] as const;

/**
 * Quick-lookup set of interval hex values for validation.
 */
export const INTERVAL_HEX_SET: ReadonlySet<string> = new Set(
  INTERVAL_COLORS.map((c) => c.hex),
);

/**
 * Default interval color (Schlag Red) used for new intervals.
 */
export const DEFAULT_INTERVAL_COLOR = INTERVAL_COLORS[0].hex;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate text color (white or dark) for a given
 * interval background hex color.
 *
 * If the hex is not in the palette, falls back to a relative-luminance
 * calculation per WCAG guidelines.
 */
export function getTextColorForInterval(hex: string): string {
  // Fast path: look up in the palette
  const paletteEntry = INTERVAL_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  );
  if (paletteEntry) {
    return paletteEntry.textColor;
  }

  // Fallback: compute relative luminance and pick white or dark
  return relativeLuminance(hex) > 0.179 ? '#1A1A2E' : '#FFFFFF';
}

/**
 * Compute relative luminance of a hex color per WCAG 2.1.
 * Returns a value between 0 (black) and 1 (white).
 */
function relativeLuminance(hex: string): number {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
