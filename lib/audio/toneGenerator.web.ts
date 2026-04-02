/**
 * ToneGeneratorWeb — Web Audio API tone synthesis for Schlag.
 *
 * Uses OscillatorNode and GainNode to generate tones in the browser.
 * AudioContext must be "unlocked" by a user gesture (wired to the
 * "Start Workout" button) before any audio can play.
 *
 * Same public interface as the native ToneGenerator so they can be
 * swapped via Platform.OS detection.
 */

import type { ToneName } from '@/types';

// ---------------------------------------------------------------------------
// Tone specifications
// ---------------------------------------------------------------------------

interface ToneSegment {
  frequency: number;
  durationMs: number;
  volume: number; // linear amplitude 0..1
}

/** Volume at -12dB relative to full scale. */
const VOLUME_MINUS_12DB = Math.pow(10, -12 / 20); // ~0.25

/**
 * Tone definitions matching the PRD spec.
 * Single-segment tones are arrays of one entry; compound tones have multiple.
 */
const TONE_SPECS: Record<ToneName, { segments: ToneSegment[]; gapMs: number }> = {
  intervalStart: {
    segments: [{ frequency: 440, durationMs: 80, volume: 1.0 }],
    gapMs: 0,
  },
  countdown3: {
    segments: [{ frequency: 523, durationMs: 80, volume: 1.0 }],
    gapMs: 0,
  },
  countdown2: {
    segments: [{ frequency: 466, durationMs: 80, volume: 1.0 }],
    gapMs: 0,
  },
  countdown1: {
    segments: [{ frequency: 440, durationMs: 80, volume: 1.0 }],
    gapMs: 0,
  },
  intervalEnd: {
    segments: [
      { frequency: 440, durationMs: 80, volume: 1.0 },
      { frequency: 440, durationMs: 80, volume: 1.0 },
    ],
    gapMs: 50,
  },
  workoutComplete: {
    segments: [
      { frequency: 440, durationMs: 120, volume: 1.0 },
      { frequency: 554, durationMs: 120, volume: 1.0 },
      { frequency: 659, durationMs: 120, volume: 1.0 },
    ],
    gapMs: 30,
  },
  pauseClick: {
    segments: [{ frequency: 1000, durationMs: 50, volume: VOLUME_MINUS_12DB }],
    gapMs: 0,
  },
  halfway: {
    segments: [{ frequency: 330, durationMs: 60, volume: 1.0 }],
    gapMs: 0,
  },
};

// ---------------------------------------------------------------------------
// ToneGeneratorWeb
// ---------------------------------------------------------------------------

export class ToneGeneratorWeb {
  private audioContext: AudioContext | null = null;
  private initialized = false;

  /**
   * Create the AudioContext.
   *
   * Note: On most browsers the context starts in a "suspended" state and
   * must be resumed via a user gesture (see `unlockAudioContext`).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Use the standard AudioContext or the webkit-prefixed version.
      const AudioCtx =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : (typeof (window as any).webkitAudioContext !== 'undefined'
              ? (window as any).webkitAudioContext
              : null);

      if (!AudioCtx) {
        console.warn('[ToneGeneratorWeb] Web Audio API is not available in this browser.');
        return;
      }

      this.audioContext = new AudioCtx();
      this.initialized = true;
    } catch (error) {
      console.warn('[ToneGeneratorWeb] Failed to create AudioContext:', error);
    }
  }

  /**
   * Resume the AudioContext after a user gesture.
   * Must be called from a click/tap handler (e.g. "Start Workout" button).
   */
  unlockAudioContext(): void {
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((err) => {
        console.warn('[ToneGeneratorWeb] Failed to resume AudioContext:', err);
      });
    }
  }

  /**
   * Whether the AudioContext is active and ready to produce sound.
   */
  isUnlocked(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * Play a named tone using oscillators.
   *
   * Each call creates fresh OscillatorNode + GainNode instances that are
   * automatically garbage collected after playback completes.  This avoids
   * the complexity of pooling while remaining performant for short tones.
   *
   * @param name   The tone to play.
   * @param volume Optional master volume override (0..1).
   */
  async playTone(name: ToneName, volume?: number): Promise<void> {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      // Silently skip if not unlocked — the UI should call unlockAudioContext first.
      return;
    }

    const spec = TONE_SPECS[name];
    if (!spec) {
      console.warn(`[ToneGeneratorWeb] Unknown tone "${name}".`);
      return;
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const masterVolume = volume ?? 1.0;

    let timeOffset = 0;

    for (let i = 0; i < spec.segments.length; i++) {
      const seg = spec.segments[i];
      const startTime = now + timeOffset / 1000;
      const durationSec = seg.durationMs / 1000;
      const fadeTime = 0.005; // 5ms fade to avoid clicks

      // Create oscillator.
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(seg.frequency, startTime);

      // Create gain node with fade envelope.
      const gainNode = ctx.createGain();
      const effectiveVolume = seg.volume * masterVolume;

      // Start silent, fade in.
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(
        effectiveVolume,
        startTime + fadeTime,
      );

      // Sustain at full volume.
      gainNode.gain.setValueAtTime(
        effectiveVolume,
        startTime + durationSec - fadeTime,
      );

      // Fade out to avoid click.
      gainNode.gain.linearRampToValueAtTime(0, startTime + durationSec);

      // Connect: oscillator -> gain -> destination.
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Schedule start and stop.
      oscillator.start(startTime);
      oscillator.stop(startTime + durationSec + 0.01); // small buffer to complete fade

      // Advance time offset for the next segment.
      timeOffset += seg.durationMs;

      // Add gap between segments.
      if (i < spec.segments.length - 1) {
        timeOffset += spec.gapMs;
      }
    }
  }

  /**
   * Close the AudioContext and release resources.
   */
  async cleanup(): Promise<void> {
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.warn('[ToneGeneratorWeb] Error closing AudioContext:', error);
      }
      this.audioContext = null;
    }
    this.initialized = false;
  }
}
