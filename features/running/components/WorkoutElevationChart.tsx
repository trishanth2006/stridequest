"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { WorkoutChartPoint, WorkoutElevation } from '../types/workout-detail'

interface WorkoutElevationChartProps {
  chartSeries: WorkoutChartPoint[]
  elevation: WorkoutElevation
}

const formatDistanceAxis = (val: number) => `${val.toFixed(2)} km`

export function WorkoutElevationChart({ chartSeries, elevation }: WorkoutElevationChartProps) {
  // Only render real, measured elevation — never fabricate a profile.
  if (!elevation.hasData) return null
  const profile = chartSeries.filter((p) => p.altitude != null)
  if (profile.length < 2) return null

  const stats = [
    { label: 'Gain', value: `${elevation.gainM} m`, icon: TrendingUp, text: 'text-emerald-400' },
    { label: 'Loss', value: `${elevation.lossM} m`, icon: TrendingDown, text: 'text-amber-400' },
    { label: 'Highest', value: `${elevation.highestM} m`, icon: ArrowUp, text: 'text-foreground' },
    { label: 'Lowest', value: `${elevation.lowestM} m`, icon: ArrowDown, text: 'text-foreground' },
  ]

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl w-full">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">⛰ Elevation</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.02]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${s.text}`} />
                {s.label}
              </span>
              <span className="text-2xl font-mono font-bold text-foreground tabular-nums">{s.value}</span>
            </div>
          )
        })}
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={profile} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="distanceKm"
              tickFormatter={formatDistanceAxis}
              stroke="rgba(255,255,255,0.4)"
              fontSize={12}
              tickMargin={10}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(val) => `${Math.round(val)} m`}
              stroke="rgba(255,255,255,0.4)"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
              formatter={(value) => [`${Math.round(Number(value))} m`, 'Elevation']}
              labelFormatter={(label) => formatDistanceAxis(Number(label))}
            />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#elevFill)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
