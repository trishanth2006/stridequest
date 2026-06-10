"use client"

import { useMemo } from 'react'
import { BaseMap } from '@/features/map/components/BaseMap'
import { RouteLayer } from '@/features/map/components/RouteLayer'
import { MarkerLayer } from '@/features/map/components/MarkerLayer'
import { TerritoryLayer } from '@/features/map/components/TerritoryLayer'
import type { WorkoutRoutePoint } from '../types/workout-detail'
import { MapPin } from 'lucide-react'

interface WorkoutRouteMapProps {
  routePoints: WorkoutRoutePoint[]
  capturedCellIds?: string[]
}

export function WorkoutRouteMap({ routePoints, capturedCellIds = [] }: WorkoutRouteMapProps) {
  const bounds = useMemo(() => {
    if (routePoints.length < 2) return null
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    for (const p of routePoints) {
      if (p.lng < minLng) minLng = p.lng
      if (p.lat < minLat) minLat = p.lat
      if (p.lng > maxLng) maxLng = p.lng
      if (p.lat > maxLat) maxLat = p.lat
    }
    return [minLng, minLat, maxLng, maxLat] as [number, number, number, number]
  }, [routePoints])

  if (routePoints.length < 2) {
    return (
      <div className="bg-slate-900 rounded-3xl border border-white/[0.04] p-12 flex flex-col items-center justify-center text-center h-[500px] w-full">
        <MapPin className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-xl font-semibold text-foreground mb-2">No GPS Data</p>
        <p className="text-sm text-muted-foreground">This workout was recorded without route tracking.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[500px] rounded-3xl overflow-hidden border border-white/[0.04] shadow-2xl relative">
      <BaseMap bounds={bounds} className="w-full h-full">
        <TerritoryLayer 
          cellIds={capturedCellIds} 
          mode="highlight-captured" 
        />
        <RouteLayer routePoints={routePoints} />
        <MarkerLayer routePoints={routePoints} />
      </BaseMap>
    </div>
  )
}
