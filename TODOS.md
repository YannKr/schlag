# TODOS

## Testing

### E2E coverage for v0.3.0.0 features
**Priority:** P1
**What:** Playwright specs for: settings JSON import flow (oversized file → limit alert, non-array JSON → error alert), workout-screen E/M/? wiring + MUTED indicator + overlay render, un-gated templates smoke pass, and an offline test (build production, `context.setOffline(true)`, reload, assert app shell renders — covers `public/sw.js` strategies that jsdom can't).
**Added:** 2026-06-10 via /ship coverage audit

## Workout Screen

### Decide the fate of the "Workout theme" setting
**Priority:** P1
**What:** The Dark/Light/Color segmented control in Settings writes `settings.workoutTheme`, but the Signal-redesigned workout screen hardcodes full-bleed interval color and never reads it. Either remove the control or re-wire the screen to honor it.
**Why:** Users toggle a setting that does nothing.
**Added:** 2026-06-10 via /ship design review

### Contrast on light interval colors
**Priority:** P2
**What:** RingButton outline (`rgba(255,255,255,0.75)`), the solid white pause button, and the 30%-white progress track are near-invisible on light interval colors (lime, bone, yellow) where text correctly inverts to ink. Derive these from `textColor` like `mutedOnColor` does. Verify visually (`/design-review`).
**Added:** 2026-06-10 via /ship design review

### Small visual polish batch
**Priority:** P2
**What:** Volume +/- buttons are 36px (< 44px tap-target minimum; add hitSlop or resize). Templates header uses hardcoded `paddingTop: 60` instead of safe-area insets. Complete-screen button label uses fullwidth "＋" (U+FF0B) — screen readers say "plus done". Settings footer hardcodes "Schlag v1.0" instead of reading the real version.
**Added:** 2026-06-10 via /ship design review

## Timer / Notifications

### expo-audio migration device QA
**Priority:** P1
**What:** The SDK 57 upgrade moved native beeps from expo-av to expo-audio; only mocks cover it. On real hardware verify: iOS beeps play with the ringer switch off and music playing (music keeps full volume); the first beep after Start fires on a cold launch; TTS announcements are not cut off by an overlapping beep; on Android, headset/Bluetooth play-pause still controls the music app after a beep (each expo-audio player owns a Media3 MediaSession).
**Added:** 2026-09-22 via Expo SDK 57 upgrade review

### Background notification hardening (device QA)
**Priority:** P1
**What:** Verify on real hardware: Android Doze/OEM battery optimization can delay DATE-trigger notifications (no SCHEDULE_EXACT_ALARM; test Samsung/Xiaomi); force-quitting mid-workout leaves up to 60 future notifications firing with no in-app cancel path (consider a wall-clock horizon cap or a final summary notification); iOS permission dialog appears while the timer is already counting.
**Added:** 2026-06-10 via /ship adversarial review

### Mute should also cut in-flight tones
**Priority:** P3
**What:** `setMuted(true)` stops TTS mid-utterance but lets an already-playing tone finish (built-in beeps are ≤1.5s so it's barely noticeable; a long custom end-audio file would keep playing). Add a `stopAll()` to the ToneGenerator interface and call it from `AudioEngine.setMuted`.
**Added:** 2026-06-10 via Gemini cross-model review

### Service worker cache eviction is racy under concurrent puts
**Priority:** P3
**What:** Concurrent `putStaticAsset` calls on first load can read the same `cache.keys()` snapshot and double-delete the same "oldest" entries — harmless (deletes are idempotent) but can over-evict a few assets. Defer pruning to the `activate` event or serialize it.
**Added:** 2026-06-10 via Gemini cross-model review

### Unify nextPosition() with TimerEngine.advanceToNext
**Priority:** P2
**What:** `computeUpcomingBoundaries`' position-walking helper mirrors the engine's advance semantics by hand. The catch-up fix made them agree, but nothing structurally pins them together — extract a shared pure helper or add a property test asserting boundaries match an actual engine run.
**Added:** 2026-06-10 via /ship maintainability review

## Camera Rep Tracking

### Native camera rep tracking
**Priority:** P2
**What:** Use the device camera to watch the user and automatically count reps during work intervals (web already shipped via MediaPipe). Native blocked on RN MediaPipe package maturity / Expo compatibility — see learnings (`rn-mediapipe-expo-risk`).
**Why:** Removes manual rep counting on mobile, where most gym users are.
**Added:** 2026-04-02 via user backlog

## Maintainability

### Adopt React Compiler lint rules
**Priority:** P3
**What:** The Expo SDK 57 upgrade turned off six `react-hooks/*` React Compiler rules in `eslint.config.js` (refs, purity, set-state-in-effect, immutability, preserve-manual-memoization, globals). They flagged 28 existing sites, mostly ref and `Date.now()` reads during render in `app/workout/[id].tsx`. Refactor those sites and re-enable the rules before turning on the React Compiler.
**Added:** 2026-09-22 via Expo SDK 57 upgrade

### Derive import-validation enum whitelists from canonical arrays
**Priority:** P3
**What:** `VALID_AUDIO_TONES` / `VALID_EXERCISE_TYPES` / `VALID_SESSION_STATUSES` in `lib/importValidation.ts` manually re-enumerate union types; adding a new enum member without updating the Set silently strips valid values on import. Derive type and runtime list from one `as const` array.
**Added:** 2026-06-10 via /ship maintainability review

### Set up ESLint
**Priority:** P3
**What:** `npm run lint` calls eslint but no eslint dependency or config exists in the repo — the script has never worked.
**Added:** 2026-06-10 via /ship

## Completed

### Repair the Playwright e2e suite (stale Signal-migration locators)
**Completed:** v0.3.1.0 (2026-06-10) — 12 failing tests root-caused to Signal-migration locator drift; all test-only fixes, no app bugs found. Locators deduped into e2e/helpers.ts; review pass also fixed four pre-existing vacuous assertions. Suite now 72/72 across chromium/firefox/webkit (three dead per-theme tests collapsed into one that exercises the theme picker, per the open "Workout theme" TODO).

### Reduce Motion Accessibility Setting
**Completed:** feature/todo-batch (2026-04-02)

### Extend Narrative Arc to Light and Interval-Color Themes
**Completed:** feature/todo-batch (2026-04-02)

### Configurable Get-Ready Countdown
**Completed:** feature/todo-batch (2026-04-02)

### Session History Export + Import
**Completed:** feature/todo-batch (2026-04-02)
