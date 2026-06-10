"use client"

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import type { WorkoutRoutePoint } from '../types/workout-detail'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const rLat1 = lat1 * Math.PI / 180;
  const rLat2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rLat1) * Math.cos(rLat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

interface WorkoutChartsProps {
  routePoints: WorkoutRoutePoint[]
}

export function WorkoutCharts({ routePoints }: WorkoutChartsProps) {
  const chartData = useMemo(() => {
    if (!routePoints || routePoints.length < 2) return []

    const data = []
    let cumulativeDistance = 0
    const startTime = new Date(routePoints[0].timestamp).getTime()

    // Smooth window logic to avoid huge spikes in speed/pace due to GPS jitter
    // We'll calculate speed across small windows
    for (let i = 1; i < routePoints.length; i++) {
      const prev = routePoints[i - 1]
      const curr = routePoints[i]

      const distMeters = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)
      cumulativeDistance += distMeters

      const prevTime = new Date(prev.timestamp).getTime()
      const currTime = new Date(curr.timestamp).getTime()
      const dtSeconds = (currTime - prevTime) / 1000

      if (dtSeconds > 0) {
        const speedMps = distMeters / dtSeconds
        const speedKmph = speedMps * 3.6
        // Pace is min/km = 60 / speedKmph
        // Cap pace at 20 min/km so charts don't look broken when stopped
        const pace = speedKmph > 0 ? Math.min(20, 60 / speedKmph) : 20

        data.push({
          timeOffset: (currTime - startTime) / 1000,
          distanceOffset: cumulativeDistance / 1000, // km
          speed: speedKmph,
          pace: pace
        })
      }
    }

    // Apply a simple moving average to smooth the charts
    const windowSize = 5
    const smoothedData = data.map((d, idx, arr) => {
      let sumSpeed = 0
      let sumPace = 0
      let count = 0
      for (let j = Math.max(0, idx - windowSize); j <= Math.min(arr.length - 1, idx + windowSize); j++) {
        sumSpeed += arr[j].speed
        sumPace += arr[j].pace
        count++
      }
      return {
        ...d,
        speed: sumSpeed / count,
        pace: sumPace / count
      }
    })

    return smoothedData
  }, [routePoints])

  if (chartData.length === 0) {
    return null
  }

  const formatPace = (val: number) => {
    const mins = Math.floor(val)
    const secs = Math.floor((val - mins) * 60)
    return `${mins}:${secs.toString().padStart(2, '0')} /km`
  }

  const formatDistance = (val: number) => `${val.toFixed(2)} km`

  return (
    <div className="flex flex-col gap-8 w-full mt-8">
      {/* Pace Chart */}
      <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Pace</h3>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="distanceOffset" 
                tickFormatter={formatDistance} 
                stroke="rgba(255,255,255,0.4)" 
                fontSize={12}
                tickMargin={10}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                reversed={true} // Faster pace = lower min/km = higher up on chart
                tickFormatter={formatPace}
                stroke="rgba(255,255,255,0.4)" 
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                formatter={(value: any) => [formatPace(value), 'Pace']}
                labelFormatter={(label: any) => formatDistance(label)}
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Speed</h3>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="distanceOffset" 
                tickFormatter={formatDistance} 
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
                formatter={(value: any) => [`${Number(value).toFixed(1)} km/h`, 'Speed']}
                labelFormatter={(label: any) => formatDistance(label)}
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
