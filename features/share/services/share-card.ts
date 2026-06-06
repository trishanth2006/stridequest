import type {
  ShareCardType,
  WorkoutShareCard,
  LevelUpCard,
  AchievementCard,
  PersonalRecordCard,
  ShareCardMetadata,
} from '../types'

const APP_VERSION = '1.0.0'

function generateMetadata(): ShareCardMetadata {
  return {
    generatedAt: new Date().toISOString(),
    strideQuestVersion: APP_VERSION,
  }
}

interface ShareHeadlineData {
  hasPr?: boolean
  territoriesCaptured?: number
  currentLevel?: number
  distance?: number
}

export function generateShareHeadline(type: ShareCardType, data?: ShareHeadlineData): string {
  switch (type) {
    case 'workout':
      if (data?.hasPr) return 'Set a new Personal Record!'
      if (data?.territoriesCaptured && data.territoriesCaptured > 0)
        return `Captured ${data.territoriesCaptured} new territories!`
      return 'Crushed another run!'
    case 'level-up':
      return `Reached Level ${data?.currentLevel || '!'}!`
    case 'achievement':
      return 'Unlocked a new achievement!'
    case 'personal-record':
      return 'Set a new Personal Record!'
    default:
      return 'Check out my progress!'
  }
}

export function buildWorkoutShareCard(data: Omit<WorkoutShareCard, 'type' | 'metadata' | 'headline'>): WorkoutShareCard {
  return {
    ...data,
    type: 'workout',
    metadata: generateMetadata(),
    headline: generateShareHeadline('workout', data),
  }
}

export function buildLevelUpCard(data: Omit<LevelUpCard, 'type' | 'metadata' | 'headline'>): LevelUpCard {
  return {
    ...data,
    type: 'level-up',
    metadata: generateMetadata(),
    headline: generateShareHeadline('level-up', data),
  }
}

export function buildAchievementCard(data: Omit<AchievementCard, 'type' | 'metadata' | 'headline'>): AchievementCard {
  return {
    ...data,
    type: 'achievement',
    metadata: generateMetadata(),
    headline: generateShareHeadline('achievement'),
  }
}

export function buildPersonalRecordCard(data: Omit<PersonalRecordCard, 'type' | 'metadata' | 'headline'>): PersonalRecordCard {
  return {
    ...data,
    type: 'personal-record',
    metadata: generateMetadata(),
    headline: generateShareHeadline('personal-record'),
  }
}
