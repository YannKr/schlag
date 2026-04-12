import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  showNoPoseHint: boolean;
  repCount: number;
  visible: boolean;
}

export function CameraPreview({
  videoRef,
  isTracking,
  showNoPoseHint,
  repCount,
  visible,
}: CameraPreviewProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 12,
          transform: 'scaleX(-1)',
        }}
        playsInline
        muted
        autoPlay
      />
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {showNoPoseHint
            ? 'Position camera'
            : isTracking
              ? `${repCount} reps`
              : 'Starting...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00ff88',
  },
});
