"use client"

import type { AchievementCard } from '../types'

export function AchievementCardBody({ cardData }: { cardData: AchievementCard }) {
  return (
     <div className="flex flex-col items-center z-10 relative gap-8 px-12 text-center w-full">
      <div className="w-32 h-32 rounded-full bg-yellow-400/20 flex items-center justify-center mb-4">
         <span className="text-6xl">🏅</span>
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
}
