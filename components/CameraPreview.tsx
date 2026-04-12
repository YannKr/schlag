import React from 'react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  showNoPoseHint: boolean;
  visible: boolean;
  isMirrored?: boolean;
}

export function CameraPreview(_props: CameraPreviewProps) {
  return null;
}
