import { useMemo } from 'react'
import { fitBoundsFromCoordinates } from '../utils/geojson'
import type { TerritoryCollection } from '../types'

type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
} catch {
  // native build required
}

const PADDING = 50

type Props = {
  data: TerritoryCollection
}

export function TerritoryLayer({ data }: Props) {
  const bounds = useMemo(() => {
    const coords: [number, number][] = data.features.flatMap((f) =>
      f.geometry.coordinates[0].map(([lng, lat]) => [lng, lat] as [number, number]),
    )
    return fitBoundsFromCoordinates(coords)
  }, [data])

  if (data.features.length === 0 || !MapboxGL) return null

  return (
    <>
      <MapboxGL.Camera
        bounds={{
          ne: bounds.ne,
          sw: bounds.sw,
          paddingTop: PADDING,
          paddingRight: PADDING,
          paddingBottom: PADDING,
          paddingLeft: PADDING,
        }}
        animationDuration={0}
      />
      <MapboxGL.ShapeSource id="territory-source" shape={data as unknown as GeoJSON.FeatureCollection}>
        <MapboxGL.FillLayer
          id="territory-fill"
          style={{ fillColor: '#10b981', fillOpacity: 0.4 }}
        />
        <MapboxGL.LineLayer
          id="territory-border"
          style={{ lineColor: '#10b981', lineWidth: 1 }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
