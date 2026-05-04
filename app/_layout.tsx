import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, Platform, StyleSheet } from 'react-native';

import { getTimerSession, clearTimerSession, getSequences, requestPersistentStorage, setStorageErrorHandler } from '@/lib/storage';
import { useSettingsStore } from '@/stores/settingsStore';
import { SpeechEngine } from '@/lib/audio/speechEngine';

SplashScreen.preventAutoHideAsync();

/** Max age of a saved session before it's considered stale (24 hours). */
const SESSION_STALE_MS = 24 * 60 * 60 * 1000;

export default function RootLayout() {
  const router = useRouter();
  const hasCheckedRestore = useRef(false);

  const [fontsLoaded] = useFonts({
    'JetBrainsMono-Bold': require('../assets/fonts/JetBrainsMono-Bold.ttf'),
  });

  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const selectedVoiceId = useSettingsStore((s) => s.settings.selectedVoiceId);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Ask the browser to keep localStorage data permanently (prevents Firefox eviction).
  // Show an alert if any storage write fails (quota exceeded, etc.).
  useEffect(() => {
    requestPersistentStorage();
    setStorageErrorHandler(({ message }) => {
      const text = `Could not save: ${message}. Your data may not persist.`;
      if (Platform.OS === 'web') {
        window.alert(text);
      } else {
        Alert.alert('Storage Error', text);
      }
    });
  }, []);

  // Hydrate global settings on cold start so prewarm and other launch-time
  // logic can read them. Idempotent — per-tab loadFromStorage calls remain
  // for safety but become no-ops after this runs.
  useEffect(() => {
    if (!useSettingsStore.getState().isLoaded) {
      useSettingsStore.getState().loadFromStorage();
    }
  }, []);

  // Pre-warm the TTS engine after settings hydrate, and re-prewarm whenever
  // the user picks a different voice. Cuts 50–300ms off the first countdown
  // beep of a workout. See docs/i18n-l10n-a11y-research.md §3.3.
  //
  // Web is skipped here because SpeechSynthesis requires a user gesture before
  // the first speak() will run; web prewarm fires from AudioEngine.unlockWebAudio
  // on the gesture that unlocks Web Audio.
  useEffect(() => {
    if (!settingsLoaded || Platform.OS === 'web') return;
    SpeechEngine.prewarm(selectedVoiceId);
  }, [settingsLoaded, selectedVoiceId]);

  // Check for a saved timer session on cold start and auto-navigate.
  useEffect(() => {
    if (!fontsLoaded || hasCheckedRestore.current) return;
    hasCheckedRestore.current = true;

    const saved = getTimerSession();
    if (!saved) return;

    // Discard stale sessions.
    if (Date.now() - saved.savedAt > SESSION_STALE_MS) {
      clearTimerSession();
      return;
    }

    // Only restore running/paused sessions.
    if (saved.state.status !== 'running' && saved.state.status !== 'paused') {
      clearTimerSession();
      return;
    }

    // Verify the sequence still exists in storage.
    const sequences = getSequences();
    const exists = sequences.some((s) => s.id === saved.sequenceId);
    if (!exists) {
      clearTimerSession();
      return;
    }

    // Navigate to the workout screen to resume.
    // Use setTimeout to ensure navigation is ready after initial render.
    setTimeout(() => {
      router.push(`/workout/${saved.sequenceId}` as any);
    }, 100);
  }, [fontsLoaded, router]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="builder/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="templates"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="workout/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
