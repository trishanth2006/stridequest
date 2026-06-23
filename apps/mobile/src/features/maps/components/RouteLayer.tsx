import { useMemo } from 'react'
import { simplifyRoute, routePointsToLineString, fitBoundsFromCoordinates } from '../utils/geojson'
import type { RoutePoint } from '../types'

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
  points: RoutePoint[]
}

export function RouteLayer({ points }: Props) {
  const simplified = useMemo(() => simplifyRoute(points), [points])
  const lineString = useMemo(() => routePointsToLineString(simplified), [simplified])
  const bounds = useMemo(() => {
    const coords = simplified.map((p): [number, number] => [p.lng, p.lat])
    return fitBoundsFromCoordinates(coords)
  }, [simplified])

  if (points.length === 0 || !MapboxGL) return null

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
      <MapboxGL.ShapeSource id="route-source" shape={lineString}>
        <MapboxGL.LineLayer
          id="route-line"
          style={{
            lineColor: '#10b981',
            lineWidth: 3,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
