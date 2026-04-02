---
version: '1.0'
inputDocuments:
  - 'docs/Schlag_PRD_v1.0.md'
date: '2026-03-07'
---

# Schlag Technical Architecture — v1.0

**Source:** Extracted from Schlag PRD v1.0, Section 7
**Audience:** Solo Dev Build

## Recommended Stack

| Layer | Recommendation |
|-------|---------------|
| Cross-platform framework | React Native (Expo) — single codebase for iOS and Android. Expo SDK simplifies audio, notifications, and wake lock. |
| Web app | React (same component logic as RN where possible; use react-native-web or a separate React web app sharing business logic). |
| State management | Zustand or Jotai — lightweight, no boilerplate overkill for this app's complexity. |
| Backend / sync | None in v1 (local-only). All data persisted via MMKV on-device. v2 will add platform-native sync: iCloud (iOS), Google Drive App Data (Android), self-hosted SQLite in Docker (web). |
| Audio (mobile) | expo-av or expo-audio for beeps; AVAudioSession on iOS for silent-mode bypass. |
| Audio (web) | Web Audio API. Requires a user gesture unlock on first tap. |
| Push notifications | Expo Notifications — foreground service on Android, Live Activity for iOS 16.2+. |
| Local storage | MMKV for on-device sequence storage. |

## Data Model

### Sequence

```
{
  id, name, description, repeat_count, rest_between_sets_seconds, auto_advance,
  intervals: [
    { id, name, duration_seconds, color, note }
  ],
  audio_config: {
    use_voice_countdown, use_builtin_beeps
  },
  created_at, updated_at
}
```

## Timer Implementation

- Use a high-resolution timer (`requestAnimationFrame` on web, `setInterval` at 100ms with drift correction on native) rather than a pure interval counter.
- Store absolute start time (`Date.now()`) and compute remaining time as: `remaining = startTime + totalDuration - Date.now()`. This prevents drift accumulation.
- Schedule audio cues using `AudioContext.currentTime` on web, and with a small pre-fire buffer (50ms ahead) on native to compensate for scheduling latency.
- On app backgrounding, persist the absolute session start time to local storage so the timer can correctly resume if the process is killed.

## Platform-Specific Implementation

### iOS

- Declare audio session category as `.playback` in AppDelegate to play audio when ringer switch is off.
- Request wake lock via `UIApplication.shared.isIdleTimerDisabled = true` during active workouts.
- Submit Live Activity entitlement for background timer display.
- App Store: no special categories required beyond 'Health & Fitness'.

### Android

- Use a foreground Service for background timer + audio. Declare `FOREGROUND_SERVICE` and `WAKE_LOCK` permissions in manifest.
- Use `AudioManager.STREAM_MUSIC` for workout audio so it respects the media volume, not ringer volume.
- Handle Do Not Disturb mode: audio should still play for fitness apps — use `setCategory(AudioAttributes.USAGE_MEDIA)`.

### Web

- Web Audio API requires user gesture before audio can play — wire this to the 'Start Workout' button tap.
- Screen Wake Lock API (`navigator.wakeLock.request('screen')`) is broadly supported in modern browsers.
- Use a Service Worker for offline support and so the page title/tab shows the countdown (`document.title = remaining`).
- Responsive layout: workout screen at >= 768px shifts to a centered column with max-width 480px — it should not stretch across a full desktop.
