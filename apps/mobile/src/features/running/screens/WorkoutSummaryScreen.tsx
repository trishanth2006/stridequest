import React, { useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Share } from 'react-native';
import { BlurView } from 'expo-blur';
import { captureRef } from 'react-native-view-shot';
import { RouteFlyoverMap } from '../components/RouteFlyoverMap';
import type { GpsSample } from '@stridequest/shared/running';

export interface WorkoutSummaryScreenProps {
  samples: GpsSample[];
  totalDistanceMeters: number;
  movingTimeMs: number;
  averageSpeedMps: number;
}

const formatDistance = (meters: number) => {
  return (meters / 1000).toFixed(2);
};

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (speedMps: number) => {
  if (!speedMps || speedMps <= 0) return "--:--";
  const paceMinutesPerKm = 1000 / (speedMps * 60);
  const m = Math.floor(paceMinutesPerKm);
  const s = Math.floor((paceMinutesPerKm - m) * 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
};

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({
  samples,
  totalDistanceMeters,
  movingTimeMs,
  averageSpeedMps,
}) => {
  const viewRef = useRef<View>(null);

  const handleShare = async () => {
    try {
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
      });

      await Share.share({
        url: uri, // iOS supports file URLs in Share. Android needs extra config sometimes
        title: 'My StrideQuest Run',
        message: 'Check out my run on StrideQuest!',
      });
    } catch (error) {
      console.error('Failed to share route', error);
    }
  };

  return (
    <View style={styles.container} ref={viewRef}>
      <RouteFlyoverMap samples={samples} />

      {/* Premium Glassmorphism Overlay */}
      <View style={styles.overlayContainer}>
        <BlurView intensity={80} tint="dark" style={styles.glassPanel}>
          <Text style={styles.title}>Victory Replay</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>
                {formatDistance(totalDistanceMeters)} <Text style={styles.statUnit}>km</Text>
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={styles.statValue}>
                {formatTime(movingTimeMs)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>AVG PACE</Text>
              <Text style={styles.statValue}>
                {formatPace(averageSpeedMps)}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share Route</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // True dark theme background
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 48, // Safe area approximation
  },
  glassPanel: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden', // Required for BlurView border radius
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 20, 20, 0.4)', // Heavy glassmorphism
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statBox: {
    alignItems: 'flex-start',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'], // Tabular numeral fonts
  },
  statUnit: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  shareButton: {
    backgroundColor: '#00FFFF', // Neon Cyan from the design language
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shareButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
