/**
 * Pro status and preferences for Schlag v2.
 *
 * Tracks whether the user has purchased Schlag Pro and
 * stores Pro-specific preferences like weekly goal and theme.
 */

/** Extended theme options available in v2 (4 Pro-only themes). */
export type ExtendedTheme =
  | 'dark'
  | 'light'
  | 'interval-color'
  | 'ember'
  | 'ocean'
  | 'forest'
  | 'midnight';

export interface ProStatus {
  /** Whether Pro features are unlocked. */
  pro_unlocked: boolean;

  /** ISO 8601 timestamp of purchase, or null if not purchased. */
  pro_purchased_at: string | null;

  /** Weekly workout goal (1-14), or null if not set. Pro feature. */
  weekly_goal: number | null;
}
