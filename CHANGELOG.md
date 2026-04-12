# Changelog

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
