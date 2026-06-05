"use client"

import { forwardRef } from 'react'
import type { AnyShareCard, ShareConfig } from '../types'
import { projectCoordinates, generatePolyline } from '../utils/route-renderer'
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
const SAFE_ZONE_BOTTOM = 250

export const ShareCardPreview = forwardRef<HTMLDivElement, ShareCardPreviewProps>(
  ({ cardData, config }, ref) => {
    const dims = DIMENSIONS[config.aspectRatio]

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

    const renderRoute = () => {
      if (cardData.type !== 'workout' || !cardData.routeData || !config.showRoute) return null

      // If hero-route layout, use larger canvas
      const padding = config.layout === 'hero-route' ? 50 : 100
      const availableHeight = config.aspectRatio === 'portrait' 
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
          top: config.aspectRatio === 'portrait' ? SAFE_ZONE_TOP : 100,
          bottom: config.aspectRatio === 'portrait' ? SAFE_ZONE_BOTTOM : 100,
        }}>
          <svg
            width={dims.width}
            height={availableHeight}
            className="overflow-visible"
          >
            <path
              d={`M ${pathData}`}
              fill="none"
              stroke={config.routeColor}
              strokeWidth={config.routeThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={config.theme === 'midnight' ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
            />
            {config.showTerritoryOverlay && cardData.territoryMarkers && (() => {
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
                     r={config.routeThickness * 1.5} 
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

    const renderStats = () => {
      if (cardData.type === 'workout') {
        const stats = []
        if (config.showDistance && cardData.distance !== undefined) {
          stats.push({ label: 'Distance', value: `${(cardData.distance / 1000).toFixed(2)} km` })
        }
        if (config.showDuration && cardData.duration !== undefined) {
          const minutes = Math.floor(cardData.duration / 60)
          const seconds = cardData.duration % 60
          stats.push({ label: 'Time', value: `${minutes}:${seconds.toString().padStart(2, '0')}` })
        }
        if (config.showPace && cardData.pace !== undefined) {
          const paceMin = Math.floor(cardData.pace / 60)
          const paceSec = Math.floor(cardData.pace % 60)
          stats.push({ label: 'Pace', value: `${paceMin}:${paceSec.toString().padStart(2, '0')} /km` })
        }
        if (config.showXp && cardData.xp !== undefined) {
          stats.push({ label: 'XP', value: `+${cardData.xp}` })
        }
        if (config.showLevel && cardData.level !== undefined) {
          stats.push({ label: 'Level', value: `${cardData.level}` })
        }
        if (config.showTerritories && cardData.territoriesCaptured !== undefined && cardData.territoriesCaptured > 0) {
          stats.push({ label: 'Captured', value: `${cardData.territoriesCaptured}` })
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
      } else if (cardData.type === 'level-up') {
        return (
          <div className="flex flex-col items-center z-10 relative mt-12 gap-4">
            <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-amber-600">
              {cardData.currentLevel}
            </span>
            <span className="text-2xl opacity-80 uppercase tracking-widest">Current Level</span>
            {config.showXp && (
              <div className="mt-8 text-xl">Total XP: {cardData.totalXp}</div>
            )}
          </div>
        )
      } else if (cardData.type === 'achievement') {
        return (
           <div className="flex flex-col items-center z-10 relative mt-12 gap-6 px-12 text-center">
            <span className="text-6xl font-bold">{cardData.achievementTitle}</span>
            <span className="text-3xl opacity-80">{cardData.achievementDescription}</span>
          </div>
        )
      } else if (cardData.type === 'personal-record') {
        return (
           <div className="flex flex-col items-center z-10 relative mt-12 gap-4">
            <span className="text-4xl opacity-80 uppercase tracking-wider">{cardData.recordTitle}</span>
            <span className="text-8xl font-black">{cardData.recordValue}</span>
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
      if (cardData.type === 'achievement') {
        badges.push('🏆 Achievement Unlocked')
      }
      if (cardData.type === 'personal-record') {
        badges.push('🏅 New Personal Record')
      }
      if (cardData.type === 'workout' && cardData.hasPr) {
        badges.push('🏅 Personal Record')
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

    // Determine layout structure based on config.layout and aspectRatio
    const isPortrait = config.aspectRatio === 'portrait'

    return (
      <div 
        className="relative overflow-hidden w-full h-full flex items-center justify-center transition-all bg-slate-200/50"
        style={{ padding: '2rem' }} // outer container just for visual scaling in editor
      >
        <div
          ref={ref}
          className={cn(
            'relative overflow-hidden flex flex-col items-center shadow-2xl',
            getThemeClasses(),
            config.transparentBackground ? 'bg-transparent' : ''
          )}
          style={{
            width: dims.width,
            height: dims.height,
            // Use transform to scale down the actual node so it fits in the editor view
            // The actual exported size is strictly width/height
            transform: 'scale(0.35)', // Adjusted dynamically by parent if needed, but we hardcode for simple preview here or let editor handle it via zoom wrappers.
            transformOrigin: 'top center',
          }}
        >
          {/* Main Content Area */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{
            paddingTop: isPortrait ? SAFE_ZONE_TOP : 100,
            paddingBottom: isPortrait ? SAFE_ZONE_BOTTOM : 100,
          }}>
            {/* Top Section */}
            <div className="flex flex-col items-center z-10 relative px-12 text-center">
              <h1 className="text-5xl font-black uppercase tracking-tight max-w-full truncate px-4">
                 {cardData.headline}
              </h1>
              {renderBadges()}
            </div>

            {/* Middle Section (Route usually sits behind this) */}
            <div className="flex-grow flex items-center justify-center pointer-events-none">
              {/* Route is rendered absolute, Stats go here if center layout */}
              {config.layout !== 'hero-route' && renderStats()}
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col items-center z-10 relative pb-12">
               {config.layout === 'hero-route' && renderStats()}
            </div>
          </div>

          {/* Route Layer */}
          {renderRoute()}

          {/* Branding */}
          {config.showBranding && (
            <div className={cn(
              "absolute z-20 flex items-center gap-4",
              isPortrait ? "bottom-32" : "bottom-12",
              "right-12"
            )}>
               <span className="text-3xl font-black tracking-tighter uppercase opacity-50">
                 StrideQuest
               </span>
            </div>
          )}
        </div>
      </div>
    )
  }
)

ShareCardPreview.displayName = 'ShareCardPreview'
