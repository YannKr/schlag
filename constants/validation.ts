/**
 * Validation limits for Schlag data types.
 *
 * All values are sourced from the PRD feature requirements
 * (Sections 4.1.1, 4.1.2, 4.4.3, and NFRs).
 */

// ---------------------------------------------------------------------------
// Interval validation
// ---------------------------------------------------------------------------

/** Maximum length of an interval name. */
export const INTERVAL_NAME_MAX_LENGTH = 32;

/** Maximum length of an interval note / coaching cue. */
export const INTERVAL_NOTE_MAX_LENGTH = 80;

/** Minimum interval duration in seconds (1 second). */
export const INTERVAL_DURATION_MIN_SECONDS = 1;

/** Maximum interval duration in seconds (99:59:59 = 359,999 seconds). */
export const INTERVAL_DURATION_MAX_SECONDS = 359_999;

// ---------------------------------------------------------------------------
// Sequence validation
// ---------------------------------------------------------------------------

/** Maximum length of a sequence description. */
export const SEQUENCE_DESCRIPTION_MAX_LENGTH = 120;

/** Minimum repeat count. 0 = infinite mode. */
export const SEQUENCE_REPEAT_MIN = 0;

/** Maximum finite repeat count. */
export const SEQUENCE_REPEAT_MAX = 99;

/** Minimum number of intervals in a sequence. */
export const SEQUENCE_INTERVALS_MIN = 1;

// ---------------------------------------------------------------------------
// Audio validation
// ---------------------------------------------------------------------------

/** Maximum custom audio file size in bytes (5 MB). */
export const AUDIO_FILE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum per-user cloud storage for custom audio in bytes (50 MB). */
export const AUDIO_CLOUD_STORAGE_MAX_BYTES = 50 * 1024 * 1024;

/** Allowed MIME types for custom audio uploads. */
export const AUDIO_ALLOWED_MIME_TYPES = [
  'audio/mpeg',    // .mp3
  'audio/wav',     // .wav
  'audio/x-wav',   // .wav (alternative)
  'audio/x-m4a',   // .m4a
  'audio/mp4',     // .m4a (alternative)
] as const;

/** Allowed file extensions for custom audio uploads. */
export const AUDIO_ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a'] as const;

// ---------------------------------------------------------------------------
// Import validation
// ---------------------------------------------------------------------------

/** Maximum import file size in bytes (10 MB per NFR). */
export const IMPORT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Beep tuning ranges
// ---------------------------------------------------------------------------

/** Minimum beep volume multiplier. */
export const BEEP_VOLUME_MIN = 0;

/** Maximum beep volume multiplier. */
export const BEEP_VOLUME_MAX = 1;

/** Minimum beep pitch multiplier. */
export const BEEP_PITCH_MIN = 0.5;

/** Maximum beep pitch multiplier. */
export const BEEP_PITCH_MAX = 2.0;
