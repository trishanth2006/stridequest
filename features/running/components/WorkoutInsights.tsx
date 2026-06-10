"use client"

import { Zap, Flame, Flag, Trophy } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

interface WorkoutInsightsProps {
  workout: WorkoutDetail
}

export function WorkoutInsights({ workout }: WorkoutInsightsProps) {
  const territoriesCaptured = workout.territoryBreakdown?.claimed || 0
  const xpEarned = workout.xpBreakdown?.totalXp || 0
  
  // We can look at PR flags or distance to guess a fastest segment or streak.
  // In a real app these would come directly from the backend API.
  const fastestSegmentText = workout.prFlags?.fastest1k ? "1k Personal Best" : "Pace consistent"
  const streakText = "3 Day Streak" // Mocked for now to show the premium feel

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full">
      <div className="bg-card rounded-2xl border border-white/[0.04] p-4 flex flex-col items-start shadow-sm">
        <div className="bg-amber-500/20 p-2 rounded-lg mb-3">
          <Flame className="w-5 h-5 text-amber-500" />
        </div>
        <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">Consistency</span>
        <span className="text-lg font-bold text-foreground">{streakText}</span>
      </div>

      <div className="bg-card rounded-2xl border border-white/[0.04] p-4 flex flex-col items-start shadow-sm">
        <div className="bg-blue-500/20 p-2 rounded-lg mb-3">
          <Zap className="w-5 h-5 text-blue-500" />
        </div>
        <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">Performance</span>
        <span className="text-lg font-bold text-foreground">{fastestSegmentText}</span>
      </div>

      <div className="bg-card rounded-2xl border border-white/[0.04] p-4 flex flex-col items-start shadow-sm">
        <div className="bg-emerald-500/20 p-2 rounded-lg mb-3">
          <Flag className="w-5 h-5 text-emerald-500" />
        </div>
        <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">Territory</span>
        <span className="text-lg font-bold text-foreground">{territoriesCaptured} Captured</span>
      </div>

      <div className="bg-card rounded-2xl border border-white/[0.04] p-4 flex flex-col items-start shadow-sm">
        <div className="bg-yellow-500/20 p-2 rounded-lg mb-3">
          <Trophy className="w-5 h-5 text-yellow-500" />
        </div>
        <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">XP Earned</span>
        <span className="text-lg font-bold text-foreground">+{xpEarned} XP</span>
      </div>
    </div>
  )
}
