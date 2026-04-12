// hooks/useCamera.ts

import { useRef } from 'react';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

export interface UseCameraWebOptions {
  enabled: boolean;
  facingMode: 'user' | 'environment';
  onLandmarks: (landmarks: NormalizedLandmark[]) => void;
}

export interface UseCameraWebReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

export function useCameraWeb(_options: UseCameraWebOptions): UseCameraWebReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  return { videoRef, isReady: false, error: null };
}
