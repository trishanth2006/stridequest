/** @jsxImportSource react */
// ↑ NativeWind's global `jsxImportSource: 'nativewind'` routes elements through
// css-interop's runtime, which (on the pinned v0.1.22) drops the `ref` — so
// view-shot's capture target never attached and sharing threw
// "findNodeHandle failed to resolve view". This file must stay className-free
// (StyleSheet only) so overriding the JSX runtime back to React is safe.
import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Share, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { captureRef } from 'react-native-view-shot';
import { RunReplayMap } from '../components/RunReplayMap';
import { BadgeCard } from '../components/BadgeCard';
import { calculateBestEfforts } from '../utils/BestEffortsCalculator';
import type { GpsSample } from '@stridequest/shared/running';
import { colors, fonts, withAlpha } from '@/theme';

export interface RunRewards {
  xpAwarded: number;
  cellsClaimed: number;
  cellsStolen: number;
  questsCompleted: Array<{ questId: string; title: string | null; rewardXp: number }>;
}

export interface PostRunSummaryProps {
  samples: GpsSample[];
  totalDistanceMeters: number;
  movingTimeMs: number;
  averageSpeedMps: number;
  rewards?: RunRewards;
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

export const PostRunSummary: React.FC<PostRunSummaryProps> = ({
  samples,
  totalDistanceMeters,
  movingTimeMs,
  averageSpeedMps,
  rewards,
}) => {
  const viewRef = useRef<View>(null);

  const hasRewards =
    rewards !== undefined &&
    (rewards.xpAwarded > 0 ||
      rewards.cellsClaimed > 0 ||
      rewards.cellsStolen > 0 ||
      rewards.questsCompleted.length > 0);

  const bestEfforts = useMemo(() => {
    return calculateBestEfforts(samples);
  }, [samples]);

  const handleShare = async () => {
    try {
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
      });

      await Share.share({
        url: uri, 
        title: 'My StrideQuest Run',
        message: 'Check out my run on StrideQuest!',
      });
    } catch (error) {
      console.error('Failed to share route', error);
    }
  };

  return (
    <View style={styles.container} ref={viewRef}>
      <RunReplayMap routeCoordinates={samples.map(s => [s.lng, s.lat])} />

      {/* Hero Section */}
      <View style={styles.heroContainer}>
        <Text style={styles.heroTitle}>VICTORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroScroll}>
          {bestEfforts.map((effort, index) => (
             <BadgeCard 
                key={index}
                distanceLabel={effort.distanceLabel} 
                timeMs={effort.timeMs} 
                isPR={effort.isPR} 
             />
          ))}
        </ScrollView>
      </View>

      {/* Premium Glassmorphism Overlay */}
      <View style={styles.overlayContainer}>
        <BlurView intensity={80} tint="dark" style={styles.glassPanel}>
          <Text style={styles.title}>Run Analytics</Text>
          
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

          {hasRewards && rewards && (
            <View testID="run-rewards" style={styles.rewardsSection}>
              <View style={styles.rewardChipsRow}>
                {rewards.xpAwarded > 0 && (
                  <View style={[styles.rewardChip, styles.xpChip]}>
                    <Text style={styles.xpChipText}>⚡ +{rewards.xpAwarded} XP</Text>
                  </View>
                )}
                {rewards.cellsClaimed > 0 && (
                  <View style={styles.rewardChip}>
                    <Text style={styles.rewardChipText}>
                      🚩 {rewards.cellsClaimed} {rewards.cellsClaimed === 1 ? 'cell' : 'cells'} captured
                    </Text>
                  </View>
                )}
                {rewards.cellsStolen > 0 && (
                  <View style={styles.rewardChip}>
                    <Text style={styles.rewardChipText}>⚔️ {rewards.cellsStolen} stolen</Text>
                  </View>
                )}
              </View>
              {rewards.questsCompleted.map((quest) => (
                <View key={quest.questId} style={styles.questRow}>
                  <Text style={styles.questTitle} numberOfLines={1}>
                    🎯 {quest.title ?? 'Quest complete'}
                  </Text>
                  <Text style={styles.questXp}>+{quest.rewardXp} XP</Text>
                </View>
              ))}
            </View>
          )}

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
    backgroundColor: '#09090b', // neutral-900 / bgPrimary
  },
  heroContainer: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingLeft: 24,
    height: 192,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroScroll: {
    overflow: 'visible',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 48,
  },
  glassPanel: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
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
    fontSize: 26,
    fontFamily: fonts.display,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  rewardsSection: {
    marginTop: -8,
    marginBottom: 24,
    gap: 8,
  },
  rewardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rewardChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  rewardChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  xpChip: {
    backgroundColor: withAlpha(colors.primary, 0.18),
    borderColor: withAlpha(colors.primary, 0.4),
  },
  xpChipText: {
    color: colors.primaryBright,
    fontSize: 13,
    fontWeight: '800',
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: withAlpha(colors.accent, 0.1),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.25),
  },
  questTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  questXp: {
    color: colors.accentBright,
    fontSize: 13,
    fontWeight: '800',
  },
  shareButton: {
    backgroundColor: '#00FFFF',
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
