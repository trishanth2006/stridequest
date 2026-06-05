import { render, screen } from '@testing-library/react'
import { TerritoryKingCard } from '@/features/leaderboards/components/TerritoryKingCard'
import type { TerritoryKing } from '@/features/leaderboards/types'

describe('TerritoryKingCard', () => {
  it('displays the reigning territory king and their cell count', () => {
    const king: TerritoryKing = {
      userId: 'u-alice',
      username: 'alice',
      territoryCount: 42,
    }
    render(<TerritoryKingCard king={king} />)

    expect(screen.getByTestId('territory-king-card')).toBeInTheDocument()
    expect(screen.getByTestId('territory-king-username')).toHaveTextContent('alice')
    expect(screen.getByTestId('territory-king-count')).toHaveTextContent('42')
    expect(screen.queryByTestId('territory-king-empty')).not.toBeInTheDocument()
  })

  it('shows an empty state when nobody owns territory', () => {
    render(<TerritoryKingCard king={null} />)

    expect(screen.getByTestId('territory-king-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('territory-king-username')).not.toBeInTheDocument()
  })
})
