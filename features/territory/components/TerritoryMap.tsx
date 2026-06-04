'use client'

import { useMemo } from 'react'
import Map, { Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { cellsToGeoJSON, calculateBounds } from '@/features/territory/utils/map'

export function TerritoryMap({ cellIds }: { cellIds: string[] }) {
  const geojson = useMemo(() => cellsToGeoJSON(cellIds), [cellIds])
  const bounds = useMemo(() => calculateBounds(cellIds), [cellIds])

  const initialViewState = useMemo(() => {
    if (!bounds) return { longitude: -122.4, latitude: 37.8, zoom: 14 }
    return {
      bounds: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 40, maxZoom: 16 }
    }
  }, [bounds])

  // Do not render the map if there are no cells, as requested in requirements.
  if (cellIds.length === 0) return null

  return (
    <div data-testid="territory-map" className="w-full h-[400px] rounded-2xl overflow-hidden border border-white/[0.04]">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactive={true}
      >
        <Source type="geojson" data={geojson}>
          <Layer 
            id="territory-cells" 
            type="fill" 
            paint={{
              'fill-color': '#10b981', // green
              'fill-opacity': 0.4,
              'fill-outline-color': '#059669' // darker green
            }} 
          />
        </Source>
      </Map>
    </div>
  )
}
