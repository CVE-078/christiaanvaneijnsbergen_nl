# Auto-applied deload for stalled lifts — design

Date: 2026-06-05
Status: approved (brainstorm), ready for implementation plan
Branch: `feature/auto-deload-stalled-lifts`

## Problem

The plateau nudge (`computePlateau`) flags a stalled lift but is purely advisory: `computeProgression` keeps prefilling the same target, so the user has no built-in way out of the stall. The periodized-programs spec deferred "an auto-applied deload that rewrites the week's targets" because it assumed a per-lift deload store was needed. It isn't — the deload can be derived from logs, like the rest of the app.

## Decisions (from brainstorm)

1. **Derived, no new storage.** Computed from `computeE1RMHistory` each render, consistent with `computeProgression` / `computeStreak` / the adherence engine.
2. **Auto-applied to the prefill.** A stalled lift's next-week target becomes the deload automatically; the user still confirms by saving each set (non-destructive).
3. **Self-limiting.** Deload once, then stay quiet for ~3 weeks while the lift rebuilds, instead of re-deloading every week.
4. **Scope:** stalled-lift deload only. Multi-tier ramp-back for long layoffs is deferred.

## Logic (`src/lib/pulse/utils.ts`)

Two new pure functions, plus reuse of the existing `computeE1RMHistory` and `computePlateau`.

- `recentDrop(history, withinWeeks = DELOAD_REBUILD_WEEKS)` → boolean. True if any consecutive pair in the last `withinWeeks + 1` logged e1RM points dropped by at least `(1 - DELOAD_DROP_THRESHOLD)` (i.e. `curr < prev * DELOAD_DROP_THRESHOLD`). A real deload leaves a ~10% e1RM dip, well above the 3% threshold, so this detects "we already deloaded recently / are rebuilding."
- `shouldDeload(history)` → `computePlateau(history) && !recentDrop(history)`. Stalled, and not already mid-rebuild.
- `deloadTarget(previousEntry, repsRange)` → `{ kg, reps } | null`. `kg = max(MIN_KG, round(previousEntry.kg * DELOAD_FACTOR to nearest 2.5))`; `reps =` the lowest integer parsed from `repsRange` (falls back to `previousEntry.reps` when the range has no number). Returns `null` when there is no `previousEntry`.

`shouldDeload` is computed once per exercise (in `ExerciseCard`, which already derives `computeE1RMHistory(logs, re.id)` for the stall card). `deloadTarget` is computed per set in `SetLogger` from that set's own `previousEntry`, so each set deloads from its own prior weight.

## Constants (`src/lib/pulse/constants.ts`)

- `DELOAD_FACTOR = 0.9` — 10% lighter.
- `DELOAD_REBUILD_WEEKS = 3` — quiet window after a deload.
- `DELOAD_DROP_THRESHOLD = 0.97` — a ≥3% e1RM drop counts as "already deloaded."

## Wiring

- **`ExerciseCard`**: compute `const deload = shouldDeload(history)` (reusing the history it already builds). Pass `deload` to each `SetLogger`. Update the existing "Stalled" card: when `deload`, show "Deloading this week to break the stall — lighter target, then build back up. Or swap the lift."; otherwise keep the current advisory copy.
- **`SetLogger`**: new optional prop `deload?: boolean`. Compute `const dt = deload && previousEntry && week > 1 ? deloadTarget(previousEntry, repsRange ?? '') : null;` and let `dt` take precedence over `computeProgression` for the prefilled `kg`/`reps`. When `dt` is present, render a `↓ deload target X × Y` line (amber accent) in place of the `↑ target` line. Saving still writes the user's confirmed values at the week's `targetRIR`.
- **Out of scope:** `SupersetCard` (auto-supersets for ~30 min sessions) keeps normal progression for now; noted as a follow-up.

## Footprint

Pure functions + two component edits. **No migration, table, action, or hook.**

## Testing

- Unit (`utils.test.ts`): `recentDrop` (detects a drop in window, ignores older drops); `shouldDeload` (true on a clean stall; false while rebuilding; re-arms after the window scrolls past the drop); `deloadTarget` (rounding to 2.5, `MIN_KG` floor, reps = bottom of range, null without `previousEntry`).
- Component: `SetLogger` shows the deload prefill + `↓ deload target` line when `deload` is set and suppresses it otherwise; `ExerciseCard` shows the deload card copy when stalled-and-deloading.

## Edge cases

- Week 1 / no `previousEntry`: no deload (returns null), normal behavior.
- A lift that beats its deload week resumes normal double-progression automatically (the deload week's lower entry is its new baseline).
- Deload rounds to the same 2.5 kg grid as the `+2.5` progression steps; never below `MIN_KG`.
