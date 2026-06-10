"use client"

import { forwardRef, useRef, useState, useLayoutEffect, useCallback } from 'react'
import type { AnyShareCard, ShareConfig } from '../types'
import { validateRoute } from '../utils/route-renderer'
import { computeFitScale } from '../utils/fit-scale'
import { WorkoutRoute, WorkoutStats } from './WorkoutCardBody'
import { AchievementCardBody } from './AchievementCardBody'
import { RecordCardBody } from './RecordCardBody'
import { LevelUpCardBody } from './LevelUpCardBody'
import { cn } from '@/lib/utils'

interface ShareCardPreviewProps {
  cardData: AnyShareCard
  config: ShareConfig
  editable?: boolean
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
  ({ cardData, config, editable = false }, ref) => {
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

    const renderCenterContent = () => {
      switch (cardData.type) {
        case 'workout':
          return <WorkoutStats cardData={cardData} config={config} />
        case 'level-up':
          return <LevelUpCardBody cardData={cardData} />
        case 'achievement':
          return <AchievementCardBody cardData={cardData} />
        case 'personal-record':
          return <RecordCardBody cardData={cardData} config={config} />
        default:
          return null
      }
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

    const isHeroRoute = config.layout === 'hero-route' && cardData.type === 'workout'

    // Check if we should fallback to workout layout if hero-route is selected but route is invalid
    const isRouteInvalid = cardData.type === 'workout' && cardData.routeData && !validateRoute(cardData.routeData)
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
            <div className="flex flex-col items-center z-10 relative px-12 text-center mt-12">
              <h1
                data-testid="share-headline"
                contentEditable={editable}
                suppressContentEditableWarning
                spellCheck={false}
                className={cn(
                  'text-5xl font-black uppercase tracking-tight max-w-full px-4 outline-none',
                  editable && 'focus:ring-2 focus:ring-white/40 rounded cursor-text',
                )}
              >
                {cardData.headline}
              </h1>
              {renderBadges()}
            </div>

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
          {cardData.type === 'workout' && (
            <WorkoutRoute
              cardData={cardData}
              config={config}
              dims={dims}
              isPortrait={isPortrait}
              safeZoneTop={SAFE_ZONE_TOP}
              safeZoneBottom={SAFE_ZONE_BOTTOM}
            />
          )}

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
