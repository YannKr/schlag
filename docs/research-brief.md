# Schlag — Market Research & Competitive Intelligence Brief

**Date:** March 2026
**Purpose:** Inform v2 and v3 roadmap planning
**Sources:** App store data, fitness community forums, competitor feature analysis, platform API documentation (through early 2025)

---

## 1. Competitive Landscape

### 1.1 Direct Competitors (Interval Timer Apps)

| App | Platform | Model | Key Differentiator |
|-----|----------|-------|--------------------|
| **Seconds Interval Timer** | iOS, Android, Wear OS | Free + Pro ($9.99/yr or $4.99 one-time) | Template library, Apple Watch, Spotify integration, voice guidance |
| **Tabata Timer** (various) | iOS, Android | Free + IAP ($2.99-$4.99) | Simplicity, Tabata-specific presets |
| **Interval Timer - HIIT Timer** | iOS, Android | Free + Pro ($5.99/yr) | Clean UI, Apple Health integration |
| **SmartWIT** | iOS, Android | Free + Pro | Complex interval nesting, warmup/cooldown auto-insert |
| **GymNext Flex Timer** | iOS, Android + hardware | Hardware + app ($149 timer) | Physical gym display, Bluetooth-synced wall timer |
| **Boxing Timer Pro** | iOS, Android | $2.99 one-time | Sport-specific rounds, bell sounds |

### 1.2 Adjacent Competitors (Workout Trackers with Timers)

| App | Relevant Features |
|-----|-------------------|
| **Strong** | Rest timer between sets, workout history/analytics, Apple Watch, clean UI benchmark |
| **JEFIT** | Community routine sharing, exercise database, social feeds |
| **Hevy** | Workout sharing, social feed, routine templates, Apple Watch |
| **Strava** | Gold standard for social fitness — segments, clubs, challenges, leaderboards |
| **Peloton** | Live & on-demand group workouts, leaderboards, streaks, instructor-led timing |

### 1.3 Platform/Gym Tools

| Tool | Relevant Features |
|------|-------------------|
| **SugarWOD** | CrossFit box programming distribution, coach-to-athlete push, gym leaderboards, TV display |
| **Wodify** | CrossFit gym management, WOD timer with TV casting, athlete tracking |
| **BTWB (Beyond the Whiteboard)** | CrossFit analytics, workout tracking, gym leaderboards |
| **PushPress** | Gym management + member-facing app with programming |

---

## 2. User Pain Points & Feature Demands

Based on analysis of App Store/Play Store reviews and fitness community discussions (r/fitness, r/HIIT, r/crossfit, r/weightlifting):

### 2.1 Most Requested Features (by frequency)

1. **Workout history/logging** — "I love this timer but I wish I could see my past workouts"
2. **Apple Watch / wearable support** — "Need haptic tap on my wrist, I can't hear beeps while lifting"
3. **Sharing/importing sequences** — "My coach programmed a great EMOM, I want to share it with my training partner"
4. **Heart rate-based rest** — "Rest until my HR drops below 130, then auto-start next set"
5. **Per-interval custom sounds** — "I want a different sound for 'work' vs 'rest' intervals"
6. **Spotify/music integration** — "Auto-duck music volume during countdowns"
7. **Keyboard shortcuts on web** — "Space to pause, N for next interval"
8. **Templates/presets** — "Common formats like Tabata, EMOM, AMRAP should be one-tap"

### 2.2 Common Complaints About Existing Apps

- Ads interrupting workouts (biggest complaint — Schlag's free-no-ads model is a major advantage)
- Timer drift / audio not firing on silent mode (Schlag v1 addresses this)
- UI too small / unreadable during exercise
- No cloud sync / lost sequences when switching phones
- Overly complex builder for simple needs
- No offline support

---

## 3. Technology Trends & Platform Opportunities

### 3.1 Wearable Integration

**Apple Watch (watchOS 10+):**
- HealthKit workout sessions with custom workout types
- Extended runtime sessions for fitness apps (background execution)
- WKExtendedRuntimeSession for timer apps specifically
- Haptic patterns via WKInterfaceDevice.play(.notification) — distinct patterns for start/end/countdown
- Complications for quick-launch from watch face
- Live Activity + Dynamic Island on iPhone (iOS 16.1+) — shows timer countdown in pill

**Wear OS (Wear OS 4+):**
- Health Services API for heart rate during workouts
- Ongoing Activity API for persistent timer notification
- Tiles for quick-launch
- Smaller developer market but growing with Samsung partnership

**Expo/React Native feasibility:**
- No first-party Expo Apple Watch support — requires native Swift companion app
- Community package `react-native-watch-connectivity` bridges phone ↔ watch
- Wear OS: `react-native-wear-connectivity` exists but less mature
- Realistic approach: native watchOS companion app with WatchConnectivity framework, controlled from RN phone app

### 3.2 Heart Rate Integration

- **Apple Watch:** Direct HealthKit HKWorkoutSession streams real-time HR
- **Bluetooth HR monitors:** Standard BLE Heart Rate Profile (0x180D) — works with Polar, Garmin, Wahoo chest straps
- **React Native:** `react-native-ble-plx` for BLE device pairing; well-maintained
- **Use case:** "Rest until HR < X" (adaptive rest), HR zone display during intervals, post-workout HR analytics

### 3.3 AI/ML Opportunities

- **LLM-powered sequence generation:** "Create a 20-minute HIIT workout with 30s work / 15s rest" → auto-builds sequence. Uses Claude API or similar
- **Adaptive rest recommendations:** Based on workout history, suggest optimal rest periods
- **Smart templates:** Analyze user's past sequences → suggest new variations
- **Voice command processing:** "Add 90-second squat interval" during sequence building

### 3.4 Audio & Haptics

- **Spatial audio (iOS 16+):** Not directly useful for timers but enables richer soundscapes
- **Custom haptic patterns (Core Haptics):** Can create rhythmic countdown taps distinct from notifications
- **Music integration:** Spotify SDK (iOS/Android), Apple Music via MusicKit — auto-duck during countdowns, auto-pause on workout end

### 3.5 Modern Platform APIs

- **iOS 18 / iPadOS:** Interactive widgets, StandBy mode timer display, ControlCenter widget
- **Android 14+:** Predictive back gestures, per-app language preferences, health connect migration
- **Web:** View Transitions API for smooth page transitions, Shared Storage API, WebBluetooth for HR monitors

---

## 4. Social & Community Insights

### 4.1 What Works

- **Strava model:** Activity feed + kudos (low-friction social). Segments create friendly competition. Clubs enable local community
- **Peloton model:** Live leaderboards during synchronous workouts. Tags for sub-communities. Streaks for consistency
- **Strong/Hevy model:** Share workout summaries as images to Instagram/Stories. Simple but effective virality loop

### 4.2 What Doesn't Work

- In-app chat / messaging (users already have messaging apps)
- Mandatory social features blocking core functionality
- Complex following/follower graphs for utility apps
- Leaderboards without meaningful context (comparing incomparable workouts)

### 4.3 Sharing Mechanisms That Drive Growth

1. **Sequence/routine sharing via link** — shareable URL opens app or web preview → import one-tap
2. **Workout summary card** — beautiful auto-generated image of completed workout → share to Stories/X
3. **Coach → athlete push** — trainer creates sequence, sends link/code to clients
4. **Public template gallery** — community-curated library, browsable by workout type

### 4.4 Group/Gym Features

- **SugarWOD approach:** Coach publishes daily WOD → athletes see it in their app → built-in leaderboard
- **GymNext approach:** Physical display synced via Bluetooth + companion app
- **TV casting:** Chromecast/AirPlay the workout screen to gym TV — large countdown visible to whole class
- **Synchronized start:** QR code or room code → all devices start simultaneously

---

## 5. Monetization Research

### 5.1 Pricing Benchmarks

| Model | Typical Price | Examples |
|-------|---------------|----------|
| One-time Pro unlock | $4.99 - $9.99 | Boxing Timer Pro ($2.99), Tabata Timer Pro ($4.99) |
| Annual subscription | $9.99 - $19.99/yr | Seconds Pro ($9.99/yr), Strong Pro ($39.99/yr) |
| Monthly subscription | $2.99 - $4.99/mo | Interval Timer Pro ($3.99/mo), Hevy Pro ($9.99/mo) |
| Freemium (sequence limit) | Free for 3-5 sequences, unlimited on Pro | Common pattern |

### 5.2 Sustainable Models for a "Free-First" App

1. **"Schlag Pro" one-time purchase ($6.99-$9.99):** Unlocks power features (Apple Watch, unlimited custom audio, advanced analytics, per-interval sounds). Core timer stays fully free forever. Avoids subscription fatigue
2. **Tip jar / supporter badge:** "Buy the developer a protein shake" — $1.99/$4.99/$9.99 tiers. Low conversion but builds goodwill
3. **B2B gym licensing ($9.99/mo per gym):** Coach accounts with push-to-athletes, gym branding, TV casting mode. Separate revenue stream from consumer app
4. **Theme packs ($1.99-$2.99):** Cosmetic customization — workout screen themes, custom color palettes, sound packs. Non-functional, feels fair
5. **Hybrid:** Free core + one-time Pro unlock for power users + B2B subscription for gyms/trainers

### 5.3 Conversion Drivers

Features that most reliably convert free → paid in fitness timer apps:
1. Apple Watch companion (strongest driver)
2. Unlimited sequences (if free tier is capped)
3. Workout history/analytics
4. Custom audio per interval
5. Cloud backup (if free tier is local-only — but Schlag already offers this free)

---

## 6. Localization & Accessibility

### 6.1 High-Value Languages (by fitness app download volume)

1. English (US, UK, AU, CA)
2. Spanish (global)
3. Portuguese (Brazil)
4. German
5. Japanese
6. Korean
7. French
8. Italian

### 6.2 Accessibility Opportunities

- **Haptic-only mode:** Critical for deaf/hard-of-hearing athletes — Apple Watch haptics + phone vibration patterns replace audio entirely
- **Dynamic Type support:** iOS built-in, critical for low-vision users
- **Colorblind-safe palette:** Offer alternative palettes (deuteranopia, protanopia, tritanopia). The v1 12-color palette includes red/green that are indistinguishable for ~8% of males
- **Reduced motion:** Replace progress bar animation with static percentage text; no auto-scrolling
- **VoiceOver workout experience:** Announce interval changes, time remaining on demand, pause/resume confirmation
- **High contrast mode:** Pure black background + white text option for workout screen

### 6.3 RTL Considerations

- Progress bars should fill right-to-left in RTL locales
- Drag handles and swipe directions reverse
- Timer digits remain LTR (universal convention for numbers)
- "NEXT →" becomes "← NEXT"

---

## 7. Recommended Version Strategy

### v2 — "The Complete Athlete" (Retention & Power Features)

Focus: workout history, wearable integration, per-interval audio, templates, keyboard shortcuts. Makes the app indispensable for daily use.

### v3 — "The Connected Gym" (Social & Growth)

Focus: sequence sharing, coach mode, community gallery, group workouts, gym TV casting. Drives organic growth and opens B2B revenue.

### v2.x / v3.x Considerations

- AI-powered sequence generation (can be v2.5 or v3)
- Heart rate-based adaptive rest (v2 if Apple Watch ships in v2, else v3)
- Localization (8 languages — can be v2.5 when codebase is stable)
- Spotify/Apple Music integration (v3+)

---

*This research brief should be revisited and updated with live market data before finalizing version scoping.*
