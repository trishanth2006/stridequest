"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WorkoutChartPoint } from '../types/workout-detail'

interface WorkoutChartsProps {
  /** Server-built, smoothed and down-sampled series. */
  chartSeries: WorkoutChartPoint[]
}

const formatPaceAxis = (val: number) => {
  const mins = Math.floor(val)
  const secs = Math.floor((val - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /km`
}

const formatDistanceAxis = (val: number) => `${val.toFixed(2)} km`

export function WorkoutCharts({ chartSeries }: WorkoutChartsProps) {
  if (chartSeries.length === 0) return null

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Pace Chart */}
      <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl">
        <h3 className="text-lg font-bold mb-6">Pace</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartSeries} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
                reversed
                tickFormatter={formatPaceAxis}
                stroke="rgba(255,255,255,0.4)"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                formatter={(value) => [formatPaceAxis(Number(value)), 'Pace']}
                labelFormatter={(label) => formatDistanceAxis(Number(label))}
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Speed Chart */}
      <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl">
        <h3 className="text-lg font-bold mb-6">Speed</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartSeries} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="distanceKm"
                tickFormatter={formatDistanceAxis}
                stroke="rgba(255,255,255,0.4)"
                fontSize={12}
                tickMargin={10}
              />
              <YAxis
                domain={[0, 'auto']}
                tickFormatter={(val) => `${val} km/h`}
                stroke="rgba(255,255,255,0.4)"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                formatter={(value) => [`${Number(value).toFixed(1)} km/h`, 'Speed']}
                labelFormatter={(label) => formatDistanceAxis(Number(label))}
              />
              <Line
                type="monotone"
                dataKey="speed"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
