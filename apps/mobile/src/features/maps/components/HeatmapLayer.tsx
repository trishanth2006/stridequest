import { useMemo } from 'react'

type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
} catch {
  // native build required
}

type HeatmapCellPoint = {
  cellId: string
  lat: number
  lng: number
  captures: number
}

type Props = {
  cells: HeatmapCellPoint[]
}

/**
 * Renders a Mapbox heatmap layer where each cell centre is a GeoJSON point
 * weighted by its capture count. The heatmap intensity scales from emerald at
 * low density to amber/red at high density, matching the website's palette.
 */
export function HeatmapLayer({ cells }: Props) {
  const geojson = useMemo(() => {
    const maxCaptures = Math.max(...cells.map((c) => c.captures), 1)
    return {
      type: 'FeatureCollection' as const,
      features: cells.map((c) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: {
          intensity: c.captures / maxCaptures,
          count: c.captures,
        },
      })),
    }
  }, [cells])

  if (!MapboxGL || cells.length === 0) return null

  return (
    <MapboxGL.ShapeSource id="heatmap-source" shape={geojson as unknown as GeoJSON.FeatureCollection}>
      <MapboxGL.HeatmapLayer
        id="heatmap-layer"
        style={{
          heatmapWeight: ['get', 'intensity'],
          heatmapIntensity: 1.2,
          heatmapRadius: 30,
          heatmapOpacity: 0.85,
          heatmapColor: [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(16,185,129,0)',
            0.2, 'rgba(16,185,129,0.5)',
            0.5, 'rgba(245,158,11,0.8)',
            0.8, 'rgba(239,68,68,0.9)',
            1, 'rgba(239,68,68,1)',
          ],
        }}
      />
    </MapboxGL.ShapeSource>
  )
}
