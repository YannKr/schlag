# SCHLAG
## Interval Training Timer
### Product Requirements Document | Version 3.0 — "The Connected Gym"

**Platforms:** iOS | Android | Web | watchOS | Wear OS
**Status:** Draft | **Audience:** Solo Dev Build
**Builds on:** [Schlag PRD v1.0](../Schlag_PRD_v1.0.docx) and [Schlag PRD v2.0](./Schlag_PRD_v2.0.md)

---

## 1. Executive Summary

Schlag v3 transforms the app from a personal training tool into a connected fitness platform. The release adds three pillars: **sharing & community** (so athletes can exchange sequences and discover new workouts), **coach/trainer mode** (so fitness professionals can push programming to clients), and **group workout features** (so gyms and classes can run synchronized timers).

v3 is the growth engine. While v1 built the tool and v2 made it indispensable, v3 makes it viral — every shared sequence, every coach-pushed workout, every group class is an organic acquisition channel.

| Field | Detail |
|-------|--------|
| Product Name | Schlag |
| Version | 3.0 |
| Codename | The Connected Gym |
| Platforms | iOS, Android, Web, watchOS, Wear OS |
| Primary Audience | Individual athletes (existing), fitness coaches/trainers (new), gym owners/class instructors (new) |
| Monetization | Free core + Schlag Pro (one-time, from v2) + **Schlag Coach** (monthly subscription, new) |
| Key Additions | Sequence sharing, community gallery, coach mode, group workouts, AI sequence builder, adaptive rest, localization |
| Prerequisite | Schlag v2.0 shipped and stable |

---

## 2. Goals & Success Metrics

### 2.1 Product Goals

1. Make sequence sharing so frictionless that athletes naturally send Schlag links to training partners — every share is a potential new user.
2. Give fitness coaches a professional tool for distributing timed workouts to clients — replacing WhatsApp screenshots and paper printouts.
3. Enable gym classes to run on a single synchronized timer — establishing Schlag as infrastructure in training facilities.
4. Introduce AI-powered sequence creation so athletes can describe a workout in words and get a ready-to-run sequence.
5. Open a sustainable B2B revenue stream through coach/gym subscriptions without compromising the free consumer experience.

### 2.2 Success Metrics (6-month post-launch targets)

| Metric | Target |
|--------|--------|
| Monthly active users (MAU) | 5x v2 baseline |
| Viral coefficient (invites per user) | > 0.3 (each user brings 0.3 new users on average) |
| Sequences shared per month | > 10,000 |
| Coach accounts (paid) | > 500 |
| Group workout sessions per month | > 2,000 |
| D30 retention | > 50% |
| Revenue run rate | > $5K/month (Coach subscriptions + Pro purchases) |

---

## 3. User Personas (Additions to v1/v2)

### 3.1 New Persona — The Online Coach

| Attribute | Detail |
|-----------|--------|
| Name | Sarah, 38 |
| Activity | Online fitness coach with 40 remote clients across 3 programs |
| Device | MacBook for programming, iPhone for demos |
| Pain point | Creates workout timers in Google Sheets, screenshots them to a WhatsApp group. Clients manually re-enter into their own timer apps |
| Goal | Build sequences on Schlag web, push them directly to clients' phones with one click |
| Key behavior | Programs 3 different weekly plans; updates sequences every 4 weeks. Needs to know which clients completed the workout |

### 3.2 New Persona — The Class Instructor

| Attribute | Detail |
|-----------|--------|
| Name | Javi, 42 |
| Activity | Runs 3 CrossFit-style classes daily at a small gym |
| Device | iPad mounted on wall, gym TV via Chromecast |
| Pain point | Uses a basic web timer on the TV; can't customize intervals or have athletes follow along on their own phones |
| Goal | Cast the Schlag workout screen to the gym TV while athletes follow along on their watches/phones — all synchronized |
| Key behavior | Sets up the day's WOD in 2 minutes; needs class-wide start/stop control |

### 3.3 New Persona — The Community Explorer

| Attribute | Detail |
|-----------|--------|
| Name | Kai, 23 |
| Activity | Just started lifting, follows fitness influencers |
| Device | iPhone |
| Pain point | Knows they should use timed rest periods but doesn't know how to program them |
| Goal | Browse community-created sequences, find something that matches their program, and start using it immediately |
| Key behavior | Discovers sequences via social media links or in-app browsing; modifies templates slightly |

---

## 4. Feature Requirements

### 4.1 Sequence Sharing

The core viral mechanic of v3.

#### 4.1.1 Share Links

| Feature | Detail |
|---------|--------|
| Generate link | Any sequence can generate a share link via share button (library card or builder) |
| Link format | `schlag.app/s/{shortcode}` — short, clean, works everywhere |
| Web preview | Opening the link in a browser shows a beautiful preview: sequence name, interval list with colors, total duration, "Open in Schlag" / "Get Schlag" buttons |
| Deep link | If the app is installed, the link opens directly into an import preview screen |
| Import flow | Preview screen shows full sequence details → "Add to My Library" button → copies sequence to user's library (new sequence, no link to original) |
| No account required | Sharing and importing work without an account. Account is needed only for publishing to the community gallery |
| Analytics (Coach only) | Coaches can see how many times their shared link was opened and imported |

#### 4.1.2 Share Card (Social Media)

| Feature | Detail |
|---------|--------|
| Auto-generated image | When sharing, option to generate a visual "share card" — a 1080x1080 or 1080x1920 image showing: sequence name, interval breakdown as color blocks, total duration, Schlag branding |
| Use case | Post to Instagram Stories, X, Reddit — visual + link combo |
| Generation | Client-side canvas rendering (no server needed). Available on all platforms |

#### 4.1.3 QR Code Sharing

| Feature | Detail |
|---------|--------|
| Generate QR | Encode the share link as a QR code, displayable in-app |
| Use case | Gym instructor shows QR on screen → class members scan to get the workout on their phones |
| Display | Full-screen QR code view with sequence name and "Scan to get this workout" text |

### 4.2 Community Gallery

A public, browsable library of community-shared sequences.

#### 4.2.1 Gallery Structure

| Feature | Detail |
|---------|--------|
| Access | New "Explore" tab on mobile; "Explore" sidebar section on web |
| Categories | Tabata, EMOM, AMRAP, Circuit, Strength Rest Timers, Mobility, Warm-Up, Custom |
| Sorting | Popular (most imports), New, Editor's Picks (curated by developer) |
| Search | Search by name, category, duration range, number of intervals |
| Preview | Tap a gallery card → preview screen identical to share link import (but with author attribution) |
| Publishing | User taps "Publish to Gallery" on any of their sequences. Requires account. Author shown as display name |

#### 4.2.2 Moderation

| Feature | Detail |
|---------|--------|
| Review | Automated: reject sequences with profanity in names/notes. Manual review queue for flagged content |
| Reporting | "Report" button on gallery items (spam, inappropriate, misleading) |
| Removal | Developer can remove items from gallery. Author notified via in-app notification |
| No ratings in v3 | Popularity is measured by import count, not star ratings. Avoids review gaming |

#### 4.2.3 Author Profiles

| Feature | Detail |
|---------|--------|
| Profile page | Display name + avatar + list of published sequences + total imports |
| Following | Users can follow authors to see new publications in a "Following" tab within Explore |
| No DMs / chat | No messaging. This is a content discovery platform, not a social network |

### 4.3 Coach Mode (Schlag Coach)

A paid tier enabling fitness professionals to distribute workouts to clients.

#### 4.3.1 Coach Account

| Feature | Detail |
|---------|--------|
| Pricing | $9.99/month or $79.99/year |
| Includes | Everything in Schlag Pro + Coach features |
| Client limit | Up to 50 clients in v3. Scalable in future versions |
| Platform | Coach management is primarily web-based; mobile shows client list and push controls |

#### 4.3.2 Client Management

| Feature | Detail |
|---------|--------|
| Invite clients | Coach generates invite link or enters client's email → client receives invitation in-app or via email |
| Client list | Web dashboard showing all connected clients: name, last active, last workout completed |
| Groups | Organize clients into groups (e.g., "Monday HIIT Class", "Remote Program A") |
| Client view | Client sees "From [Coach Name]" sequences in a dedicated "Coach" section of their library |
| Disconnect | Either party can disconnect at any time. Client keeps copies of received sequences |

#### 4.3.3 Workout Distribution

| Feature | Detail |
|---------|--------|
| Push sequence | Coach selects a sequence → "Send to Clients" → choose individual clients or groups → sequence appears in their libraries with push notification |
| Schedule push | Schedule a sequence to be pushed on a future date (e.g., set up the whole week's programming on Sunday) |
| Programming calendar | Web-only: calendar view where coach drags sequences onto dates for specific clients/groups |
| Client notification | Push notification: "[Coach Name] sent you a new workout: Leg Day EMOM" |
| Updates | If coach edits a pushed sequence, clients get the updated version. A "Updated by coach" badge appears |

#### 4.3.4 Client Activity Visibility

| Feature | Detail |
|---------|--------|
| Completion feed | Coach sees a feed: "[Client] completed [Sequence] — 100% — 45 min" |
| Completion rate | Dashboard metric: "X% of clients completed today's workout" |
| No detailed history | Coach does not see client's full workout history — only completion status of sequences the coach pushed. Privacy by default |
| Opt-in detail | Client can opt-in to share detailed session data (intervals completed, HR data) with their coach |

### 4.4 Group Workouts

Synchronized timer for classes, group training, and partner workouts.

#### 4.4.1 Room System

| Feature | Detail |
|---------|--------|
| Create room | Any user creates a "room" from a sequence → generates a 6-character room code (e.g., "SCHLAG") |
| Join room | Enter room code in "Join Room" field (accessible from library or Active tab) |
| Room URL | `schlag.app/r/{code}` — works in browser for participants without the app |
| Capacity | Up to 30 participants per room in v3 |
| Duration | Room expires 1 hour after creation or when host ends the session |

#### 4.4.2 Synchronized Timer

| Feature | Detail |
|---------|--------|
| Host controls | Only the room creator (host) can start, pause, and stop the workout. Participants see a "Waiting for host..." screen |
| Sync mechanism | Supabase Realtime (WebSocket) for state sync. Host broadcasts: { state: 'running' | 'paused' | 'stopped', current_interval_index, round, server_timestamp }. Participants compute local timer from server timestamp |
| Latency tolerance | Target < 500ms sync variance between participants. Display rounds to nearest second — sub-second differences are imperceptible in a gym setting |
| Audio | Each participant's device plays audio cues locally based on the sync state — no streamed audio |
| Offline resilience | If a participant loses connection briefly, they resync on reconnect using the absolute timestamp approach (same as v1 backgrounding logic) |

#### 4.4.3 TV/Display Casting

| Feature | Detail |
|---------|--------|
| Web display mode | `schlag.app/r/{code}/display` — a fullscreen web view optimized for TV: extra-large countdown, high contrast, no controls visible |
| Casting | Works via Chromecast (cast browser tab), AirPlay (screen mirror), or direct HDMI from laptop |
| Layout | Countdown fills 70% of screen height. Interval name at top. Next interval at bottom. No chrome, no browser UI (suggests using fullscreen mode / kiosk) |
| No native casting in v3 | Uses browser-based approach rather than native Chromecast/AirPlay SDK. Simpler to build, works everywhere |

### 4.5 AI Sequence Builder

Natural language → interval sequence.

#### 4.5.1 Interface

| Feature | Detail |
|---------|--------|
| Access | "AI" button in the sequence builder or as a creation option from library ("Create with AI") |
| Input | Text field: "Describe your workout..." |
| Examples | "20 minute Tabata with squats, push-ups, and burpees", "Powerlifting rest timer: 5 sets, 3 minute rest between sets", "EMOM 10: odd minutes wall balls, even minutes rowing" |
| Output | AI generates a complete sequence (name, intervals with names/durations/colors, repeat count). Shown in a preview |
| Editing | User can accept as-is or edit any field before saving. "Regenerate" button for a different variation |

#### 4.5.2 Technical

| Feature | Detail |
|---------|--------|
| Model | Claude API (Haiku for speed, Sonnet for complex requests). Structured output → Sequence JSON |
| Cost | Each generation costs ~$0.001-0.005. Free for all users (budget cap: 10 generations/day for free users, unlimited for Pro) |
| Privacy | Only the workout description is sent to the API. No user data, no history |
| Prompt engineering | System prompt includes Schlag's interval schema, color palette, and common workout format knowledge |
| Fallback | If API is unavailable, show "AI builder is temporarily unavailable. Try the template gallery instead." |

### 4.6 Heart Rate-Based Adaptive Rest

The natural evolution of v2's display-only HR feature.

#### 4.6.1 Adaptive Rest Mode

| Feature | Detail |
|---------|--------|
| Configuration | Per-interval setting (only for rest intervals): "Wait until HR below [BPM]" with a number picker (default: 120 BPM) |
| Behavior | When the interval countdown reaches 0 but HR is still above threshold, the timer pauses and shows: "Recovering... 142 BPM ↓ [target: <120]". Timer resumes (or auto-advances) when HR drops below threshold |
| Timeout | Maximum wait time: configurable, default 5 minutes. If HR doesn't drop below threshold in time, auto-advance anyway with a notification |
| Requires | Apple Watch or connected Bluetooth HR monitor. Not available on phone-only sessions |
| Audio | Gentle rising tone plays when HR threshold is reached: "Heart rate recovered. Starting next interval." |

#### 4.6.2 Bluetooth HR Monitor Support

| Feature | Detail |
|---------|--------|
| Protocol | Standard BLE Heart Rate Profile (UUID 0x180D). Works with Polar H10, Garmin HRM-Pro, Wahoo TICKR, etc. |
| Pairing | Settings > Devices > "Connect HR Monitor". Standard BLE scan + pair flow |
| Library | `react-native-ble-plx` for BLE communication |
| Display | HR from external monitor shown on phone workout screen (same position as watch HR in v2, but from BLE device) |
| Priority | If both Apple Watch and BLE monitor are connected, prefer BLE monitor (more accurate chest strap data) |

### 4.7 Localization

v3 ships with multi-language support.

#### 4.7.1 Supported Languages

| Priority | Language | Reason |
|----------|----------|--------|
| 1 | English (default) | Base language |
| 2 | Spanish | Largest non-English fitness app market |
| 3 | Portuguese (Brazil) | Large and growing fitness culture |
| 4 | German | Strong gym culture, "Schlag" is a German word |
| 5 | Japanese | High smartphone fitness app adoption |
| 6 | Korean | Growing fitness tech market |
| 7 | French | Wide geographic coverage |
| 8 | Italian | Strong fitness culture |

#### 4.7.2 Implementation

| Feature | Detail |
|---------|--------|
| Framework | i18next + react-i18next (shared across RN and web) |
| TTS | expo-speech uses device locale by default. Supported in all target languages |
| AI builder | Accepts input in any supported language; generates sequences with translated interval names |
| User content | Sequence names, interval names, and notes are NOT translated — they are user-authored in whatever language the user writes them |
| Community gallery | Gallery shows sequences in all languages. Language tag on each published sequence for filtering |
| RTL | Not required in v3 (no Arabic/Hebrew in initial language set). Architecture should support it for future |

### 4.8 Advanced Accessibility

Building on v1's WCAG AA compliance.

#### 4.8.1 Haptic-Only Mode

| Feature | Detail |
|---------|--------|
| Setting | Settings > Accessibility > "Haptic-Only Mode" |
| Behavior | All audio cues are replaced with vibration patterns. On Apple Watch: rich Taptic Engine patterns. On phone: vibration motor patterns. On web: not available (no haptic API) |
| Patterns | Distinct patterns for: interval start (3 short pulses), countdown (rhythmic single pulses at T-3/T-2/T-1), interval end (long buzz), workout complete (celebratory pattern) |
| Use case | Deaf/hard-of-hearing athletes; also useful for early-morning home workouts where audio would disturb others |

#### 4.8.2 Colorblind-Safe Palette

| Feature | Detail |
|---------|--------|
| Setting | Settings > Accessibility > "Colorblind Mode" with options: Deuteranopia, Protanopia, Tritanopia |
| Effect | Replaces the 12-color interval palette with an alternative set optimized for the selected type |
| Additional | Interval color swatches gain a pattern overlay (stripes, dots, crosshatch) in addition to color — dual encoding |

#### 4.8.3 Dynamic Type & Font Scaling

| Feature | Detail |
|---------|--------|
| iOS | Full Dynamic Type support — all text scales with system font size setting |
| Android | Full sp-based font scaling |
| Web | Respects browser zoom and font size preferences |
| Workout screen | Countdown timer scales proportionally but caps at available width to prevent overflow |

---

## 5. Navigation Changes

### 5.1 Mobile (Bottom Tab Bar)

| Tab | Content | Change from v2 |
|-----|---------|-----------------|
| Home (Library) | Sequence library + Coach section (if connected to a coach) | Coach section added |
| Explore | Community gallery + search + following feed | **New tab** (replaces Templates, which moves into Explore) |
| History | Workout history + analytics | No change |
| Settings | All settings + Coach dashboard (if Coach account) | Coach dashboard added |

### 5.2 Web (Left Sidebar)

| Section | Content | Change from v2 |
|---------|---------|-----------------|
| My Sequences | Library | No change |
| From Coach | Sequences pushed by coach (if connected) | **New** |
| Explore | Community gallery | **New** |
| History | Workout history + analytics | No change |
| Running | Active workout | No change |
| Coach Dashboard | Client management, programming calendar (if Coach account) | **New** |
| Settings | All settings | No change |

---

## 6. Data Model Changes

### 6.1 New: SharedSequence

```
{
  id: uuid,
  sequence_id: uuid,        // reference to original sequence
  author_id: uuid,
  shortcode: string,         // unique 8-char code for URL
  is_published: boolean,     // true = visible in community gallery
  category: string,          // 'tabata' | 'emom' | 'amrap' | 'circuit' | 'strength' | 'mobility' | 'warmup' | 'custom'
  import_count: number,
  language: string,          // ISO 639-1 code
  created_at: timestamp,
  updated_at: timestamp
}
```

### 6.2 New: CoachClient

```
{
  id: uuid,
  coach_id: uuid,
  client_id: uuid,
  group_name: string | null,
  status: 'invited' | 'active' | 'disconnected',
  connected_at: timestamp,
  disconnected_at: timestamp | null
}
```

### 6.3 New: PushedWorkout

```
{
  id: uuid,
  coach_id: uuid,
  sequence_id: uuid,
  target_client_ids: uuid[],
  target_group: string | null,
  scheduled_for: timestamp | null,  // null = push immediately
  pushed_at: timestamp,
  completion_status: { [client_id]: 'pending' | 'completed' | 'partial' }
}
```

### 6.4 New: WorkoutRoom

```
{
  id: uuid,
  host_id: uuid,
  sequence_id: uuid,
  room_code: string,          // 6-char alphanumeric
  state: 'waiting' | 'running' | 'paused' | 'completed',
  current_interval_index: number,
  current_round: number,
  state_changed_at: timestamp, // server timestamp for sync
  participant_count: number,
  created_at: timestamp,
  expires_at: timestamp
}
```

### 6.5 New: AuthorProfile

```
{
  user_id: uuid,
  display_name: string,
  avatar_url: string | null,
  total_imports: number,
  published_count: number,
  follower_count: number
}
```

### 6.6 New: Follow

```
{
  follower_id: uuid,
  following_id: uuid,
  created_at: timestamp
}
```

---

## 7. Technical Architecture Changes

### 7.1 Supabase Realtime (Group Workouts)

- Room state broadcast via Supabase Realtime channels
- Channel name: `room:{room_code}`
- Host publishes state changes; participants subscribe
- Presence tracking for participant count
- Server-side timestamp used for sync reference (clients adjust for clock skew)

### 7.2 Share Links & Deep Linking

- **Web:** `schlag.app/s/{shortcode}` served by a Next.js or static page with OpenGraph meta tags for social previews
- **iOS:** Universal Links → app opens to import preview
- **Android:** App Links → same behavior
- **Link generation:** Supabase Edge Function generates shortcode and creates SharedSequence record

### 7.3 AI Sequence Builder

- **API:** Claude API via Supabase Edge Function (server-side to protect API key)
- **Model:** claude-haiku-4-5 for speed; claude-sonnet-4-6 for complex requests (auto-detected based on input length/complexity)
- **Schema:** Structured output matching Sequence JSON schema
- **Rate limiting:** 10 requests/day for free users, unlimited for Pro/Coach (enforced server-side)

### 7.4 Bluetooth HR

- `react-native-ble-plx` for BLE scanning and connection
- Heart Rate Measurement characteristic (0x2A37) for real-time HR data
- Background BLE reading requires explicit permissions (iOS: `NSBluetoothAlwaysUsageDescription`)

### 7.5 Localization Infrastructure

- `i18next` with JSON translation files per language
- Translation keys organized by feature area: `library.*`, `workout.*`, `settings.*`, `coach.*`
- Pluralization rules per language (i18next handles this natively)
- Date/time formatting via `Intl.DateTimeFormat` (web) and device locale (native)

### 7.6 Coach Subscription Billing

- iOS: StoreKit 2 auto-renewable subscription
- Android: Google Play Billing auto-renewable
- Web: Stripe subscription with customer portal for management
- Supabase Edge Function webhook validates receipts and updates coach status
- Grace period: 7 days past subscription expiry before coach features are disabled (clients keep received sequences)

---

## 8. Schlag Coach Pricing & Features

### 8.1 Pricing

| Plan | Price | Billing |
|------|-------|---------|
| Monthly | $9.99/mo | Auto-renewable |
| Annual | $79.99/yr ($6.67/mo effective) | Auto-renewable |
| Trial | 14-day free trial | Requires payment method |

### 8.2 What's Included

| Feature | Free | Pro ($6.99 one-time) | Coach ($9.99/mo) |
|---------|------|----------------------|-------------------|
| Everything in Pro | - | Yes | Yes |
| Client management (up to 50) | - | - | Yes |
| Push workouts to clients | - | - | Yes |
| Programming calendar | - | - | Yes |
| Client completion tracking | - | - | Yes |
| Share link analytics | - | - | Yes |
| Scheduled pushes | - | - | Yes |
| Priority support | - | - | Yes |

---

## 9. Out of Scope for v3

- Apple Watch / Wear OS standalone mode (watch still requires phone nearby for initial setup)
- Video demonstrations within intervals
- Rep-based or distance-based interval types
- Marketplace / paid sequences (all community content is free)
- Direct messaging between users
- Heart rate zones and training load calculations
- Integration with third-party programming platforms (TrainHeroic, TrueCoach)
- White-label / custom branding for gyms

---

## 10. Open Questions

| # | Question |
|---|----------|
| OQ-1 | Community gallery moderation at scale: at what point does manual review become unsustainable? Should we implement community flagging + auto-hide after N flags? |
| OQ-2 | Coach subscription pricing: $9.99/mo is low for B2B but accessible for independent trainers. Should there be a "Gym" tier at higher price for multi-coach accounts? |
| OQ-3 | AI sequence builder: should generated sequences automatically include a warm-up and cool-down unless the user says otherwise? |
| OQ-4 | Group workout room capacity: 30 is conservative. Supabase Realtime can handle more, but latency may increase. Need load testing |
| OQ-5 | Should the community gallery allow coaches to link their profile to attract clients? Risks making it feel like a marketplace |
| OQ-6 | Localization effort: should we use AI-assisted translation (faster, cheaper) or professional translators (higher quality)? Recommendation: AI-assisted with community review |
| OQ-7 | Bluetooth HR monitor support: should this be a Pro feature or available to all users? (Recommendation: available to all — it's an accessibility feature for adaptive rest) |

---

## 11. Phased Rollout Recommendation

v3 is the largest release. Consider shipping in sub-releases:

| Phase | Features | Timeline Estimate |
|-------|----------|-------------------|
| v3.0 | Sequence sharing (links + QR + share cards), community gallery, localization (top 4 languages) | 8-10 weeks |
| v3.1 | Coach mode (client management, push workouts, completion tracking) | 6-8 weeks |
| v3.2 | Group workouts (rooms, sync, TV display mode) | 6-8 weeks |
| v3.3 | AI sequence builder, adaptive HR rest, Bluetooth HR, remaining languages | 6-8 weeks |

This allows shipping value incrementally while each phase builds on the previous data model.

---

## 12. Migration & Compatibility

- v3 is additive to v2 — no breaking changes
- New Supabase tables: `shared_sequences`, `coach_clients`, `pushed_workouts`, `workout_rooms`, `author_profiles`, `follows`
- Existing sequences gain a "Share" button but are not automatically published
- Existing Pro users retain all Pro features; Coach is an additional subscription
- Users not interested in social/community features see zero change to their workflow — Explore tab is discoverable but not intrusive

---

*SCHLAG PRD v3.0 — End of Document — Draft*
