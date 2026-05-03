/**
 * SpeechEngine — TTS wrapper for Schlag voice countdown.
 *
 * Uses expo-speech for device-side text-to-speech on native platforms.
 * Provides methods for countdown announcements ("3... 2... 1...") and
 * next-interval callouts ("Next: [name]").
 *
 * On web, expo-speech delegates to the Web Speech API (SpeechSynthesis),
 * which is supported in all modern browsers.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default speech options for English TTS. */
const SPEECH_OPTIONS: Speech.SpeechOptions = {
  language: 'en-US',
  rate: 1.0,
  pitch: 1.0,
};

// ---------------------------------------------------------------------------
// SpeechEngine
// ---------------------------------------------------------------------------

export class SpeechEngine {
  /**
   * Pre-warm the TTS engine to eliminate first-utterance latency.
   *
   * Fires a silent ` ` (single space) utterance at zero volume so the engine
   * loads the voice into memory without producing audible output. This cuts
   * 50–300ms off the very first countdown beep of a workout.
   *
   * Web is skipped: SpeechSynthesis typically requires a user gesture before
   * the first speak() will run, so a cold-start prewarm would silently no-op
   * and waste a call. Web prewarm strategy is tracked as a follow-up.
   *
   * Errors are swallowed — audio failures must never crash the app.
   *
   * @param voice  Optional expo-speech voice identifier. Null/undefined uses
   *               the system default voice for the language.
   */
  static prewarm(voice?: string | null): void {
    if (Platform.OS === 'web') return;

    try {
      Speech.speak(' ', {
        volume: 0,
        language: 'en-US',
        voice: voice ?? undefined,
      });
    } catch (error) {
      console.warn('[SpeechEngine] prewarm error:', error);
    }
  }

  /**
   * Speak a countdown number ("3", "2", "1").
   * The speech is brief and punchy at natural speed.
   *
   * @param n The countdown number (3, 2, or 1).
   */
  speakCountdown(n: number): void {
    this.stopAndSpeak(String(n), {
      ...SPEECH_OPTIONS,
      rate: 1.1, // Slightly faster for short numbers
    });
  }

  /**
   * Announce the next interval by name.
   * Example output: "Next: Squat"
   *
   * @param name The name of the upcoming interval.
   */
  speakNextInterval(name: string): void {
    if (!name || name.trim().length === 0) return;

    this.stopAndSpeak(`Next: ${name}`, {
      ...SPEECH_OPTIONS,
      rate: 0.95, // Slightly slower for clarity
    });
  }

  /**
   * Announce "Halfway" during an interval (reserved for future use).
   */
  speakHalfway(): void {
    this.stopAndSpeak('Halfway', SPEECH_OPTIONS);
  }

  /**
   * Stop any currently playing speech.
   * Call this before starting a new workout or when the user stops.
   */
  stop(): void {
    Speech.stop();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Stop any in-progress utterance and immediately speak new text.
   * This prevents overlapping speech when cues fire rapidly.
   */
  private stopAndSpeak(text: string, options: Speech.SpeechOptions): void {
    try {
      Speech.stop();
      Speech.speak(text, options);
    } catch (error) {
      console.warn('[SpeechEngine] TTS error:', error);
    }
  }
}
