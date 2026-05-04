/**
 * Unit tests for SpeechEngine — focused on the static prewarm() helper.
 *
 * expo-speech is mocked; we assert on call shape, not actual TTS output.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as Speech from 'expo-speech';
import { SpeechEngine } from '@/lib/audio/speechEngine';

const speakMock = Speech.speak as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SpeechEngine.prewarm', () => {
  it('calls Speech.speak with a single space at zero volume', () => {
    SpeechEngine.prewarm();

    expect(speakMock).toHaveBeenCalledTimes(1);
    const [text, options] = speakMock.mock.calls[0];
    expect(text).toBe(' ');
    expect(options.volume).toBe(0);
    expect(options.language).toBe('en-US');
    expect(options.voice).toBeUndefined();
  });

  it('passes the voice identifier through when provided', () => {
    SpeechEngine.prewarm('com.apple.ttsbundle.Samantha-compact');

    expect(speakMock).toHaveBeenCalledTimes(1);
    const [, options] = speakMock.mock.calls[0];
    expect(options.voice).toBe('com.apple.ttsbundle.Samantha-compact');
  });

  it('treats null voice as no voice (system default)', () => {
    SpeechEngine.prewarm(null);

    expect(speakMock).toHaveBeenCalledTimes(1);
    const [, options] = speakMock.mock.calls[0];
    expect(options.voice).toBeUndefined();
  });

  it('swallows errors thrown by Speech.speak', () => {
    speakMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => SpeechEngine.prewarm()).not.toThrow();
  });
});

describe('SpeechEngine instance voice resolution', () => {
  const stopMock = Speech.stop as jest.Mock;

  it('reads the voice via the resolver on every utterance', () => {
    let voice: string | null = 'voice-A';
    const engine = new SpeechEngine(() => voice);

    engine.speakCountdown(3);
    expect(speakMock).toHaveBeenLastCalledWith('3', expect.objectContaining({
      voice: 'voice-A',
    }));

    voice = 'voice-B';
    engine.speakNextInterval('Squat');
    expect(speakMock).toHaveBeenLastCalledWith('Next: Squat', expect.objectContaining({
      voice: 'voice-B',
    }));

    voice = null;
    engine.speakHalfway();
    expect(speakMock).toHaveBeenLastCalledWith('Halfway', expect.objectContaining({
      voice: undefined,
    }));
  });

  it('defaults to no voice when no resolver is provided', () => {
    const engine = new SpeechEngine();
    engine.speakCountdown(2);
    const [, options] = speakMock.mock.calls.at(-1)!;
    expect(options.voice).toBeUndefined();
  });

  it('stops any in-progress speech before speaking', () => {
    const engine = new SpeechEngine(() => null);
    engine.speakCountdown(1);
    expect(stopMock).toHaveBeenCalled();
  });

  it('skips empty next-interval announcements', () => {
    const engine = new SpeechEngine(() => 'voice-X');
    engine.speakNextInterval('   ');
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('speakPreview uses the active voice', () => {
    const engine = new SpeechEngine(() => 'voice-preview');
    engine.speakPreview('hello');
    expect(speakMock).toHaveBeenLastCalledWith('hello', expect.objectContaining({
      voice: 'voice-preview',
    }));
  });
});
