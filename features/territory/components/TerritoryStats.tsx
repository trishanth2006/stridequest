export function TerritoryStats({ totalCells }: { totalCells: number }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04]">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Total Cells Owned</h3>
      <p data-testid="territory-count" className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
        {totalCells}
      </p>
    </div>
  )
}
