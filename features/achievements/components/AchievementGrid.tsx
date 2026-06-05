import type { Achievement } from '../types'
import { AchievementCard } from './AchievementCard'
import { getCategorySummaries, groupAchievementsByCategory, sortAchievements } from '../services/achievements'

export function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center" data-testid="achievements-empty-state">
        <p className="text-lg font-semibold text-foreground">No achievements</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No achievements unlocked yet. Complete your first workout to start earning achievements.
        </p>
      </div>
    )
  }

  const summaries = getCategorySummaries(achievements);
  const grouped = groupAchievementsByCategory(achievements);
  
  const sortedRunning = sortAchievements(grouped.running);
  const sortedTerritory = sortAchievements(grouped.territory);
  const sortedXp = sortAchievements(grouped.xp);

  return (
    <div className="space-y-8" data-testid="achievements-grid">
      {/* Category Summaries */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="category-summaries-grid">
        <div data-testid="category-summary-running" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Running">🏃</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Running</p>
              <p className="text-xs text-muted-foreground">Category</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">
              {summaries.running.unlocked} / {summaries.running.total}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unlocked</p>
          </div>
        </div>

        <div data-testid="category-summary-territory" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Territory">🌍</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Territory</p>
              <p className="text-xs text-muted-foreground">Category</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">
              {summaries.territory.unlocked} / {summaries.territory.total}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unlocked</p>
          </div>
        </div>

        <div data-testid="category-summary-xp" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="XP">⚡</span>
            <div>
              <p className="text-sm font-semibold text-foreground">XP</p>
              <p className="text-xs text-muted-foreground">Category</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">
              {summaries.xp.unlocked} / {summaries.xp.total}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unlocked</p>
          </div>
        </div>
      </div>

      {/* Grouped lists */}
      <div className="space-y-8" data-testid="categories-container">
        {sortedRunning.length > 0 && (
          <section className="space-y-4" aria-labelledby="running-achievements-title" data-testid="running-category-section">
            <h3 id="running-achievements-title" className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span role="img" aria-label="Running Icon">🏃</span> Running Achievements
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="running-achievements-grid">
              {sortedRunning.map(ach => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </div>
          </section>
        )}

        {sortedTerritory.length > 0 && (
          <section className="space-y-4" aria-labelledby="territory-achievements-title" data-testid="territory-category-section">
            <h3 id="territory-achievements-title" className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span role="img" aria-label="Territory Icon">🌍</span> Territory Achievements
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="territory-achievements-grid">
              {sortedTerritory.map(ach => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </div>
          </section>
        )}

        {sortedXp.length > 0 && (
          <section className="space-y-4" aria-labelledby="xp-achievements-title" data-testid="xp-category-section">
            <h3 id="xp-achievements-title" className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span role="img" aria-label="XP Icon">⚡</span> XP Achievements
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="xp-achievements-grid">
              {sortedXp.map(ach => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
