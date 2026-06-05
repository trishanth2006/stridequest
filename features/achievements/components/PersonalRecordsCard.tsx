import type { PersonalRecord } from '../types'
import { getBestRecord } from '../services/achievements'
import { formatRecordValue, formatDistance } from '../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type PersonalRecordsCardProps = {
  records: PersonalRecord[]
  hasWorkouts: boolean
}

export function PersonalRecordsCard({ records, hasWorkouts }: PersonalRecordsCardProps) {
  if (records.length === 0) {
    if (hasWorkouts) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center" data-testid="records-empty-state-workouts">
          <p className="text-lg font-semibold text-foreground">Keep running.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete longer runs to unlock personal records.
          </p>
        </div>
      )
    } else {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center" data-testid="records-empty-state-new">
          <p className="text-lg font-semibold text-foreground">No personal records yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete a run of at least 1 km to begin setting records.
          </p>
        </div>
      )
    }
  }

  const bestRecord = getBestRecord(records);
  const remainingRecords = records.filter(r => r.id !== bestRecord?.id);

  const fixedOrder = [
    'fastest-1k',
    'fastest-5k',
    'fastest-10k',
    'longest-run',
    'most-xp-workout',
    'most-territory-workout',
    'most-efficient-run',
    'territory-efficiency'
  ];

  const orderedRemaining = fixedOrder
    .map(id => remainingRecords.find(r => r.id === id))
    .filter((r): r is PersonalRecord => !!r);

  const formatMetadata = (r: PersonalRecord) => {
    const parts: string[] = [];
    if (r.workoutDistanceM != null) {
      parts.push(`Run Distance: ${formatDistance(r.workoutDistanceM)}`);
    }
    if (r.workoutXp != null) {
      parts.push(`XP Earned: ${r.workoutXp}`);
    }
    if (r.achievedAt) {
      try {
        const dateStr = new Date(r.achievedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        parts.push(`Achieved ${dateStr}`);
      } catch {
        // Ignored
      }
    }
    return parts.join(' • ');
  };

  return (
    <div className="space-y-6" data-testid="personal-records-container">
      {/* Current Best Record Highlight */}
      {bestRecord && (
        <Card className="border-amber-500/20 bg-amber-500/[0.01]" data-testid="best-record-highlight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span role="img" aria-label="Medal">🏅</span> Current Best Record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <h3 className="text-xl font-bold text-foreground" data-testid="best-record-title">{bestRecord.title}</h3>
            <p className="text-3xl font-extrabold text-foreground tabular-nums" data-testid="best-record-value">
              {formatRecordValue(bestRecord.id, bestRecord.value)}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="best-record-metadata">
              {formatMetadata(bestRecord)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid of Remaining Records */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="remaining-records-grid">
        {orderedRemaining.map(record => (
          <Card key={record.id} className="border-white/[0.06] bg-white/[0.01]" data-testid={`record-card-${record.id}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {record.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xl font-bold text-foreground tabular-nums" data-testid={`record-value-${record.id}`}>
                {formatRecordValue(record.id, record.value)}
              </p>
              <p className="text-[10px] text-muted-foreground truncate" data-testid={`record-metadata-${record.id}`}>
                {formatMetadata(record)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
