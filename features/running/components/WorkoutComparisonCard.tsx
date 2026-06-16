import { Trophy, History } from 'lucide-react'
import type { WorkoutComparison, WorkoutComparisonEntry, ComparisonDeltas } from '../types/workout-detail'

interface WorkoutComparisonCardProps {
  comparison: WorkoutComparison
}

type Direction = 'lowerBetter' | 'higherBetter'

function colorFor(delta: number, direction: Direction): string {
  if (delta === 0) return 'text-muted-foreground'
  const good = direction === 'lowerBetter' ? delta < 0 : delta > 0
  return good ? 'text-emerald-400' : 'text-amber-400'
}

function sign(n: number): string {
  return n > 0 ? '+' : n < 0 ? '−' : ''
}

function signedSeconds(s: number): string {
  const abs = Math.abs(s)
  const m = Math.floor(abs / 60)
  const sec = abs % 60
  return `${sign(s)}${m}:${sec.toString().padStart(2, '0')}`
}

function signedDistance(m: number): string {
  const abs = Math.abs(m)
  return abs >= 1000 ? `${sign(m)}${(abs / 1000).toFixed(2)} km` : `${sign(m)}${abs} m`
}

function DeltaCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className={`text-sm font-mono font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function ComparisonRow({ entry }: { entry: WorkoutComparisonEntry }) {
  const d: ComparisonDeltas = entry.deltas
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{entry.label}</span>
      <div className="grid grid-cols-4 gap-2">
        <DeltaCell label="Dist" value={signedDistance(d.distanceDeltaM)} color={colorFor(d.distanceDeltaM, 'higherBetter')} />
        <DeltaCell label="Pace" value={`${sign(d.paceDeltaSPerKm)}${Math.abs(d.paceDeltaSPerKm)}s`} color={colorFor(d.paceDeltaSPerKm, 'lowerBetter')} />
        <DeltaCell label="Time" value={signedSeconds(d.timeDeltaS)} color={colorFor(d.timeDeltaS, 'lowerBetter')} />
        <DeltaCell label="XP" value={`${sign(d.xpDelta)}${Math.abs(d.xpDelta)}`} color={colorFor(d.xpDelta, 'higherBetter')} />
      </div>
    </div>
  )
}

export function WorkoutComparisonCard({ comparison }: WorkoutComparisonCardProps) {
  if (!comparison.hasHistory) return null

  const match = comparison.routeMatch
  const faster = match ? match.timeDeltaS < 0 : false

  return (
    <div className="bg-card rounded-3xl border border-white/[0.04] shadow-2xl overflow-hidden flex flex-col w-full">
      <div className="p-6 border-b border-white/[0.04] flex items-center gap-3">
        <History className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-foreground">Historical Comparison</h3>
      </div>

      {match && (
        <div className="p-6 flex items-center gap-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-white/[0.04]">
          <Trophy className="w-8 h-8 text-emerald-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Route Comparison</span>
            <span className="text-lg font-bold text-foreground">
              You ran this route {Math.abs(match.timeDeltaS)} seconds {faster ? 'faster' : 'slower'} than last time.
            </span>
            {match.pacePctImprovement !== 0 && (
              <span className={`text-sm font-mono font-bold ${match.pacePctImprovement > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {match.pacePctImprovement > 0 ? '+' : ''}{match.pacePctImprovement}% Pace Improvement
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {comparison.entries.map((entry) => (
          <ComparisonRow key={entry.key} entry={entry} />
        ))}
      </div>
    </div>
  )
}
