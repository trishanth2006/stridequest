'use client'

import { useCallback, useMemo, useState } from 'react'
import { Popup, type MapMouseEvent } from 'react-map-gl/mapbox'
import {
  calculateBounds,
  buildTooltip,
  type TooltipData,
} from '@/features/territory/utils/map'
import type { HeatmapCell } from '@/features/territory/types'
import type { TerritoryMode } from './TerritoryHeatmapControls'
import { BaseMap } from '@/features/map/components/BaseMap'
import { TerritoryLayer } from '@/features/map/components/TerritoryLayer'

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

  // Initial framing fits the owned cells; toggling mode keeps the current view
  // (instant switch, no re-fit) since owned and heatmap cells are co-located.
  const bounds = useMemo(() => calculateBounds(cellIds), [cellIds])

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
      className="w-full h-[400px] rounded-2xl overflow-hidden border border-white/[0.04] relative"
    >
      <BaseMap
        bounds={bounds}
        interactive={true}
        interactiveLayerIds={[layerId]}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        className="w-full h-full"
      >
        <TerritoryLayer cellIds={cellIds} heatmapCells={heatmapCells} mode={mode} />

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
      </BaseMap>
    </div>
  )
}
