import type { WorkoutSummary } from '../types/workout-summary'

type Props = {
  summary: WorkoutSummary
}

export function TerritoryImpactCard({ summary }: Props) {
  const hasImpact = summary.cellsClaimed > 0 || summary.cellsStolen > 0 || summary.cellsDefended > 0

  return (
    <div className="bg-card rounded-2xl border border-white/10 p-6 shadow-xl" data-testid="territory-impact-card">
      <h3 className="text-lg font-bold text-foreground mb-4 text-center">Territory Impact</h3>
      
      {!hasImpact ? (
        <div className="text-center text-muted-foreground p-4 bg-black/20 rounded-xl border border-white/[0.04]">
          No territory captured this session.
        </div>
      ) : (
        <div className="flex flex-col gap-2 bg-black/20 rounded-xl p-4 border border-white/[0.04]">
          {summary.cellsClaimed > 0 && (
            <div className="flex justify-between items-center text-foreground/80" data-testid="impact-claimed">
              <span>Claimed</span>
              <span className="font-medium text-primary">{summary.cellsClaimed}</span>
            </div>
          )}
          {summary.cellsStolen > 0 && (
            <div className="flex justify-between items-center text-foreground/80" data-testid="impact-stolen">
              <span>Stolen</span>
              <span className="font-medium text-primary">{summary.cellsStolen}</span>
            </div>
          )}
          {summary.cellsDefended > 0 && (
            <div className="flex justify-between items-center text-foreground/80" data-testid="impact-defended">
              <span>Defended</span>
              <span className="font-medium text-primary">{summary.cellsDefended}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
