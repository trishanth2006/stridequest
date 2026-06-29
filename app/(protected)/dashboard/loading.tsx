export default function DashboardLoading() {
  return (
    <div className="relative flex flex-col gap-6 pb-12 pt-24">
      {/* ── Header row ── */}
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-white/10 rounded-md skeleton-shimmer" />
          <div className="h-10 w-64 bg-white/10 rounded-md skeleton-shimmer" />
        </div>
        <div className="h-12 w-36 bg-primary/20 rounded-2xl skeleton-shimmer" />
      </section>

      {/* ── Today's Activity ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/50 backdrop-blur-md rounded-xl p-4 border border-white/[0.04] flex flex-col gap-3 min-h-[90px]">
            <div className="h-4 w-24 bg-white/10 rounded-md skeleton-shimmer" />
            <div className="h-7 w-16 bg-white/10 rounded-md mt-auto skeleton-shimmer" />
          </div>
        ))}
      </section>

      {/* ── Lifetime Stats (Bento) ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card/50 backdrop-blur-md rounded-2xl p-5 border border-white/[0.04] flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="h-4 w-20 bg-white/10 rounded-md skeleton-shimmer" />
              <div className="h-4 w-4 bg-white/10 rounded-full skeleton-shimmer" />
            </div>
            <div className="mt-auto pt-3">
              <div className="h-10 w-28 bg-white/10 rounded-md skeleton-shimmer" />
            </div>
          </div>
        ))}
      </section>

      {/* ── Recent Activity Feed ── */}
      <section className="flex flex-col gap-4 mt-2">
        <div className="h-4 w-32 bg-white/10 rounded-md mb-2 px-1 skeleton-shimmer" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-card/50 backdrop-blur-md rounded-2xl p-4 border border-white/[0.04] flex gap-4 items-center">
            <div className="h-10 w-10 bg-white/10 rounded-full shrink-0 skeleton-shimmer" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-4 w-48 bg-white/10 rounded-md skeleton-shimmer" />
              <div className="h-3 w-32 bg-white/10 rounded-md skeleton-shimmer" />
            </div>
            <div className="h-6 w-16 bg-white/10 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </section>

      {/* ── Explore ── */}
      <section className="mt-4">
        <div className="h-4 w-24 bg-white/10 rounded-md mb-3 px-1 skeleton-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card/50 backdrop-blur-md rounded-2xl p-5 border border-white/[0.04] flex items-center gap-3 h-[90px]">
              <div className="w-9 h-9 rounded-xl bg-white/10 shrink-0 skeleton-shimmer" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-24 bg-white/10 rounded-md skeleton-shimmer" />
                <div className="h-3 w-32 bg-white/10 rounded-md skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
