// hooks/useCamera.web.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

const FRAME_INTERVAL_MS = 1000 / 15; // 15fps

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

export function useCameraWeb({
  enabled,
  facingMode,
  onLandmarks,
}: UseCameraWebOptions): UseCameraWebReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastProcessedRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  const initLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (e) {
      setError('Rep tracking unavailable: model failed to load.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      setIsReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const landmarker = await initLandmarker();
        if (!landmarker || cancelled) return;
        setIsReady(true);

        function processFrame() {
          if (cancelled) return;
          animFrameRef.current = requestAnimationFrame(processFrame);

          const now = performance.now();
          if (now - lastProcessedRef.current < FRAME_INTERVAL_MS) return;
          lastProcessedRef.current = now;

          const video = videoRef.current;
          const landmarker = landmarkerRef.current;
          if (!video || !landmarker || video.readyState < 2) return;

          try {
            const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now);
            if (result.landmarks && result.landmarks.length > 0) {
              const landmarks: NormalizedLandmark[] = result.landmarks[0].map(
                (lm, i) => ({
                  x: lm.x,
                  y: lm.y,
                  z: lm.z,
                  visibility: result.landmarks[0][i].visibility ?? 0,
                }),
              );
              onLandmarksRef.current(landmarks);
            }
          } catch {
            // Frame processing error — skip silently
          }
        }
        processFrame();
      } catch (e) {
        if (!cancelled) setError('Camera access denied.');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [enabled, facingMode, initLandmarker]);

  return { videoRef, isReady, error };
}
