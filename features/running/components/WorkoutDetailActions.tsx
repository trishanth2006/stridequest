"use client"

import { ShareDialog } from '@/features/share/components/ShareDialog'
import type { WorkoutDetail } from '../types/workout-detail'
import type { WorkoutShareCard } from '@/features/share/types'
import { generateShareHeadline } from '@/features/share/services/share-card'
import { Map, MapPin, Share } from 'lucide-react'
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
    totalTerritory: workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen, // Or any available total territory metric if needed
    level: workout.xpBreakdown.levelReached,
    date: workout.startedAt,
    routeData: workout.routePoints.length > 0 ? workout.routePoints.map(p => ({ lat: p.lat, lng: p.lng })) : undefined,
    territoryMarkers: workout.territoryCaptures.length > 0 ? workout.territoryCaptures.map(c => ({
      lat: c.lat,
      lng: c.lng,
      action: c.action === 'claim' ? 'claim' : 'steal'
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

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4">
      <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-1 px-1">Share Run</h3>
      
      <ShareDialog 
        cardData={fullWorkoutData} 
        defaultConfig={{ layout: 'classic' }}
        trigger={
          <Button variant="default" className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <Share className="w-4 h-4" />
            Share Workout
          </Button>
        } 
      />

      {workout.routePoints.length > 0 && (
        <ShareDialog 
          cardData={routeData} 
          defaultConfig={{ layout: 'hero-route' }}
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3 bg-white/[0.02] hover:bg-white/[0.04]">
              <Map className="w-4 h-4 text-blue-400" />
              Share Route
            </Button>
          } 
        />
      )}

      {(workout.territoryBreakdown.claimed > 0 || workout.territoryBreakdown.stolen > 0) && (
        <ShareDialog 
          cardData={territoryData} 
          defaultConfig={{ layout: 'territory' }}
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3 bg-white/[0.02] hover:bg-white/[0.04]">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Share Territory
            </Button>
          } 
        />
      )}
    </div>
  )
}
