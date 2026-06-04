import type { TerritoryOwnership } from '@/features/territory/types'
import { TerritoryStats } from './TerritoryStats'

export function TerritoryBoard({ ownedCells, stats }: { ownedCells: TerritoryOwnership[], stats: { totalCells: number } }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <TerritoryStats totalCells={stats.totalCells} />
      </section>

      <section>
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3 px-1">Owned Territories</h2>
        
        {ownedCells.length === 0 ? (
          <div data-testid="empty-state" className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-8 flex flex-col items-center justify-center text-center min-h-[140px]">
            <p className="text-sm font-medium text-muted-foreground">You don't own any territory yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Start a run to capture some cells!</p>
          </div>
        ) : (
          <div data-testid="owned-cells" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ownedCells.map(cell => (
              <div key={cell.cellId} className="bg-card/60 rounded-xl p-4 border border-white/[0.04]">
                <div className="font-mono text-sm font-medium mb-1">{cell.cellId}</div>
                <div className="text-xs text-muted-foreground/60">
                  Owned since: {new Date(cell.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
