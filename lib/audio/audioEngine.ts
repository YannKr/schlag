/**
 * AudioEngine — Orchestrator combining tones and speech for Schlag.
 *
 * Provides a high-level API that the timer loop calls to play interval
 * start beeps, countdown tones, voice announcements, etc.  Internally
 * selects the correct ToneGenerator implementation (native via expo-av
 * or web via Web Audio API) based on the current platform.
 *
 * Usage:
 *   const audio = new AudioEngine();
 *   await audio.initialize();
 *   audio.unlockWebAudio();          // call from a user gesture on web
 *   audio.playIntervalStart();       // fire and forget
 */

import { Platform } from 'react-native';
import type { ToneName } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { ToneGenerator } from './toneGenerator';
import { ToneGeneratorWeb } from './toneGenerator.web';
import { SpeechEngine } from './speechEngine';

// ---------------------------------------------------------------------------
// Type for the union of tone generator interfaces
// ---------------------------------------------------------------------------

interface IToneGenerator {
  initialize(): Promise<void>;
  playTone(name: ToneName, volume?: number): Promise<void>;
  cleanup(): Promise<void>;
}

// ---------------------------------------------------------------------------
// AudioEngine
// ---------------------------------------------------------------------------

export class AudioEngine {
  private toneGenerator: IToneGenerator;
  private speechEngine: SpeechEngine;
  private initialized = false;

  constructor() {
    // Select the platform-appropriate tone generator.
    if (Platform.OS === 'web') {
      this.toneGenerator = new ToneGeneratorWeb();
    } else {
      this.toneGenerator = new ToneGenerator();
    }

    // Resolve the active voice on every utterance so a Settings change
    // takes effect on the next cue without reconstructing the engine.
    this.speechEngine = new SpeechEngine(() => this.getActiveVoice());
  }

  private getActiveVoice(): string | null | undefined {
    return useSettingsStore.getState().settings.selectedVoiceId;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the audio system.
   * On native: sets AVAudioSession and pre-loads all tone sounds.
   * On web: creates the AudioContext (still suspended until user gesture).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.toneGenerator.initialize();
    this.initialized = true;
  }

  /**
   * Resume the Web AudioContext and pre-warm the TTS engine after a user
   * gesture. No-op on native platforms.
   *
   * Web SpeechSynthesis requires a user gesture before the first speak() will
   * run, so we piggy-back the TTS prewarm on the same gesture that unlocks
   * Web Audio. This cuts first-utterance latency on web the same way the
   * cold-start prewarm does on native.
   */
  unlockWebAudio(): void {
    if (Platform.OS === 'web' && this.toneGenerator instanceof ToneGeneratorWeb) {
      this.toneGenerator.unlockAudioContext();
      SpeechEngine.prewarm(this.getActiveVoice());
    }
  }

  /**
   * Release all audio resources.
   * Call when navigating away from the workout screen.
   */
  async cleanup(): Promise<void> {
    this.speechEngine.stop();
    await this.toneGenerator.cleanup();
    this.initialized = false;
  }

  // -----------------------------------------------------------------------
  // Tone playback (fire-and-forget)
  // -----------------------------------------------------------------------

  /**
   * Play the interval-start beep (440Hz, 80ms).
   */
  playIntervalStart(): void {
    this.toneGenerator.playTone('intervalStart').catch(this.logError('intervalStart'));
  }

  /**
   * Play a countdown beep and optionally speak the number via TTS.
   *
   * @param secondsRemaining  3, 2, or 1.
   * @param voiceEnabled      Whether TTS voice countdown is active.
   */
  playCountdown(secondsRemaining: 3 | 2 | 1, voiceEnabled: boolean): void {
    const toneMap: Record<number, ToneName> = {
      3: 'countdown3',
      2: 'countdown2',
      1: 'countdown1',
    };

    this.toneGenerator
      .playTone(toneMap[secondsRemaining])
      .catch(this.logError(toneMap[secondsRemaining]));

    if (voiceEnabled) {
      this.speechEngine.speakCountdown(secondsRemaining);
    }
  }

  /**
   * Play the interval-end tone (double beep), or a custom audio file
   * if one is configured.
   *
   * Note: Custom audio URI playback is handled separately since it
   * requires loading a user-provided file.  In v1, the custom end tone
   * replaces the built-in double-beep globally.
   *
   * @param customUri  URI to a custom end-of-interval audio file, or null.
   */
  playIntervalEnd(customUri?: string | null): void {
    if (customUri) {
      this.playCustomAudio(customUri);
    } else {
      this.toneGenerator.playTone('intervalEnd').catch(this.logError('intervalEnd'));
    }
  }

  /**
   * Play the workout-complete flourish (ascending 440/554/659Hz).
   * This tone cannot be disabled per PRD requirements.
   */
  playWorkoutComplete(): void {
    this.toneGenerator
      .playTone('workoutComplete')
      .catch(this.logError('workoutComplete'));
  }

  /**
   * Play the pause/resume click (1kHz, 50ms, -12dB).
   */
  playPauseClick(): void {
    this.toneGenerator.playTone('pauseClick').catch(this.logError('pauseClick'));
  }

  /**
   * v2: Play the halfway alert (330Hz, 60ms) and optionally speak "Halfway".
   */
  playHalfway(voiceEnabled: boolean): void {
    this.toneGenerator.playTone('halfway').catch(this.logError('halfway'));
    if (voiceEnabled) {
      this.speechEngine.speakHalfway();
    }
  }

  /**
   * Announce the next interval via TTS if voice is enabled.
   *
   * @param name          Name of the upcoming interval.
   * @param voiceEnabled  Whether TTS voice is active for this sequence.
   */
  speakNextInterval(name: string, voiceEnabled: boolean): void {
    if (voiceEnabled) {
      this.speechEngine.speakNextInterval(name);
    }
  }

  /**
   * Stop any in-progress TTS speech.
   */
  stopSpeech(): void {
    this.speechEngine.stop();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Play a custom audio file from a URI.
   * Uses expo-av for native and falls back to HTMLAudioElement on web.
   */
  private async playCustomAudio(uri: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        const audio = new Audio(uri);
        await audio.play();
      } else {
        // Dynamic import to avoid bundling expo-av's Sound in web builds.
        const { Audio: ExpoAudio } = await import('expo-av');
        const { sound } = await ExpoAudio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
        );
        // Unload after playback completes to free memory.
        sound.setOnPlaybackStatusUpdate((status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
          }
        });
      }
    } catch (error) {
      console.warn('[AudioEngine] Error playing custom audio:', error);
      // Fall back to the built-in interval end tone.
      this.toneGenerator.playTone('intervalEnd').catch(this.logError('intervalEnd'));
    }
  }

  /**
   * Create a catch handler that logs errors without crashing.
   * Audio failures should never crash the workout.
   */
  private logError(toneName: string) {
    return (error: unknown) => {
      console.warn(`[AudioEngine] Error playing "${toneName}":`, error);
    };
  }
}
