import { useCallback, useEffect, useState } from 'react'
import { fetchActiveQuests } from '../services/quests'
import type { ActiveQuest } from '@stridequest/shared'

export function useQuests(userId: string) {
  const [quests, setQuests] = useState<ActiveQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    void (async () => {
      try {
        const data = await fetchActiveQuests(userId)
        setQuests(data)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load quests')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  useEffect(() => { load() }, [load])

  return { quests, loading, error, refresh: load }
}
