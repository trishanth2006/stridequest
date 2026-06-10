"use client"

import React, { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import { cellsToGeoJSON, cellsToHeatmapGeoJSON } from '@/features/territory/utils/map'
import type { HeatmapCell } from '@/features/territory/types'
import type { TerritoryMode } from '@/features/territory/components/TerritoryHeatmapControls'

export interface TerritoryLayerProps {
  cellIds?: string[]
  heatmapCells?: HeatmapCell[]
  mode?: TerritoryMode | 'highlight-captured'
  beforeId?: string // useful for z-index sorting
}

export function TerritoryLayer({
  cellIds = [],
  heatmapCells = [],
  mode = 'territory',
  beforeId
}: TerritoryLayerProps) {
  const geojson = useMemo(() => {
    if (mode === 'heatmap') return cellsToHeatmapGeoJSON(heatmapCells)
    return cellsToGeoJSON(cellIds)
  }, [mode, cellIds, heatmapCells])

  const layerId = mode === 'heatmap' ? 'heatmap-cells' : 'territory-cells'

  const paintProps: any = useMemo(() => {
    if (mode === 'heatmap') {
      return {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.6,
        'fill-outline-color': '#064e3b',
      }
    }
    if (mode === 'highlight-captured') {
      return {
        'fill-color': '#10b981',
        'fill-opacity': 0.3,
        'fill-outline-color': '#059669',
      }
    }
    // Default territory mode
    return {
      'fill-color': '#10b981',
      'fill-opacity': 0.4,
      'fill-outline-color': '#059669',
    }
  }, [mode])

  // If no cells to show, don't render the source/layer
  if (cellIds.length === 0 && heatmapCells.length === 0) return null

  return (
    <Source type="geojson" data={geojson}>
      <Layer
        id={layerId}
        type="fill"
        paint={paintProps}
        beforeId={beforeId}
      />
    </Source>
  )
}
