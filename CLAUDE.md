# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Schlag is a cross-platform interval training timer for gym/weightlifting athletes. The name is German for "beat/stroke." It provides configurable work/rest sequences with audio cues and a distraction-free workout screen. Free, no ads, no paywalls. English only in v1. v1 is fully local-only; cloud sync is deferred to v2.

Full PRD: `Schlag_PRD_v1.0.docx` in the repo root.

## Recommended Tech Stack (from PRD)

- **Cross-platform mobile**: React Native (Expo)
- **Web**: React (share business logic with RN via react-native-web or shared modules)
- **State management**: Zustand or Jotai
- **Audio (mobile)**: expo-av or expo-audio; AVAudioSession `.playback` on iOS for silent-mode bypass
- **Audio (web)**: Web Audio API (user gesture unlock required on first tap)
- **Local storage**: expo-sqlite or MMKV for offline sequence storage
- **Push notifications**: Expo Notifications (foreground service on Android, Live Activity on iOS 16.2+)
- **Sync (v2)**: iCloud (iOS), Google Drive App Data (Android), self-hosted SQLite in Docker (web)

## Data Model

**Sequence**: `{ id, name, description, repeat_count, rest_between_sets_seconds, auto_advance, intervals: [{ id, name, duration_seconds, color, note }], audio_config: { use_voice_countdown, use_builtin_beeps }, created_at, updated_at }`

## Critical Implementation Requirements

### Timer Precision
- Use absolute start time (`Date.now()`) and compute remaining as `startTime + totalDuration - Date.now()` — never accumulate intervals
- Web: `requestAnimationFrame`; Native: `setInterval` at 100ms with drift correction
- Persist absolute session start time to local storage on backgrounding (process may be killed)
- Pre-fire audio cues ~50ms ahead on native to compensate for scheduling latency

### Audio Reliability (highest priority functional requirement)
- iOS: AVAudioSession category `.playback` in AppDelegate — audio MUST play when ringer switch is off
- Android: `AudioManager.STREAM_MUSIC` with `AudioAttributes.USAGE_MEDIA` (plays through DND)
- Web: Web Audio API requires user gesture unlock — wire to "Start Workout" button

### Audio Cue Schedule
| Trigger | Sound |
|---------|-------|
| Interval start | 440Hz beep, 80ms |
| T-3, T-2, T-1 countdown | Three descending beeps (configurable per-sequence, on by default) |
| Interval end (T=0) | Distinct double-beep, 200ms |
| Workout complete | Multi-tone flourish (cannot be disabled) |
| Pause/Resume | Subtle click |

Voice countdown (TTS via expo-speech in v1): announces "3... 2... 1..." and "Next: [interval name]."

### Platform-Specific
- iOS: `UIApplication.shared.isIdleTimerDisabled = true` during workouts; Live Activity entitlement
- Android: Foreground Service with `FOREGROUND_SERVICE` and `WAKE_LOCK` permissions
- Web: Screen Wake Lock API (`navigator.wakeLock`); Service Worker for offline; `document.title` shows countdown; workout screen max-width 480px centered at >= 768px

## Design System

### Color Palette
- Primary accent (Schlag Red): `#E63946`
- Workout screen background (dark): `#1A1A2E`
- Library/settings background (light): `#F8FAFC`
- 12 interval colors: Red `#E63946`, Orange `#F4722B`, Yellow `#F6AE2D`, Green `#2DC653`, Teal `#00B4D8`, Blue `#2563EB`, Indigo `#4338CA`, Violet `#7C3AED`, Pink `#DB2777`, Slate `#475569`, Zinc `#71717A`, Off-White `#E2E8F0` (uses dark text)

### Typography
- Countdown timer: 72-96pt monospace bold (JetBrains Mono / SF Mono)
- Interval name on workout screen: 32-40pt sans-serif bold, ALL CAPS
- System fonts: SF Pro (iOS), Roboto (Android), Inter (Web)

### Workout Screen
- Default dark background with active interval color at 20% opacity tint
- Optional full-color mode (entire background = interval color, text auto-inverts for contrast)
- Progress bar: 12px height, rounded ends, 60fps fill animation
- Buttons: min 44px tap targets, 8px border radius
- Workout screen always opens in compact mode (expanded preference not persisted)

## Navigation Structure

**Mobile (bottom tabs)**: Home (Library) | Active/Now | Settings

**Web (left sidebar)**: My Sequences | Running | Settings

## Key Constraints & Scope

- No auth or cloud sync in v1 — app is fully local-only
- Cloud sync deferred to v2 (iCloud for iOS, Google Drive for Android, self-hosted SQLite for web)
- Custom audio upload deferred to v2
- No workout history/session logging in v1
- No sharing, social features, wearable integration, or localization in v1
- Sequence export/import as JSON; import merges (adds new, never overwrites)

## Sequence Builder UX Notes

- Intervals displayed as vertical drag-and-drop list
- "+" appends new interval; long-press inserts after specific row
- Swipe-to-delete on mobile, trash icon on web
- Interval duration: min 1s, max 99:59:59
- Interval name: max 32 chars; Note/cue: max 80 chars
- Sequence description: max 120 chars
- Repeat count: 1-99, plus infinite mode toggle
- Live-updating total duration summary at top of builder

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
