"use client"

import type { LevelUpCard } from '../types'

export function LevelUpCardBody({ cardData }: { cardData: LevelUpCard }) {
  return (
    <div className="flex flex-col items-center z-10 relative mt-12 gap-3 text-center">
      <span className="text-7xl font-black uppercase tracking-tight">
        LEVEL {cardData.currentLevel}
      </span>
      <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-amber-600">
        {cardData.totalXp} XP
      </span>
      {cardData.xpToNextLevel !== undefined && cardData.xpToNextLevel > 0 && (
        <div className="mt-8 flex flex-col items-center gap-1">
          <span className="text-xl opacity-70 uppercase tracking-widest">Next Level</span>
          <span className="text-3xl font-bold">{cardData.xpToNextLevel} XP Remaining</span>
        </div>
      )}
    </div>
  )
}
