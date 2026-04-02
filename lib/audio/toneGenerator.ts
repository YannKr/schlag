/**
 * ToneGenerator — Native audio tone synthesis for Schlag.
 *
 * Generates beep tones as base64-encoded WAV data URIs and plays them
 * via expo-av.  All sounds are pre-loaded during initialization to
 * minimize playback latency during workouts.
 *
 * CRITICAL: Sets AVAudioSession to `.playback` mode so audio fires
 * even when the iOS ringer switch is off.
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import type { ToneName } from '@/types';

// ---------------------------------------------------------------------------
// WAV generation
// ---------------------------------------------------------------------------

/**
 * Generate a single-channel 16-bit PCM WAV as a base64 data URI.
 *
 * @param frequency  Frequency in Hz (e.g. 440).
 * @param durationMs Duration in milliseconds.
 * @param volume     Amplitude 0..1 (1 = full scale).
 * @param sampleRate Sample rate (default 44100).
 * @returns          `data:audio/wav;base64,...` string.
 */
function generateToneWav(
  frequency: number,
  durationMs: number,
  volume: number = 1.0,
  sampleRate: number = 44100,
): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave samples with a short fade-in/out to avoid clicks.
  const fadeInSamples = Math.min(Math.floor(sampleRate * 0.005), numSamples); // 5ms fade
  const fadeOutSamples = Math.min(Math.floor(sampleRate * 0.005), numSamples);
  const fadeOutStart = numSamples - fadeOutSamples;

  const amplitude = volume * 32767;

  for (let i = 0; i < numSamples; i++) {
    let envelope = 1.0;

    if (i < fadeInSamples) {
      envelope = i / fadeInSamples;
    } else if (i >= fadeOutStart) {
      envelope = (numSamples - 1 - i) / fadeOutSamples;
    }

    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * envelope;
    view.setInt16(headerSize + i * 2, Math.round(sample), true);
  }

  // Convert ArrayBuffer to base64.
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  return `data:audio/wav;base64,${base64}`;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a compound tone (multiple frequencies played in sequence)
 * as a single WAV data URI.
 *
 * @param segments Array of { frequency, durationMs, volume } objects.
 * @param gapMs    Silence gap between segments in ms.
 */
function generateCompoundToneWav(
  segments: Array<{ frequency: number; durationMs: number; volume: number }>,
  gapMs: number,
  sampleRate: number = 44100,
): string {
  // Calculate total number of samples.
  const gapSamples = Math.floor((sampleRate * gapMs) / 1000);
  let totalSamples = 0;

  for (let s = 0; s < segments.length; s++) {
    totalSamples += Math.floor((sampleRate * segments[s].durationMs) / 1000);
    if (s < segments.length - 1) {
      totalSamples += gapSamples;
    }
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = totalSamples * blockAlign;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = headerSize;

  for (let s = 0; s < segments.length; s++) {
    const { frequency, durationMs, volume } = segments[s];
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const fadeLen = Math.min(Math.floor(sampleRate * 0.005), numSamples);
    const fadeOutStart = numSamples - fadeLen;
    const amplitude = volume * 32767;

    for (let i = 0; i < numSamples; i++) {
      let envelope = 1.0;
      if (i < fadeLen) {
        envelope = i / fadeLen;
      } else if (i >= fadeOutStart) {
        envelope = (numSamples - 1 - i) / fadeLen;
      }

      const sample =
        Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * envelope;
      view.setInt16(offset, Math.round(sample), true);
      offset += 2;
    }

    // Write silence for the gap (except after the last segment).
    if (s < segments.length - 1) {
      for (let i = 0; i < gapSamples; i++) {
        view.setInt16(offset, 0, true);
        offset += 2;
      }
    }
  }

  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  return `data:audio/wav;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Pre-defined tone data URIs
// ---------------------------------------------------------------------------

/** Volume at -12dB relative to full scale. */
const VOLUME_MINUS_12DB = Math.pow(10, -12 / 20); // ~0.25

const TONE_CONFIGS: Record<ToneName, string> = {
  intervalStart: generateToneWav(440, 80, 1.0),
  countdown3: generateToneWav(523, 80, 1.0), // C5
  countdown2: generateToneWav(466, 80, 1.0), // Bb4
  countdown1: generateToneWav(440, 80, 1.0), // A4
  intervalEnd: generateCompoundToneWav(
    [
      { frequency: 440, durationMs: 80, volume: 1.0 },
      { frequency: 440, durationMs: 80, volume: 1.0 },
    ],
    50,
  ),
  workoutComplete: generateCompoundToneWav(
    [
      { frequency: 440, durationMs: 120, volume: 1.0 },
      { frequency: 554, durationMs: 120, volume: 1.0 },
      { frequency: 659, durationMs: 120, volume: 1.0 },
    ],
    30,
  ),
  pauseClick: generateToneWav(1000, 50, VOLUME_MINUS_12DB),
  halfway: generateToneWav(330, 60, 1.0), // v2: 330Hz, 60ms
};

// ---------------------------------------------------------------------------
// ToneGenerator class
// ---------------------------------------------------------------------------

export class ToneGenerator {
  private sounds: Map<ToneName, Audio.Sound> = new Map();
  private initialized = false;

  /**
   * Pre-load all tones and configure the audio session for iOS silent
   * switch bypass and background playback.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // CRITICAL: Set audio mode BEFORE loading sounds.
    // This ensures iOS plays audio when the ringer switch is off.
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    // Pre-load all tones.
    const entries = Object.entries(TONE_CONFIGS) as Array<[ToneName, string]>;
    const loadPromises = entries.map(async ([name, uri]) => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, volume: 1.0 },
        );
        this.sounds.set(name, sound);
      } catch (error) {
        console.warn(`[ToneGenerator] Failed to load tone "${name}":`, error);
      }
    });

    await Promise.all(loadPromises);
    this.initialized = true;
  }

  /**
   * Play a pre-loaded tone.
   *
   * The sound is rewound to position 0 before playing so it can be
   * re-triggered rapidly (e.g. countdown beeps at 1-second intervals).
   *
   * @param name   The tone to play.
   * @param volume Optional volume override (0..1).
   */
  async playTone(name: ToneName, volume?: number): Promise<void> {
    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`[ToneGenerator] Tone "${name}" not loaded.`);
      return;
    }

    try {
      // Stop current playback before rewinding to prevent overlap/clipping.
      await sound.stopAsync();
      await sound.setPositionAsync(0);

      if (volume !== undefined) {
        await sound.setVolumeAsync(volume);
      }

      await sound.playAsync();
    } catch (error) {
      console.warn(`[ToneGenerator] Error playing tone "${name}":`, error);
    }
  }

  /**
   * Unload all pre-loaded sounds to free memory.
   * Call when the audio engine is no longer needed.
   */
  async cleanup(): Promise<void> {
    const unloadPromises: Promise<AVPlaybackStatus>[] = [];

    this.sounds.forEach((sound) => {
      unloadPromises.push(sound.unloadAsync());
    });

    await Promise.allSettled(unloadPromises);
    this.sounds.clear();
    this.initialized = false;
  }
}
