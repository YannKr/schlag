/**
 * Barrel export for all Schlag constants.
 */

export {
  APP_COLORS,
  SIGNAL,
  INTERVAL_COLORS,
  INTERVAL_HEX_SET,
  DEFAULT_INTERVAL_COLOR,
  getTextColorForInterval,
  getIntervalByHex,
  getIntervalById,
  getGlyphForInterval,
  normalizeIntervalHex,
} from './colors';
export type { IntervalColor, IntervalGlyph } from './colors';

export {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  LINE_HEIGHT,
} from './typography';

export { LAYOUT, SPACING } from './layout';

export {
  createDefaultInterval,
  createDefaultSequence,
  DEFAULT_SETTINGS,
} from './defaults';

export {
  INTERVAL_NAME_MAX_LENGTH,
  INTERVAL_NOTE_MAX_LENGTH,
  INTERVAL_DURATION_MIN_SECONDS,
  INTERVAL_DURATION_MAX_SECONDS,
  SEQUENCE_DESCRIPTION_MAX_LENGTH,
  SEQUENCE_REPEAT_MIN,
  SEQUENCE_REPEAT_MAX,
  SEQUENCE_INTERVALS_MIN,
  AUDIO_FILE_MAX_SIZE_BYTES,
  AUDIO_CLOUD_STORAGE_MAX_BYTES,
  AUDIO_ALLOWED_MIME_TYPES,
  AUDIO_ALLOWED_EXTENSIONS,
  IMPORT_FILE_MAX_SIZE_BYTES,
  BEEP_VOLUME_MIN,
  BEEP_VOLUME_MAX,
  BEEP_PITCH_MIN,
  BEEP_PITCH_MAX,
} from './validation';
