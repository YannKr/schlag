# TODOS

## Reduce Motion Accessibility Setting

**What:** Add a "reduce motion" setting that falls back to Approach A behavior (Reanimated-only, no Skia shaders). Respect iOS system-wide "Reduce Motion" via `AccessibilityInfo.isReduceMotionEnabled()`.

**Why:** Users with motion sensitivity or older devices need the visual polish without full shader intensity. The intensity engine is parametric, so "reduce motion" could clamp all intensity values to a low constant rather than requiring a separate render path.

**Pros:** Accessibility compliance, battery savings on older devices.
**Cons:** Second rendering path to maintain (though minimal if done via intensity clamping).
**Depends on:** Narrative Arc feature must ship first.
**Added:** 2026-04-01 via /plan-eng-review

## Extend Narrative Arc to Light and Interval-Color Themes

**What:** Apply intensity-driven visual effects to the light and interval-color workout themes. Currently the narrative arc only applies to the dark theme.

**Why:** Users who prefer light or interval-color themes miss the premium feel entirely. The intensity engine is theme-agnostic (outputs 0-1 values). The theme-specific part is how those values map to colors. Light theme might use opacity/saturation shifts. Interval-color theme could intensify the existing tint.

**Pros:** Consistent premium experience across all themes.
**Cons:** Three theme variants to tune visually. Light theme needs different color palettes.
**Depends on:** Dark theme narrative arc must ship first.
**Added:** 2026-04-01 via /plan-eng-review

## Camera Rep Tracking

**What:** Use the device camera to watch the user and automatically count reps during work intervals. Computer vision detects exercise movement patterns.

**Why:** Removes manual rep counting. The app knows when you've done 10 reps and can auto-advance or display the count. Huge differentiator.

**Pros:** Genuinely unique feature, hands-free tracking, feels like magic.
**Cons:** High complexity (pose estimation ML model), battery drain from camera, privacy concerns, requires camera permissions.
**Depends on:** v2 scope. May need TensorFlow Lite or MediaPipe for on-device pose estimation.
**Added:** 2026-04-02 via user backlog

## Configurable Get-Ready Countdown

**What:** When starting a workout, show a configurable "get ready" countdown (default 3 seconds) before the first interval begins. Gives the user time to put the phone down and get in position.

**Why:** Currently the workout starts immediately on tap. Users need a moment to set the phone on a bench, grab weights, etc.

**Pros:** Small feature, big UX improvement. Every timer app does this and users expect it.
**Cons:** Minimal. Simple to implement.
**Depends on:** None.
**Added:** 2026-04-02 via user backlog

## Session History Export + Import

**What:** Allow exporting workout session history as JSON, and importing history from another device. Same merge strategy as sequence import (add new, never overwrite).

**Why:** Symmetry with sequence export/import. Users switching devices want their history.

**Pros:** Data portability, matches existing export/import pattern.
**Cons:** History can be large. Need to handle schema versioning.
**Depends on:** Session history must be persisted first (v1 logs sessions but PRD says no history UI).
**Added:** 2026-04-02 via user backlog
