# Changelog

## [0.3.0.0] - 2026-06-10

### Added
- **Import your sequences and history — everywhere.** The Import buttons in Settings now work on every platform: a JSON file picker on web, and the system document picker on iOS/Android (sequences and workout history). Imports merge (new items added, existing ones never overwritten), enforce the 10 MB file limit before reading, and run every entry through a strict sanitizer — durations clamped to valid ranges, names/notes truncated to their limits, colors validated against the 12-color palette, unknown fields dropped. A corrupt or malicious file can no longer crash the timer or sneak garbage into your library.
- **Workout cues keep coming when you switch apps.** Backgrounding mid-workout now schedules OS notifications at every upcoming interval boundary ("Next: Squats" … "Workout complete 🎉"), so a locked phone still tells you when to switch. Returning to the app cancels them and the in-app audio takes over. If you muted the workout (M key), the notifications stay silent too.
- **The web app works offline.** A service worker caches the app shell and static assets, so schlag loads without a connection after the first visit (your data was always local). Deploys still arrive instantly when online — pages are fetched network-first.
- **Keyboard shortcuts now actually work** on the web workout screen — the shortcut system existed but was never wired up. Space (pause/resume), N/→ (skip), Escape (stop), E (expand/collapse the up-next timeline), M (mute everything, with an on-screen MUTED indicator), and ? (shortcut overlay).

### Changed
- **Schlag is free. Full stop.** All Pro/monetization scaffolding is gone: every template is available to everyone, and the Pro section, "Restore Purchase" placeholder, and pro-gating code were removed.
- "Keep screen awake" in Settings now actually controls the workout-screen wake lock (it was previously always on regardless of the toggle).

### Fixed
- **The timer now fast-forwards correctly after long backgrounding.** Previously the engine could only advance one interval no matter how long the app was away — reopening after two minutes of a Tabata showed you stuck near where you left. The engine now lands on the mathematically correct interval, round, and remaining time, in exact agreement with the scheduled notifications.
- Pressing Space during the get-ready countdown or after a workout finished no longer corrupts the session log with phantom pause entries.
- The workout screen no longer re-registers its keyboard listener 60 times per second (performance fix on the most timing-sensitive screen).
- A rapid background/foreground flip can no longer leave stale or duplicate notifications scheduled (operations are now serialized with a generation counter).
- Importing a file with a negative repeat count no longer flips the sequence into infinite mode.
- The service worker refuses to cache redirected or cross-origin responses (captive-portal poisoning protection) and prunes old cached assets across deploys.

### Security
- `@mediapipe/tasks-vision` is pinned to an exact version with a guard test that fails if the npm package and the hardcoded WASM CDN URL ever drift apart.
- `npm audit`: 0 vulnerabilities (cleared the `shell-quote` advisory).

## [0.2.1.1] - 2026-05-22

### Security
- **Cloudflare Pages security headers.** Added `public/_headers` with strict Content-Security-Policy (allow-listing only the CDN origins MediaPipe actually uses at runtime), HSTS with 2-year max-age and preload, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a tight `Permissions-Policy` (camera=self; mic/geo/payment denied), and Cross-Origin-Opener/Resource-Policy. Defense in depth for any future XSS bug.
- **Subresource Integrity on third-party CSS.** The Expo HTML shell now loads DSEG7 from the static (non-minified) jsdelivr file with a sha384 `integrity` hash and `crossorigin="anonymous"`, so a jsdelivr compromise can't silently swap the stylesheet.
- **Eliminated all dependency vulnerabilities.** `npm audit` went from 22 advisories (1 critical, 4 high, 16 moderate, 1 low) to **0**. Path: ran `npm audit fix` for the real CVEs, then added a top-level `uuid: ^13.0.0` override to clear the remaining 11 phantom alerts (one upstream `uuid <11.1.1` bounds-check CVE that only affects `uuid.v3/v5/v6`+buf, propagated through the dep tree even though only `uuid.v4` is used).
- **Hardened JSON import validation.** `importSessions` now rejects entries with the wrong shape for `pauses` or `sequence_snapshot` (was: bare 4-field check, then spread the rest), and `getMostUsedSequence` no longer dereferences a snapshot that `pruneOldSessions` set to `null` after 90 days.
- **.wrangler/ added to .gitignore** so Wrangler's local build/auth cache can't be accidentally committed if it grows.

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
