---
version: '2.0'
inputDocuments:
  - 'docs/Schlag_PRD_v2.0.md'
  - 'docs/architecture-v1.md'
date: '2026-03-07'
---

# Schlag Technical Architecture — v2.0

**Source:** Extracted from Schlag PRD v2.0, Sections 6-7
**Builds on:** architecture-v1.md

## Data Model Changes

### New: WorkoutSession

```
{
  id: uuid,
  user_id: uuid,
  sequence_id: uuid,
  sequence_snapshot: Sequence,  // frozen copy at workout start
  started_at: timestamp,
  ended_at: timestamp | null,
  status: 'completed' | 'stopped' | 'in_progress',
  stopped_at_interval: number | null,
  stopped_at_round: number | null,
  intervals_completed: number,
  rounds_completed: number,
  total_active_seconds: number,
  total_rest_seconds: number,
  pauses: [{ paused_at: timestamp, resumed_at: timestamp }],
  heart_rate_samples: [{ timestamp, bpm }] | null,
  avg_heart_rate: number | null,
  created_at: timestamp,
  updated_at: timestamp
}
```

### Modified: Sequence.intervals[]

Add to each interval object:

```
{
  ...existing fields,
  audio_tone: 'default' | 'bell' | 'whistle' | 'horn' | 'chime' | 'buzz' | 'click' | 'gong' | 'drum' | 'custom',
  custom_audio_url: string | null
}
```

### Modified: Sequence.audio_config

Add:

```
{
  ...existing fields,
  announce_interval_names: boolean,  // default false
  halfway_alert: boolean             // default false
}
```

### New: UserPreferences

```
{
  user_id: uuid,
  pro_unlocked: boolean,
  pro_purchased_at: timestamp | null,
  theme: 'dark' | 'light' | 'ember' | 'ocean' | 'forest' | 'midnight',
  health_integration_enabled: boolean,
  weekly_goal: number | null
}
```

## New Supabase Tables

- `workout_sessions` — stores all session logs
- `user_preferences` — stores Pro status and settings
- Row Level Security: users can only read/write their own data

## In-App Purchase

- iOS: StoreKit 2 (`Product`, `Transaction` APIs)
- Android: Google Play Billing Library v6+
- Web: Stripe Checkout with webhook to update `user_preferences.pro_unlocked`
- Receipt validation: server-side via Supabase Edge Functions

## Watch Apps

- **watchOS:** Separate Xcode target in the same project. Swift/SwiftUI. WatchConnectivity for data sync with RN phone app
- **Wear OS:** Separate Android module. Kotlin/Compose for Wear OS. Data Layer API (DEFERRED to v2.1)
- Both watch apps are thin clients — phone is source of truth for sequences

## HealthKit / Health Connect

- iOS: `expo-health` or native module wrapping HealthKit
- Android: Health Connect API (Jetpack Health library)
- Workout type mapping: sequences with work:rest ratio > 2:1 → HIIT; else → strength training
