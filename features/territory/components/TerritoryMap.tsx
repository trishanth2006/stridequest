'use client'

import { useCallback, useMemo, useState } from 'react'
import Map, { Source, Layer, Popup, type MapMouseEvent } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  cellsToGeoJSON,
  cellsToHeatmapGeoJSON,
  calculateBounds,
  buildTooltip,
  type TooltipData,
} from '@/features/territory/utils/map'
import type { HeatmapCell } from '@/features/territory/types'
import type { TerritoryMode } from './TerritoryHeatmapControls'

type HoverState = { longitude: number; latitude: number; data: TooltipData }

export function TerritoryMap({
  cellIds,
  mode = 'territory',
  heatmapCells = [],
}: {
  cellIds: string[]
  mode?: TerritoryMode
  heatmapCells?: HeatmapCell[]
}) {
  // The owned set is the source of truth for the tooltip's owner label.
  const ownedSet = useMemo(() => new Set(cellIds), [cellIds])

  const geojson = useMemo(
    () => (mode === 'heatmap' ? cellsToHeatmapGeoJSON(heatmapCells) : cellsToGeoJSON(cellIds)),
    [mode, cellIds, heatmapCells],
  )

  // Initial framing fits the owned cells; toggling mode keeps the current view
  // (instant switch, no re-fit) since owned and heatmap cells are co-located.
  const bounds = useMemo(() => calculateBounds(cellIds), [cellIds])
  const initialViewState = useMemo(() => {
    if (!bounds) return { longitude: -122.4, latitude: 37.8, zoom: 14 }
    return {
      bounds: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 40, maxZoom: 16 },
    }
  }, [bounds])

  const [hover, setHover] = useState<HoverState | null>(null)
  const layerId = mode === 'heatmap' ? 'heatmap-cells' : 'territory-cells'

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature || !feature.properties) {
        setHover(null)
        return
      }
      const cellId = String(feature.properties.cellId)
      const rawCaptures = feature.properties.captures
      const captures = typeof rawCaptures === 'number' ? rawCaptures : 0
      setHover({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        data: buildTooltip(cellId, ownedSet.has(cellId), captures),
      })
    },
    [ownedSet],
  )

  // Do not render the map if there are no owned cells (empty-state requirement).
  if (cellIds.length === 0) return null

  return (
    <div
      data-testid="territory-map"
      data-mode={mode}
      className="w-full h-[400px] rounded-2xl overflow-hidden border border-white/[0.04]"
    >
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactive={true}
        interactiveLayerIds={[layerId]}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {mode === 'heatmap' ? (
          <Source type="geojson" data={geojson}>
            <Layer
              id="heatmap-cells"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.6,
                'fill-outline-color': '#064e3b',
              }}
            />
          </Source>
        ) : (
          <Source type="geojson" data={geojson}>
            <Layer
              id="territory-cells"
              type="fill"
              paint={{
                'fill-color': '#10b981',
                'fill-opacity': 0.4,
                'fill-outline-color': '#059669',
              }}
            />
          </Source>
        )}

        {hover && (
          <Popup
            longitude={hover.longitude}
            latitude={hover.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={12}
          >
            <div data-testid="territory-tooltip" className="text-xs leading-snug">
              <div className="font-semibold text-emerald-700">{hover.data.owner}</div>
              <div className="text-foreground/80">Captures: {hover.data.captures}</div>
              <div className="font-mono text-[10px] opacity-60">{hover.data.cellId}</div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}
