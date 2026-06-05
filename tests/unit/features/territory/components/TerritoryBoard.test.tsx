import { render, screen, within } from '@testing-library/react'
import { TerritoryBoard } from '@/features/territory/components/TerritoryBoard'
import type { TerritoryOwnership, HeatmapCell } from '@/features/territory/types'

jest.mock('@/features/territory/components/TerritoryMap', () => ({
  TerritoryMap: () => <div data-testid="territory-map-mock" />,
}))

describe('TerritoryBoard', () => {
  const mockStats = {
    totalCells: 2,
    totalCaptures: 5,
    mostCapturedCell: { cellId: '89283082803ffff', captures: 3 } as HeatmapCell,
  }
  const emptyStats = { totalCells: 0, totalCaptures: 0, mostCapturedCell: null }
  const mockHeatmap: HeatmapCell[] = [
    { cellId: '89283082803ffff', captures: 3 },
    { cellId: '89283082807ffff', captures: 2 },
  ]
  const mockOwnedCells: TerritoryOwnership[] = [
    { cellId: '89283082803ffff', ownerUserId: 'user-1', ownedSinceWorkoutId: 'workout-1', updatedAt: '2023-01-01T12:00:00Z' },
    { cellId: '89283082807ffff', ownerUserId: 'user-1', ownedSinceWorkoutId: 'workout-1', updatedAt: '2023-01-02T12:00:00Z' },
  ]

  it('renders the empty state when no cells are owned', () => {
    render(<TerritoryBoard ownedCells={[]} stats={emptyStats} heatmapCells={[]} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText("You don't own any territory yet.")).toBeInTheDocument()
    expect(screen.queryByTestId('owned-cells')).not.toBeInTheDocument()
  })

  it('does not show the Territory/Heatmap toggle in the empty state', () => {
    render(<TerritoryBoard ownedCells={[]} stats={emptyStats} heatmapCells={[]} />)
    expect(screen.queryByTestId('territory-mode-controls')).not.toBeInTheDocument()
  })

  it('renders the owned cells list when cells are owned', () => {
    render(<TerritoryBoard ownedCells={mockOwnedCells} stats={mockStats} heatmapCells={mockHeatmap} />)

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    const list = screen.getByTestId('owned-cells')
    // Scope to the debug list so the stat card's cell id does not double-match.
    expect(within(list).getByText('89283082803ffff')).toBeInTheDocument()
    expect(within(list).getByText('89283082807ffff')).toBeInTheDocument()
  })

  it('shows the Territory/Heatmap toggle when cells are owned (02D-07B)', () => {
    render(<TerritoryBoard ownedCells={mockOwnedCells} stats={mockStats} heatmapCells={mockHeatmap} />)

    expect(screen.getByTestId('territory-mode-controls')).toBeInTheDocument()
    expect(screen.getByTestId('mode-territory')).toBeInTheDocument()
    expect(screen.getByTestId('mode-heatmap')).toBeInTheDocument()
  })

  it('renders the territory stats (owned + captures)', () => {
    render(<TerritoryBoard ownedCells={mockOwnedCells} stats={mockStats} heatmapCells={mockHeatmap} />)

    expect(screen.getByTestId('territory-count')).toHaveTextContent('2')
    expect(screen.getByTestId('total-captures')).toHaveTextContent('5')
  })
})
