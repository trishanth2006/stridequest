import { queryInvalidate } from './queryCache'

// Single source of truth for queryCache keys shared across screens, so a
// mutation in one place can invalidate the caches another screen reads.
export const DASHBOARD_KEY = 'dashboard'
export const TERRITORY_KEY = 'territory-screen'
export const profileKey = (userId: string) => `profile:${userId}`
export const questsKey = (userId: string) => `quests:${userId}`

/**
 * Invalidate every cache a completed run affects (XP, lifetime distance,
 * territory ownership, quest progress) so the next screen focus refetches
 * instead of serving stale data for up to the TTL window.
 */
export function invalidateAfterRun(userId: string): void {
  queryInvalidate(DASHBOARD_KEY)
  queryInvalidate(TERRITORY_KEY)
  queryInvalidate(profileKey(userId))
  queryInvalidate(questsKey(userId))
}
