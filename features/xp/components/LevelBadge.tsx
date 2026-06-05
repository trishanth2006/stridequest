import { Star } from 'lucide-react'

export function LevelBadge({ level }: { level: number }) {
  return (
    <div
      data-testid="level-badge"
      className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-primary"
    >
      <Star className="h-4 w-4 fill-current" />
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest">Level</span>
        <span className="text-lg font-bold tabular-nums">{level}</span>
      </div>
    </div>
  )
}
