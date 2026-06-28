type Entry<T> = { data: T; fetchedAt: number }

const store = new Map<string, Entry<unknown>>()

export function queryGet<T>(key: string, staleMs: number): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined
  if (!entry) return undefined
  if (Date.now() - entry.fetchedAt > staleMs) return undefined
  return entry.data
}

export function querySet<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() })
}

export function queryInvalidate(key: string): void {
  store.delete(key)
}
