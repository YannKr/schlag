/**
 * Unit tests for the workout screen's session logging.
 *
 * Leaving the screen with the hardware Back button or a back swipe unmounts
 * it without going through Stop or Done, so the unmount cleanup is what
 * decides how the workout is recorded. Getting that wrong writes a wrong row
 * into permanent history, and nothing else in the suite renders this screen.
 *
 * The timer loop, audio, camera and navigation are mocked; the real session
 * store runs against an in-memory storage mock.
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the screen)
// ---------------------------------------------------------------------------

jest.mock('uuid', () => {
  let n = 0;
  return { v4: () => `test-uuid-${++n}` };
});

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'seq-1' }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Heavy leaves that contribute nothing to session logging.
jest.mock('react-native-svg', () => {
  const React = jest.requireActual('react');
  const stub = (name: string) => {
    const C = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(name, null, children);
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Path: stub('Path'),
    Polygon: stub('Polygon'),
    Rect: stub('Rect'),
  };
});
jest.mock('@/components/CameraPreview', () => ({ CameraPreview: () => null }));
jest.mock('@/components/RepCountDisplay', () => ({ RepCountDisplay: () => null }));
jest.mock('@/components/AnimatedCountdown', () => ({ AnimatedCountdown: () => null }));
jest.mock('@/components/KeyboardShortcutOverlay', () => ({
  KeyboardShortcutOverlay: () => null,
}));
jest.mock('@/components/Glyph', () => ({ Glyph: () => null }));
jest.mock('@/hooks/useWakeLock', () => ({ useWakeLock: jest.fn() }));
jest.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: jest.fn() }));
jest.mock('@/hooks/useIntensity', () => ({ useIntensity: () => ({ act: 0, intensity: 0 }) }));
jest.mock('@/hooks/useRepTracking', () => ({
  useRepTracking: () => ({ reps: 0, isTracking: false, error: null }),
}));

// The timer loop is driven by hand so each test can pin the tick data the
// cleanup will read.
const mockTimerLoop = {
  tickData: null as unknown,
  start: jest.fn().mockResolvedValue(undefined),
  restore: jest.fn().mockResolvedValue(true),
  pause: jest.fn(),
  resume: jest.fn(),
  skip: jest.fn(),
  stop: jest.fn(),
  finishAfterRound: jest.fn(),
  setMuted: jest.fn(),
  isActive: true,
};
jest.mock('@/hooks/useTimerLoop', () => ({
  useTimerLoop: () => mockTimerLoop,
}));

jest.mock('@/lib/storage', () => {
  const { DEFAULT_SETTINGS } = jest.requireActual('@/constants/defaults');
  let sessions: unknown[] = [];
  return {
    getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS })),
    saveSettings: jest.fn(() => true),
    getSequences: jest.fn(() => []),
    saveSequences: jest.fn(() => true),
    getSessions: jest.fn(() => sessions),
    saveSessions: jest.fn((s: unknown[]) => {
      sessions = s;
      return true;
    }),
    getTimerSession: jest.fn(() => null),
    saveTimerSession: jest.fn(() => true),
    clearTimerSession: jest.fn(),
    getStorageUsageBytes: jest.fn(() => 0),
    setStorageErrorHandler: jest.fn(),
    requestPersistentStorage: jest.fn(),
  };
});

import WorkoutScreen from '@/app/workout/[id]';
import { useSequenceStore } from '@/stores/sequenceStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Sequence } from '@/types/sequence';
import type { TimerTickData } from '@/types/timer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEQUENCE: Sequence = {
  id: 'seq-1',
  name: 'Test Sequence',
  description: '',
  repeat_count: 3,
  rest_between_sets_seconds: 0,
  auto_advance: true,
  intervals: [
    { id: 'int-1', name: 'Push', duration_seconds: 30, color: '#E63946', note: '' },
    { id: 'int-2', name: 'Pull', duration_seconds: 30, color: '#00B4D8', note: '' },
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
};

function makeTick(overrides: Partial<TimerTickData> = {}): TimerTickData {
  return {
    status: 'running',
    currentInterval: SEQUENCE.intervals[0],
    currentIntervalIndex: 1,
    totalIntervals: 2,
    currentRound: 2,
    totalRounds: 3,
    remainingMs: 12_000,
    intervalDurationMs: 30_000,
    progress: 0.6,
    nextInterval: SEQUENCE.intervals[1],
    isRestBetweenSets: false,
    formattedTime: '00:12',
    ...overrides,
  };
}

function renderScreen(tick: TimerTickData) {
  mockTimerLoop.tickData = tick;
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<WorkoutScreen />);
  });
  return tree!;
}

/** Re-render with new tick data so the screen's refs pick it up. */
function updateTick(tree: ReturnType<typeof renderer.create>, tick: TimerTickData) {
  mockTimerLoop.tickData = tick;
  act(() => {
    tree.update(<WorkoutScreen />);
  });
}

function loggedSession() {
  const sessions = useSessionStore.getState().sessions;
  expect(sessions).toHaveLength(1);
  return sessions[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  useSequenceStore.setState({ sequences: [SEQUENCE], isLoaded: true });
  useSessionStore.setState({ sessions: [], isLoaded: true });
  mockTimerLoop.tickData = null;
  mockTimerLoop.restore.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workout screen session logging', () => {
  it('opens a session when the screen mounts', () => {
    renderScreen(makeTick());
    expect(loggedSession().status).toBe('in_progress');
  });

  it('closes an unfinished session as stopped when the screen is left', () => {
    const tree = renderScreen(makeTick());

    act(() => {
      tree.unmount();
    });

    const session = loggedSession();
    expect(session.status).toBe('stopped');
    expect(session.ended_at).not.toBeNull();
    expect(session.stopped_at_interval).toBe(1);
    expect(session.stopped_at_round).toBe(2);
  });

  it('records a finished workout as completed, not stopped', () => {
    // Backing out of the completion screen instead of pressing Done.
    const tree = renderScreen(makeTick());
    updateTick(tree, makeTick({ status: 'completed', remainingMs: 0 }));

    act(() => {
      tree.unmount();
    });

    const session = loggedSession();
    expect(session.status).toBe('completed');
  });

  it('counts every round and interval of a finished workout', () => {
    const tree = renderScreen(makeTick());
    updateTick(tree, makeTick({ status: 'completed', remainingMs: 0 }));

    act(() => {
      tree.unmount();
    });

    // Not the mid-workout position the stopped path would have written.
    const session = loggedSession();
    expect(session.intervals_completed).toBe(2);
    expect(session.rounds_completed).toBe(3);
  });

  it('leaves no session in progress after the screen is gone', () => {
    const tree = renderScreen(makeTick());

    act(() => {
      tree.unmount();
    });

    expect(
      useSessionStore.getState().sessions.filter((s) => s.status === 'in_progress'),
    ).toHaveLength(0);
  });
});
