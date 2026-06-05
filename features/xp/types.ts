/**
 * XP domain types (02E-01). Plain camelCase domain shapes (mirrors the
 * territory/running domain split); DB rows are mapped into these in the read
 * service. XP is server-awarded only — these are read models.
 */

/** The XP-earning event categories. 1:1 with the pure calc functions. */
export type XpEventType = 'workout' | 'capture' | 'steal'

/** A user's cumulative XP + derived level (the `user_xp` row, camelCase). */
export type UserXp = {
  userId: string
  totalXp: number
  level: number
  updatedAt: string
}

/** One audited XP award (the `xp_events` row, camelCase). Append-only. */
export type XpEvent = {
  id: string
  userId: string
  workoutId: string | null
  eventType: XpEventType
  xpAwarded: number
  createdAt: string
}

/** One completed workout with its awarded XP, newest first on the profile UI. */
export type WorkoutXpHistoryEntry = {
  workoutId: string
  startedAt: string
  xpAwarded: number
  distanceM: number | null
  durationS: number | null
}
