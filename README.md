# Schlag

A cross-platform interval training timer for gym and weightlifting athletes. Configurable work/rest sequences with audio cues and a distraction-free workout screen.

Free, no ads, no paywalls.

**[Try it on the web](https://schlag.ypk.sh)**

## Features

- Create custom interval sequences with named intervals, colors, and notes
- Precise countdown timer with absolute-time calculation (no drift)
- Audio cues: start beeps, 3-2-1 countdown, end tones, completion flourish
- Voice countdown via text-to-speech
- Three workout themes: dark, light, and interval-color tinted
- 10 built-in workout templates (Tabata, EMOM, AMRAP, strength, mobility)
- Workout history with streaks and analytics
- Export/import sequences as JSON
- Works fully offline — all data stored on-device

## Tech Stack

- **Framework**: React Native (Expo) with expo-router
- **Web**: react-native-web
- **State**: Zustand with MMKV persistence
- **Audio**: expo-av (native), Web Audio API (browser), expo-speech (TTS)
- **Testing**: Jest (unit), Playwright (E2E)

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm start

# Run on specific platforms
npm run web       # Web browser
npm run ios       # iOS simulator
npm run android   # Android emulator
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run web` | Start web dev server |
| `npm test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run build:web` | Build static web bundle |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Project Structure

```
app/              # Expo Router screens
  (tabs)/         # Tab navigation (Library, History, Settings)
  builder/        # Sequence editor
  workout/        # Workout timer screen
components/       # Reusable UI components
stores/           # Zustand state stores
lib/              # Core business logic (timer engine, audio engine, storage)
hooks/            # Custom React hooks
types/            # TypeScript type definitions
constants/        # Colors, typography, layout, defaults, templates
__tests__/        # Jest unit tests
e2e/              # Playwright E2E tests
```

## License

MIT
