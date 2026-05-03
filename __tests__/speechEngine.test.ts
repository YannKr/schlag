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

// react-native Platform is mocked per-test below by overriding the OS field.
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { SpeechEngine } from '@/lib/audio/speechEngine';

const speakMock = Speech.speak as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset platform to ios for each test; web tests override.
  (Platform as { OS: string }).OS = 'ios';
});

describe('SpeechEngine.prewarm', () => {
  it('calls Speech.speak with a single space at zero volume on native', () => {
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

  // The web no-op behavior (`Platform.OS === 'web'` early-return) cannot be
  // unit-tested: babel-preset-expo statically inlines `Platform.OS` reads to
  // a string literal at the bundler's `caller.platform` — 'ios' in jest-expo.
  // The mutation `(Platform as { OS: string }).OS = 'web'` lands on the
  // underlying object but is never read at runtime. Verified in a smoke test.
  it.skip('no-ops on web (returns without calling Speech.speak)', () => {
    (Platform as { OS: string }).OS = 'web';
    SpeechEngine.prewarm();
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by Speech.speak', () => {
    speakMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => SpeechEngine.prewarm()).not.toThrow();
  });
});
