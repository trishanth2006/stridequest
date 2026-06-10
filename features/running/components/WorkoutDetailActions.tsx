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
    totalTerritory: workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen,
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

  const fullWorkoutData: WorkoutShareCard = {
    ...baseCardData,
    headline: generateShareHeadline('workout', { distance: workout.distanceM })
  }

  const routeData: WorkoutShareCard = {
    ...baseCardData,
    headline: 'Epic Route Completed'
  }

  const territoryData: WorkoutShareCard = {
    ...baseCardData,
    headline: `Captured ${workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen} Cells!`
  }

  const hasTerritory = workout.territoryBreakdown.claimed > 0 || workout.territoryBreakdown.stolen > 0

  return (
    <div className="bg-card rounded-3xl border border-white/[0.04] p-8 shadow-2xl flex flex-col gap-4 relative overflow-hidden w-full">
      <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="mb-2 relative z-10">
        <h3 className="text-xl font-bold text-foreground mb-1">Spread the Word</h3>
        <p className="text-sm text-muted-foreground">Show off your run and territory claims.</p>
      </div>
      
      <div className="relative z-10 flex flex-col gap-3">
        <ShareDialog 
          cardData={hasTerritory ? territoryData : fullWorkoutData} 
          defaultConfig={{ layout: hasTerritory ? 'territory' : 'classic' }}
          trigger={
            <Button variant="default" className="w-full justify-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 text-lg rounded-2xl shadow-[0_0_20px_rgba(252,82,0,0.3)] hover:shadow-[0_0_30px_rgba(252,82,0,0.5)] transition-all">
              <Share className="w-5 h-5" />
              {hasTerritory ? 'Share Conquest' : 'Share Run'}
            </Button>
          } 
        />

        <div className="grid grid-cols-2 gap-3 mt-2">
          {workout.routePoints.length > 0 && (
            <ShareDialog 
              cardData={routeData} 
              defaultConfig={{ layout: 'hero-route' }}
              trigger={
                <Button variant="outline" className="w-full justify-center gap-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl h-11">
                  <Map className="w-4 h-4 text-blue-400" />
                  Route
                </Button>
              } 
            />
          )}

          {hasTerritory && (
            <ShareDialog 
              cardData={territoryData} 
              defaultConfig={{ layout: 'territory' }}
              trigger={
                <Button variant="outline" className="w-full justify-center gap-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl h-11">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  Territory
                </Button>
              } 
            />
          )}
        </div>
      </div>
    </div>
  )
}
