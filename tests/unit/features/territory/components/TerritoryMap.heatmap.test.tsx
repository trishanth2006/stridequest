import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { latLngToCell } from 'h3-js'
import { captureColor, buildTooltip } from '@/features/territory/utils/map'

// jsdom can't run Mapbox GL (WebGL), so mock the map primitives. Each mock
// surfaces its props via DOM attributes so we can assert what the real
// TerritoryMap renders per mode.
jest.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
jest.mock('react-map-gl/mapbox', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <div data-testid="map-root">{children}</div>,
  Source: ({ data, children }: { data: unknown; children?: ReactNode }) => (
    <div data-testid="map-source" data-geojson={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Layer: ({ id, paint }: { id: string; paint: unknown }) => (
    <div data-testid={`map-layer-${id}`} data-paint={JSON.stringify(paint)} />
  ),
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="map-popup">{children}</div>,
}))

import { TerritoryMap } from '@/features/territory/components/TerritoryMap'

// Real res-9 H3 cells so utils/map's cellToBoundary() accepts them.
const cellA = latLngToCell(37.7749, -122.4194, 9)
const cellB = latLngToCell(37.7849, -122.4194, 9)

type HeatmapGeoJSON = {
  features: Array<{ properties: { cellId: string; color: string; captures: number } }>
}

describe('TerritoryMap heatmap (02D-07B)', () => {
  it('renders the ownership layer in territory mode', () => {
    render(<TerritoryMap cellIds={[cellA, cellB]} mode="territory" />)
    expect(screen.getByTestId('map-layer-territory-cells')).toBeInTheDocument()
    expect(screen.queryByTestId('map-layer-heatmap-cells')).not.toBeInTheDocument()
  })

  it('renders the heatmap layer in heatmap mode', () => {
    render(
      <TerritoryMap
        cellIds={[cellA, cellB]}
        mode="heatmap"
        heatmapCells={[
          { cellId: cellA, captures: 3 },
          { cellId: cellB, captures: 12 },
        ]}
      />,
    )
    expect(screen.getByTestId('map-layer-heatmap-cells')).toBeInTheDocument()
    expect(screen.queryByTestId('map-layer-territory-cells')).not.toBeInTheDocument()
  })

  it('encodes graduated colors + capture counts into the heatmap geojson', () => {
    render(
      <TerritoryMap
        cellIds={[cellA, cellB]}
        mode="heatmap"
        heatmapCells={[
          { cellId: cellA, captures: 3 },
          { cellId: cellB, captures: 12 },
        ]}
      />,
    )
    const source = screen.getByTestId('map-source')
    const geojson = JSON.parse(source.getAttribute('data-geojson') ?? '{}') as HeatmapGeoJSON
    const byCell = Object.fromEntries(geojson.features.map((f) => [f.properties.cellId, f.properties]))

    expect(byCell[cellA].captures).toBe(3)
    expect(byCell[cellA].color).toBe('#4ade80') // 2–5
    expect(byCell[cellB].captures).toBe(12)
    expect(byCell[cellB].color).toBe('#16a34a') // 11+
  })

  it('captureColor maps counts to the graduated buckets (color interpolation)', () => {
    expect(captureColor(1)).toBe('#86efac')
    expect(captureColor(5)).toBe('#4ade80')
    expect(captureColor(6)).toBe('#22c55e')
    expect(captureColor(10)).toBe('#22c55e')
    expect(captureColor(11)).toBe('#16a34a')
    expect(captureColor(0)).toBe('#374151')
  })

  it('buildTooltip resolves owner label + captures for the hover tooltip', () => {
    expect(buildTooltip(cellA, true, 12)).toEqual({ cellId: cellA, owner: 'Owned by You', captures: 12 })
    expect(buildTooltip(cellB, false, 0)).toEqual({ cellId: cellB, owner: 'Neutral Territory', captures: 0 })
  })

  it('renders nothing when there are no owned cells (empty-state preserved)', () => {
    const { container } = render(<TerritoryMap cellIds={[]} mode="territory" />)
    expect(container).toBeEmptyDOMElement()
  })
})
