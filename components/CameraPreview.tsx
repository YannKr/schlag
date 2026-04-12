import React from 'react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  showNoPoseHint: boolean;
  repCount: number;
  visible: boolean;
}

export function CameraPreview(_props: CameraPreviewProps) {
  return null;
}
