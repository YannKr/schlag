---
stepsCompleted: []
inputDocuments: []
workflowType: 'prd'
version: '1.0'
status: 'Draft'
author: 'Yann'
date: '2026-03-07'
---

# SCHLAG — Interval Training Timer

**Product Requirements Document | Version 1.0**

**Platforms:** iOS | Android | Web (full parity)
**Status:** Draft | **Audience:** Solo Dev Build

| Field | Detail |
|-------|--------|
| Product Name | Schlag |
| Version | 1.0 (MVP) |
| Platforms | iOS, Android, Web (full parity) |
| Primary Audience | Gym / weightlifting athletes |
| Monetization | Free — no ads, no paywalls |
| Core Feature | Configurable interval sequences (local-only in v1; cloud sync in v2) |
| Doc Status | Draft v1.0 |

---

## Executive Summary

Schlag is a cross-platform interval training timer built for gym and weightlifting athletes who need precise, fully configurable work/rest sequences. The name — German for 'beat' or 'stroke' — reflects the app's core purpose: keeping athletes on beat with their training rhythm.

Most interval apps are either too simple (no named intervals, no color coding) or too bloated (nutrition tracking, social feeds). Schlag occupies a focused middle ground: a powerful sequence builder with a distraction-free workout screen and reliable audio cues. v1 is fully local-only; cloud sync across devices is planned for v2.

---

## Goals & Success Metrics

### 2.1 Product Goals

1. Allow athletes to build, save, and run fully custom interval sequences — named, color-coded, and repeatable.
2. Deliver reliable audio cues (beeps, voice countdowns, custom sounds) so athletes never have to watch the screen.
3. *(Deferred to v2)* Sync workouts seamlessly across iOS, Android, and web via platform-native sync (iCloud, Google Drive, self-hosted SQLite).
4. Keep the active workout screen readable at a glance from arm's length in a gym environment.
5. Ship a feature-complete v1 that a solo developer can build and maintain sustainably.

### 2.2 Success Metrics (6-month targets)

| Metric | Target |
|--------|--------|
| Workout completion rate | > 80% of started sessions finish without abandon |
| Sequences created per user | > 3 on average within first week |
| Audio cue reliability | Fires within 150ms of interval boundary |
| Crash-free session rate | > 99.5% |
| User retention (D30) | > 35% |

---

## User Personas

### 3.1 Primary Persona — The Structured Lifter

| Attribute | Detail |
|-----------|--------|
| Name | Marcus, 29 |
| Activity | 5x/week gym: powerlifting + accessory work |
| Device | iPhone during workouts, sometimes checks on iPad at home |
| Pain point | Built-in phone clock is clunky; existing interval apps have no named intervals or are cluttered |
| Goal | Set up a sequence once (e.g. 90s work, 3min rest, x5 rounds) and let the phone manage it |
| Key behavior | Leaves phone on bench face-up; needs large text readable from standing height |

### 3.2 Secondary Persona — The Program Switcher

| Attribute | Detail |
|-----------|--------|
| Name | Dani, 34 |
| Activity | Switches between HIIT, circuit training, and mobility sessions |
| Device | Android phone, also browses on laptop |
| Pain point | Maintains different timer configs per workout type; loses them when switching phones |
| Goal | Keep a library of sequences, access them anywhere without re-entering |
| Key behavior | Uses web app to configure new sequences; runs them on phone |

---

## Feature Requirements

### 4.1 Sequence Builder

The sequence builder is where users create, edit, and organize their interval programs. It is the primary 'management' surface of the app.

#### 4.1.1 Interval Properties

Each interval within a sequence has the following properties:

| Property | Details |
|----------|---------|
| Name | Free-text label, e.g. 'Squat', 'Rest', 'Burnout'. Max 32 characters. Required. |
| Duration | Hours:Minutes:Seconds picker. Minimum 1 second. Maximum 99:59:59. |
| Color | User-selectable from a palette of 12 preset colors. Used as full-screen background tint during active interval. |
| Notes / Cue | Optional short text shown on the workout screen during the interval. Max 80 characters. E.g. 'Keep back straight'. |

#### 4.1.2 Sequence Properties

| Property | Details |
|----------|---------|
| Name | Sequence title shown in the library. Required. |
| Description | Optional subtitle for the library card. Max 120 characters. |
| Intervals | Ordered list of intervals. Minimum 1, no maximum (unlimited). |
| Repeat count | How many times the full sequence loops. Range: 1 to 99. Default: 1. '0' or 'Infinite' mode available as a toggle for open-ended use. |
| Rest between sets | Optional automatic rest interval inserted between each loop. Duration picker identical to interval duration. |
| Auto-advance | Toggle (default: ON). When enabled, timer advances to the next interval automatically when the countdown reaches zero. When disabled, user must tap to advance. |

#### 4.1.3 Builder UX

- Intervals are displayed as a vertical drag-and-drop list; rows can be reordered by drag handle.
- Tapping an interval row opens an edit sheet (bottom sheet on mobile, modal on web).
- '+' button, 56px diameter, primary accent color (#E63946), fixed position bottom-right, appends a new interval at the bottom; long press inserts after a specific row.
- Swipe-to-delete on mobile; trash icon on web. Destructive action requires confirmation only if sequence has 1 interval remaining.
- Duration entry: tap-to-edit inline or use a scroll-wheel picker — both supported.
- Color swatch is shown as a 16px diameter circle on the interval row for at-a-glance identification.
- Total workout duration (all intervals x repeats) is shown as a live-updating summary at the top of the builder.

### 4.2 Sequence Library

The home screen of the app is the sequence library — a personal collection of saved interval programs.

- Sequences displayed as cards in a scrollable list, sorted by last-used (default) or alphabetically.
- Each card shows: name, description, total duration, interval count, repeat count, and a color strip previewing the interval colors in order.
- 'Start' button, minimum 48px height, full card width, on each card launches directly into the workout screen.
- Tap elsewhere on the card opens the sequence builder / editor.
- Long press or swipe reveals: Duplicate, Rename, Delete.
- A search bar at the top filters sequences by name.
- Empty state: vector illustration centered at max 240px width with 'Create your first sequence' CTA button below.

### 4.3 Active Workout Screen

The workout screen is the heart of Schlag. Design priority: maximum readability, minimum cognitive load during physical exertion.

> **Design principle:** A user should be able to glance at their phone from 2 meters away and immediately know: what interval they are in, how much time is left, and what is coming next.

#### 4.3.1 Layout — Compact (Default) View

```
[ SCHLAG — Compact Workout View ]

  [ SQUAT ]  |  Round 2 of 5

       01:23
  [========         ]  78%

  NEXT ->  Rest  (00:90)

  [ Pause ]   [ Skip ]
```

| Element | Spec |
|---------|------|
| Interval name | 32-40pt bold text, top of screen. Color matches interval color as full-screen background tint at 15% opacity. |
| Round indicator | Label: 'Round 2 of 5'. Hidden when sequence has no repeat (repeat = 1). |
| Countdown timer | 72-96pt monospace bold, center-dominant. Updates every 100ms for smooth animation. |
| Progress bar | Full-width horizontal bar, 12px height, rounded ends, showing time elapsed within current interval. Fills left to right. 60fps animation. Color matches interval color. |
| Next interval | 'NEXT -> [Name] ([duration])' shown below timer. Hidden on final interval of final round. |
| Controls | Pause/Resume and Skip buttons. Visible but visually secondary to the timer. |
| Stop button | 32px 'x' close button in top-right corner. Tap once = confirm dialog before stopping. |

#### 4.3.2 Layout — Expanded View (Optional)

Toggled via a chevron / expand icon. Reveals an additional panel below the main timer:

- Full ordered list of remaining intervals in this round, with durations and color swatches.
- Current interval's Note/Cue text (if set) in a highlighted block.
- A 'rounds remaining' mini-indicator.

The compact vs expanded preference is saved per-session only, not persisted — app always opens in compact mode.

#### 4.3.3 Auto-Advance Behavior

- When auto-advance is ON: at T=0, the app plays the end-of-interval sound and immediately starts the next interval without user input.
- When auto-advance is OFF: at T=0, the timer freezes, the end sound plays, and a 'TAP TO CONTINUE' overlay appears (full-screen tap target). The user must tap anywhere on the screen to proceed.
- Auto-advance state can be toggled mid-workout via the expanded view without stopping the session.

#### 4.3.4 Screen Behavior

- Screen wake lock is applied on workout start (prevents device sleep). Released on workout end or app background.
- If the app is backgrounded mid-workout, audio continues and the session remains active. A persistent notification (iOS: Live Activity; Android: foreground service notification) displays the current interval name and countdown.
- Returning to the app from background snaps the display back to the correct elapsed time.

### 4.4 Audio System

Audio is the most critical functional requirement of Schlag. Athletes who are lifting, sweating, or wearing headphones rely entirely on sound to track intervals.

#### 4.4.1 Built-in Tones

| Tone | Trigger |
|------|---------|
| Interval start | Plays at the beginning of each new interval. 440Hz beep, 80ms duration. |
| 3-second countdown | Three descending beeps at T-3, T-2, T-1 seconds. Configurable: on by default, can be disabled per-sequence. |
| Interval end / next start | Double-beep: two 440Hz tones, 80ms each, 50ms gap between. Fires at T=0 to signal transition. |
| Workout complete | Ascending three-tone sequence: 440Hz, 554Hz, 659Hz, 120ms each, 30ms gaps. Marks end of all rounds. Cannot be disabled. |
| Pause / Resume | Click sound, 50ms duration, 1kHz, -12dB relative to interval start beep. Confirms UI interaction. |

#### 4.4.2 Voice Countdown

- When enabled, a synthesized voice counts down '3... 2... 1...' at the final 3 seconds of each interval. **DECIDED (OQ-1):** v1 uses device-side TTS via expo-speech. Pre-recorded clips are deferred to a future version.
- Also announces the name of the upcoming interval: e.g. 'Next: Rest.'
- Voice and beep tones can coexist — user configures which they prefer per sequence.
- Voice language: English only in v1.

#### 4.4.3 Custom Audio

Custom audio upload is deferred to v2. v1 uses built-in tones only (see 4.4.1). Per-interval audio is also a v2 consideration.

#### 4.4.4 Audio Reliability

> **Critical requirement:** Audio must fire even when the device is in silent/vibrate mode on iOS. This requires using the AVAudioSession category `.playback` on iOS. On Android, use `AudioManager.STREAM_MUSIC` with `AudioAttributes.USAGE_MEDIA`. Web uses the Web Audio API with user-gesture unlocking on first tap.

### 4.5 Cloud Sync

Cloud sync, account system, and authentication are deferred to v2. v1 is fully local-only. All sequences are stored on-device via MMKV.

v2 will add platform-native sync: iCloud (iOS), Google Drive App Data (Android), self-hosted SQLite in Docker (web).

#### 4.5.1 Data Export/Import

- Users can export all their sequences as a JSON file from Settings. **DECIDED (OQ-2):** Import merges -- imported sequences are added as new entries. Existing sequences are never overwritten. Duplicate detection is by sequence ID; if a matching ID exists, the imported copy is assigned a new ID.

---

## Navigation & Information Architecture

### 5.1 Mobile Navigation (Bottom Tab Bar)

| Tab | Content |
|-----|---------|
| Home (Library) | Sequence library — list of saved workouts. Default landing screen. |
| Active / Now | Shortcut to current or most recently used workout. Disabled state when no workout active. |
| Settings | Audio preferences, theme, export/import. |

### 5.2 Web Navigation (Left Sidebar)

| Section | Content |
|---------|---------|
| My Sequences | Library (same as mobile home tab) |
| Running | Active workout, identical to mobile workout screen |
| Settings | Same as mobile settings |

### 5.3 Core User Flows

#### Flow A — First Use (Create & Run)

1. Open app -> see empty library with 'Create your first sequence' prompt.
2. Tap '+' -> Sequence Builder opens with one default interval.
3. Name the sequence. Add/edit intervals (name, duration, color).
4. Set repeat count and auto-advance preference.
5. Tap 'Save' -> sequence appears in library.
6. Tap 'Start' -> workout screen launches.
7. App counts down; audio cues fire at transitions.
8. Final interval completes -> completion flourish plays -> results summary shown.

---

## Design System

### 6.1 Visual Language

Schlag's design is built for a gym environment: high contrast, large targets, and zero visual clutter during a workout. Outside of the active workout screen, the UI uses relaxed density.

#### 6.1.1 Color Palette

| Role | Hex |
|------|-----|
| Primary accent (Schlag Red) | `#E63946` |
| Background — dark (workout screen default) | `#1A1A2E` |
| Background — light (library / settings) | `#F8FAFC` |
| Text — primary | `#1A1A2E` |
| Text — secondary | `#475569` |
| Text — muted | `#94A3B8` |
| Surface / card | `#FFFFFF` |
| Dividers | `#E2E8F0` |
| Interval color palette (12 options) | See Appendix |

#### 6.1.2 Typography

| Role | Spec |
|------|------|
| Countdown timer (workout screen) | 72-96pt monospace bold. Recommended: JetBrains Mono or SF Mono. |
| Interval name (workout screen) | 32-40pt sans-serif bold. All caps. |
| Headings (library, settings) | 18-24pt sans-serif bold. |
| Body / labels | 14-16pt sans-serif regular. |
| Font family | System font: SF Pro (iOS), Roboto (Android), Inter (Web). |

#### 6.1.3 Workout Screen Theming

- Default: dark background (`#1A1A2E`) with a tint from the active interval's color at 20% opacity.
- Full-color mode (optional setting): entire background fills with the interval color. Text inverts to maintain contrast automatically.
- Default to dark mode on the workout screen. Library and settings follow system light/dark preference.

#### 6.1.4 Component Design Notes

- Progress bar: 12px height, rounded ends. Fills smoothly (60fps animation). Color matches interval color.
- Buttons: minimum 44px height. Rounded corners (8px radius).
- Cards (sequence library): `box-shadow: 0 1px 3px rgba(0,0,0,0.12)`, 12px radius. Color strip along the left edge shows interval colors in sequence.
- Bottom sheets and modals: platform patterns — iOS uses UISheetPresentationController style; Android uses Material Bottom Sheet.

### 6.2 Accessibility

- All interactive elements meet WCAG AA contrast minimums (4.5:1 for text).
- The large countdown font naturally aids low-vision users.
- All tap targets minimum 44x44pt.
- VoiceOver / TalkBack labels on all interactive elements.
- Audio cues serve as an accessible fallback — app is usable without watching the screen.

---

## Technical Architecture

See `architecture-v1.md` for technical architecture and implementation guidance.

---

## Settings

| Setting | Detail |
|---------|--------|
| Audio: Interval beeps | Toggle on/off globally. Pitch and volume slider. |
| Audio: Voice countdown | Toggle on/off globally. |
| Audio: Custom end-tone | *(Deferred to v2)* Upload MP3/WAV/M4A. v1 uses built-in tones only. |
| Display: Workout theme | Dark (default) / Light / Interval color full-fill. |
| Display: Keep screen awake | Toggle (default: ON). Off for battery-saving preference. |
| Sequences: Default auto-advance | Global default for new sequences (can be overridden per sequence). |
| Data: Export sequences | Downloads a JSON file of all sequences. |
| Data: Import sequences | Uploads a JSON file. Merges with existing library (see OQ-2 decision). |

---

## Out of Scope for v1

The following features are explicitly deferred to keep v1 focused and shippable:

- Cloud sync, authentication, and custom audio upload — deferred to v2.
- Workout history / session logging — no tracking of past sessions.
- Sharing sequences with other users (export JSON is the v1 equivalent).
- Per-interval custom audio — deferred to v2.
- Apple Watch / Wear OS companion app.
- Heart rate or wearable integration.
- Pre-built workout template library (app ships empty; user builds their own).
- Social features, leaderboards, or community content.
- Multiple languages / localization (English only for v1).
- Haptic-only mode without audio (haptics may be added without this being a blocker).
- Interval types beyond timed (e.g. rep-based intervals, distance-based).

---

## Non-Functional Requirements

### Performance

- **Timer drift:** Timer display drift < 50ms cumulative over a 60-minute session.
- **Audio latency:** Audio cue fires within 150ms of interval boundary.
- **UI frame rate:** UI renders at 60fps during countdown animation.
- **App launch:** App is interactive within 2 seconds of cold launch.

### Reliability

- **Crash-free rate:** Crash-free session rate > 99.5%.
- **Offline capability:** All features work without network connectivity (v1 is fully local-only).
- **Background resume:** App resumes correctly after background kill with < 1s state restoration.

### Accessibility

- **Contrast:** WCAG 2.1 AA compliance for all text contrast (4.5:1 minimum).
- **Tap targets:** All interactive elements minimum 44x44pt tap target.
- **Screen readers:** VoiceOver (iOS) and TalkBack (Android) labels on all interactive elements.
- **Auditory UX:** Audio cues serve as an accessible fallback — app is usable without watching the screen.

### Data

- **Export format:** Sequence export produces valid JSON parseable by any standard JSON parser.
- **Import capacity:** Import processes files up to 10MB without timeout.
- **Import behavior:** Import merges — adds new sequences, never overwrites existing ones.
- **Local storage:** All sequence data persists locally; no data loss on app update.

### Audio

- **iOS silent mode:** Audio plays when iOS ringer switch is off (AVAudioSession `.playback` category).
- **Android DND:** Audio plays through Android Do Not Disturb mode (`AudioAttributes.USAGE_MEDIA`).
- **Web unlock:** Web Audio API context unlocked on first user gesture (wired to 'Start Workout' button).
- **Custom audio:** Deferred to v2. v1 uses built-in tones only.

### Platform-Specific

- **iOS wake lock:** `UIApplication.shared.isIdleTimerDisabled = true` during active workouts.
- **Android wake lock:** Foreground Service with `FOREGROUND_SERVICE` and `WAKE_LOCK` permissions.
- **Web wake lock:** Screen Wake Lock API (`navigator.wakeLock.request('screen')`).
- **Web layout:** Workout screen at >= 768px viewport shifts to centered column with max-width 480px.
- **Web tab title:** `document.title` shows current countdown during active workout.

---

## Decisions (Resolved Open Questions)

The following were open questions in the original draft. All have been resolved:

| ID | Question | Decision |
|----|----------|----------|
| OQ-1 | Should the countdown voice use TTS (device-side) or pre-recorded audio clips? | **DECIDED: TTS.** v1 uses device-side TTS via expo-speech. Lower bundle size, acceptable quality for countdown numbers and interval names. Pre-recorded clips deferred to future version if quality feedback warrants it. |
| OQ-2 | How should sequence import work — merge or replace? | **DECIDED: Merge.** Import adds sequences as new entries; existing sequences are never overwritten. If an imported sequence ID matches an existing one, the import assigns a new ID. |
| OQ-3 | Should 'infinite repeat' mode have a manual stop-after-set-completes option or only a hard stop? | **DECIDED: Both options available.** Infinite repeat mode provides two stop controls: (1) a 'Finish after this round' button that lets the current set complete then stops, and (2) the standard stop button with confirmation dialog for immediate stop. |
| OQ-4 | Custom audio files synced to cloud — storage cap? | **DEFERRED to v2.** Custom audio upload and cloud sync are not part of v1. This decision will be revisited when cloud sync is implemented. |
| OQ-5 | Should the web version support keyboard shortcuts during a workout? | **DECIDED: Yes.** Web workout screen supports keyboard shortcuts: Space = Pause/Resume, N = Next interval (skip), Esc = Stop (opens confirmation dialog). Shortcuts are listed in a tooltip accessible from the workout screen. |

---

## Appendix — Interval Color Palette

The following 12 colors form the interval color palette. Colors are chosen to be distinguishable from each other, readable with white text, and function as a full-screen background tint.

| Label | Hex |
|-------|-----|
| Schlag Red | `#E63946` |
| Ember Orange | `#F4722B` |
| Solar Yellow | `#F6AE2D` |
| Sprint Green | `#2DC653` |
| Teal | `#00B4D8` |
| Steel Blue | `#2563EB` |
| Indigo | `#4338CA` |
| Violet | `#7C3AED` |
| Pink | `#DB2777` |
| Slate | `#475569` |
| Zinc | `#71717A` |
| Off-White / Warmup | `#E2E8F0` |

*Note: Off-White (`#E2E8F0`) uses dark (`#1A1A2E`) text rather than white for contrast.*

---

*SCHLAG PRD -- End of Document -- v1.0*
