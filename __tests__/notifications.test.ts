/**
 * Mock-level tests for lib/notifications — verifies the schedule/cancel
 * wiring against a mocked expo-notifications (jest-expo runs as iOS).
 *
 * The real OS behavior (presentation, channels) is not testable in jest;
 * these tests cover the contract: permission re-checking, idempotent
 * scheduling, past-event filtering, the 60-notification cap, muted
 * (silent) scheduling, schedule/cancel serialization, and never-throw
 * guarantees.
 */

import type { BoundaryEvent } from '@/lib/timer/timerCalculations';

/** A manually resolvable promise, for holding an in-flight schedule open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Flush pending microtasks so serialized ops reach their next await. */
async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelAllScheduledNotificationsAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync: mockCancelAllScheduledNotificationsAsync,
  setNotificationHandler: mockSetNotificationHandler,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
}));

function makeBoundary(overrides: Partial<BoundaryEvent> = {}): BoundaryEvent {
  return {
    fireDate: Date.now() + 60_000,
    title: 'Next: Work',
    body: 'Rest complete · 00:30',
    ...overrides,
  };
}

// Module state (permission cache, handler flag) must reset per test.
function loadModule() {
  let mod: typeof import('@/lib/notifications');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/notifications');
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
  mockScheduleNotificationAsync.mockResolvedValue('notification-id');
  mockCancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
  mockSetNotificationChannelAsync.mockResolvedValue(null);
});

describe('requestNotificationPermission', () => {
  it('returns true when already granted, without re-requesting', async () => {
    const { requestNotificationPermission } = loadModule();
    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('re-checks the OS permission status on every call (no stale cache)', async () => {
    const { requestNotificationPermission } = loadModule();
    await requestNotificationPermission();
    await requestNotificationPermission();
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(2);
  });

  it('picks up a grant made later via system Settings after canAskAgain: false', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const { requestNotificationPermission } = loadModule();
    await expect(requestNotificationPermission()).resolves.toBe(false);

    // The user flips the toggle in system Settings.
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
    });
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it('caches the prompt result and never re-prompts within a session', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
    const { requestNotificationPermission } = loadModule();

    await expect(requestNotificationPermission()).resolves.toBe(false);
    await expect(requestNotificationPermission()).resolves.toBe(false);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('resolves false (never throws) when the request fails', async () => {
    mockGetPermissionsAsync.mockRejectedValue(new Error('boom'));
    const { requestNotificationPermission } = loadModule();
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('does not re-prompt when denied and canAskAgain is false', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const { requestNotificationPermission } = loadModule();
    await expect(requestNotificationPermission()).resolves.toBe(false);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleIntervalNotifications', () => {
  it('cancels previous schedules before scheduling (idempotent)', async () => {
    const { scheduleIntervalNotifications } = loadModule();
    await scheduleIntervalNotifications([makeBoundary()]);
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('schedules with a DATE trigger and the workout channel', async () => {
    const { scheduleIntervalNotifications } = loadModule();
    const boundary = makeBoundary();
    await scheduleIntervalNotifications([boundary]);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: boundary.title,
        body: boundary.body,
        sound: 'default',
      },
      trigger: {
        type: 'date',
        date: boundary.fireDate,
        channelId: 'workout',
      },
    });
  });

  it('skips events in the past', async () => {
    const { scheduleIntervalNotifications } = loadModule();
    await scheduleIntervalNotifications([
      makeBoundary({ fireDate: Date.now() - 1_000 }),
      makeBoundary({ fireDate: Date.now() + 10_000 }),
    ]);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('caps at 60 scheduled notifications', async () => {
    const { scheduleIntervalNotifications } = loadModule();
    const boundaries = Array.from({ length: 80 }, (_, i) =>
      makeBoundary({ fireDate: Date.now() + (i + 1) * 1_000 }),
    );
    await scheduleIntervalNotifications(boundaries);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(60);
  });

  it('never throws when scheduling fails', async () => {
    mockScheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    const { scheduleIntervalNotifications } = loadModule();
    await expect(
      scheduleIntervalNotifications([makeBoundary()]),
    ).resolves.toBeUndefined();
  });

  it('schedules silently (no sound, silent channel) when muted', async () => {
    const { scheduleIntervalNotifications } = loadModule();
    const boundary = makeBoundary();
    await scheduleIntervalNotifications([boundary], true);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = mockScheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.sound).toBeUndefined();
    expect(call.trigger.channelId).toBe('workout-silent');
  });
});

describe('schedule/cancel serialization', () => {
  it('a cancel issued during an in-flight schedule leaves nothing scheduled', async () => {
    const mod = loadModule();
    const ops: string[] = [];
    const gate = deferred<string>();

    mockScheduleNotificationAsync.mockImplementation(() => {
      ops.push('schedule');
      return gate.promise;
    });
    mockCancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      ops.push('cancelAll');
    });

    const boundaries = [1, 2, 3].map((i) =>
      makeBoundary({ fireDate: Date.now() + i * 1_000 }),
    );
    const schedulePromise = mod.scheduleIntervalNotifications(boundaries);

    // Let the schedule reach (and block on) its first OS call.
    await flushMicrotasks();
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);

    // Cancel arrives while the schedule is still in flight.
    const cancelPromise = mod.cancelScheduledNotifications();
    gate.resolve('notification-id');
    await Promise.all([schedulePromise, cancelPromise]);

    // The in-flight schedule aborted (no further items scheduled) and the
    // last effective operation is the cancel, sweeping up the one item.
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(ops[ops.length - 1]).toBe('cancelAll');
  });

  it('two concurrent schedule calls never double-schedule', async () => {
    const mod = loadModule();

    const first = mod.scheduleIntervalNotifications([
      makeBoundary({ fireDate: Date.now() + 1_000 }),
      makeBoundary({ fireDate: Date.now() + 2_000 }),
    ]);
    const second = mod.scheduleIntervalNotifications([
      makeBoundary({ fireDate: Date.now() + 3_000, title: 'Next: Second' }),
    ]);
    await Promise.all([first, second]);

    // The superseded first call aborts; only the latest call schedules.
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync.mock.calls[0][0].content.title).toBe(
      'Next: Second',
    );
  });
});

describe('cancelScheduledNotifications', () => {
  it('cancels all scheduled notifications', async () => {
    const { cancelScheduledNotifications } = loadModule();
    await cancelScheduledNotifications();
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('never throws when cancellation fails', async () => {
    mockCancelAllScheduledNotificationsAsync.mockRejectedValue(
      new Error('boom'),
    );
    const { cancelScheduledNotifications } = loadModule();
    await expect(cancelScheduledNotifications()).resolves.toBeUndefined();
  });
});
