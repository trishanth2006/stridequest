"use client"

import { ShareDialog } from '@/features/share/components/ShareDialog'
import type { WorkoutDetail } from '../types/workout-detail'
import type { WorkoutShareCard } from '@/features/share/types'
import { generateShareHeadline } from '@/features/share/services/share-card'
import { Map, Zap, MapPin, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WorkoutDetailActions({ workout }: { workout: WorkoutDetail }) {
  
  const baseCardData: Omit<WorkoutShareCard, 'headline'> = {
    type: 'workout',
    metadata: {
      generatedAt: new Date().toISOString(),
      strideQuestVersion: '0.1.0'
    },
    distance: workout.distanceM,
    duration: workout.durationS,
    pace: workout.avgPaceSPerKm,
    xp: workout.xpBreakdown.totalXp,
    territoriesCaptured: workout.territoryBreakdown.claimed,
    territoriesStolen: workout.territoryBreakdown.stolen,
    level: workout.xpBreakdown.levelReached,
    date: workout.startedAt,
    routeData: workout.routePoints.length > 0 ? workout.routePoints.map(p => ({ lat: p.lat, lng: p.lng })) : undefined,
    territoryMarkers: workout.territoryCaptures.length > 0 ? workout.territoryCaptures.map(c => ({
      lat: c.lat,
      lng: c.lng,
      action: c.action === 'claim' ? 'claim' : 'steal' // map defend -> steal or just ignore it, ShareCard expects claim/steal. Actually types allow defend if we cast. Let's cast.
    })) as any : undefined,
    hasPr: workout.prFlags.records.length > 0
  }

  // Preset 1: Full Workout
  const fullWorkoutData: WorkoutShareCard = {
    ...baseCardData,
    headline: generateShareHeadline('workout', { distance: workout.distanceM })
  }

  // Preset 2: Route Focus
  const routeData: WorkoutShareCard = {
    ...baseCardData,
    headline: 'Epic Route Completed'
  }

  // Preset 3: Territory Focus
  const territoryData: WorkoutShareCard = {
    ...baseCardData,
    headline: `Captured ${workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen} Cells!`
  }

  // Preset 4: XP Focus
  const xpData: WorkoutShareCard = {
    ...baseCardData,
    headline: `Earned ${workout.xpBreakdown.totalXp} XP`
  }

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4">
      <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-1 px-1">Share Run</h3>
      
      <ShareDialog 
        cardData={fullWorkoutData} 
        trigger={
          <Button variant="default" className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <Share className="w-4 h-4" />
            Share Full Workout
          </Button>
        } 
      />

      {workout.routePoints.length > 0 && (
        <ShareDialog 
          cardData={routeData} 
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3 bg-white/[0.02] hover:bg-white/[0.04]">
              <Map className="w-4 h-4 text-blue-400" />
              Share Route Polyline
            </Button>
          } 
        />
      )}

      {(workout.territoryBreakdown.claimed > 0 || workout.territoryBreakdown.stolen > 0) && (
        <ShareDialog 
          cardData={territoryData} 
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3 bg-white/[0.02] hover:bg-white/[0.04]">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Share Territories
            </Button>
          } 
        />
      )}

      {workout.xpBreakdown.totalXp > 0 && (
        <ShareDialog 
          cardData={xpData} 
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3 bg-white/[0.02] hover:bg-white/[0.04]">
              <Zap className="w-4 h-4 text-yellow-400" />
              Share XP Gain
            </Button>
          } 
        />
      )}
    </div>
  )
}
