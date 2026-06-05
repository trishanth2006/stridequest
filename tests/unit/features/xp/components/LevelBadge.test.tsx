import { render, screen } from '@testing-library/react'
import { LevelBadge } from '@/features/xp/components/LevelBadge'

describe('LevelBadge', () => {
  it('renders the current level clearly', () => {
    render(<LevelBadge level={4} />)

    expect(screen.getByTestId('level-badge')).toHaveTextContent('Level')
    expect(screen.getByTestId('level-badge')).toHaveTextContent('4')
  })
})
