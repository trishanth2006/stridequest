"use client"

import type { PersonalRecordCard, ShareConfig } from '../types'

export function RecordCardBody({ cardData, config }: { cardData: PersonalRecordCard; config: ShareConfig }) {
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
