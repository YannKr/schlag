# Changelog

## [0.2.1.0] - 2026-05-03

### Added
- **Pick your own TTS voice.** Settings → Voice opens a list of every English voice on your device, sorted with Enhanced quality first. Tapping a voice previews "3, 2, 1" so you hear the change before saving. The chosen voice is used for countdown numbers and "Next: …" callouts.
- Cold-start TTS prewarm on native (iOS/Android) at app launch, and a re-prewarm whenever the selected voice changes. Trims 50–300 ms off the first countdown utterance of a workout.
- 27 new unit tests covering AudioEngine — platform routing, init idempotency, web AudioContext unlock, every fire-and-forget tone, voice toggles, and cleanup.

### Changed
- **Web countdowns now warm up faster.** The first time you tap "Start Workout" on the web, the TTS engine prewarms on that same gesture (which is the only moment a browser will let it run). Previously web silently no-oped the cold-start prewarm and you ate the full load-time hit on the first countdown.

## [0.2.0.0] - 2026-04-20

### Changed
- **Signal design system.** Full visual refresh across every screen: library, builder, workout, history, settings. New Swiss-editorial palette (warm paper `#FAFAF7`, ink `#141416`, vermillion accent `#EA2F14`) with a typography system built on Inter + JetBrains Mono (DSEG7 for seven-segment timer digits).
- **Interval palette.** 12 colorblind-retuned hues paired with non-color glyphs (circle, triangle, square, etc.) for redundant encoding — color-deficient users can still tell intervals apart at a glance.
- **Workout screen.** Redesigned countdown and progress UI. Cleaner hierarchy, bigger timer, less chrome.
- **Tabs.** New Signal-styled bottom tab bar with a thin top-rule active indicator.
- **Splash/icon.** Background updated to paper tone to match the new palette.

### Added
- New `Wordmark` and `Glyph` components for the identity system.
- Web HTML shell (`app/+html.tsx`) that preloads Inter, JetBrains Mono, and DSEG7 fonts and sets the paper background at the document level to prevent white flash on load.
- `react-native-svg` for glyph rendering.

### Fixed
- Bottom tab labels (Library/History/Settings) no longer clip below the viewport on Firefox. Root cause: `html`/`body`/`#root` had no explicit height, and the navigator's tab bar container was shorter than the tablist's natural height.

## [0.1.0.0] - 2026-04-11

### Added
- **Camera rep tracking (web).** Point your webcam at yourself during a workout and Schlag counts your reps automatically. Uses MediaPipe pose estimation to track joint angles at 15fps, with exercise-specific profiles for squat, deadlift, bench/push-up, curl, overhead press, and row. Phone propped up, camera on, reps counted. No cloud, no subscription, all on-device.
- **Exercise type picker in the sequence builder.** Each interval can now be mapped to an exercise type (squat, curl, etc.) so the camera knows which joints to track. "No tracking" option disables camera for warm-ups, rest, or unsupported exercises.
- **Camera settings.** Enable/disable camera and camera preview from Settings (web-only section). Camera is off by default.
- **Rep count display on workout screen.** Large green rep counter below the progress bar during work intervals with an exercise type set. Camera pip overlay in the top-right corner shows the live feed with tracking status.

### Technical
- Pure-function rep counting engine with 5-frame angle smoothing, 15-degree hysteresis, and confidence gating. Handles inverted exercises (overhead press) automatically.
- Web: MediaPipe PoseLandmarker via `@mediapipe/tasks-vision` with GPU-to-CPU fallback.
- Native: stub files in place. Camera rep tracking is web-only in phase 1.
- 19 new unit tests covering angle calculation, exercise profiles, and the rep counter state machine.
