import { useMemo } from 'react'
import { fitBoundsFromCoordinates, computeCentroid } from '../utils/geojson'
import type { TerritoryCollection } from '../types'
import { colors } from '@/theme'

type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
} catch {
  // native build required
}

const PADDING = 50
// Below this zoom, individual cell polygons overlap into unreadable clutter;
// at and above it, polygons are visually distinguishable.
const CLUSTER_ZOOM_BOUNDARY = 12

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

  const centroids = useMemo((): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
    type: 'FeatureCollection',
    features: data.features.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: computeCentroid(f.geometry.coordinates[0]) },
      properties: { cellId: f.properties.cellId },
    })),
  }), [data])

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

      {/* Low zoom: native clustered bubbles over territory centroids. */}
      <MapboxGL.ShapeSource
        id="territory-cluster-source"
        shape={centroids}
        cluster
        clusterRadius={50}
        clusterMaxZoomLevel={CLUSTER_ZOOM_BOUNDARY - 1}
      >
        <MapboxGL.CircleLayer
          id="territory-cluster-circle"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['has', 'point_count']}
          style={{
            circleColor: colors.primary,
            circleOpacity: 0.85,
            circleRadius: [
              'interpolate', ['linear'], ['get', 'point_count'],
              1, 18,
              20, 28,
              100, 38,
            ],
          }}
        />
        <MapboxGL.SymbolLayer
          id="territory-cluster-count"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['has', 'point_count']}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textColor: colors.background,
            textSize: 13,
            textAllowOverlap: true,
          }}
        />
        <MapboxGL.CircleLayer
          id="territory-unclustered-point"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['!', ['has', 'point_count']]}
          style={{
            circleColor: colors.primary,
            circleOpacity: 0.7,
            circleRadius: 6,
          }}
        />
      </MapboxGL.ShapeSource>

      {/* High zoom: existing polygon fill/border. */}
      <MapboxGL.ShapeSource id="territory-source" shape={data as unknown as GeoJSON.FeatureCollection}>
        <MapboxGL.FillLayer
          id="territory-fill"
          minZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          style={{ fillColor: colors.primary, fillOpacity: 0.4 }}
        />
        <MapboxGL.LineLayer
          id="territory-border"
          minZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          style={{ lineColor: colors.primary, lineWidth: 1 }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
