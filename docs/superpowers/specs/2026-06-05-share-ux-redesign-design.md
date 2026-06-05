# Phase 02E-10.1 — Share UX Refinement (Design)

**Date:** 2026-06-05
**Status:** Approved (pending final spec review)
**Type:** UX refinement + rendering fixes. **No** database, schema, migration, or persistence changes.

---

## 1. Goal

Turn the existing Share System from a configurable card *generator* into a premium social
sharing experience comparable to Strava / Runna / Nike Run Club / Garmin. The user opens a
share dialog and should immediately think *"I want to post this"* — not *"this is a settings
panel."*

Outcome targets:

- Preview occupies ~70–80% of the dialog and is visible without scrolling.
- Each card type exposes only the controls that meaningfully change the post (≤ ~3 per type).
- No clipped/tiny preview; no stretched route artifacts.
- Layout is chosen by the entry point, never by a manual dropdown.

---

## 2. Current state (reconciliation)

The Share System is already substantially implemented (commit `9c2be20`) and its unit tests
pass. This phase is a **refinement of existing code**, not a greenfield build. Accurate
status of each requirement vs. the committed code:

| Area | Current behavior | Work needed |
| --- | --- | --- |
| Preview scaling | Hardcoded `transform: scale(0.35)` + `transformOrigin: top center` on the export node — transform doesn't shrink the layout box, so the 1080×H card drives layout, clips, and miscentres | **Rewrite** to measure-and-fit |
| Dialog layout | Preview-on-top exists but card clips; controls bottom | Restructure: format pills → preview → controls → share |
| Format selector | `<Select>` dropdown (Story/Square/Landscape) | Replace with pills above preview; per-type format sets |
| Layout selector | `<Select>` with `classic / hero-route / territory / achievement-focus / record-focus` | **Remove**; layout set by entry point; delete dead `achievement-focus`, `record-focus` |
| Headline editing | None (auto-generated only) | Add inline `contentEditable` headline on the card |
| Control bloat | Route color swatches, thickness slider, territory-overlay toggle, 6 per-metric toggles, transparent-bg toggle, branding toggle | Remove all of the above |
| Branding | `showBranding` toggle, default on | Always render; remove toggle |
| Route validation | `distance < 500 || (latDiff < t && lngDiff < t)` + `projectCoordinates` uses `min(scaleX,scaleY)` (aspect-preserving, centred) | **Already matches approved logic** — verify + test, fix placeholder copy only |
| Hero route | Renders Distance/Time/Pace; re-adds `+XP` line | Remove the `+XP` line (hide XP/Level/Territory) |
| Level Up content | Shows `Total XP: n` | Show `n XP` + `Next Level` + `n XP Remaining` |
| `ShareCardPreview.tsx` | 361 lines (over 300-line limit) | Split into per-card body components |

**Key correction:** "tests pass" ≠ "spec met." Existing tests assert workout fields are
*absent* on non-workout cards; they do **not** assert the spec's *positive allowlist*. The new
tests must assert the allowlist (only the permitted controls render).

---

## 3. Preview scaling mechanism (load-bearing)

**Problem.** A CSS `transform: scale()` does not change an element's layout dimensions, so the
native 1080×H card still occupies full size — causing clipping, bad centring, and a tiny
effective preview.

**Solution — measure-and-fit with a sized wrapper:**

```
previewArea            (flex-1; the ~70–80% region; has a ResizeObserver)
└── sizedWrapper       style={{ width: cardW * scale, height: cardH * scale }}
    └── exportRef      style={{ width: cardW, height: cardH,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left' }}
        └── card content (rendered at native 1080×H resolution)
```

- `ResizeObserver` on `previewArea` recomputes `scale = min(areaW / cardW, areaH / cardH)`
  on resize **and** whenever the selected format changes (cardW/cardH change).
- `sizedWrapper` takes the *scaled* dimensions so it occupies real layout space → correct
  centring, no clipping, preview fills the region.
- Export continues to snapshot `exportRef` at native dimensions (`pixelRatio: 2`) → export
  quality unchanged.

Rejected alternative: pure-CSS (`aspect-ratio` + `max-height`) — cannot keep a fixed-resolution
export node crisp while also fitting the preview. The JS measure is ~30 lines and reliable.

Dimensions (unchanged):

```
story (portrait):   1080 × 1920
square:             1080 × 1080
landscape:          1200 × 628
```

---

## 4. Dialog layout

```
┌─────────────────────────────────────┐
│ [ Story ] [ Square ] [ Landscape ]   │  ← format pills (per-type set)
│                                       │
│           LARGE PREVIEW               │  ← ~70–80%, scaled via §3
│        (inline-editable headline)     │
│                                       │
│ Theme · Card Style …                  │  ← slim controls (per-type, §6)
│ [        Share / Download        ]    │  ← always visible
└─────────────────────────────────────┘
```

- Preview is primary and visible without scrolling.
- Controls are secondary.
- Share button always visible.

---

## 5. Format pills

Replace the aspect-ratio dropdown with pills rendered **above** the preview. Tapping a pill
updates `aspectRatio` and re-fits the preview. Per-type format sets:

| Card type | Formats offered |
| --- | --- |
| Workout (incl. hero-route, territory) | Story · Square · Landscape |
| Achievement | Story · Square |
| Personal Record | Story · Square |
| Level Up | Story · Square |

Default: **Story (9:16)**.

---

## 6. Controls (per card type)

Layout is **never** a manual control. Branding is always on (no toggle). Per type:

### Workout
```
Theme
Card Style:  ◉ Stats   ○ Route
```
- `Card Style = Stats` → `layout: 'classic'` (metrics-forward).
- `Card Style = Route` → `layout: 'hero-route'` (route artwork).
- Both-off is impossible (radio, not toggles).
- **Territory preset** (opened via *Share Territory*): show **Theme only** — no Card Style
  radio, layout fixed to `territory`. (Decision: the Stats/Route choice is meaningless for a
  territory card, so it is hidden.)

### Achievement
```
Theme
```

### Personal Record
```
Theme
Show Previous Record
```

### Level Up
```
Theme
```

### Removed from all types
Route color, route thickness, territory-overlay toggle, per-metric visibility toggles,
layout dropdown, aspect-ratio dropdown, transparent-background toggle, branding toggle.

`ShareConfig` is slimmed to roughly: `{ theme, aspectRatio, layout (internal), showPreviousRecord }`.
Route stroke color/width become **theme-derived constants** in the renderer (e.g. white on
midnight, slate on minimal; fixed thickness ~8), since the controls are gone.

---

## 7. Inline headline editing

The headline becomes a `contentEditable` element rendered by the preview **shell** (so the
contentEditable lives in one place, not duplicated per body). Pre-filled from the generated
headline; editing updates the preview instantly and is captured on export.

Applies to: Workout, Achievement, Personal Record, Level Up.

- Edit affordance (subtle hint / focus outline) must be CSS-only and **must not** appear in the
  exported PNG. Blur the active element before export.
- **Decision:** the editable headline is the card's **top title line**, rendered by the shell
  for every card type (including Achievement, which currently suppresses the headline),
  pre-filled from the generated headline (e.g. "Unlocked First Run", "Reached Level 5",
  "New 5K Personal Best", "Completed a 5.2 km run"). The type-specific body (achievement
  title/description, PR value, level/XP, etc.) renders below it. The section 11–13 mockups
  omit this headline line for brevity; the shell still renders it.

---

## 8. Route validation (verify, do not regress)

Approved logic — **already implemented** in `features/share/utils/route-renderer.ts`:

```ts
// reject when:
distance_m < 500 || (boundingBoxWidth < threshold && boundingBoxHeight < threshold)
```

Rationale for AND (not OR) on the bounding box: a legitimate long, near-straight route must
still render; only routes that are tiny in *both* dimensions are degenerate. `projectCoordinates`
already preserves aspect ratio via `min(scaleX, scaleY)` and centres the path, so a thin route
renders as a centred thin line rather than a stretched artifact.

Work for this section: **verify** the behavior, ensure the placeholder copy matches, and add
tests. No logic rewrite.

Placeholder state (when validation fails):
```
🏃
SHORT RUN
Route unavailable
Distance: {X}m
```

---

## 9. Hero Route layout

Route is the artwork; metrics are secondary.

```
[ LARGE ROUTE ]
Distance
Time
Pace
```

Hide by default: XP, Level, Territory counts. (Remove the existing `+XP` line from the
hero-route branch.)

---

## 10. Territory layout

Stays a **workout-card preset** (`layout: 'territory'`). Do **not** add a new `ShareCardType`.

```
🌍
TERRITORY CONQUEST
Captured: 7
Stolen: 2
Total Territory: 34
+42 XP
StrideQuest
```

---

## 11. Achievement layout

```
🏅
FIRST RUN
Complete your first workout
✓ UNLOCKED
Jun 4 2026
StrideQuest
```

Never show pace / distance / duration / route on achievement cards.

---

## 12. Personal Record layout

```
🏆
FASTEST 5K
24:18
NEW PERSONAL RECORD
Previous Best
25:11
StrideQuest
```

"Previous Best / 25:11" shown only when `Show Previous Record` is on and a previous value exists.

---

## 13. Level Up layout

```
⚡
LEVEL 5
875 XP
Next Level
125 XP Remaining
StrideQuest
```

Add `xpToNextLevel` to `LevelUpCard`. Source: existing `getXpProgress().xpNeededToNextLevel`
— `XPEarnedCard` already has `progress` and passes it into `buildLevelUpCard`. Also surface
`totalXp` ("875 XP").

---

## 14. File / change map

All changes stay under `features/share/` plus two consumer touch-ups. No new top-level folders.

**Modified**
- `features/share/types.ts` — slim `ShareConfig`; drop dead `ShareLayout` options; add
  `xpToNextLevel` to `LevelUpCard`.
- `features/share/components/ShareDialog.tsx` — preview-first layout; format pills;
  ResizeObserver scaling state; slim controls; headline state; always-on branding.
- `features/share/components/ShareCardPreview.tsx` — becomes the **shell**: theme classes,
  scaling wrapper, format handling, inline-editable headline, branding. Delegates body to
  per-type components.
- `features/share/components/ShareEditorControls.tsx` — reduce to per-type allowlist (Theme;
  Workout adds Card Style radio; PR adds Show Previous Record).
- `features/share/utils/route-renderer.ts` — verify validation; ensure placeholder copy.
- `features/share/services/share-card.ts` — `buildLevelUpCard` accepts/derives `xpToNextLevel`.
- `features/xp/components/XPEarnedCard.tsx` — pass `progress.xpNeededToNextLevel` (and totalXp).
- `features/running/components/WorkoutDetailActions.tsx` / `RunHistory.tsx` — presets keep
  setting `layout` internally; remove any now-invalid config.

**Created** (split of the >300-line `ShareCardPreview.tsx`)
- `features/share/components/WorkoutCardBody.tsx` (classic + hero-route + territory bodies)
- `features/share/components/AchievementCardBody.tsx`
- `features/share/components/RecordCardBody.tsx`
- `features/share/components/LevelUpCardBody.tsx`

Each body stays well under 300 lines and receives typed card data + resolved config.

---

## 15. Tests (`tests/unit/features/share/`)

- Scaling: `scale = min(areaW/cardW, areaH/cardH)`; sized-wrapper dimensions = scaled size.
- Route validation: short run (`distance < 500`) → placeholder; long near-straight route
  (one axis tiny, distance ≥ 500) → still renders (regression guard for the AND logic).
- Short-run placeholder copy renders.
- Inline headline edit updates the rendered text.
- **Positive** control allowlist per card type (only permitted controls present; forbidden
  ones absent).
- Level Up renders `n XP`, `Next Level`, `n XP Remaining`.
- Hero route shows Distance/Time/Pace and hides XP/Level/Territory.
- Territory layout renders Captured/Stolen/Total + XP.

Visual verification (not unit-testable): run the app and screenshot each card type to confirm
"fills the preview," "looks post-ready," and "no stretched artifact."

---

## 16. Risks / notes

- **Export fidelity of contentEditable:** ensure caret/focus chrome is excluded from the PNG
  (blur before snapshot; CSS-only affordance).
- **Headline placement** (§7) and **Territory share controls** (§6) are now locked decisions
  (top-title headline for all types; Theme-only for territory).
- Removing `transparentBackground` deletes a currently-wired option; `ShareDownloadButton`
  must stop reading it.
- Theme-derived route color must give acceptable contrast on every theme.

---

## 17. Success criteria

- **Achievement:** large preview, no workout controls, post-ready.
- **Workout:** route/metrics balanced per Card Style; premium presentation.
- **Hero Route:** route reads as artwork.
- **Territory:** territory-focused content only.
- **Short runs:** placeholder shown, no stretched vertical line.
- **Overall:** feels like Strava / Runna / NRC / Garmin, not a settings panel.
