/**
 * RunLiveMap
 *
 * Renders a full-screen Mapbox map that:
 *  - Sits behind the RunHUD via `StyleSheet.absoluteFillObject`
 *  - Follows the user's live smoothed GPS position
 *  - Draws the accumulated route as a GeoJSON LineString
 *  - Shows a pulsing circle at the current position tip of the line
 */
import React, { memo, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import type { Feature, LineString, Point } from 'geojson'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunLiveMapProps = {
  /** GeoJSON-order [lng, lat] tuples collected by the recorder. */
  routeCoordinates: [number, number][]
  /** Latest GPS fix — drives the current-position marker. */
  currentPosition: { lat: number; lng: number } | null
  /** Whether the user is actively tracking a run. */
  isTracking?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE_SOURCE_ID = 'run-route-source'
const ROUTE_LAYER_ID = 'run-route-layer'
const ROUTE_CASING_LAYER_ID = 'run-route-casing'
const POSITION_SOURCE_ID = 'run-position-source'
const POSITION_LAYER_ID = 'run-position-layer'
const POSITION_PULSE_LAYER_ID = 'run-position-pulse'

/** High-contrast Neon Cyan for aggressive visibility on dark maps. */
const ROUTE_COLOR = '#00E5FF'
/** Brighter highlight for the casing glow. */
const ROUTE_CASING_COLOR = '#84ffff'
/** White dot core for max contrast on any basemap. */
const POSITION_COLOR = '#ffffff'
const POSITION_HALO_COLOR = '#00E5FF'

// ─── Component ────────────────────────────────────────────────────────────────

export const RunLiveMap = memo(({ routeCoordinates, currentPosition, isTracking = true }: RunLiveMapProps) => {
  // ─── GeoJSON Memoization ───
  // By using useMemo, this heavy GeoJSON construction only triggers when the 
  // underlying coordinate array actually changes. This prevents expensive UI
  // stuttering during 1Hz map re-renders, feeding the ShapeSource efficiently.
  const routeFeature = useMemo<Feature<LineString>>(() => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      // Need at least 2 points for Mapbox to render a line.
      coordinates: routeCoordinates.length >= 2 ? routeCoordinates : [],
    },
    properties: {},
  }), [routeCoordinates])

  // Build the Point GeoJSON for the live-position marker.
  const positionFeature = useMemo<Feature<Point> | null>(() => {
    if (!currentPosition) return null
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [currentPosition.lng, currentPosition.lat],
      },
      properties: {},
    }
  }, [currentPosition])

  return (
    <MapboxGL.MapView
      style={StyleSheet.absoluteFillObject}
      styleURL="mapbox://styles/mapbox/dark-v11"
      zoomEnabled
      scrollEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      attributionEnabled={false}
      logoEnabled={false}
      compassEnabled={false}
    >
      {/* ── Camera: follow the runner's smoothed engine coordinate ── */}
      {/* We bind centerCoordinate directly to our engine's output rather than raw puck data */}
      <MapboxGL.Camera
        zoomLevel={16}
        centerCoordinate={isTracking && currentPosition ? [currentPosition.lng, currentPosition.lat] : undefined}
        animationMode="easeTo"
        animationDuration={1000}
      />

      {/* ── Route line ── */}
      {routeCoordinates.length >= 2 && (
        <MapboxGL.ShapeSource id={ROUTE_SOURCE_ID} shape={routeFeature}>
          {/* Wider casing gives a subtle neon glow effect */}
          <MapboxGL.LineLayer
            id={ROUTE_CASING_LAYER_ID}
            style={{
              lineColor: ROUTE_CASING_COLOR,
              lineWidth: 10,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.3,
            }}
          />
          {/* Main route line */}
          <MapboxGL.LineLayer
            id={ROUTE_LAYER_ID}
            style={{
              lineColor: ROUTE_COLOR,
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.95,
            }}
          />
        </MapboxGL.ShapeSource>
      )}

      {/* ── Live-position smoothed marker (tip of the line) ── */}
      {positionFeature && (
        <MapboxGL.ShapeSource id={POSITION_SOURCE_ID} shape={positionFeature}>
          {/* Outer pulse ring */}
          <MapboxGL.CircleLayer
            id={POSITION_PULSE_LAYER_ID}
            style={{
              circleRadius: 18,
              circleColor: POSITION_HALO_COLOR,
              circleOpacity: 0.25,
              circlePitchAlignment: 'map',
            }}
          />
          {/* Inner dot */}
          <MapboxGL.CircleLayer
            id={POSITION_LAYER_ID}
            style={{
              circleRadius: 8,
              circleColor: POSITION_COLOR,
              circleStrokeColor: POSITION_HALO_COLOR,
              circleStrokeWidth: 3,
              circlePitchAlignment: 'map',
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </MapboxGL.MapView>
  )
})

RunLiveMap.displayName = 'RunLiveMap'
