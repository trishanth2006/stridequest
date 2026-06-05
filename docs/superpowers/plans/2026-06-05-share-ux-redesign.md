# Share UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing Share System into a premium, preview-first social card experience (Strava/Runna-like) with correct preview scaling, minimal per-type controls, inline-editable headlines, and clean route rendering — no DB/schema changes.

**Architecture:** The dialog becomes preview-first: format pills on top, a measure-and-fit scaled preview in the middle, a minimal per-type control row below, and an always-visible share button. A CSS `transform: scale()` is wrapped in a sized container so the layout box matches the on-screen size (fixes clipping/tiny preview). Controls are reduced to a per-card-type allowlist; branding is always on; the headline is `contentEditable` on the card. The >300-line `ShareCardPreview` is split into four per-type body components at the end.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind, Radix-based UI primitives (`components/ui`), `html-to-image` for export, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-05-share-ux-redesign-design.md`

**Conventions:**
- Run a single test file: `npx jest <path>` (optionally `-t "<name>"`).
- Verification gate (CLAUDE.md): `npm run lint` && `npm run typecheck` && `npm test` must pass.
- `@/` resolves to repo root (configured in `jest.config.ts` `moduleNameMapper`).
- Use real-ish coordinates/UUIDs in fixtures; strict TS, no `any`.
- Commit after each task. Branch convention: project commits features directly to `main`.

---

## File Structure (decomposition)

**Modified**
- `features/share/types.ts` — slim `ShareConfig`; drop dead `ShareLayout` options; add `xpToNextLevel?` to `LevelUpCard`.
- `features/share/utils/route-renderer.ts` — unchanged logic; covered by a new regression test.
- `features/share/utils/fit-scale.ts` *(new)* — pure `computeFitScale` used by the preview shell.
- `features/share/components/ShareDialog.tsx` — preview-first layout, format pills, scaling state, headline state, slim controls, always-on branding.
- `features/share/components/ShareCardPreview.tsx` — shell: theme + scaling + format + inline headline + branding; delegates bodies (split in Task 9).
- `features/share/components/ShareEditorControls.tsx` — per-type allowlist (Theme; Workout Card Style; PR Show Previous Record).
- `features/share/components/ShareFormatPills.tsx` *(new)* — pill format selector.
- `features/share/components/ShareDownloadButton.tsx` — drop `transparentBackground`.
- `features/share/services/share-card.ts` — `xpToNextLevel` flows through `buildLevelUpCard`.
- `features/xp/components/XPEarnedCard.tsx` — pass `xpToNextLevel` + `totalXp`.
- `features/running/components/WorkoutDetailActions.tsx`, `features/running/components/RunHistory.tsx` — verify presets; remove dead config.

**Created at split (Task 9)**
- `features/share/components/WorkoutCardBody.tsx` (classic + hero-route + territory)
- `features/share/components/AchievementCardBody.tsx`
- `features/share/components/RecordCardBody.tsx`
- `features/share/components/LevelUpCardBody.tsx`

**Tests**
- `tests/unit/features/share/utils.test.ts` — add validation regression + `fit-scale`.
- `tests/unit/features/share/components.test.tsx` — rewrite control-allowlist tests; level-up content; hero-route; headline edit.
- `tests/unit/features/share/services.test.ts` — `xpToNextLevel` pass-through.

---

## Task 0: Pre-flight — reconcile the uncommitted baseline

The working tree already contains a large uncommitted first-pass of the share feature (the state this plan refines): modified `features/share/components/{ShareCardPreview,ShareDialog,ShareEditorControls}.tsx`, `features/share/types.ts`, `features/share/utils/route-renderer.ts`, `features/running/components/{RunHistory,WorkoutDetailActions}.tsx`, and tests `tests/unit/features/{share/components.test.tsx,share/utils.test.ts,running/services/workout-detail.test.ts}` (~462 insertions over `HEAD` 9c2be20). If left uncommitted, the first task's `git add` will fold this baseline into the wrong commit.

> **Decision required from the maintainer before executing** (the spec/plan author flagged this): is the baseline intended work to keep, or scratch to discard? Default below assumes "keep."

- [ ] **Step 1: Inspect the baseline**

Run: `git status --short` and `git diff --stat`
Confirm the modified files match the list above and contain the expected first-pass (e.g. `ShareCardPreview.tsx` has the hardcoded `transform: scale(0.35)`, route color/thickness controls, per-metric toggles).

- [ ] **Step 2: Run the suite to confirm a green starting point**

Run: `npm test`
Expected: PASS. If the baseline is red, stop and report — do not build refinements on a broken base.

- [ ] **Step 3: Commit the baseline as its own checkpoint** *(if "keep")*

```bash
git add features/share features/running/components/RunHistory.tsx features/running/components/WorkoutDetailActions.tsx tests/unit/features/share tests/unit/features/running/services/workout-detail.test.ts
git commit -m "feat(share): first-pass share system (pre-refinement checkpoint)"
```

(If "discard": `git restore` the working-tree files instead, then re-derive the plan's line references from `HEAD`.)

- [ ] **Step 4: Commit the design + plan docs**

```bash
git add docs/superpowers/specs/2026-06-05-share-ux-redesign-design.md docs/superpowers/plans/2026-06-05-share-ux-redesign.md
git commit -m "docs(share): UX refinement design + implementation plan"
```

Now each subsequent task commits a clean, attributable delta.

---

## Task 1: Lock approved route validation with a regression test

The approved rule (`distance_m < 500 || (bboxW < t && bboxH < t)`) is **already implemented** in `route-renderer.ts`. Add a regression test that pins it so a future "OR" refactor can't silently break long straight routes.

**Files:**
- Test: `tests/unit/features/share/utils.test.ts`

- [ ] **Step 1: Add the regression tests**

Add these `it` blocks inside the existing `describe('validateRoute', ...)` block in `tests/unit/features/share/utils.test.ts`:

```ts
    it('renders a long, near-straight route (one axis tiny, distance ok)', () => {
      // latDiff = 0.1 (large), lngDiff = 0.00001 (tiny). AND-logic must NOT reject.
      const route = [
        { lat: 10, lng: 10 },
        { lat: 10.05, lng: 10.00001 },
        { lat: 10.1, lng: 10.00002 },
      ]
      expect(validateRoute(route, 2000)).toBe(true)
    })

    it('rejects a tiny route even when distance is unknown', () => {
      const route = [
        { lat: 10, lng: 10 },
        { lat: 10.00001, lng: 10.00001 },
      ]
      expect(validateRoute(route)).toBe(false)
    })
```

- [ ] **Step 2: Run the tests**

Run: `npx jest tests/unit/features/share/utils.test.ts -t validateRoute`
Expected: PASS (documents that current logic already satisfies the spec; a regression to OR-logic would fail the first test).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/features/share/utils.test.ts
git commit -m "test(share): pin approved route validation (AND-logic, long straight routes render)"
```

---

## Task 2: Add the `computeFitScale` pure utility

A pure, testable function the preview shell will use to scale the native-resolution card to the available preview area.

**Files:**
- Create: `features/share/utils/fit-scale.ts`
- Test: `tests/unit/features/share/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new top-level `describe` to `tests/unit/features/share/utils.test.ts`, and extend the import on line 2.

Change line 2 from:
```ts
import { getRouteBounds, projectCoordinates, generatePolyline, validateRoute } from '@/features/share/utils/route-renderer'
```
to add a second import line directly beneath it:
```ts
import { computeFitScale } from '@/features/share/utils/fit-scale'
```

Append this block at the end of the outer `describe('Route Renderer Utils', ...)`? No — add it as a sibling `describe` after that block closes:

```ts
describe('computeFitScale', () => {
  it('fits a portrait card into a small area by the limiting dimension', () => {
    // area 400x600, card 1080x1920 -> min(400/1080, 600/1920) = min(0.370, 0.3125)
    expect(computeFitScale({ w: 400, h: 600 }, { w: 1080, h: 1920 })).toBeCloseTo(0.3125, 4)
  })

  it('is limited by width when the area is wide and short', () => {
    // area 1000x200, card 1080x1080 -> min(0.9259, 0.1852) = 0.1852
    expect(computeFitScale({ w: 1000, h: 200 }, { w: 1080, h: 1080 })).toBeCloseTo(0.18518, 4)
  })

  it('returns 1 for non-positive card dimensions', () => {
    expect(computeFitScale({ w: 400, h: 600 }, { w: 0, h: 0 })).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/features/share/utils.test.ts -t computeFitScale`
Expected: FAIL — `Cannot find module '@/features/share/utils/fit-scale'`.

- [ ] **Step 3: Create the utility**

Create `features/share/utils/fit-scale.ts`:

```ts
export interface Size {
  w: number
  h: number
}

/**
 * Returns the scale factor that fits a card of `card` dimensions entirely
 * within `area`, preserving aspect ratio. Caps at 1 (never upscales beyond
 * native) is intentionally NOT applied — the preview may upscale small cards
 * to fill the area; the export always uses native dimensions regardless.
 */
export function computeFitScale(area: Size, card: Size): number {
  if (card.w <= 0 || card.h <= 0) return 1
  return Math.min(area.w / card.w, area.h / card.h)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/features/share/utils.test.ts -t computeFitScale`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/share/utils/fit-scale.ts tests/unit/features/share/utils.test.ts
git commit -m "feat(share): add computeFitScale utility for preview measure-and-fit"
```

---

## Task 3: Slim `ShareConfig` + rewrite controls to the per-type allowlist

The cascading type change. Removing config fields breaks every consumer, so this task updates types, `DEFAULT_CONFIG`, `ShareEditorControls`, `ShareDownloadButton`, and `ShareCardPreview`'s use of the removed fields together, in one green commit. Branding becomes always-on; route stroke is theme-derived; workout exposes a single **Card Style** radio (Stats→classic, Route→hero-route).

**Files:**
- Modify: `features/share/types.ts`
- Modify: `features/share/components/ShareDialog.tsx:18-34` (DEFAULT_CONFIG) and the `ShareDownloadButton` call
- Modify: `features/share/components/ShareEditorControls.tsx` (full rewrite)
- Modify: `features/share/components/ShareDownloadButton.tsx`
- Modify: `features/share/components/ShareCardPreview.tsx` (route style, branding, stats)
- Test: `tests/unit/features/share/components.test.tsx`

- [ ] **Step 1: Rewrite the failing control tests first**

Replace the entire `describe('ShareEditorControls', ...)` block (lines ~99-137) in `tests/unit/features/share/components.test.tsx` with:

```tsx
  describe('ShareEditorControls', () => {
    it('workout shows Theme + Card Style, no per-metric or route toggles', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'Crushed another run!', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Card Style')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Stats' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Route' })).toBeTruthy()
      // Removed controls:
      expect(screen.queryByLabelText('Distance')).toBeNull()
      expect(screen.queryByText('Route Color')).toBeNull()
      expect(screen.queryByText('Route Thickness')).toBeNull()
      expect(screen.queryByText('StrideQuest Branding')).toBeNull()
      expect(screen.queryByText('Transparent Background')).toBeNull()
    })

    it('Card Style "Route" selects hero-route layout', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'x', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Route' }))
      expect(onChange).toHaveBeenCalledWith({ layout: 'hero-route' })
    })

    it('territory preset shows Theme only (no Card Style)', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'x', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={{ ...defaultConfig, layout: 'territory' }} onChange={onChange} />)
      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.queryByText('Card Style')).toBeNull()
    })

    it('achievement shows Theme only', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'achievement', achievementTitle: 'First Run', achievementDescription: '', achievementCategory: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.queryByText('Card Style')).toBeNull()
      expect(screen.queryByLabelText('Distance')).toBeNull()
      expect(screen.queryByText('Route & Map')).toBeNull()
      expect(screen.queryByText('Aspect Ratio')).toBeNull()
    })

    it('personal record shows Theme + Show Previous Record', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'personal-record', recordTitle: 'Fastest 5K', recordValue: '25:00', achievedAt: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.getByLabelText('Show Previous Record')).toBeTruthy()
      expect(screen.queryByText('Route & Map')).toBeNull()
    })
  })
```

Also update the shared `defaultConfig` object near the top of this test file (lines ~31-47) to the slim shape:

```tsx
  const defaultConfig: ShareConfig = {
    theme: 'midnight',
    layout: 'classic',
    aspectRatio: 'portrait',
    showPreviousRecord: true,
  }
```

And in `describe('ShareCardPreview', ...)`, **delete** the `it('respects visibility toggles', ...)` test (lines ~66-80) — per-metric toggles no longer exist.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Expected: FAIL — type errors on the slim `defaultConfig` and missing "Card Style"/Stats/Route.

- [ ] **Step 3: Slim the types**

In `features/share/types.ts`, replace the `ShareLayout` and `ShareConfig` definitions:

```ts
export type ShareLayout =
  | 'classic'
  | 'hero-route'
  | 'territory'

export interface ShareConfig {
  theme: ShareTheme
  layout: ShareLayout // internal: set by entry-point preset or the workout Card Style radio
  aspectRatio: ShareAspectRatio
  showPreviousRecord: boolean
}
```

In the same file, add `xpToNextLevel` to `LevelUpCard` (used in Task 7; safe to add now):

```ts
export interface LevelUpCard extends BaseShareCard {
  type: 'level-up'
  previousLevel: number
  currentLevel: number
  totalXp: number
  xpToNextLevel?: number
}
```

- [ ] **Step 4: Rewrite `ShareEditorControls`**

Replace the entire contents of `features/share/components/ShareEditorControls.tsx` with:

```tsx
"use client"

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ShareConfig, ShareTheme, AnyShareCard } from '../types'

interface ShareEditorControlsProps {
  cardData: AnyShareCard
  config: ShareConfig
  onChange: (updates: Partial<ShareConfig>) => void
}

const THEMES: { value: ShareTheme; label: string }[] = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'territory', label: 'Territory' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'retro', label: 'Retro' },
]

export function ShareEditorControls({ cardData, config, onChange }: ShareEditorControlsProps) {
  const isWorkout = cardData.type === 'workout'
  const isRecord = cardData.type === 'personal-record'
  const isTerritory = isWorkout && config.layout === 'territory'

  return (
    <div className="flex flex-wrap items-end gap-6 p-4">
      <div className="space-y-2 min-w-[180px]">
        <Label>Theme</Label>
        <Select value={config.theme} onValueChange={(val: ShareTheme) => onChange({ theme: val })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isWorkout && !isTerritory && (
        <div className="space-y-2">
          <Label>Card Style</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={config.layout === 'classic' ? 'default' : 'outline'}
              className={cn('h-9', config.layout === 'classic' && 'pointer-events-none')}
              onClick={() => onChange({ layout: 'classic' })}
            >
              Stats
            </Button>
            <Button
              type="button"
              variant={config.layout === 'hero-route' ? 'default' : 'outline'}
              className={cn('h-9', config.layout === 'hero-route' && 'pointer-events-none')}
              onClick={() => onChange({ layout: 'hero-route' })}
            >
              Route
            </Button>
          </div>
        </div>
      )}

      {isRecord && (
        <div className="flex items-center gap-3 pb-2">
          <Label htmlFor="showPreviousRecord">Show Previous Record</Label>
          <Switch
            id="showPreviousRecord"
            checked={config.showPreviousRecord}
            onCheckedChange={(val) => onChange({ showPreviousRecord: val })}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update `ShareDialog` default config + download call**

In `features/share/components/ShareDialog.tsx`, replace `DEFAULT_CONFIG` (lines ~18-34) with:

```tsx
const DEFAULT_CONFIG: ShareConfig = {
  theme: 'midnight',
  layout: 'classic',
  aspectRatio: 'portrait',
  showPreviousRecord: true,
}
```

And change the `<ShareDownloadButton ... />` usage (lines ~79-83) to drop `transparentBackground`:

```tsx
            <ShareDownloadButton
              cardRef={previewRef}
              cardData={cardData}
            />
```

- [ ] **Step 6: Update `ShareDownloadButton`**

In `features/share/components/ShareDownloadButton.tsx`: remove the `transparentBackground` prop and its use.

Change the props interface (lines ~9-13) to:
```tsx
interface ShareDownloadButtonProps {
  cardRef: React.RefObject<HTMLDivElement | null>
  cardData: AnyShareCard
}
```
Change the function signature (line ~15) to:
```tsx
export function ShareDownloadButton({ cardRef, cardData }: ShareDownloadButtonProps) {
```
Change the `toPng` options (lines ~37-41) to:
```tsx
      const dataUrl = await htmlToImage.toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2, // High DPI
      })
```

- [ ] **Step 7: Update `ShareCardPreview` for removed fields (route style, branding, stats)**

In `features/share/components/ShareCardPreview.tsx`:

(a) Add a theme→route-style helper near the top of the component (after `const isPortrait = ...`, ~line 42):

```tsx
    const routeStyle = (() => {
      switch (config.theme) {
        case 'midnight': return { color: '#ffffff', width: 8 }
        case 'retro': return { color: '#22c55e', width: 8 }
        case 'territory': return { color: '#0f172a', width: 8 }
        default: return { color: '#0f172a', width: 8 } // minimal
      }
    })()
```

(b) In `renderRoute`, **fix the removed `showRoute` guard** on line ~45. Change:
```tsx
      if (cardData.type !== 'workout' || !cardData.routeData || !config.showRoute) return null
```
to (route draws for classic/hero-route, never for territory):
```tsx
      if (cardData.type !== 'workout' || !cardData.routeData || config.layout === 'territory') return null
```
Then replace `config.routeColor` → `routeStyle.color` and `config.routeThickness` → `routeStyle.width` (the `<path stroke>`/`strokeWidth` on lines ~86-87 and the marker radius `config.routeThickness * 1.5` on line ~107 → `routeStyle.width * 1.5`). Replace the `config.showTerritoryOverlay && ...` guard (line ~92) with just `cardData.territoryMarkers && ...` (territory overlay is now always shown when markers exist).

(c) In `renderWorkoutStats`, remove the per-metric `config.show*` guards so available metrics always render in classic layout. Replace lines ~155-177 (the `const stats = []` block) with:

```tsx
      const stats: { label: string; value: string }[] = []
      if (cardData.distance !== undefined) {
        stats.push({ label: 'Distance', value: `${(cardData.distance / 1000).toFixed(2)} km` })
      }
      if (cardData.duration !== undefined) {
        const minutes = Math.floor(cardData.duration / 60)
        const seconds = cardData.duration % 60
        stats.push({ label: 'Time', value: `${minutes}:${seconds.toString().padStart(2, '0')}` })
      }
      if (cardData.pace !== undefined) {
        const paceMin = Math.floor(cardData.pace / 60)
        const paceSec = Math.floor(cardData.pace % 60)
        stats.push({ label: 'Pace', value: `${paceMin}:${paceSec.toString().padStart(2, '0')} /km` })
      }
      const showSecondary = config.layout !== 'hero-route'
      if (showSecondary && cardData.xp !== undefined) {
        stats.push({ label: 'XP', value: `+${cardData.xp}` })
      }
      if (showSecondary && cardData.level !== undefined) {
        stats.push({ label: 'Level', value: `${cardData.level}` })
      }
      if (showSecondary && cardData.territoriesCaptured !== undefined && cardData.territoriesCaptured > 0) {
        stats.push({ label: 'Captured', value: `${cardData.territoriesCaptured}` })
      }
```

(d) In the hero-route branch of `renderWorkoutStats` (lines ~179-194), **remove** the trailing `+XP` line so hero-route shows only Distance/Time/Pace. Replace that block with:

```tsx
      if (config.layout === 'hero-route') {
        return (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex justify-center gap-12 w-full">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-4xl font-bold">{s.value}</span>
                  <span className="text-lg opacity-70 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
```

(e) In the territory branch of `renderWorkoutStats` (line ~145), the XP line currently checks `config.showXp` — change `config.showXp && cardData.xp !== undefined && cardData.xp > 0` to `cardData.xp !== undefined && cardData.xp > 0`.

(f) Make branding always render: change the branding block (lines ~344-354) from `{config.showBranding && ( ... )}` to always render the `<div>` (remove the `config.showBranding &&` guard and surrounding braces).

(g) Remove the `transparentBackground` usage: in the inner card `className` (line ~304) remove `config.transparentBackground ? 'bg-transparent' : ''`.

(h) **Fix the removed `showXp` guard in the level-up branch** (line ~218). The level-up content is fully rewritten in Task 7, but until then it must compile. Change:
```tsx
            {config.showXp && (
              <div className="mt-8 text-xl">Total XP: {cardData.totalXp}</div>
            )}
```
to (render unconditionally):
```tsx
            <div className="mt-8 text-xl">Total XP: {cardData.totalXp}</div>
```

- [ ] **Step 8: Run the full share test file**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Expected: PASS.

- [ ] **Step 9: Typecheck + verify no dangling config fields**

Run: `npm run typecheck`
Expected: PASS (no references to removed `ShareConfig` fields remain).

Then grep the preview for stray config reads:
Run: `npx --yes rg "config\.show" features/share/components/ShareCardPreview.tsx`
Expected: only `config.showPreviousRecord` appears (used by the PR branch). Any `config.showRoute`/`config.showXp`/`config.showTerritoryOverlay`/`config.showDistance`/etc. is a miss — fix before committing.

- [ ] **Step 10: Commit**

```bash
git add features/share/types.ts features/share/components/ShareEditorControls.tsx features/share/components/ShareDialog.tsx features/share/components/ShareDownloadButton.tsx features/share/components/ShareCardPreview.tsx tests/unit/features/share/components.test.tsx
git commit -m "feat(share): slim ShareConfig to per-type control allowlist; theme route style; always-on branding"
```

---

## Task 4: Wire the measure-and-fit scaling into the preview shell

Replace the hardcoded `transform: scale(0.35)` / `transformOrigin: top center` with a `ResizeObserver`-driven scale and a sized wrapper that occupies real layout space (fixes clipping + tiny preview). Export still snapshots the native-resolution node.

**Files:**
- Modify: `features/share/components/ShareCardPreview.tsx:294-356` (outer wrapper)
- Test: `tests/unit/features/share/components.test.tsx`

- [ ] **Step 1: Add a render test that asserts the sized wrapper exists**

Add to `describe('ShareCardPreview', ...)` in `tests/unit/features/share/components.test.tsx`:

```tsx
    it('wraps the export node in a sized container (no raw scale on a full-size node)', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        distance: 5000,
        duration: 1500,
      }
      const { container } = render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      expect(container.querySelector('[data-testid="share-card-sized-wrapper"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="share-card-export"]')).toBeTruthy()
    })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/features/share/components.test.tsx -t "sized container"`
Expected: FAIL — testids not found.

- [ ] **Step 3: Add the scaling state and sized wrapper**

In `features/share/components/ShareCardPreview.tsx`:

(a) Update the React import (line 3) to include hooks:
```tsx
import { forwardRef, useRef, useState, useLayoutEffect, useCallback } from 'react'
```

(b) Import the util (after the existing route-renderer import, ~line 5):
```tsx
import { computeFitScale } from '../utils/fit-scale'
```

(c) Inside the component body, after `const dims = DIMENSIONS[config.aspectRatio]` (~line 25), add:
```tsx
    const areaRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0.3)

    const recompute = useCallback(() => {
      const el = areaRef.current
      if (!el) return
      setScale(computeFitScale({ w: el.clientWidth, h: el.clientHeight }, { w: dims.width, h: dims.height }))
    }, [dims.width, dims.height])

    useLayoutEffect(() => {
      recompute()
      const el = areaRef.current
      if (!el || typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(recompute)
      ro.observe(el)
      return () => ro.disconnect()
    }, [recompute])
```

(d) Replace the outer return wrapper (the `<div className="relative overflow-hidden w-full h-full ...">` at ~line 294 down to the inner card `<div ref={ref} ...>` open tag and its inline `style`) with the measure-area + sized-wrapper structure. Concretely, replace lines ~294-312:

```tsx
    return (
      <div
        ref={areaRef}
        className="relative w-full h-full flex items-center justify-center p-4"
      >
        <div
          data-testid="share-card-sized-wrapper"
          style={{ width: dims.width * scale, height: dims.height * scale }}
          className="relative"
        >
          <div
            ref={ref}
            data-testid="share-card-export"
            className={cn(
              'absolute top-0 left-0 overflow-hidden flex flex-col items-center shadow-2xl',
              getThemeClasses(),
            )}
            style={{
              width: dims.width,
              height: dims.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
```

Leave the inner content (Main Content Area, Route Layer, Branding) unchanged, and ensure the closing tags now match: the export node `</div>`, then the sized-wrapper `</div>`, then the area `</div>`.

- [ ] **Step 4: Run the share tests**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Expected: PASS (jsdom has no layout, so `clientWidth/Height` are 0 → `computeFitScale` returns a finite scale via the `0`-guard path; the testids exist and content still renders).

> Note: jsdom reports `clientWidth/clientHeight` as `0`, so `computeFitScale` receives `area {0,0}` → returns `0`. That's fine for unit tests (content still in DOM). Real scaling is verified in the browser pass (Task 10).

- [ ] **Step 5: Commit**

```bash
git add features/share/components/ShareCardPreview.tsx tests/unit/features/share/components.test.tsx
git commit -m "feat(share): measure-and-fit preview scaling via ResizeObserver + sized wrapper"
```

---

## Task 5: Inline-editable headline on the card

The headline becomes a `contentEditable` element rendered by the shell for **all** card types (including achievement, which currently suppresses it). It is an **uncontrolled** element: React renders `cardData.headline` once as the initial child and never rewrites it, so the caret never jumps while typing. The edited text lives in the DOM and is serialized by `html-to-image` on export. Editing is gated by an explicit `editable` prop — there is no controlled `headline` state, and the preview always receives the **original** `cardData` (a live-updated clone would reset the caret on every keystroke — the classic controlled-contentEditable bug).

**Files:**
- Modify: `features/share/components/ShareCardPreview.tsx` (editable headline element; render for all types)
- Modify: `features/share/components/ShareDialog.tsx` (pass `editable`)
- Modify: `features/share/components/ShareDownloadButton.tsx` (blur + read live headline for share title)
- Test: `tests/unit/features/share/components.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `describe('ShareCardPreview', ...)`:

```tsx
    it('renders an editable headline for every card type', () => {
      const card: AnyShareCard = {
        type: 'achievement',
        headline: 'Unlocked First Run',
        metadata: { generatedAt: '2026-06-04T00:00:00.000Z', strideQuestVersion: '' },
        achievementTitle: 'FIRST RUN',
        achievementDescription: 'Complete your first workout',
        achievementCategory: 'General',
      }
      const { container } = render(
        <ShareCardPreview cardData={card} config={defaultConfig} editable />
      )
      const headline = container.querySelector('[data-testid="share-headline"]') as HTMLElement
      expect(headline).toBeTruthy()
      expect(headline.getAttribute('contenteditable')).toBe('true')
      expect(headline.textContent).toBe('Unlocked First Run')
    })

    it('headline is not editable without the editable prop', () => {
      const card: AnyShareCard = {
        type: 'workout', headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' }, distance: 5000,
      }
      const { container } = render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      const headline = container.querySelector('[data-testid="share-headline"]') as HTMLElement
      expect(headline.getAttribute('contenteditable')).toBe('false')
    })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/features/share/components.test.tsx -t "editable"`
Expected: FAIL — `share-headline` not found / `editable` not a prop.

- [ ] **Step 3: Add an `editable` prop and a shared uncontrolled headline**

In `features/share/components/ShareCardPreview.tsx`:

(a) Extend the props interface:
```tsx
interface ShareCardPreviewProps {
  cardData: AnyShareCard
  config: ShareConfig
  editable?: boolean
}
```
and the component signature:
```tsx
  ({ cardData, config, editable = false }, ref) => {
```

(b) Add a reusable headline element. Replace the current top-section block (lines ~318-326, the `{!isAchievementCard && ( ... <h1 ...>{cardData.headline}</h1> ... )}`) so the headline renders for **all** types and is editable when `editable`:

```tsx
            <div className="flex flex-col items-center z-10 relative px-12 text-center mt-12">
              <h1
                data-testid="share-headline"
                contentEditable={editable}
                suppressContentEditableWarning
                spellCheck={false}
                className={cn(
                  'text-5xl font-black uppercase tracking-tight max-w-full px-4 outline-none',
                  editable && 'focus:ring-2 focus:ring-white/40 rounded cursor-text',
                )}
              >
                {cardData.headline}
              </h1>
              {renderBadges()}
            </div>
```

Remove the now-unused `isAchievementCard` gate around the top section (the achievement body keeps its 🏅/title/description block below; the headline now sits above it). Keep `isAchievementCard` only where it still affects layout padding, or delete it if unused (run typecheck).

> **No `onInput`, no callback, no state.** React renders `cardData.headline` as the h1's initial child exactly once; because `ShareDialog` passes the *original* (stable) `cardData`, React never rewrites that text node and the caret stays put. The user's edits live in the DOM and are captured by `html-to-image` at export.

- [ ] **Step 4: Pass `editable` from `ShareDialog`**

In `features/share/components/ShareDialog.tsx`, replace the `<ShareCardPreview ... />` usage (lines ~62-66) with the original `cardData` (do **not** spread a live headline) plus `editable`:
```tsx
            <ShareCardPreview
              ref={previewRef}
              cardData={cardData}
              config={config}
              editable
            />
```

> Do not add a `headline` state. A live-updated clone (`{ ...cardData, headline }`) would change the h1 child every keystroke and reset the caret. The export reads the edited text straight from the DOM (Step 5).

- [ ] **Step 5: Blur + read the edited headline for the share title**

In `features/share/components/ShareDownloadButton.tsx`:

(a) At the very start of `handleExport`, before `setIsExporting(true)`, commit any in-progress edit:
```tsx
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
```

(b) Use the live (possibly edited) headline from the DOM for the Web Share `title`. Replace `title: cardData.headline,` in the `navigator.share({...})` call (line ~51) with:
```tsx
          title: cardRef.current.querySelector('[data-testid="share-headline"]')?.textContent?.trim() || cardData.headline,
```

- [ ] **Step 6: Run the share tests**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Expected: PASS. (The achievement render test from Task 3 still finds 'FIRST RUN'/'UNLOCKED'; the new headline test passes.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add features/share/components/ShareCardPreview.tsx features/share/components/ShareDialog.tsx features/share/components/ShareDownloadButton.tsx tests/unit/features/share/components.test.tsx
git commit -m "feat(share): inline-editable headline on all card types"
```

---

## Task 6: Format pills above the preview

Replace the aspect-ratio dropdown (removed in Task 3) with pills rendered above the preview. Per-type format sets: Workout → Story/Square/Landscape; others → Story/Square. Tapping a pill updates `aspectRatio` and re-fits the preview (Task 4's effect depends on `dims`).

**Files:**
- Create: `features/share/components/ShareFormatPills.tsx`
- Modify: `features/share/components/ShareDialog.tsx` (render pills above preview)
- Test: `tests/unit/features/share/components.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a new `describe` to `tests/unit/features/share/components.test.tsx`, and add the import at the top with the other component imports:

```tsx
import { ShareFormatPills } from '@/features/share/components/ShareFormatPills'
```

```tsx
  describe('ShareFormatPills', () => {
    it('offers Story/Square/Landscape for workout', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="workout" value="portrait" onChange={onChange} />)
      expect(screen.getByRole('button', { name: 'Story' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Square' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Landscape' })).toBeTruthy()
    })

    it('offers only Story/Square for achievement', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="achievement" value="portrait" onChange={onChange} />)
      expect(screen.getByRole('button', { name: 'Story' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Square' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Landscape' })).toBeNull()
    })

    it('emits the selected aspect ratio', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="workout" value="portrait" onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Square' }))
      expect(onChange).toHaveBeenCalledWith('square')
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/features/share/components.test.tsx -t ShareFormatPills`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `features/share/components/ShareFormatPills.tsx`:

```tsx
"use client"

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ShareAspectRatio, ShareCardType } from '../types'

interface ShareFormatPillsProps {
  cardType: ShareCardType
  value: ShareAspectRatio
  onChange: (value: ShareAspectRatio) => void
}

const ALL_FORMATS: { value: ShareAspectRatio; label: string }[] = [
  { value: 'portrait', label: 'Story' },
  { value: 'square', label: 'Square' },
  { value: 'landscape', label: 'Landscape' },
]

export function ShareFormatPills({ cardType, value, onChange }: ShareFormatPillsProps) {
  const formats = cardType === 'workout'
    ? ALL_FORMATS
    : ALL_FORMATS.filter((f) => f.value !== 'landscape')

  return (
    <div className="flex justify-center gap-2">
      {formats.map((f) => (
        <Button
          key={f.value}
          type="button"
          size="sm"
          variant={value === f.value ? 'default' : 'outline'}
          className="rounded-full px-4"
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/features/share/components.test.tsx -t ShareFormatPills`
Expected: PASS.

- [ ] **Step 5: Render pills above the preview in `ShareDialog`**

In `features/share/components/ShareDialog.tsx`:

(a) Add the import:
```tsx
import { ShareFormatPills } from './ShareFormatPills'
```

(b) Inside the preview area, above `<ShareCardPreview ... />`, add the pills. Wrap the preview region so pills sit on top. Replace the preview-area `<div>` (lines ~61-67) with:
```tsx
          <div className="flex-1 min-h-[50vh] flex flex-col overflow-hidden relative">
            <div className="shrink-0 pt-4 pb-2 flex justify-center bg-slate-100 z-10">
              <ShareFormatPills
                cardType={cardData.type}
                value={config.aspectRatio}
                onChange={(aspectRatio) => handleConfigChange({ aspectRatio })}
              />
            </div>
            <div className="flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden">
              <ShareCardPreview
                ref={previewRef}
                cardData={cardData}
                config={config}
                editable
              />
            </div>
          </div>
```

- [ ] **Step 6: Run the share tests + typecheck**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add features/share/components/ShareFormatPills.tsx features/share/components/ShareDialog.tsx tests/unit/features/share/components.test.tsx
git commit -m "feat(share): format pills above preview (per-type format sets)"
```

---

## Task 7: Level Up "XP Remaining" content

Render `LEVEL n / {totalXp} XP / Next Level / {xpToNextLevel} XP Remaining`. The type field was added in Task 3; wire the builder pass-through and the XP consumer, then update the renderer.

**Files:**
- Modify: `features/share/components/ShareCardPreview.tsx` (level-up branch)
- Modify: `features/xp/components/XPEarnedCard.tsx` (pass `xpToNextLevel`)
- Test: `tests/unit/features/share/components.test.tsx`, `tests/unit/features/share/services.test.ts`

- [ ] **Step 1: Update the failing level-up tests**

In `tests/unit/features/share/components.test.tsx`, replace the `it('renders level-up card correctly', ...)` test body (lines ~82-96) with:

```tsx
    it('renders level-up card with XP remaining', () => {
      const card: AnyShareCard = {
        type: 'level-up',
        headline: 'Reached Level 5!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        previousLevel: 4,
        currentLevel: 5,
        totalXp: 875,
        xpToNextLevel: 125,
      }

      render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      expect(screen.getByText('LEVEL 5')).toBeTruthy()
      expect(screen.getByText('875 XP')).toBeTruthy()
      expect(screen.getByText('Next Level')).toBeTruthy()
      expect(screen.getByText('125 XP Remaining')).toBeTruthy()
    })
```

In `tests/unit/features/share/services.test.ts`, extend the `buildLevelUpCard` test (lines ~59-69) to assert pass-through:

```tsx
    it('buildLevelUpCard adds metadata and headline', () => {
      const card = buildLevelUpCard({
        previousLevel: 4,
        currentLevel: 5,
        totalXp: 1200,
        xpToNextLevel: 300,
      })

      expect(card.type).toBe('level-up')
      expect(card.headline).toBe('Reached Level 5!')
      expect(card.currentLevel).toBe(5)
      expect(card.xpToNextLevel).toBe(300)
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/features/share/components.test.tsx -t "XP remaining"`
Expected: FAIL — old branch renders "Total XP: ..." and "5" not "LEVEL 5".

- [ ] **Step 3: Update the level-up renderer**

In `features/share/components/ShareCardPreview.tsx`, replace the `else if (cardData.type === 'level-up')` block in `renderCenterContent` (lines ~211-222) with:

```tsx
      } else if (cardData.type === 'level-up') {
        return (
          <div className="flex flex-col items-center z-10 relative mt-12 gap-3 text-center">
            <span className="text-7xl font-black uppercase tracking-tight">
              LEVEL {cardData.currentLevel}
            </span>
            <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-amber-600">
              {cardData.totalXp} XP
            </span>
            {cardData.xpToNextLevel !== undefined && cardData.xpToNextLevel > 0 && (
              <div className="mt-8 flex flex-col items-center gap-1">
                <span className="text-xl opacity-70 uppercase tracking-widest">Next Level</span>
                <span className="text-3xl font-bold">{cardData.xpToNextLevel} XP Remaining</span>
              </div>
            )}
          </div>
        )
      }
```

- [ ] **Step 4: Pass `xpToNextLevel` from the XP consumer**

In `features/xp/components/XPEarnedCard.tsx`, update the `buildLevelUpCard` call (lines ~19-23):

```tsx
  const shareCardData = leveledUp ? buildLevelUpCard({
    previousLevel,
    currentLevel: progress.currentLevel,
    totalXp: progress.currentXp,
    xpToNextLevel: progress.xpNeededToNextLevel,
  }) : null
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest tests/unit/features/share/components.test.tsx tests/unit/features/share/services.test.ts`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add features/share/components/ShareCardPreview.tsx features/xp/components/XPEarnedCard.tsx tests/unit/features/share/components.test.tsx tests/unit/features/share/services.test.ts
git commit -m "feat(share): level-up card shows next-level XP remaining"
```

---

## Task 8: Territory + achievement emoji alignment

Small visual alignment to the spec mockups: Territory uses 🌍 with a "TERRITORY CONQUEST" heading; Achievement uses 🏅.

**Files:**
- Modify: `features/share/components/ShareCardPreview.tsx`
- Test: `tests/unit/features/share/components.test.tsx`

- [ ] **Step 1: Update the territory test**

In `tests/unit/features/share/components.test.tsx`, extend the `it('renders territory conquest card', ...)` assertions (after line ~191) with:

```tsx
      expect(screen.getByText('TERRITORY CONQUEST')).toBeTruthy()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/features/share/components.test.tsx -t "territory conquest"`
Expected: FAIL — heading text absent.

- [ ] **Step 3: Add the territory heading + globe, align achievement medal**

In `features/share/components/ShareCardPreview.tsx`, in the territory branch of `renderWorkoutStats` (the `if (config.layout === 'territory')` block, ~line 124), add a heading at the top of its returned `<div>`:

```tsx
             <div className="flex flex-col items-center gap-3 mb-4">
               <span className="text-7xl">🌍</span>
               <span className="text-4xl font-black uppercase tracking-tight">Territory Conquest</span>
             </div>
```

In the achievement branch of `renderCenterContent` (~line 226-228), change the emoji from `🏆` to `🏅`:

```tsx
               <span className="text-6xl">🏅</span>
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/unit/features/share/components.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/share/components/ShareCardPreview.tsx tests/unit/features/share/components.test.tsx
git commit -m "feat(share): territory heading + globe, achievement medal emoji"
```

---

## Task 9: Split `ShareCardPreview` into per-type body components

`ShareCardPreview` exceeds the 300-line limit. Now that content is final, extract the per-type bodies into focused files. **Behavior-preserving** — tests must stay green.

**Files:**
- Create: `features/share/components/WorkoutCardBody.tsx`, `AchievementCardBody.tsx`, `RecordCardBody.tsx`, `LevelUpCardBody.tsx`
- Modify: `features/share/components/ShareCardPreview.tsx`

- [ ] **Step 1: Extract the route + workout-stats rendering into `WorkoutCardBody`**

Create `features/share/components/WorkoutCardBody.tsx` exporting two functions used by the shell:
- `WorkoutRoute({ cardData, config, dims, isPortrait })` — the `renderRoute` body (including `routeStyle`, `validateRoute`, `projectCoordinates`, `generatePolyline`, the short-run placeholder, and territory markers).
- `WorkoutStats({ cardData, config })` — the `renderWorkoutStats` body (classic / hero-route / territory branches).

Move the corresponding JSX verbatim from `ShareCardPreview.tsx` (the `renderRoute` and `renderWorkoutStats` closures), converting closed-over values (`dims`, `isPortrait`, `config`, `cardData`, `SAFE_ZONE_TOP/BOTTOM`) into explicit props/imports. Keep all class names and structure identical. Type the props against `WorkoutShareCard` + `ShareConfig`.

- [ ] **Step 2: Extract `AchievementCardBody`, `RecordCardBody`, `LevelUpCardBody`**

Create one file per type, each a default-styled function component that receives the typed card + config and returns the JSX currently in `renderCenterContent`'s respective branch:
- `AchievementCardBody({ cardData })` — 🏅 / title / description / ✓ UNLOCKED / date block.
- `RecordCardBody({ cardData, config })` — 🏆 / recordTitle / recordValue / NEW PERSONAL RECORD / optional Previous Best (gated by `config.showPreviousRecord`).
- `LevelUpCardBody({ cardData })` — LEVEL n / totalXp XP / Next Level / XP Remaining block.

Move JSX verbatim from the matching branches; keep classes identical.

- [ ] **Step 3: Reduce `ShareCardPreview` to the shell**

In `ShareCardPreview.tsx`:
- Import the four bodies.
- Keep: theme classes, `dims`, scaling state/effect, sized wrapper, editable headline, branding, the top/middle/bottom layout scaffold.
- Replace `renderRoute()` with `<WorkoutRoute .../>`. The route-visibility guard (workout + has `routeData` + layout ≠ `territory`) was already fixed in Task 3 step 7(b); preserve that exact guard inside `WorkoutRoute` (return `null` when it fails).
- Replace `renderCenterContent()`'s branches with a switch that renders `<WorkoutStats/>` / `<AchievementCardBody/>` / `<RecordCardBody/>` / `<LevelUpCardBody/>`.
- Remove the moved closures. Confirm the file is now under 300 lines.

- [ ] **Step 4: Run the full share suite**

Run: `npx jest tests/unit/features/share`
Expected: PASS — identical DOM, tests unchanged.

- [ ] **Step 5: Verify line counts**

Run: `npx --yes wc -l features/share/components/*.tsx` (or PowerShell `Get-Content … | Measure-Object -Line`).
Expected: every file < 300 lines.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add features/share/components/
git commit -m "refactor(share): split ShareCardPreview into per-type body components (<300 lines)"
```

---

## Task 10: Entry-point verification + full verification gate + visual pass

Confirm the entry points still drive layout via presets, run the full gate, and verify the visual success criteria in a browser (unit tests can't assert "looks post-ready").

**Files:**
- Verify/modify: `features/running/components/WorkoutDetailActions.tsx`, `features/running/components/RunHistory.tsx`

- [ ] **Step 1: Verify entry-point presets compile against slim config**

Confirm `WorkoutDetailActions.tsx` still passes only valid `defaultConfig` keys: `{ layout: 'classic' | 'hero-route' | 'territory' }`. The three buttons map: Share Workout → `classic`, Share Route → `hero-route`, Share Territory → `territory`. `RunHistory` Quick Share uses the default (`classic`). Remove any `defaultConfig` key no longer on `ShareConfig`.

Run: `npm run typecheck`
Expected: PASS (fix any leftover removed-key references here).

- [ ] **Step 2: Full verification gate**

Run:
```bash
npm run lint
npm run typecheck
npm test
```
Expected: all PASS, no warnings introduced.

- [ ] **Step 3: Commit any entry-point fixups**

```bash
git add features/running/components/WorkoutDetailActions.tsx features/running/components/RunHistory.tsx
git commit -m "chore(share): align run-detail/history entry points with slim share config"
```

- [ ] **Step 4: Visual verification (browser)**

Use the `run` skill (or `npm run dev`) to launch the app, then for each card type confirm against the spec success criteria:
- Open a run detail page → **Share Workout** (Stats), toggle **Card Style → Route** (Hero Route), **Share Territory**.
- Open an achievement card → **Share** (Achievement, Theme only, 🏅, editable headline).
- Open a PR card → **Share** (Personal Record, Show Previous Record).
- Trigger a level-up XP card → **Share Level Up** (LEVEL n / XP / XP Remaining).
- A short run (< 500 m) → **Short Run** placeholder, no vertical-line artifact.

Checklist per card: preview fills ~70–80% of the dialog, no clipping, format pills switch ratio and re-fit, headline edits inline, export/download produces a clean PNG (no caret/focus ring, branding present). Capture a screenshot of each for the verification report.

- [ ] **Step 5: Record results**

Note pass/fail per success criterion in the task summary (and a `docs/phase-02/phase-02E-10.1-verification-report.md` if matching project convention). Report any visual gaps as follow-ups rather than silently fixing outside the plan.

---

## Self-Review

**Spec coverage** (each spec section → task):
- §3 preview scaling → Task 2 (util) + Task 4 (wire). ✅
- §4 dialog layout → Task 4 + Task 6 (pills on top, controls below, share button retained). ✅
- §5 format pills → Task 6. ✅
- §6 controls allowlist (Theme; Workout Card Style; PR Show Previous Record; territory Theme-only) → Task 3. ✅
- §7 branding always-on → Task 3 (step 7f). ✅
- §7 inline headline (all types) → Task 5. ✅
- §8 route validation (AND-logic) → Task 1. ✅
- §9 hero route hides XP/Level/Territory → Task 3 (step 7d). ✅
- §10 territory layout (preset, 🌍, content) → Task 3 (kept) + Task 8. ✅
- §11 achievement layout (🏅, no workout metrics) → Task 3 (metrics already gated) + Task 8. ✅
- §12 PR layout (Previous Best optional) → Task 3 (Show Previous Record) + body in Task 9. ✅
- §13 level-up content + `xpToNextLevel` → Task 3 (type) + Task 7. ✅
- §14 file split → Task 9. ✅
- §15 tests → Tasks 1–9 each add/adjust tests; Task 10 full gate + visual. ✅
- §16 risks (contentEditable export chrome, transparentBackground removal) → Task 5 (blur) + Task 3 (removal). ✅

**Placeholder scan:** No "TBD/TODO/handle edge cases". Task 9 uses "move verbatim" for existing JSX with explicit source closures named — this is a mechanical relocation of code shown in earlier tasks/the current file, not an unspecified behavior. All changed/new logic shows full code.

**Type consistency:** `ShareConfig` slim shape `{ theme, layout, aspectRatio, showPreviousRecord }` used consistently in Tasks 3–10 and both test files. `ShareLayout` = `classic | hero-route | territory` everywhere. `LevelUpCard.xpToNextLevel?: number` added in Task 3, asserted in Task 7. `computeFitScale(area, card)` signature consistent between Task 2 and Task 4. `ShareCardPreview` gains an uncontrolled `editable?: boolean` prop (no controlled headline state) — consistent in Task 5/6 and both render-call sites in `ShareDialog`. `ShareFormatPills` props `{ cardType, value, onChange }` consistent (Task 6).
