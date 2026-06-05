"use client"

import { forwardRef, useRef, useState, useLayoutEffect, useCallback } from 'react'
import type { AnyShareCard, ShareConfig } from '../types'
import { projectCoordinates, generatePolyline, validateRoute } from '../utils/route-renderer'
import { computeFitScale } from '../utils/fit-scale'
import { cn } from '@/lib/utils'

interface ShareCardPreviewProps {
  cardData: AnyShareCard
  config: ShareConfig
}

// Fixed dimensions based on Aspect Ratio
const DIMENSIONS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1920 }, // IG Story
  landscape: { width: 1200, height: 628 }, // Twitter
}

const SAFE_ZONE_TOP = 250
const SAFE_ZONE_BOTTOM = 300

export const ShareCardPreview = forwardRef<HTMLDivElement, ShareCardPreviewProps>(
  ({ cardData, config }, ref) => {
    const dims = DIMENSIONS[config.aspectRatio]

    const areaRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0.3)

    const recompute = useCallback(() => {
      const el = areaRef.current
      if (!el) return
      setScale(computeFitScale({ w: el.clientWidth, h: el.clientHeight }, { w: dims.width, h: dims.height }))
    }, [dims.width, dims.height])

    useLayoutEffect(() => {
      recompute()
      const el = areaRef.current
      if (!el || typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(recompute)
      ro.observe(el)
      return () => ro.disconnect()
    }, [recompute])

    const getThemeClasses = () => {
      switch (config.theme) {
        case 'midnight':
          return 'bg-slate-900 text-white'
        case 'territory':
          return 'bg-amber-50 text-slate-900 border-4 border-amber-500 bg-[linear-gradient(rgba(245,158,11,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.1)_1px,transparent_1px)] bg-[size:20px_20px]'
        case 'minimal':
          return 'bg-white text-slate-900'
        case 'retro':
          return 'bg-indigo-900 text-green-400 font-mono'
        default:
          return 'bg-white text-slate-900'
      }
    }

    const isPortrait = config.aspectRatio === 'portrait'

    const routeStyle = (() => {
      switch (config.theme) {
        case 'midnight': return { color: '#ffffff', width: 8 }
        case 'retro': return { color: '#22c55e', width: 8 }
        case 'territory': return { color: '#0f172a', width: 8 }
        default: return { color: '#0f172a', width: 8 } // minimal
      }
    })()

    const renderRoute = () => {
      if (cardData.type !== 'workout' || !cardData.routeData || config.layout === 'territory') return null

      const isValid = validateRoute(cardData.routeData, cardData.distance)
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

      // If hero-route layout, use larger canvas
      const padding = config.layout === 'hero-route' ? 50 : 100
      const availableHeight = isPortrait 
        ? dims.height - SAFE_ZONE_TOP - SAFE_ZONE_BOTTOM
        : dims.height - 200 // Default margins

      const projectedPoints = projectCoordinates(cardData.routeData, {
        width: dims.width,
        height: availableHeight,
        padding,
      })

      const pathData = generatePolyline(projectedPoints)

      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
          top: isPortrait ? SAFE_ZONE_TOP : 100,
          bottom: isPortrait ? SAFE_ZONE_BOTTOM : 100,
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

    const renderWorkoutStats = () => {
      if (cardData.type !== 'workout') return null

      // Check if it's the Territory Conquest layout
      if (config.layout === 'territory') {
         return (
           <div className="flex flex-col items-center z-10 relative mt-12 gap-8 px-12 text-center w-full">
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

    const renderCenterContent = () => {
      if (cardData.type === 'workout') {
        return renderWorkoutStats()
      } else if (cardData.type === 'level-up') {
        return (
          <div className="flex flex-col items-center z-10 relative mt-12 gap-4">
            <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-amber-600">
              {cardData.currentLevel}
            </span>
            <span className="text-2xl opacity-80 uppercase tracking-widest">Current Level</span>
            <div className="mt-8 text-xl">Total XP: {cardData.totalXp}</div>
          </div>
        )
      } else if (cardData.type === 'achievement') {
        return (
           <div className="flex flex-col items-center z-10 relative gap-8 px-12 text-center w-full">
            <div className="w-32 h-32 rounded-full bg-yellow-400/20 flex items-center justify-center mb-4">
               <span className="text-6xl">🏆</span>
            </div>
            <span className="text-7xl font-bold uppercase tracking-tight">{cardData.achievementTitle}</span>
            <span className="text-3xl opacity-80">{cardData.achievementDescription}</span>
            
            <div className="mt-8 px-8 py-3 rounded-full bg-current/10 border border-current/20 flex items-center gap-3">
              <span className="text-emerald-500">✓</span>
              <span className="text-xl font-bold uppercase tracking-widest">UNLOCKED</span>
            </div>
            <span className="text-xl opacity-60 mt-4">{new Date(cardData.metadata.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        )
      } else if (cardData.type === 'personal-record') {
        return (
           <div className="flex flex-col items-center z-10 relative gap-12 w-full px-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="text-4xl opacity-80 uppercase tracking-wider">{cardData.recordTitle}</span>
              <span className="text-8xl font-black">{cardData.recordValue}</span>
            </div>

            {config.showPreviousRecord && cardData.previousRecordValue && (
              <div className="flex flex-col items-center gap-2 pt-8 border-t border-current/10 w-full max-w-md">
                <span className="text-xl opacity-60 uppercase tracking-widest">Previous Best</span>
                <span className="text-3xl font-bold opacity-80">{cardData.previousRecordValue}</span>
              </div>
            )}
          </div>
        )
      }
      return null
    }

    const renderBadges = () => {
      const badges = []
      if (cardData.type === 'level-up') {
        badges.push('⚡ Level Up')
      }
      if (cardData.type === 'personal-record' && cardData.hasNewRecord !== false) {
        badges.push('🏅 NEW PERSONAL RECORD')
      }
      if (cardData.type === 'workout' && cardData.hasPr) {
        badges.push('🏅 PERSONAL RECORD')
      }

      if (badges.length === 0) return null

      return (
        <div className="flex gap-4 justify-center z-10 relative mt-6">
          {badges.map((b, i) => (
             <div key={i} className={cn(
               "px-6 py-2 rounded-full text-xl font-bold uppercase tracking-wider shadow-lg",
               config.theme === 'midnight' ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-900"
             )}>
               {b}
             </div>
          ))}
        </div>
      )
    }

    const isAchievementCard = cardData.type === 'achievement'
    const isHeroRoute = config.layout === 'hero-route' && cardData.type === 'workout'
    
    // Check if we should fallback to workout layout if hero-route is selected but route is invalid
    const isRouteInvalid = cardData.type === 'workout' && cardData.routeData && !validateRoute(cardData.routeData, cardData.distance)
    const effectiveLayout = (isHeroRoute && isRouteInvalid) ? 'classic' : config.layout

    return (
      <div
        ref={areaRef}
        className="relative w-full h-full flex items-center justify-center p-4"
      >
        <div
          data-testid="share-card-sized-wrapper"
          style={{ width: dims.width * scale, height: dims.height * scale }}
          className="relative"
        >
          <div
            ref={ref}
            data-testid="share-card-export"
            className={cn(
              'absolute top-0 left-0 overflow-hidden flex flex-col items-center shadow-2xl',
              getThemeClasses(),
            )}
            style={{
              width: dims.width,
              height: dims.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
          {/* Main Content Area */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{
            paddingTop: isPortrait ? SAFE_ZONE_TOP : 100,
            paddingBottom: isPortrait ? SAFE_ZONE_BOTTOM : 100,
          }}>
            {/* Top Section */}
            {!isAchievementCard && (
              <div className="flex flex-col items-center z-10 relative px-12 text-center mt-12">
                <h1 className="text-5xl font-black uppercase tracking-tight max-w-full truncate px-4">
                  {cardData.headline}
                </h1>
                {renderBadges()}
              </div>
            )}

            {/* Middle Section (Route usually sits behind this) */}
            <div className="flex-grow flex items-center justify-center pointer-events-none">
              {/* Route is rendered absolute, Stats go here if center layout */}
              {effectiveLayout !== 'hero-route' && renderCenterContent()}
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col items-center z-10 relative pb-12 w-full px-12">
               {effectiveLayout === 'hero-route' && renderCenterContent()}
            </div>
          </div>

          {/* Route Layer */}
          {renderRoute()}

          {/* Branding */}
          <div className={cn(
            "absolute z-20 flex items-center gap-4",
            isPortrait ? "bottom-40" : "bottom-12",
            "right-12"
          )}>
             <span className="text-3xl font-black tracking-tighter uppercase opacity-50">
               StrideQuest
             </span>
          </div>
        </div>
      </div>
    </div>
    )
  }
)

ShareCardPreview.displayName = 'ShareCardPreview'
