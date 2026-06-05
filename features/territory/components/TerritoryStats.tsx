import type { HeatmapCell } from '@/features/territory/types'

/**
 * The territory stat row (02D-07B): Total Cells Owned, Total Captures, and the
 * Most Captured Cell. Pure presentational — values are computed server-side.
 */
export function TerritoryStats({
  totalCells,
  totalCaptures,
  mostCapturedCell,
}: {
  totalCells: number
  totalCaptures: number
  mostCapturedCell: HeatmapCell | null
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard label="Total Cells Owned">
        <span
          data-testid="territory-count"
          className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums"
        >
          {totalCells}
        </span>
      </StatCard>

      <StatCard label="Total Captures">
        <span
          data-testid="total-captures"
          className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums"
        >
          {totalCaptures}
        </span>
      </StatCard>

      <StatCard label="Most Captured Cell">
        {mostCapturedCell ? (
          <div data-testid="most-captured-cell" className="flex flex-col">
            <span
              className="font-mono text-sm font-semibold text-foreground truncate"
              title={mostCapturedCell.cellId}
            >
              {mostCapturedCell.cellId}
            </span>
            <span className="text-xs text-muted-foreground/70 tabular-nums">
              {mostCapturedCell.captures} captures
            </span>
          </div>
        ) : (
          <span
            data-testid="most-captured-cell"
            className="text-3xl font-mono font-bold text-muted-foreground/40"
          >
            —
          </span>
        )}
      </StatCard>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04]">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </h3>
      {children}
    </div>
  )
}
