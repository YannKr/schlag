/**
 * Unit tests for AudioEngine — orchestrates tones and speech.
 *
 * All collaborators (ToneGenerator, ToneGeneratorWeb, SpeechEngine) are
 * mocked; we assert on call shape, not actual audio output. Platform.OS
 * is exposed via a getter so individual tests can flip between native and
 * web branches.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

const mockToneInit = jest.fn<Promise<void>, []>();
const mockTonePlay = jest.fn<Promise<void>, [string, number?]>();
const mockToneCleanup = jest.fn<Promise<void>, []>();

jest.mock('@/lib/audio/toneGenerator', () => ({
  ToneGenerator: jest.fn().mockImplementation(() => ({
    initialize: mockToneInit,
    playTone: mockTonePlay,
    cleanup: mockToneCleanup,
  })),
}));

const mockWebInit = jest.fn<Promise<void>, []>();
const mockWebPlay = jest.fn<Promise<void>, [string, number?]>();
const mockWebCleanup = jest.fn<Promise<void>, []>();
const mockWebUnlock = jest.fn<void, []>();

jest.mock('@/lib/audio/toneGenerator.web', () => {
  // Real class so AudioEngine's `instanceof ToneGeneratorWeb` check works.
  class FakeToneGeneratorWeb {
    initialize = mockWebInit;
    playTone = mockWebPlay;
    cleanup = mockWebCleanup;
    unlockAudioContext = mockWebUnlock;
  }
  return { ToneGeneratorWeb: FakeToneGeneratorWeb };
});

const mockSpeakCountdown = jest.fn();
const mockSpeakNext = jest.fn();
const mockSpeakHalfway = jest.fn();
const mockSpeechStop = jest.fn();
const mockPrewarm = jest.fn();

jest.mock('@/lib/audio/speechEngine', () => {
  // Function-based "class" so we can attach a static method (`prewarm`) and
  // still support `new` instantiation. The factory runs at module load,
  // BEFORE this file's top-level mock consts are initialized — so prewarm is
  // wired through a closure that reads `mockPrewarm` lazily at call time.
  const FakeSpeechEngine = function () {
    return {
      speakCountdown: (...args: unknown[]) => mockSpeakCountdown(...args),
      speakNextInterval: (...args: unknown[]) => mockSpeakNext(...args),
      speakHalfway: (...args: unknown[]) => mockSpeakHalfway(...args),
      stop: (...args: unknown[]) => mockSpeechStop(...args),
    };
  } as unknown as {
    new (): unknown;
    prewarm: (...args: unknown[]) => unknown;
  };
  FakeSpeechEngine.prewarm = (...args: unknown[]) => mockPrewarm(...args);
  return { SpeechEngine: FakeSpeechEngine };
});

let mockSelectedVoiceId: string | null | undefined = null;
jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ settings: { selectedVoiceId: mockSelectedVoiceId } }),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AudioEngine } from '@/lib/audio/audioEngine';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'ios';
  mockSelectedVoiceId = null;
  mockToneInit.mockResolvedValue(undefined);
  mockTonePlay.mockResolvedValue(undefined);
  mockToneCleanup.mockResolvedValue(undefined);
  mockWebInit.mockResolvedValue(undefined);
  mockWebPlay.mockResolvedValue(undefined);
  mockWebCleanup.mockResolvedValue(undefined);
});

// Flush a pending microtask so fire-and-forget `.catch` chains run before
// the test body returns. Two ticks covers `await await` patterns used in
// playCustomAudio's web path.
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

// ---------------------------------------------------------------------------

describe('AudioEngine constructor', () => {
  it('routes to the native tone generator on iOS', async () => {
    mockPlatformOS = 'ios';
    const engine = new AudioEngine();
    await engine.initialize();
    expect(mockToneInit).toHaveBeenCalledTimes(1);
    expect(mockWebInit).not.toHaveBeenCalled();
  });

  it('routes to the web tone generator on web', async () => {
    mockPlatformOS = 'web';
    const engine = new AudioEngine();
    await engine.initialize();
    expect(mockWebInit).toHaveBeenCalledTimes(1);
    expect(mockToneInit).not.toHaveBeenCalled();
  });
});

describe('AudioEngine.initialize', () => {
  it('initializes the underlying tone generator on first call', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    expect(mockToneInit).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — repeated calls do not re-initialize', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    await engine.initialize();
    expect(mockToneInit).toHaveBeenCalledTimes(1);
  });
});

describe('AudioEngine.unlockWebAudio', () => {
  it('unlocks AudioContext and prewarms TTS on web with the active voice', () => {
    mockPlatformOS = 'web';
    mockSelectedVoiceId = 'voice-X';
    const engine = new AudioEngine();
    engine.unlockWebAudio();

    expect(mockWebUnlock).toHaveBeenCalledTimes(1);
    expect(mockPrewarm).toHaveBeenCalledWith('voice-X');
  });

  it('reads the active voice fresh on every call', () => {
    mockPlatformOS = 'web';
    mockSelectedVoiceId = 'voice-A';
    const engine = new AudioEngine();
    engine.unlockWebAudio();
    expect(mockPrewarm).toHaveBeenLastCalledWith('voice-A');

    mockSelectedVoiceId = 'voice-B';
    engine.unlockWebAudio();
    expect(mockPrewarm).toHaveBeenLastCalledWith('voice-B');
  });

  it('passes through null voice when no voice is selected', () => {
    mockPlatformOS = 'web';
    mockSelectedVoiceId = null;
    const engine = new AudioEngine();
    engine.unlockWebAudio();
    expect(mockPrewarm).toHaveBeenCalledWith(null);
  });

  it('is a no-op on native platforms', () => {
    mockPlatformOS = 'ios';
    const engine = new AudioEngine();
    engine.unlockWebAudio();
    expect(mockWebUnlock).not.toHaveBeenCalled();
    expect(mockPrewarm).not.toHaveBeenCalled();
  });
});

describe('AudioEngine.playIntervalStart', () => {
  it('plays the intervalStart tone', () => {
    const engine = new AudioEngine();
    engine.playIntervalStart();
    expect(mockTonePlay).toHaveBeenCalledWith('intervalStart');
  });

  it('swallows tone playback errors', async () => {
    mockTonePlay.mockRejectedValueOnce(new Error('boom'));
    const engine = new AudioEngine();
    expect(() => engine.playIntervalStart()).not.toThrow();
    await flushMicrotasks();
  });
});

describe('AudioEngine.playCountdown', () => {
  it.each([
    [3, 'countdown3'],
    [2, 'countdown2'],
    [1, 'countdown1'],
  ] as const)('maps secondsRemaining %i to tone %s', (n, toneName) => {
    const engine = new AudioEngine();
    engine.playCountdown(n, false);
    expect(mockTonePlay).toHaveBeenCalledWith(toneName);
  });

  it('skips voice when voiceEnabled is false', () => {
    const engine = new AudioEngine();
    engine.playCountdown(3, false);
    expect(mockSpeakCountdown).not.toHaveBeenCalled();
  });

  it('speaks the countdown number when voiceEnabled is true', () => {
    const engine = new AudioEngine();
    engine.playCountdown(2, true);
    expect(mockSpeakCountdown).toHaveBeenCalledWith(2);
  });
});

describe('AudioEngine.playIntervalEnd', () => {
  it('plays the built-in intervalEnd tone when no custom URI is provided', () => {
    const engine = new AudioEngine();
    engine.playIntervalEnd();
    expect(mockTonePlay).toHaveBeenCalledWith('intervalEnd');
  });

  it('plays the built-in intervalEnd tone when customUri is null', () => {
    const engine = new AudioEngine();
    engine.playIntervalEnd(null);
    expect(mockTonePlay).toHaveBeenCalledWith('intervalEnd');
  });

  it('does not fall through to the built-in tone when a custom URI is provided', async () => {
    mockPlatformOS = 'web';
    const playStub = jest.fn().mockResolvedValue(undefined);
    (global as unknown as { Audio: unknown }).Audio = jest
      .fn()
      .mockImplementation(() => ({ play: playStub }));

    const engine = new AudioEngine();
    engine.playIntervalEnd('https://example.com/end.mp3');
    await flushMicrotasks();

    expect(mockTonePlay).not.toHaveBeenCalledWith('intervalEnd');
    expect(playStub).toHaveBeenCalled();
  });
});

describe('AudioEngine.playWorkoutComplete', () => {
  it('plays the workoutComplete flourish', () => {
    const engine = new AudioEngine();
    engine.playWorkoutComplete();
    expect(mockTonePlay).toHaveBeenCalledWith('workoutComplete');
  });
});

describe('AudioEngine.playPauseClick', () => {
  it('plays the pauseClick tone', () => {
    const engine = new AudioEngine();
    engine.playPauseClick();
    expect(mockTonePlay).toHaveBeenCalledWith('pauseClick');
  });
});

describe('AudioEngine.playHalfway', () => {
  it('plays the halfway tone without voice when voiceEnabled is false', () => {
    const engine = new AudioEngine();
    engine.playHalfway(false);
    expect(mockTonePlay).toHaveBeenCalledWith('halfway');
    expect(mockSpeakHalfway).not.toHaveBeenCalled();
  });

  it('plays the halfway tone and speaks "Halfway" when voiceEnabled is true', () => {
    const engine = new AudioEngine();
    engine.playHalfway(true);
    expect(mockTonePlay).toHaveBeenCalledWith('halfway');
    expect(mockSpeakHalfway).toHaveBeenCalledTimes(1);
  });
});

describe('AudioEngine.speakNextInterval', () => {
  it('speaks the next interval name when voiceEnabled is true', () => {
    const engine = new AudioEngine();
    engine.speakNextInterval('Squat', true);
    expect(mockSpeakNext).toHaveBeenCalledWith('Squat');
  });

  it('does nothing when voiceEnabled is false', () => {
    const engine = new AudioEngine();
    engine.speakNextInterval('Squat', false);
    expect(mockSpeakNext).not.toHaveBeenCalled();
  });
});

describe('AudioEngine.stopSpeech', () => {
  it('stops the underlying speech engine', () => {
    const engine = new AudioEngine();
    engine.stopSpeech();
    expect(mockSpeechStop).toHaveBeenCalledTimes(1);
  });
});

describe('AudioEngine.cleanup', () => {
  it('stops speech and cleans up the tone generator', async () => {
    const engine = new AudioEngine();
    await engine.cleanup();
    expect(mockSpeechStop).toHaveBeenCalledTimes(1);
    expect(mockToneCleanup).toHaveBeenCalledTimes(1);
  });

  it('allows initialize to run again after cleanup', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    await engine.cleanup();
    await engine.initialize();
    expect(mockToneInit).toHaveBeenCalledTimes(2);
  });
});
