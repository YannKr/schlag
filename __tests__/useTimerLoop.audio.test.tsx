/**
 * Unit tests for the useTimerLoop ⇄ audio wiring.
 *
 * The engine decides WHICH cues fire (covered in timerEngine.test.ts); this
 * file covers whether the hook actually plays and speaks them. Two things
 * here have no other coverage:
 *
 *   1. The completion flourish. tick() flips the status to 'completed' on
 *      the same call that emits the cue, so a hook that only reads cues
 *      while 'running' never plays it.
 *   2. The interval-name announcement, which the end cue and the start cue
 *      can both trigger — sometimes on different ticks.
 *
 * The real TimerEngine runs under jest fake timers (which also mock
 * Date.now, keeping the absolute-time math consistent). The audio engine
 * and storage are mocked.
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the hook)
// ---------------------------------------------------------------------------

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

jest.mock('@/lib/notifications', () => ({
  requestNotificationPermission: jest.fn().mockResolvedValue(true),
  scheduleIntervalNotifications: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotifications: jest.fn().mockResolvedValue(undefined),
}));

/**
 * The AudioEngine the hook actually uses.
 *
 * `useRef(new AudioEngine())` evaluates its argument on every render, so
 * later renders construct throwaway instances. Only the first one is kept by
 * the ref, so only the first one is captured here.
 */
let mockFirstAudio: Record<string, jest.Mock> | null = null;

jest.mock('@/lib/audio/audioEngine', () => ({
  AudioEngine: jest.fn().mockImplementation(function () {
    let muted = false;
    const instance = {
      initialize: jest.fn().mockResolvedValue(undefined),
      unlockWebAudio: jest.fn(),
      playIntervalStart: jest.fn(),
      playCountdown: jest.fn(),
      playIntervalEnd: jest.fn(),
      playWorkoutComplete: jest.fn(),
      playPauseClick: jest.fn(),
      playHalfway: jest.fn(),
      speakNextInterval: jest.fn(),
      stopSpeech: jest.fn(),
      setMuted: jest.fn((value: boolean) => {
        muted = value;
      }),
      isMuted: jest.fn(() => muted),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };
    if (!mockFirstAudio) mockFirstAudio = instance;
    return instance;
  }),
}));

jest.mock('@/lib/storage', () => {
  const { DEFAULT_SETTINGS } = jest.requireActual('@/constants/defaults');
  return {
    getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS })),
    saveSettings: jest.fn(() => true),
    saveTimerSession: jest.fn(() => true),
    clearTimerSession: jest.fn(),
    getTimerSession: jest.fn(() => null),
    getSequences: jest.fn(() => []),
    saveSequences: jest.fn(() => true),
    getSessions: jest.fn(() => []),
    saveSessions: jest.fn(() => true),
    getStorageUsageBytes: jest.fn(() => 0),
    setStorageErrorHandler: jest.fn(),
    requestPersistentStorage: jest.fn(),
  };
});

import { useTimerLoop, type UseTimerLoopReturn } from '@/hooks/useTimerLoop';
import type { Sequence } from '@/types/sequence';

// ---------------------------------------------------------------------------
// Fixtures and harness
// ---------------------------------------------------------------------------

function makeSequence(overrides: Partial<Sequence> = {}): Sequence {
  return {
    id: 'seq-1',
    name: 'Test Sequence',
    description: '',
    repeat_count: 1,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: [
      { id: 'int-1', name: 'Push', duration_seconds: 5, color: '#E63946', note: '' },
      { id: 'int-2', name: 'Pull', duration_seconds: 30, color: '#00B4D8', note: '' },
    ],
    audio_config: {
      use_voice_countdown: true,
      use_builtin_beeps: true,
      announce_interval_names: false,
      halfway_alert: false,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_used_at: null,
    ...overrides,
  };
}

let hook: UseTimerLoopReturn;

/** The captured audio engine, asserted to exist. */
function audio(): Record<string, jest.Mock> {
  if (!mockFirstAudio) throw new Error('AudioEngine was never constructed');
  return mockFirstAudio;
}

function Host() {
  hook = useTimerLoop();
  return null;
}

function render() {
  act(() => {
    renderer.create(<Host />);
  });
}

async function startWorkout(sequence: Sequence) {
  await act(async () => {
    await hook.start(sequence);
  });
}

/** Run the native 100ms tick loop for the given span. */
function runLoop(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** Names passed to speakNextInterval, in order. */
function spokenNames(): string[] {
  return audio().speakNextInterval.mock.calls.map((c) => c[0] as string);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFirstAudio = null;
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Completion flourish
// ---------------------------------------------------------------------------

describe('useTimerLoop completion flourish', () => {
  const singleInterval = () =>
    makeSequence({
      repeat_count: 1,
      intervals: [
        { id: 'int-1', name: 'Push', duration_seconds: 5, color: '#E63946', note: '' },
      ],
    });

  it('plays the flourish on the tick that completes the workout', async () => {
    render();
    await startWorkout(singleInterval());

    runLoop(5000);

    expect(audio().playWorkoutComplete).toHaveBeenCalledTimes(1);
  });

  it('plays it exactly once even as the loop keeps being driven', async () => {
    render();
    await startWorkout(singleInterval());

    runLoop(9000);

    expect(audio().playWorkoutComplete).toHaveBeenCalledTimes(1);
  });

  it('plays no flourish before the workout is over', async () => {
    render();
    await startWorkout(singleInterval());

    runLoop(4000);

    expect(audio().playWorkoutComplete).not.toHaveBeenCalled();
  });

  it('plays the interval end beep at a mid-workout boundary, not the flourish', async () => {
    render();
    await startWorkout(makeSequence());

    runLoop(5000);

    expect(audio().playIntervalEnd).toHaveBeenCalledTimes(1);
    expect(audio().playWorkoutComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Interval name announcement
// ---------------------------------------------------------------------------

describe('useTimerLoop interval announcements', () => {
  it('announces the next interval once at a boundary', async () => {
    render();
    await startWorkout(makeSequence());

    runLoop(5000);

    expect(spokenNames()).toEqual(['Pull']);
  });

  it('does not announce the same interval twice across ticks', async () => {
    // auto_advance off freezes the timer at 0 until the user taps to
    // continue, so the end cue and the following start cue land on
    // different ticks — the case a same-tick check cannot catch.
    render();
    await startWorkout(
      makeSequence({
        auto_advance: false,
        audio_config: {
          use_voice_countdown: true,
          use_builtin_beeps: true,
          announce_interval_names: true,
          halfway_alert: false,
        },
      }),
    );

    // 'Push' from its own start cue, then 'Pull' from the end cue.
    runLoop(5000);
    expect(spokenNames()).toEqual(['Push', 'Pull']);

    // Tap to continue. 'Pull' now starts — and must not be said again.
    act(() => {
      hook.skip();
    });

    expect(spokenNames()).toEqual(['Push', 'Pull']);
  });

  it('still announces an interval the end cue did not name', async () => {
    // The first interval has no end cue in front of it, so the start cue
    // must announce it. Guards against the dedupe swallowing too much.
    render();
    await startWorkout(
      makeSequence({
        audio_config: {
          use_voice_countdown: true,
          use_builtin_beeps: true,
          announce_interval_names: true,
          halfway_alert: false,
        },
      }),
    );

    runLoop(100);

    expect(spokenNames()).toEqual(['Push']);
  });

  it('announces a repeat of the same name later in the workout', async () => {
    // Push, Pull, Push: the dedupe is cleared by each start cue, so the
    // second Push is still announced.
    render();
    await startWorkout(
      makeSequence({
        repeat_count: 1,
        intervals: [
          { id: 'a', name: 'Push', duration_seconds: 5, color: '#E63946', note: '' },
          { id: 'b', name: 'Pull', duration_seconds: 5, color: '#00B4D8', note: '' },
          { id: 'c', name: 'Push', duration_seconds: 30, color: '#E63946', note: '' },
        ],
        audio_config: {
          use_voice_countdown: true,
          use_builtin_beeps: true,
          announce_interval_names: true,
          halfway_alert: false,
        },
      }),
    );

    runLoop(10_000);

    expect(spokenNames()).toEqual(['Push', 'Pull', 'Push']);
  });

  it('says nothing when voice countdown is off for the sequence', async () => {
    render();
    await startWorkout(
      makeSequence({
        audio_config: {
          use_voice_countdown: false,
          use_builtin_beeps: true,
          announce_interval_names: true,
          halfway_alert: false,
        },
      }),
    );

    runLoop(5000);

    expect(audio().speakNextInterval).not.toHaveBeenCalled();
  });
});
