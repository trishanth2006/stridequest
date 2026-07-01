import * as Speech from 'expo-speech'
import { supabase } from '@/lib/supabase'

class AudioCoachService {
  private enabled = true

  public setEnabled(value: boolean): void {
    this.enabled = value
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public toggle(): boolean {
    this.enabled = !this.enabled
    return this.enabled
  }

  public speakIfEnabled(text: string): void {
    if (this.enabled) this.speak(text)
  }

  public speak(text: string) {
    try {
      // Stop any existing speech before starting new one
      Speech.stop()
      Speech.speak(text, {
        language: 'en-US',
      })
    } catch (error) {
      console.warn('AudioCoach: Speech failed', error)
    }
  }

  /**
   * Converts a decimal pace (e.g., 5.5) into natural spoken text (e.g., "5 minutes and 30 seconds").
   */
  public formatPaceForSpeech(paceInMinutes: number): string {
    const minutes = Math.floor(paceInMinutes)
    const seconds = Math.round((paceInMinutes - minutes) * 60)

    if (minutes === 0 && seconds === 0) {
      return '0 seconds'
    }

    const minText = minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}` : ''
    const secText = seconds > 0 ? `${seconds} second${seconds !== 1 ? 's' : ''}` : ''

    if (minText && secText) {
      return `${minText} and ${secText}`
    }
    return minText || secText
  }

  /**
   * Fetches a dynamic coaching cue from the edge function and speaks it.
   */
  public async fetchAndSpeakCoachingCue(paceInMinutes: number, totalDistanceKm: number, heartRate?: number) {
    try {
      const { data, error } = await supabase.functions.invoke('finalize-workout', {
        body: {
          requestType: 'coaching-cue',
          pace: paceInMinutes,
          totalDistance: totalDistanceKm,
          heartRate
        }
      })

      if (error) {
        console.error('AudioCoach: Failed to fetch cue:', error)
        return
      }

      if (data?.cue) {
        this.speak(data.cue)
      }
    } catch (err) {
      console.error('AudioCoach: Edge function error:', err)
    }
  }
}

export const AudioCoach = new AudioCoachService()
