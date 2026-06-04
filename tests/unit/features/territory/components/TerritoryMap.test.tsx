import { render, screen } from '@testing-library/react'
import { TerritoryMap } from '@/features/territory/components/TerritoryMap'

// Mock react-map-gl
jest.mock('react-map-gl/mapbox', () => {
  const Map = ({ children, initialViewState }: { children: React.ReactNode, initialViewState?: Record<string, unknown> }) => (
    <div data-testid="mock-map" data-bounds={JSON.stringify(initialViewState?.bounds)}>
      {children}
    </div>
  )
  const Source = ({ children, data }: { children: React.ReactNode, data: unknown }) => (
    <div data-testid="mock-source" data-geojson={JSON.stringify(data)}>
      {children}
    </div>
  )
  const Layer = ({ id }: { id: string }) => (
    <div data-testid={`mock-layer-${id}`} />
  )
  return {
    __esModule: true,
    default: Map,
    Source,
    Layer,
  }
})

jest.mock('@/features/territory/utils/map', () => ({
  cellsToGeoJSON: jest.fn(() => ({ type: 'FeatureCollection', features: [] })),
  calculateBounds: jest.fn(() => [0, 0, 10, 10])
}))

describe('TerritoryMap', () => {
  it('does not render if cellIds is empty', () => {
    const { container } = render(<TerritoryMap cellIds={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders map with bounds if cellIds provided', () => {
    render(<TerritoryMap cellIds={['cell1', 'cell2']} />)
    
    const mapContainer = screen.getByTestId('territory-map')
    expect(mapContainer).toBeInTheDocument()

    const mockMap = screen.getByTestId('mock-map')
    expect(mockMap).toHaveAttribute('data-bounds', JSON.stringify([
      [0, 0],
      [10, 10]
    ]))

    const source = screen.getByTestId('mock-source')
    expect(source).toBeInTheDocument()

    const layer = screen.getByTestId('mock-layer-territory-cells')
    expect(layer).toBeInTheDocument()
  })
})
