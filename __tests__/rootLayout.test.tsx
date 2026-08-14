/**
 * Unit tests for the root layout's launch-time work.
 *
 * A process kill runs no teardown, so up to 60 interval notifications stay
 * in the OS queue and keep firing at a workout nobody is doing. The only
 * place left to clean them up is the next launch, which makes this a
 * behaviour worth pinning.
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the layout)
// ---------------------------------------------------------------------------

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const mockCancel = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/notifications', () => ({
  cancelScheduledNotifications: () => mockCancel(),
  requestNotificationPermission: jest.fn().mockResolvedValue(true),
  scheduleIntervalNotifications: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('Stack', null, children);
  Stack.displayName = 'Stack';
  const Screen = () => null;
  Screen.displayName = 'Stack.Screen';
  Stack.Screen = Screen;
  return {
    Stack,
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');
  return {
    GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('GestureHandlerRootView', null, children),
  };
});

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@/lib/registerServiceWorker', () => ({ registerServiceWorker: jest.fn() }));
jest.mock('@/lib/audio/speechEngine', () => ({ SpeechEngine: { prewarm: jest.fn() } }));

jest.mock('@/lib/storage', () => {
  const { DEFAULT_SETTINGS } = jest.requireActual('@/constants/defaults');
  return {
    getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS })),
    saveSettings: jest.fn(() => true),
    getSequences: jest.fn(() => []),
    saveSequences: jest.fn(() => true),
    getSessions: jest.fn(() => []),
    saveSessions: jest.fn(() => true),
    getTimerSession: jest.fn(() => null),
    saveTimerSession: jest.fn(() => true),
    clearTimerSession: jest.fn(),
    requestPersistentStorage: jest.fn().mockResolvedValue(true),
    setStorageErrorHandler: jest.fn(),
  };
});

import RootLayout from '@/app/_layout';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('root layout launch', () => {
  it('cancels notifications left behind by a killed process', () => {
    act(() => {
      renderer.create(<RootLayout />);
    });

    expect(mockCancel).toHaveBeenCalled();
  });

  it('sweeps once, not on every re-render', () => {
    let tree: ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<RootLayout />);
    });
    act(() => {
      tree!.update(<RootLayout />);
    });

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });
});
