import { WorkoutControls } from '@/features/running/components/WorkoutControls'

export const metadata = { title: 'Run — StrideQuest' }

export default function RunPage() {
  return (
    <div className="flex flex-col min-h-screen pt-24 pb-8 px-4">
      <div className="flex-1 w-full max-w-xl mx-auto flex flex-col justify-center">
        <WorkoutControls />
      </div>
    </div>
  )
}
