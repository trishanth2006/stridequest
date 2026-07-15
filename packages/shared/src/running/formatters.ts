export function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return '0.00 km'
  return `${(meters / 1000).toFixed(2)} km`
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)

  if (h > 0) {
    const mins = m % 60
    return `${h}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function formatPace(paceSPerKm: number | null): string {
  if (!paceSPerKm) return '--:-- /km'
  const m = Math.floor(paceSPerKm / 60)
  const s = Math.floor(paceSPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}
