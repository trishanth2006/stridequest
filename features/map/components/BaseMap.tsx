"use client"

import React, { useMemo } from 'react'
import Map, { type MapProps } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FitBoundsOptions } from 'mapbox-gl'

export interface BaseMapProps extends Omit<MapProps, 'mapboxAccessToken' | 'mapStyle'> {
  bounds?: [number, number, number, number] | null
  fitBoundsOptions?: FitBoundsOptions
  className?: string
  children?: React.ReactNode
}

export function BaseMap({
  bounds,
  fitBoundsOptions,
  className = "w-full h-[400px] rounded-2xl overflow-hidden border border-white/[0.04]",
  children,
  ...props
}: BaseMapProps) {
  const initialViewState = useMemo(() => {
    // If no bounds, default to a sensible center (e.g. SF)
    if (!bounds) return { longitude: -122.4, latitude: 37.8, zoom: 14 }
    
    return {
      bounds: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: fitBoundsOptions ?? { padding: 40, maxZoom: 16 },
    }
  }, [bounds, fitBoundsOptions])

  return (
    <div className={className} data-testid="base-map-container">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        {...props}
      >
        {children}
      </Map>
    </div>
  )
}
