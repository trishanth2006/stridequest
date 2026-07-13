import * as Haptics from 'expo-haptics'
import * as Speech from 'expo-speech'
import type { MotionEngine, WorkoutPhase } from './MotionEngine'

export class CoachingService {
  private lastSpeechTime = 0
  private lastDeviationEvent: 'TOO_FAST' | 'TOO_SLOW' | 'ON_PACE' | null = null
  private readonly DEBOUNCE_MS = 30000 // 30 seconds

  constructor(private engine: MotionEngine) {}

  start() {
    this.engine.on('paceDeviation', this.handlePaceDeviation)
    this.engine.on('phaseTransition', this.handlePhaseTransition)
  }

  stop() {
    this.engine.off('paceDeviation', this.handlePaceDeviation)
    this.engine.off('phaseTransition', this.handlePhaseTransition)
    Speech.stop()
  }

  private handlePaceDeviation = async (deviation: 'TOO_FAST' | 'TOO_SLOW' | 'ON_PACE') => {
    const now = Date.now()
    if (this.lastDeviationEvent === deviation && (now - this.lastSpeechTime) < this.DEBOUNCE_MS) {
      return
    }

    this.lastDeviationEvent = deviation
    this.lastSpeechTime = now

    const currentPhase = this.engine.getCurrentPhase()
    const targetPaceStr = currentPhase?.targetPace 
      ? this.formatPaceString(currentPhase.targetPace) 
      : ''

    try {
      if (deviation === 'TOO_FAST') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        const text = `Pace too fast. ${targetPaceStr ? `Target is ${targetPaceStr}.` : ''}`
        this.speak(text)
      } else if (deviation === 'TOO_SLOW') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        const text = `Pace slowing. ${targetPaceStr ? `Target is ${targetPaceStr}.` : ''}`
        this.speak(text)
      } else if (deviation === 'ON_PACE') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        this.speak('Back on pace. Good job.')
      }
    } catch (e) {
      console.warn('CoachingService: Haptics/Speech error', e)
    }
  }

  private handlePhaseTransition = async (data: { previousBlockIndex: number, currentBlockIndex: number, completedDistance: number, completedDurationMs: number }) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await new Promise(resolve => setTimeout(resolve, 200))
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const prevPhase = this.engine.getPhase(data.previousBlockIndex)
      const nextPhase = this.engine.getPhase(data.currentBlockIndex)

      const timeStr = this.formatDurationString(Math.floor(data.completedDurationMs / 1000))
      
      let text = ''
      if (prevPhase?.type === 'work') {
        text += `Interval complete. Time: ${timeStr}. `
      } else if (prevPhase?.type === 'rest') {
        text += `Rest complete. `
      } else {
        text += `Phase complete. `
      }

      if (nextPhase) {
        if (nextPhase.type === 'rest') {
          const dur = nextPhase.targetDuration ? this.formatDurationString(nextPhase.targetDuration) : ''
          const dist = nextPhase.targetDistance ? `${nextPhase.targetDistance} meter` : ''
          text += `Next: ${dist} ${dur} recovery.`.trim()
        } else if (nextPhase.type === 'work') {
          const dur = nextPhase.targetDuration ? this.formatDurationString(nextPhase.targetDuration) : ''
          const dist = nextPhase.targetDistance ? `${nextPhase.targetDistance} meter` : ''
          text += `Next: ${dist} ${dur} work interval.`.trim()
        }
      } else {
        text = 'Run complete. Great workout.'
      }

      // Cleanup duplicate spaces
      text = text.replace(/\s+/g, ' ').trim()
      this.speak(text)
    } catch (e) {
      console.warn('CoachingService: Haptics/Speech error', e)
    }
  }

  private speak(text: string) {
    Speech.speak(text, {
      rate: 1.0,
      pitch: 1.0,
      onDone: () => {},
      onError: (e) => console.warn('Speech error:', e)
    })
  }

  private formatPaceString(secondsPerKm: number): string {
    const mins = Math.floor(secondsPerKm / 60)
    const secs = Math.floor(secondsPerKm % 60)
    if (secs === 0) return `${mins} minutes per kilometer`
    return `${mins} minutes and ${secs} seconds per kilometer`
  }

  private formatDurationString(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    let str = ''
    if (mins > 0) {
      str += `${mins} minute${mins > 1 ? 's' : ''} `
    }
    if (secs > 0 || mins === 0) {
      str += `${secs} second${secs !== 1 ? 's' : ''}`
    }
    return str.trim()
  }
}
