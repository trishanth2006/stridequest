import { Crown } from 'lucide-react'
import type { TerritoryKing } from '@/features/leaderboards/types'
import { Card, CardContent } from '@/components/ui/card'

/** Highlights the top territory owner, or an empty state when none exists. */
export function TerritoryKingCard({ king }: { king: TerritoryKing | null }) {
  if (!king) {
    return (
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent
          data-testid="territory-king-empty"
          className="flex items-center gap-3 py-6 text-sm text-muted-foreground"
        >
          <Crown className="h-5 w-5 text-muted-foreground" />
          No territory claimed yet — capture cells to seize the crown.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      data-testid="territory-king-card"
      className="border-amber-500/20 bg-amber-500/[0.04]"
    >
      <CardContent className="flex items-center gap-4 py-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-2xl">
          👑
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-400">
            <Crown className="h-3 w-3" /> Territory King
          </p>
          <p
            data-testid="territory-king-username"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            {king.username}
          </p>
          <p className="text-xs text-muted-foreground">
            ruling{' '}
            <span
              data-testid="territory-king-count"
              className="font-semibold text-foreground tabular-nums"
            >
              {king.territoryCount}
            </span>{' '}
            {king.territoryCount === 1 ? 'cell' : 'cells'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
