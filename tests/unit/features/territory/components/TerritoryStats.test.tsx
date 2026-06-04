import { render, screen } from '@testing-library/react'
import { TerritoryStats } from '@/features/territory/components/TerritoryStats'

describe('TerritoryStats', () => {
  it('renders the total cell count correctly', () => {
    render(<TerritoryStats totalCells={42} />)
    
    expect(screen.getByText('Total Cells Owned')).toBeInTheDocument()
    expect(screen.getByTestId('territory-count')).toHaveTextContent('42')
  })

  it('renders zero when no cells are owned', () => {
    render(<TerritoryStats totalCells={0} />)
    expect(screen.getByTestId('territory-count')).toHaveTextContent('0')
  })
})
