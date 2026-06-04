import type { TerritoryOwnership } from '@/features/territory/types'
import { TerritoryStats } from './TerritoryStats'
import { TerritoryMap } from './TerritoryMap'

export function TerritoryBoard({ ownedCells, stats }: { ownedCells: TerritoryOwnership[], stats: { totalCells: number } }) {
  const cellIds = ownedCells.map(cell => cell.cellId)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <TerritoryStats totalCells={stats.totalCells} />
      </section>

      <section>
        {ownedCells.length === 0 ? (
          <div data-testid="empty-state" className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-8 flex flex-col items-center justify-center text-center min-h-[140px]">
            <p className="text-sm font-medium text-muted-foreground">You don&apos;t own any territory yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Start a run to capture some cells!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <TerritoryMap cellIds={cellIds} />
            
            <details className="group border border-white/[0.04] bg-card/40 rounded-2xl overflow-hidden">
              <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none list-none flex items-center justify-between">
                <span>View Underlying Data (Debug)</span>
                <span className="text-xs border border-white/10 px-2 py-1 rounded-md bg-black/20 group-open:bg-primary/10 group-open:text-primary group-open:border-primary/20 transition-colors">
                  {ownedCells.length} cells
                </span>
              </summary>
              <div data-testid="owned-cells" className="p-5 border-t border-white/[0.04] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ownedCells.map(cell => (
                  <div key={cell.cellId} className="bg-card rounded-xl p-4 border border-white/[0.04]">
                    <div className="font-mono text-sm font-medium mb-1 text-foreground/80">{cell.cellId}</div>
                    <div className="text-xs text-muted-foreground/60">
                      Owned since: {new Date(cell.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  )
}
