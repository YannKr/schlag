/**
 * Audio configuration and tone definitions for Schlag.
 *
 * AudioConfig is stored per-sequence and controls which audio cues fire.
 * ToneName enumerates the built-in tones used by the audio engine.
 */

export interface AudioConfig {
  /** When true, a TTS voice counts down "3... 2... 1..." before each interval ends. */
  use_voice_countdown: boolean;

  /** When true, built-in beep tones fire at interval boundaries. */
  use_builtin_beeps: boolean;

  /** v2: When true, TTS announces the interval name at the start of each interval. */
  announce_interval_names: boolean;

  /** v2: When true, a beep/voice fires at the halfway point of intervals >= 10s. */
  halfway_alert: boolean;
}

/**
 * v2: Built-in tone options for per-interval audio (Schlag Pro).
 * 'default' uses the global setting; 'custom' uses a per-interval custom_audio_url.
 */
export type IntervalAudioTone =
  | 'default'
  | 'bell'
  | 'whistle'
  | 'horn'
  | 'chime'
  | 'buzz'
  | 'click'
  | 'gong'
  | 'drum'
  | 'custom';

/**
 * Names of the built-in audio tones triggered by the timer engine.
 *
 * - intervalStart:    440 Hz beep, 80 ms -- fires at the start of each interval
 * - countdown3/2/1:  Three descending beeps at T-3, T-2, T-1
 * - intervalEnd:      Double-beep (2x 440 Hz, 80 ms each, 50 ms gap) at T=0
 * - workoutComplete:  Ascending three-tone flourish (440/554/659 Hz) -- cannot be disabled
 * - pauseClick:       Subtle click, 50 ms, 1 kHz, -12 dB relative to intervalStart
 */
export type ToneName =
  | 'intervalStart'
  | 'countdown3'
  | 'countdown2'
  | 'countdown1'
  | 'intervalEnd'
  | 'workoutComplete'
  | 'pauseClick'
  | 'halfway';
