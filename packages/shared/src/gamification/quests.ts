import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const questTypeSchema = z.enum(['distance_total', 'territory_claim', 'pace_best_km'])
export const questDurationSchema = z.enum(['daily', 'weekly'])
export const userQuestStatusSchema = z.enum(['active', 'completed', 'expired'])

export type QuestType = z.infer<typeof questTypeSchema>
export type QuestDuration = z.infer<typeof questDurationSchema>
export type UserQuestStatus = z.infer<typeof userQuestStatusSchema>

// ── Dictionary row ────────────────────────────────────────────────────────────

export const questSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: questTypeSchema,
  targetValue: z.number().positive(),
  rewardXp: z.number().int().min(0),
  durationType: questDurationSchema,
  rewardBadgeIcon: z.string().nullable(),
  rewardBadgeLabel: z.string().nullable(),
  windowEndHour: z.number().int().min(0).max(23).nullable(),
  isActive: z.boolean(),
})

export type Quest = z.infer<typeof questSchema>

// ── Active quest (one row from the ensure_active_quests RPC) ───────────────────

export const activeQuestSchema = z.object({
  userQuestId: z.string().uuid(),
  questId: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: questTypeSchema,
  targetValue: z.number(),
  rewardXp: z.number().int(),
  durationType: questDurationSchema,
  rewardBadgeIcon: z.string().nullable(),
  rewardBadgeLabel: z.string().nullable(),
  windowEndHour: z.number().int().min(0).max(23).nullable(),
  status: userQuestStatusSchema,
  currentValue: z.number().min(0),
  expiresAt: z.string(),
})

export type ActiveQuest = z.infer<typeof activeQuestSchema>

// ── Workout telemetry available at finalize time ──────────────────────────────

export const questWorkoutContextSchema = z.object({
  distanceM: z.number().min(0),
  durationS: z.number().min(0),
  avgPaceSPerKm: z.number().nullable(),
  bestKmPaceSPerKm: z.number().nullable(),
  cellsClaimed: z.number().int().min(0),
  cellsStolen: z.number().int().min(0),
  cellsDefended: z.number().int().min(0),
  completedAtHourUTC: z.number().int().min(0).max(23),
})

export type QuestWorkoutContext = z.infer<typeof questWorkoutContextSchema>

// ── Result element ────────────────────────────────────────────────────────────
// NOTE: deliberately NO rewardXp field — the DB awards XP authoritatively from
// the dictionary.

export const questUpdateSchema = z.object({
  userQuestId: z.string().uuid(),
  questId: z.string().uuid(),
  valueAdded: z.number().min(0),
  newValue: z.number(),
  completed: z.boolean(),
})

export type QuestUpdate = z.infer<typeof questUpdateSchema>

// ── Route point (input to bestKmPaceSPerKm) ───────────────────────────────────

export const questRoutePointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.string(),
})

export type QuestRoutePoint = z.infer<typeof questRoutePointSchema>

// ── Internal constants ────────────────────────────────────────────────────────

const FULL_KM_M = 1000

// ── Helpers ───────────────────────────────────────────────────────────────────
// Self-contained haversine — intentionally mirrors analytics/telemetry.ts rather
// than importing it, so this module can be ported to a Deno edge function later.

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const aq =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng
  return 2 * R * Math.atan2(Math.sqrt(aq), Math.sqrt(1 - aq))
}

// ── Function 1: fastest full 1 km split pace ──────────────────────────────────

/**
 * Returns the fastest FULL 1-kilometre split pace (seconds per km) over the
 * route, or `null` if the route has no complete 1 km segment (or < 2 points).
 *
 * Mirrors the full-KM bucketing of analytics `calculateSplits`: walk the route
 * accumulating non-overlapping 1000 m buckets, interpolating the crossing time
 * linearly at each boundary, and track the minimum full-bucket duration. Each
 * full bucket spans exactly 1000 m, so its pace (s/km) equals its duration (s).
 */
export function bestKmPaceSPerKm(points: QuestRoutePoint[]): number | null {
  if (!points || points.length < 2) return null

  const cumDist: number[] = [0]
  const times: number[] = [Date.parse(points[0].timestamp)]
  for (let i = 1; i < points.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversineMeters(points[i - 1], points[i])
    times[i] = Date.parse(points[i].timestamp)
  }

  const total = cumDist[cumDist.length - 1]
  if (total < FULL_KM_M) return null

  let segStartTime = times[0]
  let boundary = FULL_KM_M
  let bestPace: number | null = null

  for (let i = 1; i < points.length; i++) {
    const dPrev = cumDist[i - 1]
    const dCurr = cumDist[i]
    while (dCurr >= boundary && dPrev < boundary) {
      const span = dCurr - dPrev // > 0, guaranteed by the while guard
      const frac = (boundary - dPrev) / span
      const boundaryTime = times[i - 1] + frac * (times[i] - times[i - 1])
      const durationS = (boundaryTime - segStartTime) / 1000
      // Each bucket is exactly 1000 m, so pace (s/km) === durationS.
      if (durationS > 0 && (bestPace === null || durationS < bestPace)) {
        bestPace = durationS
      }
      segStartTime = boundaryTime
      boundary += FULL_KM_M
    }
  }

  return bestPace
}

// ── Function 2: evaluate quest progress for a finished workout ─────────────────

function rawContribution(quest: ActiveQuest, context: QuestWorkoutContext): number {
  switch (quest.type) {
    case 'distance_total':
      return context.distanceM
    case 'territory_claim':
      return context.cellsClaimed
    case 'pace_best_km':
      return context.bestKmPaceSPerKm != null &&
        context.bestKmPaceSPerKm <= quest.targetValue
        ? 1
        : 0
    default: {
      const _exhaustive: never = quest.type
      throw new Error(`Unhandled quest type: ${String(_exhaustive)}`)
    }
  }
}

function progressTarget(quest: ActiveQuest): number {
  return quest.type === 'pace_best_km' ? 1 : quest.targetValue
}

/**
 * Pure. For each active quest, compute this workout's contribution, clamp to the
 * remaining target, and emit a QuestUpdate ONLY when valueAdded > 0. The result
 * preserves input order; inputs are not mutated.
 */
export function evaluateQuestProgress(
  context: QuestWorkoutContext,
  activeQuests: ActiveQuest[],
): QuestUpdate[] {
  const updates: QuestUpdate[] = []

  for (const quest of activeQuests) {
    // Time window gate (type-agnostic): e.g. "finish before 8 AM" requires
    // completedAtHourUTC < 8.
    const gated =
      quest.windowEndHour != null && context.completedAtHourUTC >= quest.windowEndHour
    const contribution = gated ? 0 : rawContribution(quest, context)

    const target = progressTarget(quest)
    const remaining = Math.max(0, target - quest.currentValue)
    const valueAdded = Math.max(0, Math.min(contribution, remaining))
    if (valueAdded <= 0) continue

    const newValue = quest.currentValue + valueAdded
    updates.push({
      userQuestId: quest.userQuestId,
      questId: quest.questId,
      valueAdded,
      newValue,
      completed: newValue >= target,
    })
  }

  return updates
}
