"use client"

import type { ShareConfig, ShareTheme, WorkoutShareCard } from '../types'
import { projectCoordinates, generatePolyline, validateRoute } from '../utils/route-renderer'

function routeStyleForTheme(theme: ShareTheme): { color: string; width: number } {
  switch (theme) {
    case 'midnight': return { color: '#ffffff', width: 8 }
    case 'retro': return { color: '#22c55e', width: 8 }
    case 'territory': return { color: '#0f172a', width: 8 }
    default: return { color: '#0f172a', width: 8 } // minimal
  }
}

interface WorkoutRouteProps {
  cardData: WorkoutShareCard
  config: ShareConfig
  dims: { width: number; height: number }
  isPortrait: boolean
  safeZoneTop: number
  safeZoneBottom: number
}

export function WorkoutRoute({ cardData, config, dims, isPortrait, safeZoneTop, safeZoneBottom }: WorkoutRouteProps) {
  if (!cardData.routeData || config.layout === 'territory') return null

  const isValid = validateRoute(cardData.routeData)
  if (!isValid) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center px-12">
        <span className="text-6xl mb-4">🏃</span>
        <span className="text-4xl font-bold uppercase tracking-widest mb-2">Short Run</span>
        <span className="text-xl opacity-60 uppercase tracking-widest mb-4">Route unavailable</span>
        <span className="text-2xl font-medium">Distance: {cardData.distance}m</span>
      </div>
    )
  }

  const routeStyle = routeStyleForTheme(config.theme)

  // If hero-route layout, use larger canvas
  const padding = config.layout === 'hero-route' ? 50 : 100
  const availableHeight = isPortrait
    ? dims.height - safeZoneTop - safeZoneBottom
    : dims.height - 200 // Default margins

  const projectedPoints = projectCoordinates(cardData.routeData, {
    width: dims.width,
    height: availableHeight,
    padding,
  })

  const pathData = generatePolyline(projectedPoints)

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
      top: isPortrait ? safeZoneTop : 100,
      bottom: isPortrait ? safeZoneBottom : 100,
    }}>
      <svg
        width={dims.width}
        height={availableHeight}
        className="overflow-visible"
      >
        <path
          d={`M ${pathData}`}
          fill="none"
          stroke={routeStyle.color}
          strokeWidth={routeStyle.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={config.theme === 'midnight' ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
        />
        {cardData.territoryMarkers && (() => {
           // Project territory markers
           const projectedMarkers = projectCoordinates(
             cardData.territoryMarkers as Array<{ lat: number; lng: number }>,
             { width: dims.width, height: availableHeight, padding }
           )

           return projectedMarkers.map((m, i) => {
             const action = cardData.territoryMarkers![i].action
             const color = action === 'claim' ? '#10b981' : '#ef4444' // emerald or red
             return (
               <circle
                 key={i}
                 cx={m.x}
                 cy={m.y}
                 r={routeStyle.width * 1.5}
                 fill={color}
                 stroke="white"
                 strokeWidth={2}
               />
             )
           })
        })()}
      </svg>
    </div>
  )
}

interface WorkoutStatsProps {
  cardData: WorkoutShareCard
  config: ShareConfig
}

export function WorkoutStats({ cardData, config }: WorkoutStatsProps) {
  // Check if it's the Territory Conquest layout
  if (config.layout === 'territory') {
     return (
       <div className="flex flex-col items-center z-10 relative mt-12 gap-8 px-12 text-center w-full">
         <div className="flex flex-col items-center gap-3 mb-4">
           <span className="text-7xl">🌍</span>
           <span className="text-4xl font-black uppercase tracking-tight">TERRITORY CONQUEST</span>
         </div>
         <div className="flex gap-16 justify-center w-full">
           <div className="flex flex-col items-center">
             <span className="text-xl opacity-80 uppercase tracking-widest mb-2">Captured</span>
             <span className="text-6xl font-black text-emerald-500">{cardData.territoriesCaptured || 0}</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-xl opacity-80 uppercase tracking-widest mb-2">Stolen</span>
             <span className="text-6xl font-black text-rose-500">{cardData.territoriesStolen || 0}</span>
           </div>
         </div>

         <div className="w-full h-px bg-current opacity-10 my-4" />

         <div className="flex flex-col items-center">
             <span className="text-xl opacity-80 uppercase tracking-widest mb-2">Total Territory</span>
             <span className="text-7xl font-black">{cardData.totalTerritory || 0}</span>
         </div>

         {cardData.xp !== undefined && cardData.xp > 0 && (
            <div className="mt-8 text-3xl font-bold text-yellow-500">
              +{cardData.xp} XP
            </div>
         )}
       </div>
     )
  }

  // Normal workout stats
  const stats: { label: string; value: string }[] = []
  if (cardData.distance !== undefined) {
    stats.push({ label: 'Distance', value: `${(cardData.distance / 1000).toFixed(2)} km` })
  }
  if (cardData.duration !== undefined) {
    const minutes = Math.floor(cardData.duration / 60)
    const seconds = cardData.duration % 60
    stats.push({ label: 'Time', value: `${minutes}:${seconds.toString().padStart(2, '0')}` })
  }
  if (cardData.pace !== undefined) {
    const paceMin = Math.floor(cardData.pace / 60)
    const paceSec = Math.floor(cardData.pace % 60)
    stats.push({ label: 'Pace', value: `${paceMin}:${paceSec.toString().padStart(2, '0')} /km` })
  }
  const showSecondary = config.layout !== 'hero-route'
  if (showSecondary && cardData.xp !== undefined) {
    stats.push({ label: 'XP', value: `+${cardData.xp}` })
  }
  if (showSecondary && cardData.level !== undefined) {
    stats.push({ label: 'Level', value: `${cardData.level}` })
  }
  if (showSecondary && cardData.territoriesCaptured !== undefined && cardData.territoriesCaptured > 0) {
    stats.push({ label: 'Captured', value: `${cardData.territoriesCaptured}` })
  }

  if (config.layout === 'hero-route') {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex justify-center gap-12 w-full">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-4xl font-bold">{s.value}</span>
              <span className="text-lg opacity-70 uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap justify-center gap-8 mt-8 z-10 relative">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="text-4xl font-bold">{s.value}</span>
          <span className="text-xl opacity-80 uppercase tracking-wider">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
