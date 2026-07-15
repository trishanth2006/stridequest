import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { WorkoutTarget, WorkoutType } from '../types/workout';
import { DEFAULT_WORKOUTS } from '../constants/defaultWorkouts';

interface WorkoutSelectorProps {
  onStartWorkout: (config: WorkoutTarget) => void;
  disabled?: boolean;
}

const WORKOUT_TYPES: { label: string; value: WorkoutType }[] = [
  { label: 'Quick Run', value: 'QUICK_RUN' },
  { label: 'Easy', value: 'EASY' },
  { label: 'Long', value: 'LONG' },
  { label: 'Interval', value: 'INTERVAL' },
];

const parsePaceToSeconds = (paceStr: string): number => {
  if (!paceStr) return 0;
  const parts = paceStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(paceStr, 10) || 0;
};

const formatSecondsToPace = (secs: number | undefined): string => {
  if (!secs) return '';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
};

export const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({ onStartWorkout, disabled = false }) => {
  const [selectedType, setSelectedType] = useState<WorkoutType>('QUICK_RUN');
  const [activeConfig, setActiveConfig] = useState<WorkoutTarget>(DEFAULT_WORKOUTS[0]);

  // We maintain raw string states for inputs to prevent cursor jumping
  // or aggressive reformatting (like typing "5:" instantly becoming "5:00")
  const [distanceKmStr, setDistanceKmStr] = useState('');
  const [durationMinStr, setDurationMinStr] = useState('');
  const [paceStr, setPaceStr] = useState('');
  
  // Interval specific states
  const [setsStr, setSetsStr] = useState('');
  const [workDistMStr, setWorkDistMStr] = useState('');
  const [restDurSecStr, setRestDurSecStr] = useState('');

  // Hydrate the form whenever the user swaps workout types
  useEffect(() => {
    const template = DEFAULT_WORKOUTS.find(w => w.type === selectedType) || DEFAULT_WORKOUTS[0];
    setActiveConfig(JSON.parse(JSON.stringify(template)));
    
    if (template.type === 'INTERVAL' && template.intervals) {
      setSetsStr(template.intervals[0].repeatCount.toString());
      setWorkDistMStr((template.intervals[0].workDistance || '').toString());
      setPaceStr(formatSecondsToPace(template.intervals[0].workPace));
      setRestDurSecStr((template.intervals[0].restDuration || '').toString());
    } else {
      setDistanceKmStr(template.distanceTarget ? (template.distanceTarget / 1000).toString() : '');
      setDurationMinStr(template.durationTarget ? (template.durationTarget / 60).toString() : '');
      setPaceStr(formatSecondsToPace(template.targetPace));
    }
  }, [selectedType]);

  const handleStart = () => {
    const finalConfig: WorkoutTarget = { ...activeConfig };

    // Build the final engine payload dynamically right before start
    if (selectedType === 'INTERVAL') {
      finalConfig.intervals = [{
        repeatCount: parseInt(setsStr, 10) || 1,
        workDistance: parseInt(workDistMStr, 10) || 0,
        workPace: parsePaceToSeconds(paceStr),
        restDuration: parseInt(restDurSecStr, 10) || 0,
      }];
    } else {
      if (distanceKmStr) {
        finalConfig.distanceTarget = (parseFloat(distanceKmStr) || 0) * 1000;
      }
      if (durationMinStr) {
        finalConfig.durationTarget = (parseInt(durationMinStr, 10) || 0) * 60;
      }
      if (paceStr) {
        finalConfig.targetPace = parsePaceToSeconds(paceStr);
      }
    }

    onStartWorkout(finalConfig);
  };

  return (
    <View className="flex-1 bg-neutral-950 p-6">
      <Text className="text-white text-3xl font-bold mb-8 tracking-tight">Select Workout</Text>
      
      <View className="mb-8">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {WORKOUT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => setSelectedType(type.value)}
              className={`mr-3 px-6 py-3 rounded-full border ${
                selectedType === type.value 
                  ? 'bg-white border-white' 
                  : 'bg-neutral-900 border-neutral-800'
              }`}
            >
              <Text className={`font-semibold ${
                selectedType === type.value ? 'text-black' : 'text-neutral-400'
              }`}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-neutral-900/40 p-6 rounded-3xl border border-neutral-800/60 space-y-6">
          <View className="mb-2">
            <Text className="text-white text-xl font-bold mb-2">{activeConfig.name}</Text>
            <Text className="text-neutral-400 text-base leading-6">{activeConfig.description}</Text>
          </View>

          {selectedType === 'INTERVAL' ? (
            <>
              <View>
                <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Number of Sets</Text>
                <TextInput
                  value={setsStr}
                  onChangeText={setSetsStr}
                  keyboardType="numeric"
                  className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                  placeholderTextColor="#525252"
                />
              </View>
              
              <View>
                <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Work Distance (m)</Text>
                <TextInput
                  value={workDistMStr}
                  onChangeText={setWorkDistMStr}
                  keyboardType="numeric"
                  className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                  placeholderTextColor="#525252"
                />
              </View>

              <View>
                <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Target Pace (min/km)</Text>
                <TextInput
                  value={paceStr}
                  onChangeText={setPaceStr}
                  className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                  placeholderTextColor="#525252"
                  placeholder="5:00"
                />
              </View>

              <View>
                <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Rest Duration (s)</Text>
                <TextInput
                  value={restDurSecStr}
                  onChangeText={setRestDurSecStr}
                  keyboardType="numeric"
                  className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                  placeholderTextColor="#525252"
                />
              </View>
            </>
          ) : (
            <>
              {activeConfig.distanceTarget !== undefined && (
                <View>
                  <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Distance (km)</Text>
                  <TextInput
                    value={distanceKmStr}
                    onChangeText={setDistanceKmStr}
                    keyboardType="numeric"
                    className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                    placeholderTextColor="#525252"
                  />
                </View>
              )}

              {activeConfig.durationTarget !== undefined && (
                <View>
                  <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Duration (min)</Text>
                  <TextInput
                    value={durationMinStr}
                    onChangeText={setDurationMinStr}
                    keyboardType="numeric"
                    className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                    placeholderTextColor="#525252"
                  />
                </View>
              )}

              {activeConfig.targetPace !== undefined && (
                <View>
                  <Text className="text-neutral-400 text-sm mb-2 font-medium uppercase tracking-wider">Target Pace (min/km)</Text>
                  <TextInput
                    value={paceStr}
                    onChangeText={setPaceStr}
                    className="bg-neutral-950 text-white p-4 rounded-2xl border border-neutral-800 font-medium text-lg focus:border-white/50"
                    placeholderTextColor="#525252"
                    placeholder="e.g. 5:30"
                  />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View className="pt-6 pb-2">
        <TouchableOpacity
          onPress={handleStart}
          disabled={disabled}
          className={`bg-white p-5 rounded-full items-center justify-center shadow-lg shadow-white/10 active:opacity-80 flex-row ${
            disabled ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <Text className="text-black font-bold text-lg tracking-widest">START RUN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
