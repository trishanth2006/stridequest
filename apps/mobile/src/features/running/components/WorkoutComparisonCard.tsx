import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { WorkoutComparison, WorkoutComparisonEntry, ComparisonDeltas } from '@stridequest/shared/analytics'

interface WorkoutComparisonCardProps {
  comparison: WorkoutComparison
}

type Direction = 'lowerBetter' | 'higherBetter'

function colorFor(delta: number, direction: Direction): string {
  if (delta === 0) return '#a3a3a3'
  const good = direction === 'lowerBetter' ? delta < 0 : delta > 0
  return good ? '#34d399' : '#fbbf24' // emerald-400 / amber-400
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
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 9, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color, fontFamily: 'monospace' }}>{value}</Text>
    </View>
  )
}

function ComparisonRow({ entry }: { entry: WorkoutComparisonEntry }) {
  const d: ComparisonDeltas = entry.deltas
  return (
    <View style={{ gap: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: 1 }}>{entry.label}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <DeltaCell label="Dist" value={signedDistance(d.distanceDeltaM)} color={colorFor(d.distanceDeltaM, 'higherBetter')} />
        <DeltaCell label="Pace" value={`${sign(d.paceDeltaSPerKm)}${Math.abs(d.paceDeltaSPerKm)}s`} color={colorFor(d.paceDeltaSPerKm, 'lowerBetter')} />
        <DeltaCell label="Time" value={signedSeconds(d.timeDeltaS)} color={colorFor(d.timeDeltaS, 'lowerBetter')} />
        <DeltaCell label="XP" value={`${sign(d.xpDelta)}${Math.abs(d.xpDelta)}`} color={colorFor(d.xpDelta, 'higherBetter')} />
      </View>
    </View>
  )
}

export function WorkoutComparisonCard({ comparison }: WorkoutComparisonCardProps) {
  if (!comparison.hasHistory) return null

  const match = comparison.routeMatch
  const faster = match ? match.timeDeltaS < 0 : false

  return (
    <View style={{ backgroundColor: '#171717', borderRadius: 24, overflow: 'hidden' }}>
      <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="time" size={24} color="#10b981" />
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Historical Comparison</Text>
      </View>

      {match && (
        <View style={{ padding: 20, backgroundColor: 'rgba(16,185,129,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ionicons name="trophy" size={32} color="#34d399" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#34d399', textTransform: 'uppercase', letterSpacing: 1 }}>Route Comparison</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 20 }}>
              You ran this route {Math.abs(match.timeDeltaS)} seconds {faster ? 'faster' : 'slower'} than last time.
            </Text>
            {match.pacePctImprovement !== 0 && (
              <Text style={{ fontSize: 12, fontWeight: '700', fontFamily: 'monospace', color: match.pacePctImprovement > 0 ? '#34d399' : '#fbbf24', marginTop: 2 }}>
                {match.pacePctImprovement > 0 ? '+' : ''}{match.pacePctImprovement}% Pace Improvement
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={{ padding: 20, gap: 12 }}>
        {comparison.entries.map((entry) => (
          <ComparisonRow key={entry.key} entry={entry} />
        ))}
      </View>
    </View>
  )
}
