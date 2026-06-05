import { Calendar, Flag, Swords, Zap } from 'lucide-react'
import type { XpEvent } from '@/features/xp/types'

const EVENT_META = {
  workout: {
    label: 'Workout Complete',
    icon: <Zap className="h-4 w-4" />,
  },
  capture: {
    label: 'Cells Captured',
    icon: <Flag className="h-4 w-4" />,
  },
  steal: {
    label: 'Cells Stolen',
    icon: <Swords className="h-4 w-4" />,
  },
} as const

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function XPEventList({ events }: { events: readonly XpEvent[] }) {
  return (
    <section aria-labelledby="xp-events-heading" className="flex flex-col gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent XP Events
        </p>
        <h2 id="xp-events-heading" className="text-xl font-semibold text-foreground">
          Latest awards
        </h2>
      </div>

      {events.length === 0 ? (
        <div
          data-testid="xp-events-empty"
          className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center"
        >
          <Calendar className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-base font-semibold text-foreground">No XP events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a run to start building your activity feed.
          </p>
        </div>
      ) : (
        <ul data-testid="xp-events-list" className="flex flex-col gap-2">
          {events.map((event) => {
            const meta = EVENT_META[event.eventType]
            return (
              <li
                key={event.id}
                data-testid="xp-event-item"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{formatEventTime(event.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-primary">+{event.xpAwarded} XP</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {event.eventType}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
