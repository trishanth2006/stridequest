import { supabase } from '@/lib/supabase'
import type { ActiveQuest } from '@stridequest/shared'

type RpcActiveQuestRow = {
  user_quest_id: string
  quest_id: string
  slug: string
  title: string
  description: string
  type: ActiveQuest['type']
  target_value: number | string
  reward_xp: number | string
  duration_type: ActiveQuest['durationType']
  reward_badge_icon: string | null
  reward_badge_label: string | null
  window_end_hour: number | null
  status: ActiveQuest['status']
  current_value: number | string
  expires_at: string
}

export async function fetchActiveQuests(userId: string): Promise<ActiveQuest[]> {
  const { data, error } = await supabase.rpc('ensure_active_quests', { p_user_id: userId })
  if (error) throw new Error(error.message)
  const rows = data as RpcActiveQuestRow[] | null
  return (rows ?? []).map((row) => ({
    userQuestId: row.user_quest_id,
    questId: row.quest_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    targetValue: Number(row.target_value) || 0,
    rewardXp: Number(row.reward_xp) || 0,
    durationType: row.duration_type,
    rewardBadgeIcon: row.reward_badge_icon,
    rewardBadgeLabel: row.reward_badge_label,
    windowEndHour: row.window_end_hour === null ? null : Number(row.window_end_hour),
    status: row.status,
    currentValue: Number(row.current_value) || 0,
    expiresAt: row.expires_at,
  }))
}
