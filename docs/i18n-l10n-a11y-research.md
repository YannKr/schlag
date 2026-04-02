# Internationalization, Localization & Accessibility Research Report
## Schlag Interval Training Timer -- v2/v3 Planning

**Date**: March 2026
**Scope**: Language prioritization, RTL support, TTS localization, accessibility beyond WCAG AA, cultural considerations
**Current State**: v1 is English-only, React Native (Expo), uses expo-speech for TTS countdown

---

## 1. High-Value Languages for Fitness Apps (Priority After English)

### Market Data and Rationale

The global fitness app market crossed $16B in revenue in 2024 and is projected to reach $25-30B by 2027. App download data from Sensor Tower, data.ai, and Statista consistently show these markets as the largest for health and fitness apps outside the Anglosphere:

| Priority | Language | Key Markets | Rationale |
|----------|----------|-------------|-----------|
| 1 | **Spanish** | Spain, Mexico, Colombia, Argentina, US Hispanic | ~580M native speakers. 2nd largest language globally. US Hispanic fitness market alone is enormous. Latin America is a high-growth mobile market. |
| 2 | **Portuguese** | Brazil, Portugal | ~260M speakers. Brazil is the #1 fitness market in Latin America and #2 globally for gym memberships per capita. |
| 3 | **German** | Germany, Austria, Switzerland | ~100M speakers. Germany is the largest fitness market in Europe by revenue. High purchasing power. App name "Schlag" is already German -- natural fit. |
| 4 | **Japanese** | Japan | ~125M speakers. Japan is the #2 app revenue market globally (iOS dominant). Very high ARPU. Strong gym culture. |
| 5 | **Korean** | South Korea | ~77M speakers. South Korea is a top-10 app revenue market. Rapidly growing fitness culture, especially among younger demographics (CrossFit, functional fitness boom). |
| 6 | **French** | France, Canada (Quebec), West/North Africa | ~320M speakers. France is a top-5 European fitness market. Francophone Africa is a long-term growth opportunity. |
| 7 | **Chinese (Simplified)** | China (if distribution allows), Singapore, Malaysia | ~1.1B speakers. Massive market but distribution challenges (no Google Play, Apple App Store is accessible). WeChat/domestic ecosystem dominance. Consider for v3 if App Store China is targeted. |
| 8 | **Arabic** | UAE, Saudi Arabia, Egypt, broader MENA | ~420M speakers. Gulf states have very high smartphone penetration and app spending. Fast-growing gym culture (Saudi Vision 2030 includes fitness infrastructure). Requires RTL support. |

### Recommended Phased Rollout

**v2 (Tier 1 -- highest ROI, LTR only)**:
- Spanish, Portuguese, German, French

**v3 (Tier 2 -- requires more complex script/layout support)**:
- Japanese, Korean (CJK typography considerations)
- Arabic (requires full RTL implementation)

### Why German Should Be Tier 1

Given the app name "Schlag" is literally a German word, there is a unique branding advantage. German-speaking users will immediately understand the name and perceive the app as made for them. This is a rare natural localization advantage that should be exploited early.

### Coverage Estimate

These 8 languages plus English cover approximately 75-80% of global fitness app revenue and 65-70% of downloads. The remaining long tail (Hindi, Turkish, Italian, Russian, Thai, Vietnamese, Indonesian) can be addressed in v4+ or via community translation.

---

## 2. RTL Layout Considerations for Fitness/Timer Apps

### Overview of RTL Impact

Arabic and Hebrew read right-to-left, which inverts the spatial logic of the entire UI. For a timer/workout app like Schlag, this creates specific challenges beyond typical text mirroring.

### 2.1 Countdown Timer Display

**Timers are NOT mirrored in RTL.** This is a critical principle:

- Numeric countdowns (e.g., "02:30") remain left-to-right even in RTL contexts. Arabic-Indic numerals (Eastern Arabic: ٢:٣٠) are read left-to-right. Western Arabic numerals (02:30) are also read left-to-right. The timer itself does NOT flip.
- **Implementation**: Wrap the countdown display in a `direction: ltr` container (or use React Native's `I18nManager.forceRTL` exclusion). The 72-96pt monospace countdown from Schlag's design spec should remain LTR regardless of locale.
- **Colon/separator alignment**: Monospace fonts handle this well. Ensure the colon in "MM:SS" does not shift position when using Arabic-Indic numerals.

### 2.2 Progress Bars

**Progress bars DO mirror in RTL.** This is unintuitive but correct:

- A progress bar that fills left-to-right in LTR should fill **right-to-left** in RTL. The "start" of the interval maps to the reading direction's start.
- Schlag's 12px height, rounded-end progress bar should animate from right to left in RTL.
- **Implementation**: Use `transform: scaleX(-1)` on the progress bar container in RTL, or use `flexDirection` which auto-mirrors with `I18nManager.isRTL`. Do NOT mirror the parent container -- mirror only the fill direction.
- **Exception**: Circular progress indicators (if you add them) do NOT change direction -- clockwise remains clockwise universally.

### 2.3 Drag-and-Drop Interval Lists

The vertical interval list in the Sequence Builder is largely unaffected by RTL for its ordering (top = first, bottom = last is universal). However:

- **Row content alignment flips**: Interval name, duration, color swatch, and drag handle all mirror horizontally. The drag handle moves from left to right side. The trash icon / swipe-to-delete direction may invert.
- **Swipe gestures**: Swipe-to-delete should be **swipe left-to-right** in RTL (opposite of LTR). This is because the "hidden action" is on the start side.
- **Reorder handle**: Move from left edge to right edge in RTL.

### 2.4 Navigation and Layout

- **Bottom tab bar**: Tab order mirrors. Home (rightmost), Active/Now (center), Settings (leftmost). Icons do NOT mirror (a gear icon is the same in both directions), but icon+label alignment flips.
- **Back button / navigation arrows**: Chevrons flip direction. A "back" arrow points right in RTL.
- **Workout screen**: The "Next" and "Previous" interval skip buttons swap sides or their arrow directions flip.

### 2.5 Specific Challenges for Schlag

| Component | RTL Behavior | Implementation Note |
|-----------|-------------|---------------------|
| Countdown digits (72-96pt) | LTR always | `writingDirection: 'ltr'` on the Text component |
| Interval name (32-40pt) | RTL text alignment | `textAlign: 'right'` or auto via I18nManager |
| Progress bar fill | Right-to-left fill | Mirror fill direction, not the bar shape |
| Interval color strip | Flips to right side of row | Handled by flexDirection auto-mirror |
| "+" add button | Moves to left side | Auto-mirrors with flex layout |
| Workout control buttons (Pause/Skip) | Center alignment, no change | Centered controls are RTL-safe |
| Settings toggles | Label on right, toggle on left | Auto-mirrors with flex layout |
| Duration picker (stepper) | Minus left, Plus right (no change) | Steppers are NOT mirrored by convention |

### 2.6 React Native RTL Implementation

React Native's `I18nManager` handles most mirroring automatically when `forceRTL(true)` is set:

```javascript
import { I18nManager } from 'react-native';

// Set based on locale
I18nManager.allowRTL(true);
I18nManager.forceRTL(isRTLLanguage);

// For components that must NOT mirror (timers, numbers):
<View style={{ direction: 'ltr' }}>
  <Text style={{ writingDirection: 'ltr' }}>{countdown}</Text>
</View>
```

Expo supports RTL layouts natively. The main development cost is testing every screen in RTL mode and adding LTR overrides for numeric/timer elements.

### 2.7 Common RTL Pitfalls

1. **Hardcoded `marginLeft` / `paddingRight`**: Use `marginStart` / `paddingEnd` instead (logical properties).
2. **Absolute positioning with `left`/`right`**: Use `start`/`end` instead.
3. **Icons with directional meaning**: Arrows, play/forward icons need conditional mirroring. Play button triangle does NOT flip (universal symbol).
4. **String concatenation with mixed directions**: "Next: [Arabic interval name]" can cause reordering bugs. Use Unicode directional markers or separate Text components.
5. **Animations with hardcoded X translations**: `translateX(-100)` needs to become `translateX(100)` in RTL.

---

## 3. TTS / Voice Countdown Localization

### 3.1 Current Architecture (v1)

Schlag v1 uses `expo-speech` (which wraps AVSpeechSynthesizer on iOS and Android TTS on Android) for English countdown: "3... 2... 1..." and "Next: [interval name]."

### 3.2 Platform TTS Engine Language Support

**Apple AVSpeechSynthesizer (iOS/macOS)**:
- Supports 60+ languages and regional variants
- All Tier 1 languages covered: English, Spanish, Portuguese, German, French
- All Tier 2 languages covered: Japanese, Korean, Arabic, Chinese
- Multiple voices per language (enhanced/premium voices available via on-device download)
- Arabic TTS quality is good (both MSA and regional variants)
- Japanese and Korean quality is excellent
- Latency: ~50-150ms from speak() call to audio output (relevant for countdown timing)

**Android TextToSpeech (Google TTS)**:
- Supports 60+ languages via Google TTS engine (pre-installed on most devices)
- Samsung, Huawei, Xiaomi devices may have alternative default TTS engines with different language support
- Quality varies more than iOS across devices and manufacturers
- Network-dependent enhanced voices available on some devices

**expo-speech API**:
- Wraps both platform APIs with a unified interface
- `Speech.speak(text, { language: 'es-ES', rate: 1.0 })`
- Supports language/locale specification
- Supports rate, pitch, and voice selection
- Does NOT require internet (uses on-device voices)

### 3.3 Challenges for Multilingual Countdown TTS

#### Challenge 1: Number Pronunciation Varies

Numbers are not simply translatable -- they have grammatical context:

| Language | "3... 2... 1..." | Notes |
|----------|-----------------|-------|
| English | "Three... Two... One..." | Simple |
| Spanish | "Tres... Dos... Uno/Una..." | Gendered: "uno" (masc) vs "una" (fem). For a countdown, "uno" is standard. |
| German | "Drei... Zwei... Eins..." | "Eins" not "Ein" when counting standalone |
| French | "Trois... Deux... Un/Une..." | Gendered similarly to Spanish |
| Japanese | "San... Ni... Ichi..." | Multiple counting systems exist (native Japanese vs Sino-Japanese). "San, ni, ichi" is the standard for countdowns. |
| Korean | "Sam... I... Il..." or "Set... Dul... Hana..." | Sino-Korean (sam, i, il) for formal; Native Korean (set, dul, hana) for informal. Fitness contexts typically use native Korean. |
| Arabic | "Thalatha... Ithnan... Wahid..." | Right-to-left text but spoken linearly. Standard for countdowns. |
| Portuguese | "Tres... Dois... Um/Uma..." | Gendered |

**Recommendation**: Use pre-recorded audio snippets for countdown numbers rather than TTS. This guarantees correct pronunciation, consistent timing, and eliminates the TTS latency problem. TTS should be reserved for dynamic content (interval names).

#### Challenge 2: "Next: [Interval Name]" Announcement

The phrase structure "Next: Rest" varies significantly:

| Language | "Next: Rest" | Structure |
|----------|-------------|-----------|
| English | "Next: Rest" | [Label]: [Name] |
| Spanish | "Siguiente: Descanso" | Same structure |
| German | "Naechstes: Pause" | Grammatical gender of the interval name could affect the adjective |
| Japanese | "Tsugi: Kyuukei" (次: 休憩) | Same structure works |
| Arabic | "At-tali: Raha" (التالي: راحة) | Same structure, but spoken right-to-left is natural |
| Korean | "Da-eum: Hyusik" (다음: 휴식) | Same structure works |

**Recommendation**: Keep the announcement structure simple. "[NextWord]: [IntervalName]" works across most languages. Provide the translated word for "Next" in the localization bundle, and use TTS to speak the full string.

#### Challenge 3: TTS Latency and Countdown Timing

This is the most critical challenge for a timer app:

- TTS engines have variable startup latency (50-300ms depending on device, language, and whether the voice is loaded)
- Schlag's design already pre-fires audio cues ~50ms ahead to compensate
- TTS latency is less predictable than beep generation
- Different languages have different word lengths, meaning "Three" takes longer to speak than "One"

**Mitigation strategies**:
1. **Pre-warm the TTS engine**: Call `Speech.speak('')` silently on app launch for the selected language to load the voice into memory.
2. **Use pre-recorded audio for countdown numbers**: Eliminates latency variability entirely. Record "3", "2", "1" in each supported language. Total: 3 files x 8 languages = 24 audio files (~50KB total).
3. **Reserve TTS for interval name announcements only**: These occur at interval transitions, where 100-200ms of latency is acceptable.
4. **Provide a "voice countdown" vs "beep countdown" toggle per language**: Some languages may have poor TTS quality on certain devices, so users should be able to fall back to beeps.

#### Challenge 4: Voice Quality Across Devices

- iOS: Consistently high quality across all supported languages.
- Android: Quality varies significantly. Samsung devices with Samsung TTS may sound different from Google Pixel with Google TTS. Budget Android phones may have very poor TTS.
- **Recommendation**: Offer a "Test Voice" button in settings that speaks a sample countdown in the selected language so users can evaluate quality.

### 3.4 Alternative: Pre-Recorded Audio Bundles

Instead of relying on TTS for everything, consider a hybrid approach:

| Content | Method | Rationale |
|---------|--------|-----------|
| "3... 2... 1..." countdown | Pre-recorded audio | Timing-critical, short, finite set |
| "Next: [name]" announcement | TTS | Dynamic content (user-defined interval names) |
| Workout complete flourish | Synthesized/recorded | Universal, no localization needed |
| Beeps and clicks | Synthesized | Universal |

Pre-recorded countdown audio per language adds ~200KB to the app bundle (24 short audio files). This is negligible.

---

## 4. Accessibility Beyond WCAG AA

### 4.1 Haptic-Only Mode (Deaf/Hard of Hearing)

**Why it matters**: Approximately 15% of the world's population has some degree of hearing loss. Fitness environments (gyms, outdoor running) are inherently noisy, making audio cues unreliable even for hearing users.

**Implementation for Schlag**:

| Event | Haptic Pattern | iOS API | Android API |
|-------|---------------|---------|-------------|
| Interval start | Single strong tap | `.heavy` impact | `VibrationEffect.createOneShot(100, 255)` |
| T-3 countdown | Triple light taps | `.light` x3, 500ms interval | `VibrationEffect.createWaveform([0,50,500,50,500,50])` |
| T-2 | Double light taps | `.light` x2 | Adjusted waveform |
| T-1 | Single medium tap | `.medium` | Medium amplitude |
| Interval end (T=0) | Strong double tap | `.rigid` x2 | Strong waveform |
| Workout complete | Extended pattern (SOS-like) | Custom pattern | Extended waveform |
| Pause/Resume | Subtle selection tap | `.selection` | Low amplitude short |

**Platform considerations**:
- iOS: `UIImpactFeedbackGenerator`, `UINotificationFeedbackGenerator` via `expo-haptics`
- Android: `VibrationEffect` API (Android 8.0+). Older devices only support on/off vibration.
- Apple Watch: Haptic patterns are significantly more expressive (Taptic Engine). Consider WatchOS companion in v3.
- Web: `navigator.vibrate()` API exists but is poorly supported (Chrome Android only, no iOS Safari).

**UX design**:
- Add a "Haptic Mode" toggle in Settings, separate from audio controls
- Allow haptic AND audio simultaneously (most useful combo for gym environments)
- Provide a "Test Haptics" button so users can feel the patterns
- Consider haptic intensity preference (Low/Medium/Strong)

**Apps doing this well**: Apple Fitness+, Peloton, and Seconds Interval Timer all offer haptic feedback for interval transitions. Nike Run Club uses haptic-only mode for pace alerts.

### 4.2 High Contrast Modes

Schlag's dark workout screen (#1A1A2E background) is already reasonable for contrast, but:

**Enhanced high contrast mode should provide**:
- White text on pure black (#000000) background (OLED-friendly, maximum contrast)
- Remove the 20% opacity color tint overlay entirely
- Increase text border/outline for the countdown timer
- Use a 4px white progress bar border for visibility
- Minimum contrast ratio of 7:1 (WCAG AAA) instead of 4.5:1 (AA)

**Platform integration**:
- iOS: Respond to `UIAccessibility.isInvertColorsEnabled` and `UIAccessibility.isDarkerSystemColorsEnabled`
- Android: Respond to `Settings.Secure.ACCESSIBILITY_HIGH_TEXT_CONTRAST_ENABLED`
- React Native: `AccessibilityInfo.isHighTextContrastEnabled()` (Android), monitor system changes

**Implementation notes**:
- The 12 interval colors should have high-contrast alternatives (see Section 4.5)
- In high contrast mode, replace color-coding with patterns or labels as the primary differentiator
- Ensure the interval color swatch in the builder list has a visible border (not just a filled rectangle)

### 4.3 Dynamic Type / Font Scaling

**This is critical for Schlag** because the countdown timer uses 72-96pt text. If a user has system font scaling at 200%, that becomes 144-192pt, which may overflow.

**Strategy**:
- **Countdown timer**: Set a maximum scaled size. Use `maxFontSizeMultiplier` prop in React Native (e.g., `maxFontSizeMultiplier={1.3}`). The timer must never overflow its container or wrap.
- **Interval names on workout screen** (32-40pt): Allow scaling up to 1.5x but truncate with ellipsis if needed.
- **Builder/settings UI**: Allow full dynamic type scaling. Use `allowFontScaling={true}` (default in RN).
- **Minimum touch target**: Already at 44px (Apple HIG minimum). Ensure this remains 44px even at small font scales.

**Testing**:
- iOS: Test at all 12 Dynamic Type sizes (xSmall through AX5)
- Android: Test at system font scale 0.85x through 2.0x
- Key test case: AX5 (largest accessibility size) + long interval name + RTL language

**React Native specifics**:
```javascript
// Allow scaling for body text
<Text allowFontScaling={true}>{intervalName}</Text>

// Cap scaling for the countdown display
<Text
  allowFontScaling={true}
  maxFontSizeMultiplier={1.3}
  style={{ fontSize: 84 }}
>
  {formattedTime}
</Text>
```

### 4.4 Screen Reader Workout Experience

This is the most complex accessibility challenge for a timer app. The workout screen is highly visual and time-based -- two things that conflict with screen reader interaction.

**Current VoiceOver/TalkBack issues with typical timer apps**:
1. Screen readers announce every UI update, creating a flood of announcements during a workout
2. Timer countdown updates every second would overwhelm the screen reader
3. Touch exploration during a workout is impractical (users may be holding weights, running, etc.)
4. Standard screen reader gestures conflict with quick pause/resume needs

**Recommended screen reader workout experience**:

1. **On workout start, announce**: "Workout started. [Sequence name]. First interval: [name], [duration]. Tap anywhere to pause."

2. **During intervals, announce only**:
   - Interval transitions: "Rest. 60 seconds."
   - Countdown at T-10 and T-3: "10 seconds remaining" ... "3, 2, 1"
   - Do NOT announce every second of the countdown

3. **Simplified gestures during workout**:
   - Single tap anywhere: Pause/Resume
   - Double tap: Skip to next interval
   - Three-finger tap: End workout
   - These should be announced when the workout screen opens

4. **Custom rotor actions** (iOS VoiceOver):
   - "Current interval" -- speaks the interval name and remaining time
   - "Workout progress" -- speaks "Interval 3 of 8, Set 2 of 4"
   - "Skip interval" -- jumps to next

5. **Accessibility announcements** (not element focus changes):
   ```javascript
   import { AccessibilityInfo } from 'react-native';

   // Use announcements instead of live region updates for time-critical info
   AccessibilityInfo.announceForAccessibility('Next interval: Heavy Bag. 3 minutes.');
   ```

6. **Reduce announcements preference**: Respect `UIAccessibility.isReduceMotionEnabled` to also reduce the frequency of spoken updates.

**Apps with good screen reader support**: Apple's native Timer app, Workout app on WatchOS. Most third-party fitness timers have poor screen reader support, which is an opportunity for Schlag to differentiate.

### 4.5 Colorblind-Safe Interval Color Palette

Schlag's current 12 interval colors were designed for visual appeal but likely have colorblind accessibility issues. Approximately 8% of males and 0.5% of females have some form of color vision deficiency.

**Current palette analysis**:

| Color | Hex | Issue for Colorblind Users |
|-------|-----|---------------------------|
| Red #E63946 | | Protanopia: appears dark/brown |
| Orange #F4722B | | Deuteranopia: hard to distinguish from Red |
| Yellow #F6AE2D | | Generally safe |
| Green #2DC653 | | Protanopia/Deuteranopia: confused with Yellow/Brown |
| Teal #00B4D8 | | Generally safe |
| Blue #2563EB | | Generally safe |
| Indigo #4338CA | | Generally safe |
| Violet #7C3AED | | Tritanopia: confused with Blue |
| Pink #DB2777 | | Protanopia: confused with Blue/Gray |
| Slate #475569 | | Generally safe |
| Zinc #71717A | | May be confused with Slate |
| Off-White #E2E8F0 | | Generally safe |

**Red-Green confusion** (protanopia and deuteranopia, ~6% of males) is the biggest issue. Red, Orange, and Green may all appear as similar brownish-yellow tones.

**Recommended solutions**:

1. **Never rely on color alone**: Always pair interval colors with the interval NAME displayed prominently. Schlag already does this on the workout screen (32-40pt text).

2. **Add optional patterns/textures**: In an accessibility mode, overlay subtle patterns (stripes, dots, crosshatch) on color swatches so intervals are distinguishable without color perception.

3. **Provide a colorblind-optimized palette** (alternative palette option):

| Slot | Default | Colorblind-Safe Alternative | Notes |
|------|---------|---------------------------|-------|
| 1 | Red #E63946 | Vermillion #E64B35 | Optimized to separate from green |
| 2 | Orange #F4722B | Orange #F0A030 | Shifted yellower |
| 3 | Yellow #F6AE2D | Yellow #F6E626 | Brighter, more distinct |
| 4 | Green #2DC653 | Bluish Green #00A676 | Shifted to cyan-green, distinct from red for deuteranopes |
| 5 | Teal #00B4D8 | Sky Blue #56B4E9 | Standard colorblind-safe blue |
| 6 | Blue #2563EB | Blue #0072B2 | Wong palette blue |
| 7 | Indigo #4338CA | Dark Blue #332288 | Distinct from other blues |
| 8 | Violet #7C3AED | Reddish Purple #CC79A7 | Wong palette, distinct for tritanopia |
| 9 | Pink #DB2777 | Pink #D55E00 | Shifted to orange-red |
| 10 | Slate #475569 | Dark Gray #44AA99 | Teal-gray hybrid |
| 11 | Zinc #71717A | Medium Gray #999933 | Olive-gray hybrid |
| 12 | Off-White #E2E8F0 | Light #DDCC77 | Warm off-white |

The above incorporates elements from the **Wong color palette** and **Okabe-Ito palette**, which are specifically designed for color vision deficiency accessibility.

4. **Implement a colorblind simulation mode** in settings: Let users preview how their intervals look under protanopia, deuteranopia, and tritanopia filters. This helps all users choose distinguishable colors.

5. **Semantic color names**: In the color picker, show names ("Vermillion", "Sky Blue") rather than just swatches, so users can communicate about intervals verbally.

### 4.6 Reduced Motion Alternatives

Schlag's v1 includes several animations:
- Progress bar 60fps fill animation
- Screen transitions
- Interval color transitions
- Drag-and-drop reorder animations
- Countdown number changes

**When `prefers-reduced-motion` / `UIAccessibility.isReduceMotionEnabled` is active**:

| Animation | Default | Reduced Motion Alternative |
|-----------|---------|--------------------------|
| Progress bar fill | 60fps smooth animation | Stepped fill (updates every 5 seconds in discrete jumps) |
| Color transitions | Crossfade between interval colors | Instant color switch, no transition |
| Screen transitions | Slide/fade transitions | Instant cut, no animation |
| Drag-and-drop | Smooth item repositioning | Instant snap to new position |
| Countdown update | Number cross-fade/scale | Simple text replacement, no animation |
| Workout complete | Multi-tone flourish with visual fanfare | Static completion screen, simple vibration |

**React Native implementation**:
```javascript
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    setReduceMotion
  );
  return () => sub.remove();
}, []);

// Use in animations:
const duration = reduceMotion ? 0 : 300;
```

### 4.7 Additional Accessibility Features to Consider

Beyond the listed areas, leading fitness apps in 2025 are also implementing:

1. **Voice Control / Hands-Free Operation**: Gym users often cannot touch their phone. "Hey Siri, pause my timer" or in-app voice commands for pause/resume/skip. Expo does not natively support this, but iOS Shortcuts integration could enable it.

2. **Switch Control Compatibility**: Users with motor disabilities using external switches. Ensure all interactive elements are focusable and activatable.

3. **Cognitive Accessibility**:
   - Simple mode with fewer options and larger buttons
   - Consistent, predictable UI patterns
   - Clear, jargon-free language (avoid "AMRAP", "EMOM" without explanation)
   - Maximum 3-step flows for any action

4. **Audio Descriptions**: For any instructional content or workout previews, provide audio descriptions of the visual sequence layout.

5. **Adjustable Timing**: WCAG 2.2.1 requires that users can extend or disable time limits. For a timer app, this manifests as: generous auto-pause timeouts, no auto-dismiss notifications, and pause-able countdowns (already supported).

---

## 5. Cultural Considerations for Workout Timers

### 5.1 Regional Training Methodology Differences

Different regions have strong preferences for specific training styles, which affects how timer apps are used:

| Region | Dominant Training Styles | Timer Implications |
|--------|------------------------|-------------------|
| **USA** | CrossFit, HIIT, functional fitness, bodybuilding splits | AMRAP timers, EMOM timers, Tabata. Short intense intervals (20s work / 10s rest). Complex multi-interval sequences. |
| **Brazil** | Bodybuilding (culturally dominant), functional training, CrossFit | Longer rest periods (60-120s between sets). Set-based timers more than interval-based. Music integration is critical. |
| **Germany/Austria** | Bodybuilding, powerlifting, functional fitness | Precise timing, structured programs. German fitness culture values efficiency and precision -- the timer accuracy matters more here. |
| **Japan** | Bodybuilding, martial arts (Judo, Karate), functional training | Round-based timers (3-5 min rounds for martial arts). Karate/Judo kata timing. Quieter gym culture -- haptic/visual cues may be preferred over audio. |
| **South Korea** | CrossFit (massive adoption), Pilates, functional fitness | CrossFit-style timers. "For Time" and "AMRAP" modes. Social/competitive elements valued. |
| **Middle East (Gulf)** | Bodybuilding, CrossFit, personal training | Prayer time awareness (5 daily prayers may interrupt workouts). Ramadan considerations: training schedules shift dramatically during fasting month. Gender-separated gym culture affects social features (not relevant for Schlag v1-v2). |
| **France** | Bodybuilding, running, cycling, Pilates | Less CrossFit penetration. More traditional rest-timer usage. Metric units universal (already standard for time). |
| **Spain/Latin America** | CrossFit, functional training, soccer conditioning | Group training culture. Social/sharing features valued. Workout times often later in the day (9-11 PM gym culture in Spain). |

### 5.2 Naming and Terminology

**Interval terminology varies by region**:

| English Term | Consideration |
|-------------|---------------|
| "Work" / "Rest" | Universal concepts, translate directly. |
| "AMRAP" | American CrossFit acronym. Not widely understood outside CrossFit communities. Spell out or localize the concept. |
| "EMOM" | Same as AMRAP -- CrossFit-specific. |
| "Tabata" | Japanese origin, used globally in its original form. Do NOT translate. |
| "Set" / "Rep" | Universal in gym contexts, but the words vary by language. |
| "Round" | Martial arts / boxing terminology. Universal concept. |
| "Circuit" | Common in British/Australian English. "Circuito" in Spanish/Portuguese. |

**Recommendation**: Use generic terms ("Work", "Rest", "Interval") as defaults and provide specialized templates (Tabata, EMOM, AMRAP) with both the original term and localized explanation.

### 5.3 Number and Time Format Conventions

| Convention | Markets | Notes |
|-----------|---------|-------|
| 12-hour time | USA, some Latin American countries | For scheduling features in future versions |
| 24-hour time | Europe, Japan, Korea, most of the world | Default for non-US locales |
| Comma as decimal separator | Germany, France, Spain, Brazil, most of Europe | "2,5 seconds" not "2.5 seconds" |
| Period as decimal separator | USA, UK, Japan, Korea | "2.5 seconds" |
| Day/Month/Year date format | Most of the world | For workout history in future versions |
| Month/Day/Year | USA only | US locale only |

For Schlag specifically, since the timer displays MM:SS or HH:MM:SS, the colon separator is universal and not affected by locale. But any decimal display of seconds (if implemented) needs locale-aware formatting.

### 5.4 Sound and Audio Cultural Preferences

- **Japan**: Gym culture is quieter. Many gyms prohibit phone audio. Haptic and visual cues may be the primary interaction mode. Default volume should be lower.
- **Brazil**: Music is integral to workout culture. Timer audio cues need to be audible over loud music. Consider higher default volume or option to duck music during announcements.
- **Middle East**: The adhan (call to prayer) may play during workouts. The app should not fight for audio priority during these times. No specific technical implementation needed, but awareness in UX copy is respectful.
- **USA/Europe**: Earbuds/headphones are standard gym equipment. Audio cues should be optimized for in-ear delivery (not tinny phone speakers).

### 5.5 Calendar and Scheduling Considerations (for future versions)

- **Islamic calendar**: Relevant for Ramadan-aware features in Middle Eastern markets. Training schedules shift to pre-dawn (Suhur) and post-sunset (Iftar) during Ramadan.
- **Rest day conventions**: Friday is the rest day in many Muslim-majority countries. Saturday in Israel. Sunday in Christian-majority countries. Affects "recommended rest day" features if ever implemented.
- **Seasonal patterns**: Northern hemisphere summer = peak outdoor training. Southern hemisphere (Brazil, Australia) has opposite seasons. Affects push notification timing for workout reminders.

### 5.6 Metric vs Imperial

Not directly relevant to Schlag v1 (which only uses time), but if weight-tracking or distance features are added:
- USA, Liberia, Myanmar: Imperial (pounds, miles)
- Rest of the world: Metric (kilograms, kilometers)
- UK: Mixed (stones/pounds for body weight, miles for distance, but kilograms for lifting)

---

## 6. Implementation Roadmap Recommendation

### v2 (Localization Foundation + Core Accessibility)

**Localization**:
- [ ] Extract all strings to i18n framework (react-i18next or expo-localization + i18n-js)
- [ ] Implement string externalization for all user-facing text
- [ ] Add language selector in Settings (with system language auto-detection)
- [ ] Translate to: Spanish, Portuguese, German, French
- [ ] Pre-recorded countdown audio for 5 languages (EN, ES, PT, DE, FR)
- [ ] Locale-aware number formatting

**Accessibility**:
- [ ] Haptic feedback for all timer events (parallel to audio, independently toggleable)
- [ ] Dynamic Type support with maxFontSizeMultiplier on countdown
- [ ] Reduced motion support (respond to system preference)
- [ ] Screen reader workout experience (custom announcements, simplified gestures)
- [ ] High contrast mode toggle
- [ ] Minimum WCAG AA compliance audit across all screens

### v3 (RTL + CJK + Advanced Accessibility)

**Localization**:
- [ ] Full RTL layout support (I18nManager + logical properties)
- [ ] Arabic and Hebrew translations
- [ ] Japanese and Korean translations (CJK typography handling)
- [ ] CJK font fallback chain
- [ ] RTL-aware progress bar, swipe gestures, navigation
- [ ] Per-language TTS voice selection and testing

**Accessibility**:
- [ ] Colorblind-safe alternative palette option
- [ ] Pattern overlays for interval color differentiation
- [ ] Voice control integration (iOS Shortcuts, Android voice commands)
- [ ] Cognitive accessibility mode (simplified UI)
- [ ] Switch control compatibility audit
- [ ] Accessibility statement / documentation in-app

---

## 7. Key Takeaways

1. **German should be your first translation** -- the app name is literally German, giving you a unique branding advantage in that market.

2. **Pre-record countdown numbers** rather than relying on TTS. This solves timing, quality, and pronunciation issues in one move. Use TTS only for dynamic content (interval names).

3. **Haptic feedback is not just an accessibility feature** -- it is a core UX improvement for ALL users in noisy gym environments. Implement it for v2, not as an accessibility afterthought.

4. **RTL support is a v3 concern** unless you see significant demand from Arabic markets early. The implementation cost is non-trivial and should be done thoroughly rather than rushed.

5. **Never rely on color alone** for interval differentiation. Schlag already uses text labels prominently, which is the right foundation. Add optional patterns for full colorblind support.

6. **Screen reader workout mode needs custom UX** -- it cannot be an afterthought bolted onto the visual UI. Design it as a distinct interaction mode with its own announcement cadence and gesture set.

7. **Cultural differences in gym culture** (especially Japan's quiet gyms and Brazil's music-driven workouts) affect default settings. Consider locale-aware defaults for audio volume and haptic intensity.
