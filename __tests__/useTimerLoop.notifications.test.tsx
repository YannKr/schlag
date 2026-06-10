/**
 * Unit tests for the useTimerLoop ⇄ notifications wiring — the AppState
 * glue that schedules OS-level boundary notifications when a running
 * workout is backgrounded and cancels them on every return-to-foreground
 * / pause / stop / start path.
 *
 * computeUpcomingBoundaries (pure math) and lib/notifications (expo
 * contract) are tested elsewhere; this file covers the integration layer
 * that was previously untested: WHO calls WHAT, WHEN.
 *
 * The audio engine and storage are mocked; the real TimerEngine runs under
 * jest fake timers (which also mock Date.now, keeping absolute-time math
 * consistent).
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the hook)
// ---------------------------------------------------------------------------

// uuid ships ESM-only — mock it (it is only pulled in transitively via
// constants/defaults; IDs are irrelevant to these tests).
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const mockRequestPermission = jest.fn<Promise<boolean>, []>();
const mockSchedule = jest.fn<Promise<void>, [unknown, boolean?]>();
const mockCancel = jest.fn<Promise<void>, []>();

jest.mock('@/lib/notifications', () => ({
  requestNotificationPermission: () => mockRequestPermission(),
  scheduleIntervalNotifications: (boundaries: unknown, muted?: boolean) =>
    mockSchedule(boundaries, muted),
  cancelScheduledNotifications: () => mockCancel(),
}));

// Pass-through mock for computeUpcomingBoundaries so individual tests can
// make it throw (the AppState listener must survive that). Everything else
// in timerCalculations stays real — the TimerEngine depends on it.
const mockComputeBoundaries = jest.fn();
jest.mock('@/lib/timer/timerCalculations', () => ({
  ...jest.requireActual('@/lib/timer/timerCalculations'),
  computeUpcomingBoundaries: (...args: unknown[]) => mockComputeBoundaries(...args),
}));

jest.mock('@/lib/audio/audioEngine', () => ({
  AudioEngine: jest.fn().mockImplementation(() => {
    // Stateful mute so the hook can read back what setMuted() wrote.
    let muted = false;
    return {
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
import { clearTimerSession, getTimerSession, saveTimerSession } from '@/lib/storage';
import type { BoundaryEvent } from '@/lib/timer/timerCalculations';
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
      { id: 'int-1', name: 'Work', duration_seconds: 30, color: '#E63946', note: '' },
      { id: 'int-2', name: 'Rest', duration_seconds: 10, color: '#00B4D8', note: '' },
    ],
    audio_config: {
      use_voice_countdown: false,
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

function Host() {
  hook = useTimerLoop();
  return null;
}

let appStateHandler: ((next: AppStateStatus) => void) | null = null;
let appStateSpy: jest.SpyInstance;

function render() {
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<Host />);
  });
  return tree!;
}

async function startWorkout(sequence: Sequence = makeSequence()) {
  await act(async () => {
    await hook.start(sequence);
  });
  // start() itself clears stale schedules — reset so each test asserts
  // only the calls it provokes.
  mockSchedule.mockClear();
  mockCancel.mockClear();
}

function changeAppState(next: AppStateStatus) {
  if (!appStateHandler) throw new Error('AppState handler not captured');
  act(() => {
    appStateHandler!(next);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRequestPermission.mockResolvedValue(true);
  mockSchedule.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
  mockComputeBoundaries.mockImplementation((...args) =>
    jest
      .requireActual('@/lib/timer/timerCalculations')
      .computeUpcomingBoundaries(...args),
  );

  appStateHandler = null;
  appStateSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type: string, handler: (next: AppStateStatus) => void) => {
      appStateHandler = handler;
      return { remove: jest.fn() } as never;
    });
});

afterEach(() => {
  appStateSpy.mockRestore();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTimerLoop notification wiring', () => {
  it('start() requests permission and clears any stale schedule', async () => {
    render();
    await act(async () => {
      await hook.start(makeSequence());
    });
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules boundary notifications when backgrounded mid-workout', async () => {
    const tree = render();
    await startWorkout();

    changeAppState('background');

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const boundaries = mockSchedule.mock.calls[0][0] as BoundaryEvent[];
    // 2 intervals × 1 round → "Next: Rest" + "Workout complete".
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0].title).toBe('Next: Rest');
    expect(boundaries[1].title).toBe('Workout complete 🎉');
    expect(boundaries[0].fireDate).toBeGreaterThan(Date.now());

    // The session is also persisted for process-kill recovery.
    expect(saveTimerSession).toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('re-schedules (replaces) on repeated inactive/background transitions', async () => {
    const tree = render();
    await startWorkout();

    changeAppState('inactive');
    changeAppState('background');

    // Each transition recomputes and re-schedules; lib/notifications
    // guarantees replace-not-append semantics.
    expect(mockSchedule).toHaveBeenCalledTimes(2);

    act(() => tree.unmount());
  });

  it('cancels notifications when returning to the foreground', async () => {
    const tree = render();
    await startWorkout();

    changeAppState('background');
    mockCancel.mockClear();

    changeAppState('active');
    expect(mockCancel).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('does not schedule when backgrounded while paused', async () => {
    const tree = render();
    await startWorkout();

    act(() => {
      hook.pause();
    });
    mockSchedule.mockClear();

    changeAppState('background');
    expect(mockSchedule).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('does not schedule when backgrounded with no workout active', () => {
    const tree = render();
    changeAppState('background');
    expect(mockSchedule).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('pause() and stop() cancel any scheduled notifications', async () => {
    const tree = render();
    await startWorkout();

    act(() => {
      hook.pause();
    });
    expect(mockCancel).toHaveBeenCalledTimes(1);

    act(() => {
      hook.stop();
    });
    expect(mockCancel).toHaveBeenCalledTimes(2);

    act(() => tree.unmount());
  });

  it('cancels notifications when the workout completes naturally', async () => {
    const tree = render();
    // 1s + 1s, single round — completes quickly under fake timers.
    await startWorkout(
      makeSequence({
        intervals: [
          { id: 'int-1', name: 'Work', duration_seconds: 1, color: '#E63946', note: '' },
          { id: 'int-2', name: 'Rest', duration_seconds: 1, color: '#00B4D8', note: '' },
        ],
      }),
    );

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(hook.tickData?.status).toBe('completed');
    expect(mockCancel).toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('schedules with sound by default (not muted)', async () => {
    const tree = render();
    await startWorkout();

    changeAppState('background');

    expect(mockSchedule).toHaveBeenCalledWith(expect.any(Array), false);

    act(() => tree.unmount());
  });

  it('passes the mute state through to notification scheduling', async () => {
    const tree = render();
    await startWorkout();

    act(() => {
      hook.setMuted(true);
    });
    changeAppState('background');

    expect(mockSchedule).toHaveBeenCalledWith(expect.any(Array), true);

    act(() => tree.unmount());
  });

  it('survives a computeUpcomingBoundaries throw inside the AppState listener', async () => {
    const tree = render();
    await startWorkout();

    mockComputeBoundaries.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => changeAppState('background')).not.toThrow();
    expect(mockSchedule).not.toHaveBeenCalled();

    // The session save still happened before the failed schedule attempt.
    expect(saveTimerSession).toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('restore() rejects a saved session whose interval index is out of range', async () => {
    const tree = render();
    const sequence = makeSequence();

    (getTimerSession as jest.Mock).mockReturnValue({
      sequenceId: sequence.id,
      savedAt: Date.now(),
      state: {
        status: 'running',
        sequenceId: sequence.id,
        currentIntervalIndex: 99, // out of range for 2 intervals
        currentRound: 1,
        absoluteStartTime: Date.now() - 1_000,
        pausedElapsed: 0,
        pausedAt: null,
        isRestBetweenSets: false,
        finishAfterRound: false,
      },
    });

    let restored: boolean | undefined;
    await act(async () => {
      restored = await hook.restore(sequence);
    });

    expect(restored).toBe(false);
    expect(clearTimerSession).toHaveBeenCalled();
    expect(hook.isActive).toBe(false);

    act(() => tree.unmount());
  });
});
