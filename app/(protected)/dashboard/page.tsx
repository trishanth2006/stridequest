import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import {
  Zap, Map, Flame, Play, MapPin, History, Crown,
  Timer, TrendingUp, Calendar, Footprints,
} from 'lucide-react'

export const metadata = { title: 'Dashboard — StrideQuest' }

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, total_xp, total_distance_m')
    .eq('id', user.id)
    .single()

  const username = profile?.username ?? 'Runner'
  const totalXp = profile?.total_xp ?? 0
  const totalDistanceM = profile?.total_distance_m ?? 0
  const totalDistanceKm = (totalDistanceM / 1000).toFixed(1)
  const isNewUser = totalXp === 0 && totalDistanceM === 0

  return (
    <div className="relative flex flex-col gap-6 pb-12 pt-24">

      {/* ── Header row: greeting + CTA ── */}
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {isNewUser ? 'Welcome to StrideQuest' : 'Ready to conquer today?'}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground">
            {username}
          </h1>
        </div>
        <Link
          href="/run"
          id="start-run-cta"
          className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground transition-all duration-300 ease-out hover:scale-102 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] shrink-0"
        >
          <Play fill="currentColor" className="w-5 h-5" />
          Start Run
        </Link>
      </section>

      {/* ── Today's Activity ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TodayCard icon={<Footprints className="w-4 h-4" />} label="Distance Today" value="0" unit="m" />
        <TodayCard icon={<Timer className="w-4 h-4" />} label="Active Time" value="0" unit="min" />
        <TodayCard icon={<TrendingUp className="w-4 h-4" />} label="Runs This Week" value="0" unit="" />
        <TodayCard icon={<Zap className="w-4 h-4" />} label="XP Today" value="0" unit="xp" />
      </section>

      {/* ── Lifetime Stats (Bento) ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* XP */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total XP</span>
            <Zap className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3">
            <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">{totalXp.toLocaleString()}</span>
          </div>
        </div>

        {/* Distance */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Distance</span>
            <Map className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3 flex items-baseline gap-1.5">
            <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
              {totalDistanceM === 0 ? '0' : totalDistanceKm}
            </span>
            <span className="text-sm text-muted-foreground font-medium">{totalDistanceM === 0 ? 'm' : 'km'}</span>
          </div>
        </div>

        {/* Streak + Weekly */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Streak</span>
            <Flame className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">0</span>
              <span className="text-sm text-muted-foreground font-medium">days</span>
            </div>
            {/* Weekly progress with day labels */}
            <div className="flex gap-1">
              {DAY_LABELS.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-1.5 rounded-full ${i === 0 ? 'bg-primary/60' : 'bg-white/[0.06]'}`} />
                  <span className="text-[9px] font-medium text-muted-foreground/60">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Activity ── */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3 px-1">Recent Activity</h2>
        <div className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-8 flex flex-col items-center justify-center text-center min-h-[140px]">
          <Calendar className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Your runs will appear here</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Complete your first run to see your activity feed</p>
        </div>
      </section>

      {/* ── Explore ── */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3 px-1">Explore</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Territory Preview */}
          <div className="bg-card/60 rounded-2xl p-5 border border-white/[0.04] opacity-70 cursor-not-allowed group/card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <MapPin className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Territories</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Soon</span>
                </div>
                <p className="text-[11px] text-muted-foreground/60">Capture your city</p>
              </div>
            </div>
            {/* 3×3 Grid */}
            <div className="grid grid-cols-3 gap-1 p-2 bg-black/20 rounded-lg">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className={`aspect-square rounded-sm ${i === 4 ? 'bg-primary/30 border border-primary/40' : 'bg-white/[0.04]'}`} />
              ))}
            </div>
          </div>

          {/* History */}
          <Link href="/run/history" className="bg-card rounded-2xl p-5 border border-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group/hist">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/hist:bg-primary/10 transition-colors">
                <History className="w-4 h-4 text-muted-foreground/60 group-hover/hist:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Run History</h3>
                <p className="text-[11px] text-muted-foreground/60">View past sessions</p>
              </div>
            </div>
          </Link>

          {/* Leaderboard */}
          <div className="bg-card/60 rounded-2xl p-5 border border-white/[0.04] opacity-70 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <Crown className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Soon</span>
                </div>
                <p className="text-[11px] text-muted-foreground/60">See top runners</p>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}

/* ── Today Card (small metric) ── */
function TodayCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10">
      <div className="flex items-center gap-2 text-muted-foreground/60">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-mono font-bold text-foreground tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground font-medium">{unit}</span>}
      </div>
    </div>
  )
}
