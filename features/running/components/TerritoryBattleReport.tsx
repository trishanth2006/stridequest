"use client"

import type { WorkoutDetail } from '../types/workout-detail'
import { Swords, Shield, Target, Activity } from 'lucide-react'

export function TerritoryBattleReport({ workout }: { workout: WorkoutDetail }) {
  const { claimed, stolen, defended, totalImpact } = workout.territoryBreakdown
  const captured = claimed + stolen

  if (totalImpact === 0) return null

  return (
    <div className="bg-card rounded-3xl border border-white/[0.04] shadow-2xl overflow-hidden flex flex-col w-full relative">
      <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="p-6 border-b border-white/[0.04] flex items-center gap-3 bg-gradient-to-r from-primary/10 to-transparent">
        <Swords className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-foreground">Territory Battle Report</h3>
      </div>
      
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/20">
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <Target className="w-4 h-4 text-emerald-500" />
             Captured
          </div>
          <span className="text-4xl font-mono font-bold text-foreground">{captured}</span>
        </div>
        
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <Shield className="w-4 h-4 text-cyan-500" />
             Defended
          </div>
          <span className="text-4xl font-mono font-bold text-foreground">{defended}</span>
        </div>

        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <Swords className="w-4 h-4 text-amber-500" />
             Stolen
          </div>
          <span className="text-4xl font-mono font-bold text-foreground">{stolen}</span>
        </div>
        
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <Activity className="w-4 h-4 text-primary" />
             Impact
          </div>
          <span className="text-4xl font-mono font-bold text-foreground">{totalImpact}</span>
        </div>
      </div>
    </div>
  )
}
