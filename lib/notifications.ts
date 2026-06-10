/**
 * Local notification scheduling for backgrounded workouts (native only).
 *
 * Managed React Native cannot run JS (and therefore cannot play audio cues)
 * while the app is backgrounded. Instead, when the app backgrounds during a
 * running workout we schedule OS-level local notifications at each upcoming
 * interval boundary, and cancel them all when the app returns to the
 * foreground (the in-app audio engine takes over again).
 *
 * Every export is a no-op on web — the web build keeps its existing
 * document.title countdown and wake lock behavior.
 *
 * expo-notifications is require()'d lazily so its module side effects never
 * execute on web, and so a failure to load can never crash the timer.
 *
 * Concurrency: schedule/cancel are serialized through a module-level promise
 * chain, and each call bumps a generation counter. An in-flight schedule
 * checks the generation after every await and aborts when superseded, so an
 * iOS 'inactive' → 'background' double-fire never double-schedules, and a
 * background → active flap never leaves ghost notifications behind.
 */

import { Platform } from 'react-native';

import type { BoundaryEvent } from '@/lib/timer/timerCalculations';
import { MAX_BOUNDARY_EVENTS } from '@/lib/timer/timerCalculations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Android notification channel for interval boundary alerts. */
const ANDROID_CHANNEL_ID = 'workout';

/** Silent Android channel used when the user has muted audio cues —
 *  banners still appear, but no sound plays. */
const ANDROID_SILENT_CHANNEL_ID = 'workout-silent';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Cached result of the explicit permission prompt (null = never prompted).
 *  Only the prompt result is cached — the current grant status is always
 *  re-read fresh, so a user who granted via system Settings is picked up. */
let promptResult: boolean | null = null;

/** One-time handler / channel setup flag. */
let presentationConfigured = false;

/** Monotonically increasing generation. Every schedule/cancel call bumps
 *  it; an in-flight schedule aborts once its generation is stale. */
let generation = 0;

/** Serializes all schedule/cancel operations (never rejects). */
let opChain: Promise<void> = Promise.resolve();

/** Append an operation to the serial chain. */
function enqueue(op: () => Promise<void>): Promise<void> {
  opChain = opChain.then(op);
  return opChain;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type NotificationsModule = typeof import('expo-notifications');

/** Lazily load expo-notifications. Returns null on web or load failure. */
function getNotificationsModule(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/**
 * Configure foreground presentation and the Android channels (once).
 * Android requires a channel for notifications to present; sound is a
 * channel-level property there, hence the separate silent channel.
 */
async function ensurePresentationConfigured(
  Notifications: NotificationsModule,
): Promise<void> {
  if (presentationConfigured) return;
  presentationConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Workout',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(ANDROID_SILENT_CHANNEL_ID, {
      name: 'Workout (silent)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request notification permission (lazy).
 * Never throws — a denied or failed request resolves to false and the
 * rest of the workout flow continues unaffected.
 *
 * The current grant status is re-checked fresh on every call; only the
 * result of the explicit request prompt is cached (to avoid re-prompting),
 * so a `canAskAgain: false` denial never permanently locks out a user who
 * later grants permission via system Settings.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    if (promptResult !== null) return promptResult;

    const result = await Notifications.requestPermissionsAsync();
    promptResult = result.granted;
    return promptResult;
  } catch {
    return false;
  }
}

/**
 * Schedule local notifications for the given boundary events.
 *
 * Idempotent: cancels any previously scheduled notifications first, so
 * repeated background transitions never produce duplicates. Past events
 * are skipped and the total is capped at the platform-safe limit.
 *
 * When `muted` is true (user pressed M), notifications are scheduled
 * silently — banners still appear, but without sound.
 */
export async function scheduleIntervalNotifications(
  boundaries: BoundaryEvent[],
  muted: boolean = false,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const myGeneration = ++generation;

  return enqueue(async () => {
    // Superseded before we even started (e.g. inactive → background
    // double-fire, or a cancel raced in) — the newest call wins.
    if (myGeneration !== generation) return;

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      await ensurePresentationConfigured(Notifications);
      if (myGeneration !== generation) return;

      // Replace any previous schedule.
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (myGeneration !== generation) return;

      const now = Date.now();
      const upcoming = boundaries
        .filter((b) => b.fireDate > now)
        .slice(0, MAX_BOUNDARY_EVENTS);

      // Sequential (not Promise.all) so a cancel that arrives mid-flight
      // stops further scheduling at the next generation check.
      for (const b of upcoming) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: b.title,
            body: b.body,
            sound: muted ? undefined : 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: b.fireDate,
            channelId: muted ? ANDROID_SILENT_CHANNEL_ID : ANDROID_CHANNEL_ID,
          },
        });
        if (myGeneration !== generation) return;
      }
    } catch {
      // Scheduling is best-effort — never break the workout.
    }
  });
}

/**
 * Cancel every notification this app has scheduled.
 * Called on foreground return, pause, stop, completion, and unmount.
 *
 * Bumps the generation so any in-flight schedule aborts; the cancel
 * itself runs after it on the serial chain, sweeping up anything the
 * aborted schedule managed to register.
 */
export async function cancelScheduledNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  generation++;

  return enqueue(async () => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Best-effort.
    }
  });
}
