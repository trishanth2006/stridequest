import { render, screen } from '@testing-library/react'
import { TerritoryStats } from '@/features/territory/components/TerritoryStats'

describe('TerritoryStats', () => {
  it('renders the total cell count correctly', () => {
    render(<TerritoryStats totalCells={42} totalCaptures={0} mostCapturedCell={null} />)

    expect(screen.getByText('Total Cells Owned')).toBeInTheDocument()
    expect(screen.getByTestId('territory-count')).toHaveTextContent('42')
  })

  it('renders zero when no cells are owned', () => {
    render(<TerritoryStats totalCells={0} totalCaptures={0} mostCapturedCell={null} />)
    expect(screen.getByTestId('territory-count')).toHaveTextContent('0')
  })

  it('renders total captures and the most captured cell (02D-07B)', () => {
    render(
      <TerritoryStats
        totalCells={3}
        totalCaptures={17}
        mostCapturedCell={{ cellId: '89283082803ffff', captures: 12 }}
      />,
    )

    expect(screen.getByText('Total Captures')).toBeInTheDocument()
    expect(screen.getByTestId('total-captures')).toHaveTextContent('17')
    expect(screen.getByText('Most Captured Cell')).toBeInTheDocument()
    expect(screen.getByTestId('most-captured-cell')).toHaveTextContent('89283082803ffff')
    expect(screen.getByTestId('most-captured-cell')).toHaveTextContent('12 captures')
  })

  it('shows a placeholder for the most captured cell when there is no activity', () => {
    render(<TerritoryStats totalCells={0} totalCaptures={0} mostCapturedCell={null} />)
    expect(screen.getByTestId('most-captured-cell')).toHaveTextContent('—')
  })
})
