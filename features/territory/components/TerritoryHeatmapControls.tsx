'use client'

/** Which visualization the territory map is showing. Default is `territory`. */
export type TerritoryMode = 'territory' | 'heatmap'

/**
 * Controlled [ Territory | Heatmap ] toggle (02D-07B). Pure presentational —
 * the parent owns the `mode` state so switching is instant and reload-free.
 */
export function TerritoryHeatmapControls({
  mode,
  onModeChange,
}: {
  mode: TerritoryMode
  onModeChange: (mode: TerritoryMode) => void
}) {
  return (
    <div
      data-testid="territory-mode-controls"
      role="group"
      aria-label="Map visualization mode"
      className="inline-flex self-start rounded-xl border border-white/[0.06] bg-card/40 p-1"
    >
      <ModeButton current={mode} value="territory" onSelect={onModeChange}>
        Territory
      </ModeButton>
      <ModeButton current={mode} value="heatmap" onSelect={onModeChange}>
        Heatmap
      </ModeButton>
    </div>
  )
}

function ModeButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: TerritoryMode
  value: TerritoryMode
  onSelect: (mode: TerritoryMode) => void
  children: React.ReactNode
}) {
  const active = current === value
  return (
    <button
      type="button"
      data-testid={`mode-${value}`}
      aria-pressed={active}
      onClick={() => onSelect(value)}
      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors outline-none ${
        active
          ? 'bg-primary/15 text-primary border border-primary/20'
          : 'text-muted-foreground hover:text-foreground border border-transparent'
      }`}
    >
      {children}
    </button>
  )
}
