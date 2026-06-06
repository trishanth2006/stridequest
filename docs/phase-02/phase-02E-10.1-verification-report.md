# Phase 02E-10.1 — Share UX Refinement — Verification Report

**Date:** 2026-06-06
**Branch:** `main` (maintainer-approved direct execution)
**Spec:** `docs/superpowers/specs/2026-06-05-share-ux-redesign-design.md`
**Plan:** `docs/superpowers/plans/2026-06-05-share-ux-redesign.md`

---

## 1. What was built

A preview-first refinement of the existing Share System (refinement, not greenfield — the
first-pass was already committed):

- **Measure-and-fit preview scaling** (`computeFitScale` + `ResizeObserver` + sized wrapper)
  replacing the hardcoded `transform: scale(0.35)` that clipped/shrank the preview.
- **Per-type control allowlist** (de-Canva): `ShareConfig` slimmed to
  `{ theme, layout, aspectRatio, showPreviousRecord }`. Workout = Theme + Card Style
  (Stats/Route) radio; Achievement = Theme; Personal Record = Theme + Show Previous Record;
  Level Up = Theme. Removed route color, route thickness, territory-overlay toggle, per-metric
  toggles, layout dropdown, aspect-ratio dropdown, transparent-bg toggle, branding toggle.
- **Format pills** above the preview (Story/Square/Landscape for workout; Story/Square others).
- **Always-on branding**; theme-derived route stroke.
- **Inline-editable headline** (uncontrolled `contentEditable`, gated by `editable` prop, edits
  captured from the DOM at export; caret-safe — no controlled state).
- **Level Up card** shows `LEVEL n / {totalXp} XP / Next Level / {xpToNextLevel} XP Remaining`.
- **Territory** card 🌍 + "TERRITORY CONQUEST" heading; **Achievement** 🏅.
- **Route validation** (AND-logic: `distance < 500 || (bboxW < t && bboxH < t)`) pinned by a
  regression test; long near-straight routes still render.
- **Component split**: `ShareCardPreview` (was 408 lines) → shell (204) + `WorkoutCardBody`,
  `AchievementCardBody`, `RecordCardBody`, `LevelUpCardBody` (all < 300 lines).

## 2. Files created
- `features/share/utils/fit-scale.ts`
- `features/share/components/ShareFormatPills.tsx`
- `features/share/components/WorkoutCardBody.tsx`
- `features/share/components/AchievementCardBody.tsx`
- `features/share/components/RecordCardBody.tsx`
- `features/share/components/LevelUpCardBody.tsx`

## 3. Files modified
- `features/share/types.ts` (slim `ShareConfig`, trim `ShareLayout`, add `LevelUpCard.xpToNextLevel`)
- `features/share/components/ShareCardPreview.tsx` (shell: scaling, headline, branding, delegation)
- `features/share/components/ShareDialog.tsx` (preview-first layout, pills, slim controls)
- `features/share/components/ShareEditorControls.tsx` (per-type allowlist)
- `features/share/components/ShareDownloadButton.tsx` (blur+DOM-read headline; lint cleanup)
- `features/share/services/share-card.ts` (typed `generateShareHeadline` data)
- `features/xp/components/XPEarnedCard.tsx` (pass `xpToNextLevel`)
- `tests/unit/features/share/{components,utils,services}.test.ts(x)`

## 4. Tests added/updated
- `computeFitScale` (3 cases) and route-validation regression (2 cases) in `utils.test.ts`.
- Per-type control allowlist, Card Style radio, scaling wrapper testids, editable headline
  (editable + non-editable), format pills, level-up XP-remaining content, territory heading in
  `components.test.tsx`.
- `xpToNextLevel` pass-through in `services.test.ts`.

## 5. Test results
- **Unit suite: 503 passed / 503 (72 suites).** `npx jest tests/unit` — green.
- **Typecheck: PASS** project-wide (`tsc --noEmit`, exit 0).
- **Lint (share feature, source + tests): CLEAN** (`eslint features/share tests/unit/features/share`).
- **Full `npm test`: pre-existing integration failures** in `tests/integration/**` (Supabase
  admin/RLS) that require a live Supabase environment — environmental, unrelated to this work.

### Visual pass (browser, via temporary `/dev-share` harness — since removed)
Rendered each card type in a real browser (Chrome DevTools) and confirmed:
- **Preview-first layout works**: format pills on top, card fills the dialog (~70%+), slim
  per-type controls below, Share button always visible.
- **Measure-and-fit scaling works**: cards fill the preview with no clipping (export node
  `offsetWidth/Height = 1080×1920` driving layout, on-screen `transform: scale(~0.2)`). This
  was the core defect; now observed working.
- Format pills filter per type (Workout: Story/Square/Landscape; Level Up: Story/Square only).
- Per-type controls correct (Workout: Theme + Card Style; Level Up: Theme only).
- Inline headline is `contenteditable="true"`.
- Level Up renders "LEVEL 5 / 875 XP / NEXT LEVEL / 125 XP Remaining".
- **Short run (132 m): "🏃 SHORT RUN / ROUTE UNAVAILABLE / Distance: 132m" placeholder, and
  the SVG polyline is absent (`hasSvgRoute: false`) — no stretched artifact.** ✅

### Export bug found and fixed during the visual pass
The visual pass surfaced a real defect: `html-to-image` captured the preview node *with* its
`transform: scale()`, producing a full-size PNG with the card shrunk into the top-left ~20%.
Fixed in `ShareDownloadButton` by neutralizing the transform on the captured clone
(`style: { transform: 'none', transformOrigin: 'top left' }`); the canvas is already sized from
the untransformed 1080×H box, so the PNG now renders at native resolution. (Commit `0ccd993`.)

## 6. Migration status
N/A — no database/schema/migration changes (UX + rendering only, per spec).

## 7. Remaining risks / known gaps
- **Duplicate titles on achievement/PR/level-up (design decision to revisit).** Because the
  editable headline now renders on every card type (locked decision), non-workout cards show
  the generic headline above their body title — e.g. Level Up reads "REACHED LEVEL 5!"
  (headline) + "⚡ LEVEL UP" (badge) + "LEVEL 5" (hero); PR reads "SET A NEW PERSONAL RECORD!"
  + "NEW PERSONAL RECORD" badge + "FASTEST 5K". This reads crowded/redundant for a post-ready
  card. **Recommendation:** suppress the generic headline on achievement/PR/level-up (keep it
  only for workout, where it is the natural title), or make those headlines distinct. Requires
  a product decision since headline-on-all-cards was an approved choice.
- **Export PNG not opened byte-for-byte.** The export-scaling fix was verified by the
  transform/offset relationship (canvas sized from native 1080×H; transform neutralized on
  capture), not by opening a downloaded file. Low risk, but a one-time download-and-open check
  is worthwhile.
- **Pre-existing lint debt outside share (out of scope):** 15 errors / 3 warnings remain, all
  `@typescript-eslint/no-explicit-any` (+ minor) in the **running** feature —
  `features/running/services/workout-detail.ts`, `features/running/components/{WorkoutDetailActions,
  WorkoutDetailHeader,WorkoutHighlights}.tsx`, `app/(protected)/run/[id]/page.tsx`, and
  `tests/unit/features/running/services/workout-detail.test.ts`. These predate this work
  (baseline commit) and were not introduced by it; not fixed per the surgical-changes rule.
- The route-validation AND-rule means a genuinely long, perfectly axis-aligned straight route
  shows the "Short Run" placeholder (accepted per spec decision).

## 8. Recommended next step
1. **Product decision on duplicate titles** (§7) — confirm whether to suppress the generic
   headline on achievement/PR/level-up cards. This is the main remaining quality gap.
2. Optionally open one downloaded PNG to confirm native-resolution export end-to-end.
3. Optionally schedule the running-feature `any` lint cleanup as a separate chore.
