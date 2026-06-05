import { WorkoutXpSummary } from './WorkoutXpSummary'
import { WorkoutTerritorySummary } from './WorkoutTerritorySummary'
import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutMetricsGrid({ workout }: { workout: WorkoutDetail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <WorkoutXpSummary workout={workout} />
      <WorkoutTerritorySummary workout={workout} />
    </div>
  )
}
