/**
 * Signal palette — Swiss-editorial with a mechanical twist.
 * Paper/ink surfaces, vermillion accent, 12 colorblind-retuned interval hues
 * each paired with a non-color glyph for redundant encoding.
 */

// ---------------------------------------------------------------------------
// App-level colors
// ---------------------------------------------------------------------------

export const APP_COLORS = {
  /** Vermillion accent. Swiss poster red. CTAs, active states, cursor bars. */
  primary: '#EA2F14',

  /** Deep near-black. Used for ink in calm surfaces and dark workout fallback. */
  backgroundDark: '#141416',

  /** Warm paper. Library, builder, settings, history. */
  backgroundLight: '#FAFAF7',

  /** Ink — primary text. */
  textPrimary: '#141416',

  /** MutedInk — labels, metadata, secondary UI. */
  textSecondary: '#8A8986',

  /** Deeper muted for placeholders and disabled states. */
  textMuted: '#B3B1AC',

  /** Text on dark / full-bleed interval-color backgrounds. */
  textOnDark: '#FFFFFF',

  /** Card / surface background on paper. */
  surface: '#FFFFFF',

  /** Hairline dividers. */
  divider: '#E6E4DE',
} as const;

/**
 * Signal design tokens. Prefer these over APP_COLORS for new code.
 * The APP_COLORS export is kept so existing screens continue to resolve.
 */
export const SIGNAL = {
  paper: '#FAFAF7',
  ink: '#141416',
  accent: '#EA2F14',
  mutedInk: '#8A8986',
  divider: '#E6E4DE',
  surface: '#FFFFFF',
  onInterval: '#FFFFFF',
} as const;

// ---------------------------------------------------------------------------
// Interval color palette (12 colors, colorblind-retuned + glyph)
// ---------------------------------------------------------------------------

export type IntervalGlyph =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'hexagon'
  | 'pentagon'
  | 'plus'
  | 'star'
  | 'chevron'
  | 'wave'
  | 'line'
  | 'dot';

export interface IntervalColor {
  /** Stable id used in palette lookups. */
  id: string;
  /** Human-readable label shown in the color picker. */
  label: string;
  /** One-character short form used in compact UI. */
  short: string;
  /** Hex color value. */
  hex: string;
  /** Text color to use when this color is the background. */
  textColor: string;
  /** Non-color glyph for colorblind redundancy. */
  glyph: IntervalGlyph;
}

/**
 * 12 interval colors — colorblind-retuned. Each color ships with a glyph so
 * UI never relies on hue alone. Red↔green pair is buffered by orange/amber
 * and lime/teal to stay safe under deuteranopia and protanopia.
 */
export const INTERVAL_COLORS: readonly IntervalColor[] = [
  { id: 'red',    label: 'Red',    short: 'R', hex: '#E5484D', textColor: '#FFFFFF', glyph: 'circle'   },
  { id: 'orange', label: 'Orange', short: 'O', hex: '#F76B15', textColor: '#FFFFFF', glyph: 'triangle' },
  { id: 'amber',  label: 'Amber',  short: 'A', hex: '#E2A907', textColor: '#FFFFFF', glyph: 'square'   },
  { id: 'lime',   label: 'Lime',   short: 'L', hex: '#99D52A', textColor: '#141416', glyph: 'diamond'  },
  { id: 'teal',   label: 'Teal',   short: 'T', hex: '#12A594', textColor: '#FFFFFF', glyph: 'hexagon'  },
  { id: 'cyan',   label: 'Cyan',   short: 'C', hex: '#00A2C7', textColor: '#FFFFFF', glyph: 'pentagon' },
  { id: 'blue',   label: 'Blue',   short: 'B', hex: '#3E63DD', textColor: '#FFFFFF', glyph: 'plus'     },
  { id: 'indigo', label: 'Indigo', short: 'I', hex: '#5B5BD6', textColor: '#FFFFFF', glyph: 'star'     },
  { id: 'violet', label: 'Violet', short: 'V', hex: '#6E56CF', textColor: '#FFFFFF', glyph: 'chevron'  },
  { id: 'pink',   label: 'Pink',   short: 'P', hex: '#D6409F', textColor: '#FFFFFF', glyph: 'wave'     },
  { id: 'slate',  label: 'Slate',  short: 'S', hex: '#5F6877', textColor: '#FFFFFF', glyph: 'line'     },
  { id: 'bone',   label: 'Bone',   short: 'N', hex: '#D8D4CA', textColor: '#141416', glyph: 'dot'      },
] as const;

/**
 * Legacy → Signal hex remap. Sequences saved before the redesign store the
 * old palette hexes on their intervals; we translate on read so glyph lookup,
 * text-color lookup, and picker-highlight all resolve correctly.
 */
const LEGACY_HEX_REMAP: Record<string, string> = {
  '#E63946': '#E5484D', // Schlag Red    → red
  '#F4722B': '#F76B15', // Ember Orange  → orange
  '#F6AE2D': '#E2A907', // Solar Yellow  → amber
  '#2DC653': '#99D52A', // Sprint Green  → lime
  '#00B4D8': '#12A594', // Teal          → teal
  '#2563EB': '#3E63DD', // Steel Blue    → blue
  '#4338CA': '#5B5BD6', // Indigo        → indigo
  '#7C3AED': '#6E56CF', // Violet        → violet
  '#DB2777': '#D6409F', // Pink          → pink
  '#475569': '#5F6877', // Slate         → slate
  '#71717A': '#5F6877', // Zinc          → slate
  '#E2E8F0': '#D8D4CA', // Off-White     → bone
};

/** Normalize a stored interval hex to the current palette. */
export function normalizeIntervalHex(hex: string): string {
  const up = hex.toUpperCase();
  return LEGACY_HEX_REMAP[up] ?? hex;
}

/** Quick-lookup set of interval hex values for validation (current palette only). */
export const INTERVAL_HEX_SET: ReadonlySet<string> = new Set(
  INTERVAL_COLORS.map((c) => c.hex),
);

/** Default interval color (red) used for new intervals. */
export const DEFAULT_INTERVAL_COLOR = INTERVAL_COLORS[0].hex;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the palette entry for a given hex (with legacy remapping). */
export function getIntervalByHex(hex: string): IntervalColor | undefined {
  const normalized = normalizeIntervalHex(hex).toLowerCase();
  return INTERVAL_COLORS.find((c) => c.hex.toLowerCase() === normalized);
}

/** Find the palette entry by id. */
export function getIntervalById(id: string): IntervalColor | undefined {
  return INTERVAL_COLORS.find((c) => c.id === id);
}

/** Glyph for a given interval hex (normalized). */
export function getGlyphForInterval(hex: string): IntervalGlyph {
  return getIntervalByHex(hex)?.glyph ?? 'circle';
}

/**
 * Returns the appropriate text color (white or dark) for a given
 * interval background hex. Falls back to WCAG relative-luminance for
 * hexes outside the palette.
 */
export function getTextColorForInterval(hex: string): string {
  const entry = getIntervalByHex(hex);
  if (entry) return entry.textColor;
  return relativeLuminance(hex) > 0.5 ? '#141416' : '#FFFFFF';
}

/** Compute WCAG 2.1 relative luminance, 0 (black) → 1 (white). */
function relativeLuminance(hex: string): number {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
