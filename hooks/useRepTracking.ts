// hooks/useRepTracking.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { TimerTickData } from '@/types';
import type { ExerciseType } from '@/types/interval';
import type { NormalizedLandmark } from '@/lib/repTracking/types';
import { RepCounter } from '@/lib/repTracking/repCounter';
import { getProfileByType } from '@/lib/repTracking/exerciseProfiles';
import { useCameraWeb } from './useCamera';
import { useSettingsStore } from '@/stores/settingsStore';

export interface UseRepTrackingReturn {
  repCount: number;
  isTracking: boolean;
  isWebOnly: boolean;
  cameraError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showNoPoseHint: boolean;
}

const NO_POSE_HINT_THRESHOLD_MS = 5000;

export function useRepTracking(
  tickData: TimerTickData | null,
): UseRepTrackingReturn {
  const settings = useSettingsStore((s) => s.settings);
  const [repCount, setRepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [showNoPoseHint, setShowNoPoseHint] = useState(false);

  const counterRef = useRef<RepCounter | null>(null);
  const prevIntervalIndexRef = useRef<number>(-1);
  const noPoseTimerRef = useRef<number>(0);
  const hadPoseRef = useRef(false);

  // Determine if camera should be active
  const isWeb = Platform.OS === 'web';
  const exerciseType = tickData?.currentInterval?.exercise_type as ExerciseType | undefined;
  const isRestInterval = tickData?.isRestBetweenSets ?? true;
  const shouldTrack = isWeb && settings.cameraEnabled && !!exerciseType && !isRestInterval && tickData?.status === 'running';

  // Reset counter on interval change
  useEffect(() => {
    if (!tickData) return;
    const currentIndex = tickData.currentIntervalIndex;
    if (currentIndex !== prevIntervalIndexRef.current) {
      prevIntervalIndexRef.current = currentIndex;

      const profile = exerciseType ? getProfileByType(exerciseType) : null;
      if (profile) {
        counterRef.current = new RepCounter(profile);
      } else {
        counterRef.current = null;
      }
      setRepCount(0);
      setIsTracking(false);
      setShowNoPoseHint(false);
      hadPoseRef.current = false;
      noPoseTimerRef.current = 0;
    }
  }, [tickData, exerciseType]);

  // Landmark callback
  const onLandmarks = useCallback((landmarks: NormalizedLandmark[]) => {
    const counter = counterRef.current;
    if (!counter) return;

    const state = counter.processFrame(landmarks);
    setRepCount(state.repCount);
    setIsTracking(state.isTracking);

    if (state.isTracking) {
      hadPoseRef.current = true;
      noPoseTimerRef.current = 0;
      setShowNoPoseHint(false);
    } else if (hadPoseRef.current || noPoseTimerRef.current === 0) {
      noPoseTimerRef.current = noPoseTimerRef.current || Date.now();
      if (Date.now() - noPoseTimerRef.current > NO_POSE_HINT_THRESHOLD_MS) {
        setShowNoPoseHint(true);
      }
    }
  }, []);

  // Camera hook
  const { videoRef, isReady, error: cameraError } = useCameraWeb({
    enabled: shouldTrack,
    facingMode: settings.cameraPosition === 'back' ? 'environment' : 'user',
    onLandmarks,
  });

  return {
    repCount,
    isTracking: isTracking && isReady,
    isWebOnly: true,
    cameraError,
    videoRef,
    showNoPoseHint,
  };
}
