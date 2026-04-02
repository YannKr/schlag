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
