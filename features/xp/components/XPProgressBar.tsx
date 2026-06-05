import type { XpProgress } from '@/features/xp/services/xp'

function formatValue(value: number | null): string {
  return value === null ? 'Max' : value.toLocaleString()
}

export function XPProgressBar({ progress }: { progress: XpProgress }) {
  return (
    <section className="space-y-4" aria-label="XP progress">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Progress to Next Level
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            {progress.nextLevel === null ? 'Max Level Reached' : `Level ${progress.currentLevel} to Level ${progress.nextLevel}`}
          </h2>
        </div>
        <div data-testid="xp-progress-percent" className="text-right">
          <p className="text-2xl font-bold tabular-nums text-foreground">{progress.progressPercent}%</p>
          <p className="text-xs text-muted-foreground">Progress</p>
        </div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          data-testid="xp-progress-fill"
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ProgressCell label="Current XP" value={progress.currentXp.toLocaleString()} />
        <ProgressCell label="Current Level XP" value={progress.currentLevelXp.toLocaleString()} />
        <ProgressCell label="Next Level XP" value={formatValue(progress.nextLevelXp)} />
        <ProgressCell label="XP Needed" value={progress.xpNeededToNextLevel.toLocaleString()} />
      </div>
    </section>
  )
}

function ProgressCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
