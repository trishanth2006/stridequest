import { render, screen } from '@testing-library/react'
import { TerritoryBoard } from '@/features/territory/components/TerritoryBoard'
import type { TerritoryOwnership } from '@/features/territory/types'

describe('TerritoryBoard', () => {
  const mockStats = { totalCells: 2 }
  const mockOwnedCells: TerritoryOwnership[] = [
    {
      cellId: '89283082803ffff',
      ownerUserId: 'user-1',
      ownedSinceWorkoutId: 'workout-1',
      updatedAt: '2023-01-01T12:00:00Z'
    },
    {
      cellId: '89283082807ffff',
      ownerUserId: 'user-1',
      ownedSinceWorkoutId: 'workout-1',
      updatedAt: '2023-01-02T12:00:00Z'
    }
  ]

  it('renders the empty state when no cells are owned', () => {
    render(<TerritoryBoard ownedCells={[]} stats={{ totalCells: 0 }} />)
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText("You don't own any territory yet.")).toBeInTheDocument()
    expect(screen.queryByTestId('owned-cells')).not.toBeInTheDocument()
  })

  it('renders the owned cells list when cells are owned', () => {
    render(<TerritoryBoard ownedCells={mockOwnedCells} stats={mockStats} />)
    
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    expect(screen.getByTestId('owned-cells')).toBeInTheDocument()
    
    // Check cell IDs are rendered
    expect(screen.getByText('89283082803ffff')).toBeInTheDocument()
    expect(screen.getByText('89283082807ffff')).toBeInTheDocument()
  })

  it('renders the territory stats', () => {
    render(<TerritoryBoard ownedCells={mockOwnedCells} stats={mockStats} />)
    
    expect(screen.getByTestId('territory-count')).toHaveTextContent('2')
  })
})
