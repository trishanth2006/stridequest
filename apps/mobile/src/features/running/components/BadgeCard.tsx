import React from 'react';
import { View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '@stridequest/shared/running';

export interface BadgeCardProps {
  distanceLabel: string;
  timeMs: number;
  isPR?: boolean;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ distanceLabel, timeMs, isPR }) => {
  return (
    <View className={`rounded-2xl overflow-hidden mr-4 w-40 ${isPR ? 'border-2 border-amber-400/80 shadow-lg shadow-amber-500/20' : 'border border-white/10'}`}>
      <BlurView intensity={isPR ? 60 : 40} tint="dark" className="p-4 items-center h-full w-full bg-black/40">
        <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${isPR ? 'bg-amber-500/20' : 'bg-white/10'}`}>
          <Ionicons 
            name={isPR ? 'trophy' : 'timer-outline'} 
            size={24} 
            color={isPR ? '#fbbf24' : 'rgba(255,255,255,0.7)'} 
          />
        </View>
        <Text className={`text-2xl font-bold font-tabular-nums ${isPR ? 'text-amber-400' : 'text-white'}`}>
          {formatDuration(Math.floor(timeMs / 1000))}
        </Text>
        <Text className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">
          {distanceLabel} {isPR && 'PR'}
        </Text>
      </BlurView>
    </View>
  );
};
