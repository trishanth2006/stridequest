# Phase 02 — GPS Pipeline Root-Cause Report

**Status:** Investigation only. No fixes applied. Temporary `[GPS-DIAG]` logging is
present in the client (added earlier in this investigation); it has not been removed.

**Method:** Static trace of the full lifecycle + authoritative read-only queries against
the live Supabase database (`workouts`, `route_points`, `finalize_workout`, RLS policies).

---

## TL;DR

The pipeline is **not** broken end-to-end. Coordinates are received, accepted, batched,
uploaded, and persisted to `route_points` whenever a GPS fix passes the filter — this is
**proven** by recording workouts that hold real points (`accuracy_m = 5`).

The reported symptom is produced by **two independent defects that share one symptom**
(`distance = 0`, `pace = null`):

1. **Accuracy gate too strict for the test environment** (the one biting *now*). On the
   stop-and-save sessions, fixes arrive but every one is rejected by the 30 m accuracy
   gate, so no sample is ever accepted → "GPS Acquiring" never clears → buffer stays
   empty → 0 points → `distance = 0`.
2. **Stop finalizes *before* the final flush, and the buffer's first delivery is gated to
   a 10 s interval** (a latent bug that will bite *after* #1 is fixed). Any run stopped
   within ~10 s — i.e. every quick test run — finalizes with 0 delivered points and so
   still reports `distance = 0`.

Both must be fixed; fixing only #1 will leave short test runs still showing `distance = 0`.

---

## Lifecycle trace

```
useGeolocation.watchPosition          features/running/hooks/useGeolocation.ts:113
  → onSample(sample)                  useGeolocation.ts:126
  → recorder.handleSample             features/running/hooks/useWorkoutRecorder.ts:94
      → filterSamples (accuracy gate) features/running/services/sample-filter.ts:46   ← REJECTION POINT (defect #1)
      → buffer.add                    useWorkoutRecorder.ts:134
  → SampleBuffer.add / interval cut   features/running/services/sample-buffer.ts:119,125
  → uploadBatch (POST)                features/running/services/upload-batch.ts:14
  → POST /api/workouts/[id]/points    app/api/workouts/[id]/points/route.ts:13
  → ingestBatch (upsert)              features/running/services/ingest.ts:50
  → route_points rows
  ...
stop: stopWorkout → finalize_workout  features/running/actions/stop.ts:57   ← runs BEFORE the flush (defect #2)
  then (client effect) recorder.stop → buffer.stop  WorkoutControls.tsx:123 / useWorkoutRecorder.ts:169
```

---

## Evidence

### A. The pipeline works (coordinates → route_points)

Recording workout `ce9f1ba8-7990-470c-9fa6-d2ee808ac723` (never stopped) holds 11 points:

- `accuracy_m = 5` on every point — comfortably inside the 30 m gate.
- All in `batch_seq = 0`, `point_seq 0..10`.
- `recorded_at` spans 08:43:03 → 08:43:14 (~11 s); **all** `received_at = 08:43:19.89`.

So a single batch was delivered ~13 s after the first sample — i.e. by the **10 s interval
flush**, not by the size trigger (60) and not on the first `add`. This proves coordinates
are received, accepted, batched, POSTed, and persisted when the fix passes the filter.

### B. Completed workouts never persisted a single point

| status     | workouts | total route_points | workouts with points |
|------------|---------:|-------------------:|---------------------:|
| completed  |       14 |                  0 |                    0 |
| recording  |        7 |                 44 |                    4 |
| discarded  |        5 |                  0 |                    0 |

Completed-run durations include **182.7 s, 22.9 s, 11.5 s, ~8 s ×4** — all with 0 points.
A 3-minute run that had locked GPS would have produced ~17 interval flushes' worth of
points (per Evidence A). It produced none ⟹ **no sample was accepted in those sessions.**

`finalize_workout` neither deletes points nor depends on status to insert them, and the
`route_points` INSERT RLS policy checks **ownership only, not status** — so stopping cannot
have erased points. They were never inserted because none were accepted.

### C. Why the rejection is the accuracy gate

**Primary argument — bimodal behavior under identical code (no browser assumptions).**
The accept path *provably works*: 44 points persisted across recording runs, so
`handleSample → filter → buffer → upload → ingest` are all functional. For an as-yet-
unaccepted **first** sample (no anchor) the filter applies **only** the accuracy gate
(`sample-filter.ts:45-47`, `useWorkoutRecorder.ts:103-104`) — accuracy is its single
*environmental* input. The same code yields two outcomes across sessions (some accept,
some accept 0), so the differentiator must be that one input. Corroborating: the good
sessions reported `accuracy_m = 5` (a fixed value typical of a DevTools "Sensors" location
override), whereas un-overridden desktop/Wi‑Fi geolocation typically reports tens to
hundreds of metres — above the 30 m gate. Override on → points flow; real signal → every
first fix rejected.

**Corroborating argument — "Acquiring", never "Weak".** The UI shows **"Acquiring"** when a
success callback fires but the sample is rejected (`error = null`, `hasFix = false`), and
**"Weak GPS"** when the watch errors (`WorkoutControls.tsx:35-55`). With `timeout: 10_000`
(`useGeolocation.ts:36-40`), a watch that errored on timeout would flip the UI to "Weak"
within 10 s; the symptom is "Acquiring" sustained for minutes, which is consistent with the
success callback firing on `accuracy > 30 m` fixes. **Caveat:** this leans on watchPosition
reliably firing its timeout error, which is browser-inconsistent — a watch that never
delivers a fix *and* never times out would also yield sustained "Acquiring" + 0 points. So
this supports the conclusion but does not, by itself, prove it.

**The one residual the inference cannot reach** is exactly that: "watch never delivered a
fix" (didn't start, or has only errored since the last reset-to-null) produces the same
"Acquiring" + 0 points, and a *stateful* start failure could vary session-to-session. The
already-present `[GPS-DIAG:geolocation] watchPosition fix:` log settles it in one binary:
**present with `accuracy > 30 m` ⟹ accuracy gate (confirmed); absent ⟹ the failure is
upstream of the filter and defect #1 is wrong.** That is why the console readout below is
load-bearing, not ceremony.

### D. Defect #2 — stop finalizes before the flush (latent; bites after #1)

- The buffer's **first** delivery happens at the 10 s interval or on an explicit
  `flush()`/`stop()` — `add()` never flushes until 60 samples (`sample-buffer.ts:29-32,125-130`).
- The **Stop** button submits the `stopWorkout` server action directly; there is no
  client-side flush before it. `stopWorkout` calls `finalizeWorkout` **synchronously**
  (`stop.ts:57`), which computes distance from `route_points` *at that instant*.
- Only *after* the action returns does `phase` become `completed`, which triggers the
  `useEffect` that calls `recorder.stop()` → `buffer.stop()` (the final flush)
  (`WorkoutControls.tsx:123-130`, `useWorkoutRecorder.ts:169-174`).

So the final batch is delivered **after** distance is already computed. `finalize_workout`
needs **≥ 2** points or it sets `distance_m = 0`, and `avg_pace` is `null` whenever
`distance_m ≤ 0`. Therefore any run stopped before its first 10 s interval flush (every
quick test run) finalizes from 0 delivered points → `distance = 0`, `pace = null` — even
with perfect GPS. The late-arriving points would then be inserted into the now-`completed`
workout (RLS allows it) as orphans that never affect the stored distance.

*Note:* this defect's signature (a completed workout that **does** hold points yet shows
`distance = 0`) is **not** in the current data only because the sessions that locked GPS
were never stopped (they are the `recording` rows). It is proven by code + timing, not yet
by a row.

---

## Answers to the required questions

| Question | Answer |
|---|---|
| Coordinates received? | **Yes.** `getCurrentPosition` works; `watchPosition` success fires (sustained "Acquiring", never "Weak"). |
| Samples accepted? | **Conditionally.** Yes when `accuracy ≤ 30 m` (proven, 44 points across recording runs); **No** in every stop-and-save session — all fixes exceeded the 30 m gate. |
| Batches uploaded? | **Yes**, when samples exist — single batch per 10 s interval (`batch_seq = 0`, `received_at` stamped). |
| route_points persisted? | **Yes for recording** runs (44 rows); **No for any of the 14 completed** runs. |
| Exact failure point | **Defect #1 (strongly supported; one console line from confirmed):** `sample-filter.ts:46` — the 30 m accuracy gate rejects every first fix on the real signal → `hasFix` never set → empty buffer → 0 points → `distance = 0`. **Defect #2 (proven by code, not yet by a row):** stop/finalize ordering — `finalize_workout` (`stop.ts:57`) runs before the `buffer.stop()` flush (`WorkoutControls.tsx:123`), so sub-10 s runs finalize from 0 delivered points. |

---

## Instrumentation gaps (for completeness)

`[GPS-DIAG]` logs exist in `useGeolocation`, `useWorkoutRecorder`, and `WorkoutControls`
but **not** in `sample-buffer.ts` or `upload-batch.ts`. For the current failure those
stages are never reached (defect #1) or already proven by the DB (Evidence A), so the gap
did not block the diagnosis. If runtime confirmation of the happy path is wanted, add one
log at `SampleBuffer.add`/`cut` and one at `uploadBatch`'s POST.

## Remaining risk / next step (when fixes are authorized — not in scope here)

- Confirm defect #1 by reading the `watchPosition fix:` accuracy values once in the browser.
- Fixing **only** the accuracy gate will leave short test runs at `distance = 0` (defect #2);
  both must be addressed together. Defect #2 needs a flush-before-finalize ordering (flush
  the buffer and await delivery *before* invoking `finalize_workout`).
