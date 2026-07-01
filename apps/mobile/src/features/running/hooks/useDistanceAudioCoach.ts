import { useEffect, useRef } from 'react'
import { AudioCoach } from '../../audio/AudioCoach'

export function useDistanceAudioCoach(
  totalDistanceKm: number,
  averagePaceInMinutes: number,
  isEnabled: boolean = true,
  elapsedSeconds: number = 0
) {
  const lastSpokenKm = useRef<number>(0)
  const lastSpokenInterval = useRef<number>(0)

  useEffect(() => {
    if (!isEnabled) return

    const currentKmFloor = Math.floor(totalDistanceKm)
    const current2MinInterval = Math.floor(elapsedSeconds / 120)

    let triggered = false

    if (currentKmFloor > lastSpokenKm.current) {
      lastSpokenKm.current = currentKmFloor
      triggered = true
    }

    if (!triggered && current2MinInterval > lastSpokenInterval.current && current2MinInterval > 0) {
      lastSpokenInterval.current = current2MinInterval
      triggered = true
    } else if (current2MinInterval > lastSpokenInterval.current) {
      lastSpokenInterval.current = current2MinInterval
    }

    if (triggered) {
      // 20% chance for an intelligent AI cue
      if (Math.random() < 0.2) {
        void AudioCoach.fetchAndSpeakCoachingCue(averagePaceInMinutes, totalDistanceKm)
      } else {
        const formattedPace = AudioCoach.formatPaceForSpeech(averagePaceInMinutes)
        AudioCoach.speak(
          `${currentKmFloor} kilometer${currentKmFloor !== 1 ? 's' : ''} completed. Average pace: ${formattedPace}.`
        )
      }
    }
  }, [totalDistanceKm, averagePaceInMinutes, isEnabled, elapsedSeconds])
}
