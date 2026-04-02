/**
 * Layout constants for Schlag.
 *
 * Spacing, sizing, and breakpoint values sourced from the PRD
 * design system (Section 6.1.4) and platform requirements.
 */

export const LAYOUT = {
  /** Minimum interactive element height per WCAG / Apple HIG (44 pt). */
  buttonMinHeight: 44,

  /** Default border radius for buttons and inputs. */
  borderRadius: 8,

  /** Border radius for library cards. */
  cardRadius: 12,

  /** Height of the progress bar on the workout screen. */
  progressBarHeight: 12,

  /** Diameter of the floating action button ("+") in the sequence builder. */
  fabSize: 56,

  /** Diameter of the color swatch circle on interval rows. */
  colorSwatchSize: 16,

  /** Max content width for the workout screen on wide viewports. */
  webMaxWidth: 480,

  /** Viewport width breakpoint where the web layout switches to centered column. */
  webBreakpoint: 768,

  /** Minimum tap target size (width and height) for accessibility. */
  minTapTarget: 44,

  /** Standard "Start" button height on library cards. */
  startButtonHeight: 48,

  /** Close/stop button size on the workout screen. */
  closeButtonSize: 32,
} as const;

// ---------------------------------------------------------------------------
// Spacing scale (4-point grid)
// ---------------------------------------------------------------------------

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
