import { Activity, MapPin, Zap, Trophy } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* ── Left panel — branding (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">StrideQuest</span>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tighter text-foreground leading-tight max-w-md">
            Track your runs.<br />
            Capture territories.<br />
            Conquer your city.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-sm text-base leading-relaxed">
            A gamified running experience that turns every session into progress.
            Earn XP, build streaks, and compete with runners in your area.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-4 max-w-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">GPS-tracked runs with live distance</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">Earn XP for every session</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Trophy className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">Compete on leaderboards</span>
          </div>
        </div>
      </div>

      {/* ── Right panel — form card ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile-only logo */}
        <div className="mb-8 text-center lg:hidden">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04]">
            <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">StrideQuest</h1>
          <p className="mt-1 text-xs text-muted-foreground uppercase tracking-widest font-semibold">Track. Capture. Conquer.</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-card p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_rgba(0,0,0,0.4)] border border-white/[0.04]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
