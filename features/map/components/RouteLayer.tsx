"use client"

import React, { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import type { WorkoutRoutePoint } from '@/features/running/types/workout-detail'

export interface RouteLayerProps {
  routePoints: WorkoutRoutePoint[]
  beforeId?: string
}

export function RouteLayer({ routePoints, beforeId }: RouteLayerProps) {
  const geojson = useMemo(() => {
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routePoints.map(p => [p.lng, p.lat])
      }
    }
  }, [routePoints])

  if (routePoints.length < 2) return null

  return (
    <Source type="geojson" data={geojson}>
      <Layer
        id="route-line-bg"
        type="line"
        layout={{
          'line-join': 'round',
          'line-cap': 'round'
        }}
        paint={{
          'line-color': '#fff',
          'line-width': 8,
          'line-opacity': 0.8,
          'line-blur': 4
        }}
        beforeId={beforeId}
      />
      <Layer
        id="route-line"
        type="line"
        layout={{
          'line-join': 'round',
          'line-cap': 'round'
        }}
        paint={{
          'line-color': '#fc5200',
          'line-width': 5
        }}
        beforeId={beforeId}
      />
    </Source>
  )
}
