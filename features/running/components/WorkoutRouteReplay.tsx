"use client"

import { useMemo, useRef, useState, useEffect } from 'react'
import type { WorkoutRoutePoint, WorkoutTerritoryCapture } from '../types/workout-detail'
import { projectCoordinates, generatePolyline } from '@/features/share/utils/route-renderer'
import { MapPin } from 'lucide-react'

interface WorkoutRouteReplayProps {
  routePoints: WorkoutRoutePoint[]
  territoryCaptures: WorkoutTerritoryCapture[]
}

export function WorkoutRouteReplay({ routePoints, territoryCaptures }: WorkoutRouteReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const { pathData, markers, startPoint, endPoint } = useMemo(() => {
    if (!dimensions.width || !dimensions.height || routePoints.length === 0) {
      return { pathData: '', markers: [], startPoint: null, endPoint: null }
    }

    const padding = 60
    const allCoords = routePoints.map(p => ({ lat: p.lat, lng: p.lng }))
    
    const markerCoords = territoryCaptures.map(c => ({ lat: c.lat, lng: c.lng }))
    const combinedCoords = [...allCoords, ...markerCoords]
    
    const combinedProjected = projectCoordinates(combinedCoords, {
      width: dimensions.width,
      height: dimensions.height,
      padding
    })

    const projectedRoute = combinedProjected.slice(0, allCoords.length)
    const projectedMarkers = combinedProjected.slice(allCoords.length).map((point, i) => ({
      ...point,
      action: territoryCaptures[i].action
    }))
    
    const pathData = generatePolyline(projectedRoute)
    
    const startPoint = projectedRoute[0]
    const endPoint = projectedRoute[projectedRoute.length - 1]

    return { pathData, markers: projectedMarkers, startPoint, endPoint }
  }, [routePoints, territoryCaptures, dimensions])

  if (routePoints.length === 0) {
    return (
      <div className="bg-card rounded-3xl border border-white/[0.04] p-12 flex flex-col items-center justify-center text-center h-[500px]">
        <MapPin className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-xl font-semibold text-foreground mb-2">No GPS Data</p>
        <p className="text-sm text-muted-foreground">This workout was recorded without route tracking.</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="bg-slate-900 rounded-3xl border border-white/[0.04] overflow-hidden relative shadow-2xl h-[400px] md:h-full min-h-[500px]"
    >
      {/* Grid background for technical feel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {pathData && (
          <path
            d={`M ${pathData}`}
            fill="none"
            stroke="#3b82f6" // blue primary
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            className="drop-shadow-lg"
          />
        )}

        {/* Territory Markers */}
        {markers.map((m, i) => {
          let color = '#3b82f6'
          if (m.action === 'claim') color = '#10b981' // emerald
          if (m.action === 'steal') color = '#f59e0b' // amber
          if (m.action === 'defend') color = '#06b6d4' // cyan

          return (
            <g key={i} transform={`translate(${m.x}, ${m.y})`}>
              <circle r={12} fill={color} fillOpacity={0.2} />
              <circle r={6} fill={color} stroke="white" strokeWidth={2} />
            </g>
          )
        })}

        {/* Start / Finish Markers */}
        {startPoint && (
          <g transform={`translate(${startPoint.x}, ${startPoint.y})`}>
            <circle r={8} fill="white" stroke="#3b82f6" strokeWidth={3} />
          </g>
        )}
        
        {endPoint && (
          <g transform={`translate(${endPoint.x}, ${endPoint.y})`}>
            <circle r={8} fill="black" stroke="white" strokeWidth={3} />
            <rect x="-3" y="-3" width="6" height="6" fill="white" />
          </g>
        )}
      </svg>
    </div>
  )
}
