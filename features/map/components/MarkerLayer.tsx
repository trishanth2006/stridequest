"use client"

import React, { useMemo } from 'react'
import { Marker } from 'react-map-gl/mapbox'
import type { WorkoutRoutePoint } from '@/features/running/types/workout-detail'

export interface MarkerLayerProps {
  routePoints: WorkoutRoutePoint[]
}

export function MarkerLayer({ routePoints }: MarkerLayerProps) {
  const { start, end } = useMemo(() => {
    if (routePoints.length < 2) return { start: null, end: null }
    return {
      start: routePoints[0],
      end: routePoints[routePoints.length - 1]
    }
  }, [routePoints])

  if (!start || !end) return null

  return (
    <>
      <Marker longitude={start.lng} latitude={start.lat} anchor="center">
        <div className="w-4 h-4 rounded-full bg-white border-[3px] border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
      </Marker>
      <Marker longitude={end.lng} latitude={end.lat} anchor="center">
        <div className="w-4 h-4 rounded-full bg-white border-[3px] border-black shadow-lg" />
      </Marker>
    </>
  )
}
