---
stepsCompleted: []
inputDocuments:
  - 'docs/Schlag_PRD_v1.0.md'
workflowType: 'prd'
version: '2.0'
status: 'Draft'
author: 'Yann'
date: '2026-03-07'
---

# SCHLAG

## Interval Training Timer

### Product Requirements Document | Version 2.0 — "The Complete Athlete"

**Platforms:** iOS | Android | Web | watchOS
**Status:** Draft | **Audience:** Solo Dev Build
**Builds on:** [Schlag PRD v1.0](./Schlag_PRD_v1.0.md)

---

## 1. Executive Summary

Schlag v2 transforms the app from a capable interval timer into an indispensable daily training companion. The release adds three pillars: **workout history** (so athletes can see their training patterns), **wearable integration** (so athletes can feel their intervals without watching a screen), and **power features** (per-interval audio, templates, keyboard shortcuts) that reward daily use.

v2 does not add social/sharing features — that is the v3 mandate. v2 focuses on making Schlag the best possible tool for an individual athlete.

| Field | Detail |
|-------|--------|
| Product Name | Schlag |
| Version | 2.0 |
| Codename | The Complete Athlete |
| Platforms | iOS, Android, Web, watchOS (Wear OS deferred to v2.1) |
| Primary Audience | Gym / weightlifting athletes (existing v1 users + new users) |
| Monetization | Free core + optional "Schlag Pro" one-time purchase ($4.99 USD) |
| Key Additions | Workout history, Apple Watch, per-interval audio, templates, Schlag Pro |
| Prerequisite | Schlag v1.0 shipped and stable |

---

## 2. Goals & Success Metrics

### 2.1 Product Goals

1. Give athletes a reason to open Schlag every day — not just when programming new sequences, but to review past workouts and track consistency.
2. Eliminate the last reason athletes reach for their phone during a set — wrist haptics and glanceable watch UI replace screen dependency.
3. Unlock power-user customization (per-interval audio, advanced templates) behind a fair, one-time purchase.
4. Establish a sustainable revenue path without compromising the free-core promise.

### 2.2 Success Metrics (6-month post-launch targets)

All targets are absolute values. v1 baseline will be measured at v2 launch date and recorded in the launch readiness checklist.

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Weekly active users (WAU) | 2x v1 WAU measured at v2 launch date (record baseline in launch checklist) | Analytics dashboard (Supabase + client events) |
| D30 retention | > 45% | Cohort analysis from first v2 session |
| Workout sessions per active user per week | > 3 | Average across all users with >= 1 session that week |
| Schlag Pro conversion rate | > 5% of MAU | Pro purchases / MAU in same calendar month |
| Apple Watch session adoption | > 30% of iOS users with paired Watch | Watch session starts / iOS users with WatchConnectivity active |
| Crash-free session rate | > 99.7% | Firebase Crashlytics or equivalent |

---

## 3. User Personas (Additions to v1)

### 3.1 New Persona — The Data-Driven Athlete

| Attribute | Detail |
|-----------|--------|
| Name | Priya, 31 |
| Activity | 4x/week Olympic weightlifting + conditioning |
| Device | iPhone 15 + Apple Watch Ultra |
| Pain point | Uses Schlag for timing but tracks everything in a spreadsheet because there's no history |
| Goal | See weekly volume, rest-to-work ratios, and consistency streaks inside the app she already uses for timing |
| Key behavior | Reviews past week's training every Sunday; adjusts next week's sequences based on patterns |

### 3.2 New Persona — The Hands-Free Lifter

| Attribute | Detail |
|-----------|--------|
| Name | Tomás, 26 |
| Activity | 6x/week powerlifting — long rest periods (3-5 min) |
| Device | Pixel 8 + Galaxy Watch 6 |
| Pain point | Phone stays in gym bag; relies on audio cues but can't always hear over gym music |
| Goal | Feel a strong haptic tap on his wrist at interval transitions — never miss a cue |
| Key behavior | Starts workout on phone, shoves phone in bag, controls everything from watch. (Note: Wear OS companion deferred to v2.1 — Tomás uses audio cues from phone in v2.0) |

---

## 4. Feature Requirements

### 4.1 Workout History & Analytics

Workout history is the #1 requested feature from v1 users. It transforms Schlag from a "use and forget" tool into a training log.

#### 4.1.1 Session Logging

Every completed (or partially completed) workout session is automatically logged.

| Field | Detail |
|-------|--------|
| Session ID | Auto-generated UUID |
| Sequence reference | Link to the sequence that was run (snapshot at time of workout — edits to the sequence don't alter history) |
| Start time | Absolute timestamp when workout began |
| End time | Timestamp when workout ended (completion or manual stop) |
| Completion status | Completed / Stopped early (with interval + round where stopped) |
| Total active time | Sum of all interval durations actually elapsed |
| Total rest time | Sum of all rest intervals actually elapsed |
| Intervals completed | Count of intervals fully completed |
| Rounds completed | Count of full rounds completed |
| Pauses | Array of { paused_at, resumed_at } timestamps |

#### 4.1.2 History View

Accessed via a new "History" tab (mobile) or sidebar section (web).

| Element | Spec |
|---------|------|
| Default view | Scrollable chronological list, grouped by date (today, yesterday, this week, earlier) |
| Session card | Shows: sequence name, date/time, total duration, completion badge (checkmark or "stopped at Round 3/5"), color strip from sequence |
| Calendar view | Toggle to a month calendar where dots indicate workout days. Tap a day to see sessions |
| Detail view | Tap a session card → full breakdown: every interval with actual elapsed time, pauses marked, sequence snapshot |
| Delete | Swipe-to-delete a session. Confirmation required. Deleted sessions are soft-deleted (recoverable for 30 days) |
| Sync | Sessions sync via Supabase alongside sequences. Same last-write-wins model |

#### 4.1.3 Analytics Dashboard

A summary panel at the top of the History tab.

| Metric | Display |
|--------|---------|
| Current streak | "{N}-day streak" — consecutive calendar days with at least one completed workout. Flame icon (16px, #E63946) |
| This week | Total sessions, total active time, total rest time |
| This month | Same metrics, with comparison to previous month (up/down arrows with green/red color coding) |
| Work:Rest ratio | Average across all sessions this week. Displayed as "2.1 : 1" |
| Most-used sequence | Name + session count this month |
| Consistency chart | 12-week horizontal bar chart: x-axis = week number, y-axis = session count (0 to max+1). Bar color: #2563EB. If weekly goal is set, a dashed horizontal line at the goal value. Chart respects light/dark theme (dark background: #1A1A2E bars on #0F0F1E; light background: #2563EB bars on #F8FAFC) |

#### 4.1.4 Weekly Goal (Optional — Schlag Pro)

| Field | Detail |
|-------|--------|
| Setting | "Weekly workout goal" — number of sessions per week (1-14, default: off) |
| Location | Settings > Goals |
| Display | Progress ring (32px diameter, 3px stroke, #2DC653 fill, #E2E8F0 track) on History tab header: "3 / 5 this week" |
| Notification | Optional push notification on Sunday at 18:00 local time if goal not yet met: "2 more sessions to hit your weekly goal" |

### 4.2 Apple Watch Companion App

#### 4.2.1 Watch App Scope

The watchOS companion is a remote control + glanceable display — not a standalone workout builder.

| Feature | Detail |
|---------|--------|
| Launch | Opens from watch app grid or complication |
| Home screen | List of 5 most recent sequences (synced from phone). Tap to start |
| Workout display | Interval name, countdown timer (large), round indicator, progress arc |
| Controls | Tap to pause/resume. Swipe right to skip interval. Long-press (1s) for Stop |
| Haptics | See haptic pattern table below |
| Heart rate | Displayed on workout screen if HKWorkoutSession is active (opt-in, Schlag Pro) |
| Complication | Shows "Active: [Interval Name] MM:SS" during workout or "Schlag" with last workout timestamp when idle |
| Standalone | Watch app requires phone nearby for initial sequence sync; workout runs independently once started (in case phone goes out of BLE range mid-workout) |

**Apple Watch Haptic Patterns:**

| Event | Pattern | WKHapticType |
|-------|---------|-------------|
| Interval start | 3 taps, 100ms apart | `.notification` x3 |
| Countdown T-3, T-2, T-1 | Single tap per second | `.click` |
| Interval end (T=0) | Strong double-buzz, 200ms | `.directionUp` + `.success` |
| Workout complete | 5-tap celebration: short-short-short-long-long | `.success` + `.notification` sequence |
| Pause/Resume | Single light tap | `.click` |

#### 4.2.2 Heart Rate Display (Opt-In, Schlag Pro)

| Feature | Detail |
|---------|--------|
| Activation | Toggle in sequence settings: "Show heart rate on watch" |
| Display | HR readout ("142 BPM", 14pt SF Compact) below the countdown timer on watch |
| Data | Recorded as part of session log — average HR per interval available in phone-side history detail view |
| No adaptive rest in v2 | Heart rate is display-only in v2. Adaptive rest ("wait until HR < X") is a v3 feature |

### 4.3 Wear OS Companion App — DEFERRED TO v2.1

> **Decision:** Wear OS companion is deferred to v2.1 to keep v2.0 scope realistic for solo dev. watchOS ships first due to larger fitness user base among Schlag's target audience.

The Wear OS companion will mirror the Apple Watch feature set when shipped. See v2.1 planning for scope and timeline.

### 4.4 Per-Interval Audio (Schlag Pro)

| Feature | Detail |
|---------|--------|
| Scope | Each interval can have its own end-tone, overriding the global default |
| UI | In the interval edit sheet, a new "Sound" row appears. Tap to choose from: Default, Built-in tones (8 options), or Custom upload |
| Built-in tones | 8 tones: Bell, Whistle, Horn, Chime, Buzz, Click, Gong, Drum |
| Custom upload | Same specs as v1 global custom audio (MP3/WAV/M4A, max 5MB) but assigned per-interval |
| Storage | Custom audio files stored per-interval in Supabase Storage. Synced across devices |
| Pro gate | Per-interval audio is a Schlag Pro feature. Free users see the option grayed out with a lock icon (16px) and "Unlock with Schlag Pro" text |

### 4.5 Workout Templates

Pre-built sequence templates for common training formats. Reduces time-to-first-workout for new users.

| Feature | Detail |
|---------|--------|
| Template gallery | Accessible from library via "Templates" button (top-right of library header) or from empty state |
| Categories | Tabata (20s/10s x 8), EMOM (every minute on the minute), AMRAP (as many rounds as possible — single long interval + rounds), Circuit (work/rest x N exercises), Custom Rest Periods (powerlifting 3-5 min rests) |
| Template count | 10 templates at launch, developer-authored. Breakdown: 2 Tabata, 2 EMOM, 2 Circuit, 2 Strength Rest, 1 AMRAP, 1 Mobility |
| Free templates | Free users: Tabata Classic (20s/10s x 8), EMOM 10-Minute, Strength 5x5 Rest Timer. Remaining 7 templates require Schlag Pro |
| Usage flow | Tap template → preview intervals → "Use Template" copies it to library as a new editable sequence |
| Customization | Templates are starting points — user can edit everything after import |
| Display | Template cards show: name, description, total duration, interval pattern preview (color strip) |

### 4.6 Keyboard Shortcuts (Web)

Essential for web users during active workouts.

| Shortcut | Action |
|----------|--------|
| `Space` | Pause / Resume |
| `N` or `→` | Skip to next interval |
| `Escape` | Stop workout (opens confirm dialog) |
| `E` | Toggle expanded/compact view |
| `M` | Mute/unmute audio |
| `?` | Show keyboard shortcut overlay |

Shortcuts are active only during the workout screen. A "Keyboard shortcuts: press ?" hint (14pt, muted text color #94A3B8) is shown on first web workout, dismissed permanently after first `?` press.

### 4.7 Enhanced Audio Features

#### 4.7.1 Halfway Alert

| Feature | Detail |
|---------|--------|
| Trigger | Beep (330Hz, 60ms) or voice "Halfway" at the halfway point of each interval (only for intervals >= 10 seconds) |
| Voice | "Halfway" announcement if voice countdown is enabled |
| Configuration | Per-sequence toggle. Default: off |

#### 4.7.2 Interval Name Announcement

| Feature | Detail |
|---------|--------|
| Trigger | At the start of each interval, TTS announces the interval name |
| Example | "Squat" ... [countdown] ... "Rest" ... [countdown] |
| Configuration | Per-sequence toggle. Default: off. Requires voice countdown to be enabled |

### 4.8 Schlag Pro (Monetization)

#### 4.8.1 Pricing

| Model | Price |
|-------|-------|
| One-time purchase | $4.99 (USD). Launch price — may increase to $6.99 after initial adoption period |
| Regional pricing | Auto-adjusted by App Store / Play Store |
| Web | Stripe checkout, same price |
| Restore | "Restore Purchase" button in Settings for iOS/Android. Email-linked for web |

> **Decision (OQ-2):** Launch at $4.99 to maximize initial conversion. Evaluate price increase to $6.99 after 90 days based on conversion data.

#### 4.8.2 Pro Features

| Feature | Free | Pro |
|---------|------|-----|
| Sequence builder | Unlimited | Unlimited |
| Cloud sync | Yes | Yes |
| Workout history | 10 most recent sessions (rolling window — older sessions hidden but not deleted; upgrading to Pro reveals full history) | Unlimited history |
| Analytics dashboard | Current streak only | Full dashboard |
| Per-interval audio | Global tone only | Per-interval custom audio |
| Workout templates | 3 templates (Tabata Classic, EMOM 10-Min, Strength 5x5) | All 10 templates |
| Apple Watch | Timer + haptics | Heart rate display + interval HR logging |
| Custom themes | Default dark/light | 4 additional workout screen themes (Ember, Ocean, Forest, Midnight) |
| Weekly goal + reminders | No | Yes |
| Export history | No | CSV / JSON export of all session data |

> **Decision (OQ-1):** Free users see the 10 most recent sessions (rolling window). Older sessions are hidden, not deleted. Upgrading to Pro reveals the full history retroactively.

#### 4.8.3 Pro Principles

- The core timer experience is never degraded for free users
- Free users can do everything v1 offered — Pro adds new v2 features
- No recurring subscription — one payment, lifetime access to v2 Pro features
- No nag screens — a lock icon (16px) with "Pro" label on gated features. No modals, no interstitials

### 4.9 Apple Health / Google Fit Integration

| Feature | Detail |
|---------|--------|
| Platform | HealthKit (iOS), Health Connect (Android) |
| Write | Workout sessions written as HKWorkoutActivityType.traditionalStrengthTraining (or .highIntensityIntervalTraining based on sequence metadata) |
| Data | Duration, active/rest time, calories (estimated from duration + workout type), heart rate samples (if Watch is used) |
| Read | No reading from health platforms in v2 |
| Permission | Requested on first workout completion. Optional — app works without it |

### 4.10 Improved Sync (Conflict Awareness)

v1 uses silent last-write-wins. v2 adds transparency.

| Feature | Detail |
|---------|--------|
| Conflict detection | When a sequence has been edited on two devices offline, detect the conflict on sync |
| Resolution | Still last-write-wins, but show a toast (3-second auto-dismiss): "Sequence '[Name]' was updated on another device. Showing latest version." |
| Sync log | In Settings > Sync, show last 10 sync events with status (synced / conflict resolved / error) with timestamps |
| Manual sync | Pull-to-refresh on library screen triggers immediate sync |

---

## 5. Navigation Changes

### 5.1 Mobile (Bottom Tab Bar)

| Tab | Content | Change from v1 |
|-----|---------|-----------------|
| Home (Library) | Sequence library | No change |
| History | Workout history + analytics | **New tab** (replaces Active/Now) |
| Active / Now | Current workout (only visible during active workout) | Becomes a floating pill overlay (48px height, primary accent #E63946, shows interval name + countdown) anchored to bottom of screen above tab bar. Tap returns to full workout screen. Visible from any tab during active workout |
| Settings | Audio, account, theme, sync, Pro, goals | Expanded |

### 5.2 Web (Left Sidebar)

| Section | Content | Change from v1 |
|---------|---------|-----------------|
| My Sequences | Library | No change |
| History | Workout history + analytics | **New** |
| Running | Active workout | No change |
| Templates | Template gallery | **New** |
| Settings | Same as mobile + keyboard shortcuts reference | Expanded |

---

## 6. Data Model Changes

See `architecture-v2.md` for complete data model schemas and technical implementation details.

**Summary of data model additions in v2:**

- **WorkoutSession** — new entity for session logging (id, sequence snapshot, timestamps, completion status, pause log, HR data)
- **Sequence.intervals[]** — adds `audio_tone` and `custom_audio_url` per interval
- **Sequence.audio_config** — adds `announce_interval_names` and `halfway_alert` booleans
- **UserPreferences** — new entity for Pro status, theme, weekly goal, health integration toggle

---

## 7. Technical Architecture Changes

See `architecture-v2.md` for full technical architecture including Supabase tables, IAP implementation, watch app architecture, and HealthKit/Health Connect integration.

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| History tab initial load | < 500ms for up to 1,000 sessions | Time from tab tap to first content paint |
| Analytics dashboard computation | < 200ms for 12-week aggregation | Client-side profiling |
| Watch sync latency | Sequence list syncs to watch within 5 seconds of phone app foregrounding | WatchConnectivity transfer timing |
| Session write to local DB | < 50ms per session save | Profiled on mid-range device (iPhone 12 / Pixel 6) |
| All v1 performance targets | Carry forward | See PRD v1.0 NFR section |

### 8.2 Reliability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Crash-free session rate | > 99.7% | Firebase Crashlytics or equivalent |
| Session data durability | Zero session data loss — sessions written to local DB before sync | Verified by integration tests |
| Watch workout resilience | Workout continues on watch if phone disconnects mid-session | Manual QA test: disable Bluetooth during active workout |
| Soft-delete recovery | Deleted sessions recoverable for 30 days | Verified by restore flow test |
| IAP restore | Restore purchase succeeds within 10 seconds on valid receipt | StoreKit / Play Billing test |

### 8.3 Security

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| IAP receipt validation | All purchases validated server-side via Supabase Edge Function before unlocking Pro | Receipt validation test with invalid receipt returns rejection |
| Auth tokens | Stored in platform secure storage (iOS Keychain, Android Keystore). Never in plain text or UserDefaults | Code review + static analysis |
| API access | All Supabase tables use Row Level Security — users can only read/write their own data | RLS policy tests |
| Data in transit | All API calls over HTTPS/TLS 1.2+ | Certificate pinning validation |
| Data at rest | Supabase encrypts at rest by default. Local SQLite DB uses device-level encryption | Infrastructure audit |

### 8.4 Privacy

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Data export | Users can export all data (sequences + sessions) as JSON from Settings | Manual test |
| Account deletion | Deletes all server-side data within 30 days per GDPR. Immediate soft-delete, hard-delete within 30 days | Deletion flow test |
| Health data | HealthKit/Health Connect data written only with explicit user permission. Never uploaded to Supabase | Code review — verify no health data in API calls |
| Minimal data collection | No analytics beyond crash reporting and aggregate usage metrics. No PII in analytics | Privacy audit |

### 8.5 Accessibility

All v1 accessibility requirements carry forward (WCAG 2.1 AA contrast, 44pt tap targets, VoiceOver/TalkBack labels). Additionally:

| Requirement | Target |
|-------------|--------|
| History tab | Session cards announce: sequence name, date, duration, completion status via VoiceOver/TalkBack |
| Analytics chart | Chart data available as accessible text table alternative for screen readers |
| Watch app | All watch controls have accessibility labels. Haptic patterns serve as non-visual feedback |

### 8.6 App Store Compliance

| Requirement | Detail |
|-------------|--------|
| iOS IAP guidelines | "Restore Purchase" button visible in Settings. No external purchase links for iOS IAP content. Subscription messaging follows Apple HIG |
| Google Play billing | Comply with Google Play billing policy — all digital goods purchased via Play Billing |
| Web Stripe | PCI compliance handled by Stripe. No card data touches Schlag servers |

---

## 9. Resolved Decisions (formerly Open Questions)

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Should free users see 10 most recent sessions or 10 sessions total ever? | **DECIDED: 10 most recent (rolling window).** Older sessions are hidden, not deleted. Upgrading to Pro reveals full history retroactively. |
| OQ-2 | Pro pricing: $6.99 vs $4.99? | **DECIDED: Launch at $4.99.** Evaluate price increase to $6.99 after 90 days based on conversion data. |
| OQ-3 | Watch app priority: ship watchOS first and Wear OS in v2.1? Or both simultaneously? | **DECIDED: watchOS first.** Wear OS deferred to v2.1. Larger fitness user base on Apple Watch; reduces v2.0 scope for solo dev. |
| OQ-4 | Should workout history include sessions from before the v2 update? | **DECIDED: No.** No data to backfill. Clean start — history begins with first v2 workout session. |
| OQ-5 | Template curation: who creates the 8-12 launch templates? | **DECIDED: Developer-authored.** 10 templates covering 5 categories. Community-sourced templates are a v3 feature via community gallery. |

---

## 10. Out of Scope for v2

- Wear OS companion app (deferred to v2.1)
- Sequence sharing / social features (v3)
- Community template gallery (v3)
- Coach/trainer mode (v3)
- Group/synchronized workouts (v3)
- Heart rate-based adaptive rest (v3)
- Spotify / Apple Music integration (v3+)
- Localization / multi-language (v2.5 or v3)
- AI-powered sequence generation (v3)
- TV / Chromecast casting (v3)
- Additional workout screen themes beyond the 4 Pro themes (v3+)

---

## 11. Migration & Compatibility

- v2 is a superset of v1 — no breaking changes to existing sequences or user data
- New Supabase tables are additive (no schema migrations on existing tables beyond adding columns to intervals)
- Existing v1 users see their library unchanged; History tab is empty until they run their first v2 workout
- Pro features show lock icon with "Pro" label — no feature removal from free tier, no nag modals

---

*SCHLAG PRD v2.0 — End of Document — Draft*
