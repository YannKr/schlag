// hooks/useCamera.web.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@/lib/repTracking/types';

const FRAME_INTERVAL_MS = 1000 / 15; // 15fps

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface UseCameraWebOptions {
  enabled: boolean;
  processing: boolean;
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
  processing,
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
  const processingRef = useRef(processing);
  processingRef.current = processing;
  const activeStreamRef = useRef<MediaStream | null>(null);

  const initLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      try {
        // Try GPU first
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        landmarkerRef.current = landmarker;
        return landmarker;
      } catch {
        // Fallback to CPU
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        landmarkerRef.current = landmarker;
        return landmarker;
      }
    } catch (e) {
      setError('Rep tracking unavailable: model failed to load.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
        activeStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
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
        activeStreamRef.current = stream;
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); activeStreamRef.current = null; return; }

        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach(t => t.stop()); activeStreamRef.current = null; return; }
        video.srcObject = stream;
        await video.play();

        const landmarker = await initLandmarker();
        if (!landmarker || cancelled) return;
        setIsReady(true);

        function processFrame() {
          if (cancelled) return;
          animFrameRef.current = requestAnimationFrame(processFrame);

          if (!processingRef.current) return;

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
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
        activeStreamRef.current = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [enabled, facingMode, initLandmarker]);

  return { videoRef, isReady, error };
}
