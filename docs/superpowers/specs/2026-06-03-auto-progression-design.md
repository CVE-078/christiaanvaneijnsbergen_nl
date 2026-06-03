# Auto-progression — Design

**Date:** 2026-06-03
**Status:** Approved (design)

## Goal

Automatically advance the per-set target (weight and reps) when the user beats the
previous session, using **double progression**: climb reps within the exercise's
rep range first, then add weight and reset to the bottom of the range. This
supersedes today's weight-only `computeSuggestion`, which pre-fills a suggested
weight and leaves reps blank.

## Why double progression

Pulse already programs in rep ranges (`8-12`, `6-10`, …) and logs RIR per set —
exactly the inputs double progression needs. It's the standard, safe model for a
rep-range program: add reps inside the range session to session, and only add
weight once you own the top of the range. Linear weight-only stalls fast and
ignores the rep range; reps-only never auto-adds weight.

## Architecture

A single new pure function plus a thin UI change. No persistence, no migration —
the progression is computed on the fly from the previous session's logged set,
exactly like the current suggestion.

### 1. `computeProgression` (pure, in `src/lib/pulse/utils.ts`)

```
computeProgression(
  previousEntry: LogEntry | undefined,
  repsRange: string,   // the routine exercise's `reps`, e.g. "8-12" or "8"
  week: number,
): { kg: number; reps: number } | null
```

Logic:

- Parse `repsRange` into `[lo, hi]`. A single number (`"8"`) means `lo === hi === 8`.
  Reuse the same range parsing already used elsewhere where practical; otherwise a
  small local parse: split on `–`/`-`, take first as `lo`, last as `hi`, fall back
  to `lo` when only one number is present.
- `targetRIR = getRIR(week - 1)` — same anchor as the current `computeSuggestion`.
- Return `null` when `week <= 1` or `previousEntry` is undefined (unchanged from
  today — no progression on the first week / with no history).
- Otherwise, branch on the previous set:
  - **Harder than planned** — `previousEntry.rir < targetRIR` → deload:
    `kg = max(previousEntry.kg - 2.5, MIN_KG)`, `reps = lo`.
  - **Met or beat, at/over top of range** — `previousEntry.rir >= targetRIR` and
    `previousEntry.reps >= hi` → add weight: `kg = previousEntry.kg + 2.5`,
    `reps = lo`.
  - **Met or beat, mid-range** — otherwise → add a rep: `kg = previousEntry.kg`,
    `reps = min(previousEntry.reps + 1, hi)`.

Consequences:
- A single-number rep target (`lo === hi`) always takes the weight branch when not
  too hard, i.e. behaves like today's linear weight bump.
- A real range climbs reps by one per session until the top, then bumps weight and
  resets to `lo`.

### 2. SetLogger surfacing

`src/components/pulse/SetLogger.tsx` currently calls `computeSuggestion` to pre-fill
only the weight (`kg`), leaving `reps` blank. Change:

- Call `computeProgression(previousEntry, repsRange, week)` instead.
- Pre-fill **both** the weight input and the reps input from the returned target.
- Render a small inline hint showing the computed target (e.g. `target 62.5 × 8`)
  so the progression is visible. Hidden when there is no progression (`null`).
- The values remain editable — this is a pre-fill the user always overrides by
  typing actual performed weight/reps.

`repsRange` is threaded into SetLogger as a new prop from `ExerciseCard`, which
already has `routineExercise.reps`. (Confirm the WorkoutModeScreen render path of
SetLogger passes it too, so guided mode gets the same behaviour.)

### 3. `computeSuggestion`

`computeSuggestion` is only consumed by SetLogger. After the switch it is no longer
used in app code. Keep the function and its existing unit tests (harmless, still
correct) OR remove both — decided in the implementation plan. Default: remove it and
its tests once SetLogger no longer references it, to avoid dead code.

## Data flow

`set_logs` (previous week, same set) → `previousEntry` (already passed to SetLogger)
→ `computeProgression(previousEntry, repsRange, week)` → pre-filled `kg` + `reps` +
target hint. Nothing is written until the user saves the set as they do today.

## Error handling / edge cases

- No previous entry or `week <= 1` → `null`, inputs behave as they do today (weight
  blank unless `entry.kg` exists).
- Unparseable `repsRange` → fall back to a single value (`lo`), never throws.
- Weight never drops below `MIN_KG` (clamped on the deload branch).
- Unit display: `computeProgression` works in kg; SetLogger converts via the
  existing `toDisplay`/`toKg` exactly as it does for the current suggestion.

## Settings

Always on. Because it only changes pre-filled values the user can overtype, there
is no Profile toggle (avoids a migration and a settings surface). A toggle can be
added later if desired.

## Testing

- **`computeProgression` unit tests** (`src/lib/pulse/__tests__/utils.test.ts`):
  deload branch, rep-bump branch, weight-bump + reset branch, single-number range
  (acts linear), `reps >= hi` boundary, no-previous → null, `week <= 1` → null,
  `MIN_KG` clamp on deload.
- **SetLogger integration** (`src/components/pulse/__tests__/SetLogger.test.tsx`):
  with a beating previous entry, both weight and reps inputs pre-fill to the target
  and the target hint renders; with no previous entry, no hint and reps blank.

## Out of scope

- Persisting a progressed target on the routine exercise (Plan view stays as is).
- A user-facing on/off setting.
- Changing the 12-week RIR/volume curve.
