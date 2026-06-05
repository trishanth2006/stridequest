import { render, screen } from '@testing-library/react'
import { XPEarnedCard } from '@/features/xp/components/XPEarnedCard'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { XpProgress } from '@/features/xp/services/xp'

describe('XPEarnedCard', () => {
  const mockBreakdown: WorkoutXpBreakdown = {
    workoutXp: 50,
    captureXp: 20,
    stealXp: 0,
    totalXp: 70,
  }

  const mockProgress: XpProgress = {
    currentXp: 170,
    currentLevel: 2,
    currentLevelXp: 100,
    nextLevel: 3,
    nextLevelXp: 250,
    xpNeededToNextLevel: 80,
    progressPercent: 46,
  }

  it('renders total XP', () => {
    render(<XPEarnedCard breakdown={mockBreakdown} progress={mockProgress} />)
    
    const elements = screen.getAllByText('+70')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('renders progress correctly', () => {
    render(<XPEarnedCard breakdown={mockBreakdown} progress={mockProgress} />)
    
    expect(screen.getByText('Level 2')).toBeInTheDocument()
    expect(screen.getByText('80 XP needed')).toBeInTheDocument()
  })

  it('renders breakdown correctly', () => {
    render(<XPEarnedCard breakdown={mockBreakdown} progress={mockProgress} />)
    
    expect(screen.getByTestId('xp-workout')).toBeInTheDocument()
    expect(screen.getByTestId('xp-capture')).toBeInTheDocument()
    expect(screen.queryByTestId('xp-steal')).not.toBeInTheDocument()
  })
})
