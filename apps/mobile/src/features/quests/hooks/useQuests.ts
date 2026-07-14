import { useCallback, useEffect, useState } from 'react'
import { fetchActiveQuests } from '../services/quests'
import { queryGet, querySet, queryInvalidate, queryFetch } from '@/lib/queryCache'
import type { ActiveQuest } from '@stridequest/shared'

const STALE_MS = 30_000
const cacheKey = (userId: string) => `quests:${userId}`

export function useQuests(userId: string) {
  const [quests, setQuests] = useState<ActiveQuest[]>(
    () => (userId ? queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS) : undefined) ?? [],
  )
  const [loading, setLoading] = useState<boolean>(
    () => !(userId && queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS)),
  )
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!userId) { setLoading(false); return }

    const fresh = queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS)
    if (fresh) {
      setQuests(fresh)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    void (async () => {
      try {
        const data = await queryFetch(cacheKey(userId), () => fetchActiveQuests(userId))
        querySet(cacheKey(userId), data)
        setQuests(data)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load quests')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return
    queryInvalidate(cacheKey(userId))
    load()
  }, [userId, load])

  useEffect(() => { load() }, [load])

  return { quests, loading, error, refresh }
}
