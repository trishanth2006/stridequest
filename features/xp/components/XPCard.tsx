import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type XPCardProps = {
  title: string
  value: ReactNode
  detail: string
  icon: ReactNode
  testId?: string
}

export function XPCard({ title, value, detail, icon, testId }: XPCardProps) {
  return (
    <Card className="border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div data-testid={testId} className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
