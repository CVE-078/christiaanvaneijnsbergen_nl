# Muscle-coverage warnings (Tier-2, Spec 1 of 3)

Design for the first slice of the roadmap's "Tier-2: muscle-volume-aware generation" item. Driven by a code-truth + Claude.ai/ChatGPT review loop over the generator's real-catalogue output. The parent plan (with the validated per-muscle target table and isolation-quality data) is `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`.

## Why this first (decomposition + sequencing)

Tier-2 is three loosely-independent pieces of very different risk, not one project. The review loop and code-truth agreed on this order:

1. **Muscle-coverage warnings (THIS spec).** Warn-only observability. Pure measurement over the finished blueprint, no change to generation output. Builds the per-exercise muscle data layer that the next two pieces reuse.
2. **Muscle-based variety scoring (later spec).** A local `byPattern` ordering change (lat vs upper-back, delt-head diversity) using the same muscle data. Medium risk.
3. **Minimum-coverage gap-fill (last, only after evidence).** Actively changes selection to hit per-muscle targets. Highest risk: it sits on top of every existing cap, the compound floor, the priority-set ceiling, supersets, equipment + contraindication filters. Build it only once the warnings prove the targets are right and over many generated programs show what actually needs correcting.

**Core principle: separate measurement from intervention.** Measure → observe → validate the targets → only then consider intervention. The generator stays deterministic and unchanged in this spec.

Note: the "exercise quality scoring" piece (the kickback / concentration-curl problem) that the review loop ranked as the single biggest immediate output improvement already shipped this branch as fix #3 (`ISOLATION_QUALITY`, commit `dcd97f9`). That clears the runway for this measurement layer.

## Goal

For any generated routine, compute weekly per-muscle direct-set volume and flag muscles below their validated target band, without changing what the generator produces. Surface it (a) in the `gen-routine.ts` diagnostic for engine evaluation and (b) as one user-facing `muscle_coverage_low` warning.

## Decisions (reconciled through the review loop)

- **Decompose; warnings first** (this spec), then variety scoring, then gap-fill.
- **A structured per-exercise muscle field** is the data source, NOT movement patterns. Patterns cannot resolve delt heads (`vertical_push` does not say front/side/rear) or lats vs upper-back (`horizontal_pull` mixes them); deriving warnings from patterns would recreate the original push/pull-warning bug.
- **Warn on DIRECT sets (primary muscle only).** Compute `effectiveSets` (direct + secondary credit) internally too, but the warning/gap metric is direct sets. Crediting secondaries to the warning metric overestimates coverage from compounds (e.g. bench + OHP would read "triceps fully covered" with zero direct triceps work). Direct-set accounting reveals under-dosed muscles far more clearly. Track both so they are separated for later use; only direct is exposed in v1's gap logic.
- **Surface: diagnostic + one user-facing warning.** A single `muscle_coverage_low` key whose copy lists the under-dosed muscles. NOT one key per muscle.
- **Keep the push/pull imbalance warning (coexist), do not replace it.** Push/pull asks "is movement balance reasonable?"; muscle coverage asks "are muscles getting enough direct work?" These are different questions. The plan's "replace push/pull" is deferred until evidence proves redundancy. The just-shipped #4-refinement (asymmetric push/pull threshold) stays as-is.
- **This is programming coverage, not biomechanical truth** (see "Coverage confidence" below).

## Muscle taxonomy (new `Muscle` type, 13 values)

```
chest · lats · upper_back · front_delts · side_delts · rear_delts ·
biceps · triceps · quads · hamstrings · glutes · calves · core
```

Stops at the "programming muscles" lifters actually plan around. Deliberately NOT finer (no upper/lower chest, no triceps-head splits); that resolution adds debate without changing any selection or warning decision.

This is a NEW, separate concept from the existing 10 `ExerciseCategory` reporting buckets (chest / back / shoulders / legs / glutes / arms / etc.). The reporting categories and the Progress muscle-volume bars stay exactly as they are. We add programming muscles; we do not replace exercise categories.

## Data layer (migration + seed)

Add to the `exercises` table (text + CHECK, matching the existing `movement_pattern` / `substitution_class` convention; no Postgres enums):

- `primary_muscle text`: one `Muscle` value, the muscle the lift directly trains.
- a fine secondary-muscle list, `Muscle[]`. **Naming:** `exercises.secondary_muscles text[]` already exists at the COARSE 10-category granularity (2026-06-06 metadata seed); the new fine list needs a non-colliding name (e.g. `secondary_muscle_groups`). The implementation plan picks the final name and decides whether the coarse `secondary_muscles` is left intact (it is read by nothing in the volume path today; confirm during planning). Additive is the safe default.

Seed all 94 catalogue exercises:

- **Delts** from `substitution_class`: `lateral_raise` → side_delts, `rear_delt_isolation` → rear_delts, `front_delt_isolation` → front_delts, `vertical_press` (Arnold Press etc.) → front_delts.
- **Legs** from `movement_pattern`: squat / lunge / quad_iso → quads, hinge / hamstring_iso → hamstrings, glute_iso → glutes.
- **Back** from pattern: vertical_pull → lats, horizontal_pull → upper_back (the one genuinely fuzzy split; see confidence note).
- The rest map ~1:1 from the existing `category` (chest, biceps, triceps, calves, core).

Thread the two new fields onto `ExerciseMeta` and BOTH pool projections (`EXERCISES_SELECT` and the routine-embedded `exercise:exercises(...)` in `ROUTINES_SELECT`, `actions/routines.ts` / `queries.ts`), so the generation pool and the validator both see them.

Migration is hand-applied (repo convention; record it in the roadmap Shipped bullet as "migration X (hand-apply on merge)").

## Pure tally + targets

New module `src/lib/pulse/muscleVolume.ts` (pure, unit-tested), or an extension of `muscleMap.ts`:

- `weeklyMuscleSets(blueprint, pool) → Record<Muscle, { direct: number; effective: number }>`
  - `direct`: per working set, +1.0 to the exercise's `primary_muscle`.
  - `effective`: `direct` + 0.5 per set for each fine secondary muscle (documented effective-sets heuristic, computed but NOT used by the gap logic in v1).
  - Iterates the blueprint in existing order; deterministic, no Date / random.
- `MUSCLE_SET_TARGETS: Partial<Record<Muscle, { min: number; max: number }>>`, the validated table (intermediate hypertrophy, weekly hard sets):

  | Muscle | min | max |
  |---|---|---|
  | chest | 10 | 16 |
  | back (lats + upper_back combined) | 12 | 18 |
  | side_delts | 8 | 14 |
  | rear_delts | 6 | 12 |
  | biceps | 8 | 12 |
  | triceps | 8 | 12 |
  | quads | 10 | 16 |
  | hamstrings | 8 | 14 |
  | glutes | 8 | 14 |

  `back` is checked as the combined `lats + upper_back` direct total against 12-18 (the science table is per the coarser "back"; the finer lats/upper_back split still exists in the data for the later variety spec). `front_delts`, `calves`, and `core` have NO under-dose target (front delts are loaded by all pressing; calves/core are not floor-gated here).
- `muscleCoverageGaps(blueprint, pool) → Muscle[]` (plus the combined `back`): the targeted muscles whose weekly DIRECT sets fall below the band minimum. Under-dose only (the table is a minimum-coverage floor); over-max is not warned in v1.

## Surface

1. **Diagnostic (primary value).** Extend `scripts/gen-routine.ts` to print a weekly per-muscle readout and the gap list, e.g.:
   ```
   Weekly muscle volume (direct sets)
     Chest 12 · Back 9 (lats 3 / upper 6) · Side delts 3 · Rear delts 3
     Biceps 3 · Triceps 3 · Quads 12 · Hamstrings 6 · Glutes 8
   Potential gaps: Side delts, Rear delts, Biceps, Triceps, Hamstrings
   ```
   This is the evidence instrument: run it across many configs to learn which styles / equipment / restriction combinations under-dose which muscles, before any generation change. (Optionally also show `effective` alongside `direct` so the compound-overestimation gap is visible.)

2. **One user-facing warning.** Add `muscle_coverage_low` to `validateProgram` (`programValidation.ts`), emitted when `muscleCoverageGaps` is non-empty. Its `WARNING_COPY` lists the muscles, e.g. "Some muscles may be getting less direct work than ideal: Side delts, Rear delts, Biceps." Single key, scalable. The existing push/pull check is untouched and coexists.

## Coverage confidence (document this explicitly)

The per-exercise muscle attribution is **programming coverage, not biomechanical truth.** Some muscles are unambiguous (biceps, triceps, side_delts, rear_delts, where direct isolation makes the primary obvious); others are inherently fuzzy (lats vs upper_back on rows, front_delts share of presses, glutes vs quads/hams on compounds). The warning answers "which muscles are receiving direct work and roughly how much," not "what is the exact physiological stimulus." Stating this in the module doc and the spec prevents future debates about exact attributions and keeps the metric's purpose honest.

## Testing

- Pure unit tests for `weeklyMuscleSets` (direct + effective separated) and `muscleCoverageGaps` over synthetic blueprints with known muscle assignments.
- A seed-consistency test: every catalogue exercise has a valid `primary_muscle` (mirrors the `CANONICAL_ANCHORS` / `ISOLATION_QUALITY` name-key guards; reads the seed SQL).
- `validateProgram`: `muscle_coverage_low` fires on an under-dosed blueprint and stays silent on a balanced one; the push/pull tests are unaffected.
- Golden stability: generation output is byte-identical (this spec changes no selection logic).

## Out of scope (explicit)

- **No generation/selection change.** Warn-only. Gap-fill is Spec 3.
- **Muscle-based variety scoring** (lat vs upper-back, delt-head diversity in `byPattern`) is Spec 2.
- **Replacing the push/pull warning**: deferred until evidence shows redundancy.
- **Per-set / per-day muscle breakdowns in the app UI** beyond the single warning. Not now.
- **Over-volume (above max) warnings**: v1 is under-dose only.
- **`secondaryEffective` in the gap logic**: computed and stored, not yet used to decide warnings.

## Follow-ons

- Feed the validated targets into Spec 3 (gap-fill) once evidence confirms them.
- A future `primary_muscle` could supersede the coarse `category` for the Progress volume bars (a finer reporting layer), but that is a separate reporting change, not this spec.
