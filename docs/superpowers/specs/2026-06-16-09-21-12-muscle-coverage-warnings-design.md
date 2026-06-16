# Muscle-coverage warnings (Tier-2, Spec 1 of 3)

Design for the first slice of the roadmap's "Tier-2: muscle-volume-aware generation" item. Driven by a code-truth + Claude.ai / Perplexity / ChatGPT review loop over the generator's real-catalogue output. The parent plan (with the validated per-muscle target table and isolation-quality data) is `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`.

## Limitations and intent (read first)

This layer is an **observability instrument for evaluating the generator**, not a physiological model.

- **Programming coverage, not biomechanical truth.** The per-exercise muscle attribution is a coaching heuristic. Some muscles are unambiguous (biceps, triceps, side_delts, rear_delts, where direct isolation makes the primary obvious); others are inherently fuzzy (lats vs upper_back on rows, the front-delt share of presses, glutes vs quads/hams on compounds). The metric answers "which muscles get direct work and roughly how much," not "what is the exact stimulus."
- **A generator-quality signal, not a user-quality verdict.** A warning means the routine falls below the current target model. It does NOT mean the routine is ineffective. Weekly set targets are approximations, not hard biological thresholds (the evidence base is strongest at the larger-muscle level and weakest at the delt-head level), so the copy is hedged ("may be getting less direct work than ideal").
- **Direct sets drive the warning; effective sets are diagnostic-only.** See "Pure tally".
- This framing goes at the top of the module doc too, to keep the metric's purpose honest and pre-empt edge-case debates.

## Why this first (decomposition + sequencing)

Tier-2 is three loosely-independent pieces of very different risk, not one project. The review loop and code-truth agreed on this order:

1. **Muscle-coverage warnings (THIS spec).** Warn-only observability. Pure measurement over the finished blueprint, no change to generation output. Builds the per-exercise muscle data layer that the next two pieces reuse.
2. **Muscle-based variety scoring (later spec).** A local `byPattern` ordering change (lat vs upper-back, delt-head diversity) using the same muscle data. Medium risk.
3. **Minimum-coverage gap-fill (last, only after evidence).** Actively changes selection to hit per-muscle targets. Highest risk: it sits on top of every existing cap, the compound floor, the priority-set ceiling, supersets, equipment + contraindication filters. Build it only once the warnings prove the targets are right and many generated programs show what actually needs correcting.

**Core principle: separate measurement from intervention.** Measure → observe → validate the targets → only then consider intervention. The generator stays deterministic and unchanged in this spec.

Note: the "exercise quality scoring" piece (the kickback / concentration-curl problem) that the review loop ranked as the single biggest immediate output improvement already shipped this branch as fix #3 (`ISOLATION_QUALITY`, commit `dcd97f9`). That clears the runway for this measurement layer.

## Goal

For any generated routine, compute weekly per-muscle direct-set volume and flag muscles below their validated target band, without changing what the generator produces. Surface it (a) in the `gen-routine.ts` diagnostic for engine evaluation and (b) as one user-facing `muscle_coverage_low` warning.

## Decisions (reconciled through the review loop)

- **Decompose; warnings first** (this spec), then variety scoring, then gap-fill.
- **A structured per-exercise muscle field** is the data source, NOT movement patterns. Patterns cannot resolve delt heads (`vertical_push` does not say front/side/rear) or lats vs upper-back (`horizontal_pull` mixes them); deriving warnings from patterns would recreate the original push/pull-warning bug.
- **Warn on DIRECT sets (primary muscle only).** Compute `effective` (direct + secondary credit) internally too, but the warning/gap metric is direct sets. Crediting secondaries to the warning metric overestimates coverage from compounds (e.g. bench + OHP would read "triceps fully covered" with zero direct triceps work); direct-set accounting exposes the under-dosed muscles the warning exists to find. `effective` is **diagnostic-only and non-normative**: a labelled heuristic (0.5 per secondary set), never a validated physiological conversion, and the code path stays flexible so the secondary weighting can later be tuned per muscle or exercise class without a data-model change.
- **Warning-targeted muscles are exactly the 9 in the validated table.** `front_delts`, `calves`, and `core` are in the taxonomy and the diagnostic (and are valid secondaries) but are **informational-only, never warning-targeted**. This is a deliberate scope cut, not a value judgment: front delts are loaded by all pressing so a direct-set floor would false-flag every routine without front raises (the science table omits them for exactly this reason); calves/core need different programming logic that is not comparable to prime-mover coverage. Keeping the warning set == the 9 targeted muscles makes the model internally consistent (no muscle is "measured by direct sets but silently never flagged").
- **Surface: diagnostic + one user-facing warning.** A single `muscle_coverage_low` key whose copy lists the under-dosed muscles. NOT one key per muscle.
- **Keep the push/pull imbalance warning (coexist), do not replace it.** Push/pull asks "is movement balance reasonable?"; muscle coverage asks "are muscles getting enough direct work?" These are different questions (a routine can pass one and fail the other). The plan's "replace push/pull" is deferred until evidence proves redundancy. The just-shipped #4-refinement (asymmetric push/pull threshold) stays as-is.

## Muscle taxonomy (new `Muscle` type, 13 values)

```
chest · lats · upper_back · front_delts · side_delts · rear_delts ·
biceps · triceps · quads · hamstrings · glutes · calves · core
```

Stops at the "programming muscles" lifters actually plan around. Deliberately NOT finer (no upper/lower chest, no triceps-head splits); that resolution adds debate without changing any selection or warning decision.

Of these 13, **9 are warning-targeted** (chest, back [= lats + upper_back], side_delts, rear_delts, biceps, triceps, quads, hamstrings, glutes) and the rest (`front_delts`, `calves`, `core`) are informational-only (see Decisions).

This is a NEW, separate concept from the existing 10 `ExerciseCategory` reporting buckets (chest / back / shoulders / legs / glutes / arms / etc.). The reporting categories and the Progress muscle-volume bars stay exactly as they are. We add programming muscles; we do not replace exercise categories.

## Data layer (migration + seed)

Add to the `exercises` table (text + CHECK, matching the existing `movement_pattern` / `substitution_class` convention; no Postgres enums):

- `primary_muscle text`: one `Muscle` value, the muscle the lift directly trains.
- a fine secondary-muscle list, `Muscle[]`. **Naming:** `exercises.secondary_muscles text[]` already exists at the COARSE 10-category granularity (2026-06-06 metadata seed); the new fine list needs a non-colliding name (e.g. `secondary_muscle_groups`). Additive is the safe choice: leave the coarse `secondary_muscles` intact so the older reporting layer is untouched (it is read by nothing in the volume path today; confirm during planning). Document in the migration that the new fields are for programming analysis, not user-facing anatomy truth.

**Seed all 94 catalogue exercises. The pattern-derived assignments are an INITIAL SEED HEURISTIC, not truth, and individual rows will be revised manually later:**

- **Delts** from `substitution_class`: `lateral_raise` → side_delts, `rear_delt_isolation` → rear_delts, `front_delt_isolation` / `vertical_press` → front_delts.
- **Legs** from `movement_pattern`: squat / lunge / quad_iso → quads, hinge / hamstring_iso → hamstrings, glute_iso → glutes.
- **Back** from pattern: vertical_pull → lats, horizontal_pull → upper_back. This is the fuzziest split (some rows are lat-biased, some pulldowns are not purely lats), so it is explicitly a seed heuristic to revisit per exercise, never asserted as truth.
- The rest map ~1:1 from the existing `category` (chest, biceps, triceps, calves, core).

Thread the two new fields onto `ExerciseMeta` and BOTH pool projections (`EXERCISES_SELECT` and the routine-embedded `exercise:exercises(...)` in `ROUTINES_SELECT`, `actions/routines.ts` / `queries.ts`), so the generation pool and the validator both see them.

Migration is hand-applied (repo convention; record it in the roadmap Shipped bullet as "migration X (hand-apply on merge)").

## Pure tally + targets

New module `src/lib/pulse/muscleVolume.ts` (pure, unit-tested):

- `weeklyMuscleSets(blueprint, pool) → Record<Muscle, { direct: number; effective: number }>`
  - `direct`: per working set, +1.0 to the exercise's `primary_muscle`.
  - `effective`: `direct` + 0.5 per set for each fine secondary muscle. Diagnostic-only heuristic (see Decisions); NOT used by the gap logic in v1. The 0.5 factor is a single named constant so it can be tuned later.
  - Iterates the blueprint in existing order; deterministic, no Date / random.
- `MUSCLE_SET_TARGETS`, the validated table (intermediate hypertrophy, weekly hard sets), keyed by a **target key** (the 9 targeted muscles, where back is the aggregate):

  | Target | min | max |
  |---|---|---|
  | chest | 10 | 16 |
  | back (= lats + upper_back) | 12 | 18 |
  | side_delts | 8 | 14 |
  | rear_delts | 6 | 12 |
  | biceps | 8 | 12 |
  | triceps | 8 | 12 |
  | quads | 10 | 16 |
  | hamstrings | 8 | 14 |
  | glutes | 8 | 14 |

- **The aggregation function owns the back roll-up** (single source of truth): a `targetDirectSets(perMuscleDirect, target)` helper sums `lats + upper_back` for the `back` target and returns the muscle's own direct count otherwise. `MUSCLE_SET_TARGETS` references the aggregate `back` explicitly, and a unit test asserts the roll-up, so the taxonomy and the target definitions cannot drift apart. **This aggregation is a v1 simplification, explicitly temporary:** a `lats 2 / upper_back 15` program passes `back 17` while being one-dimensional. That blind spot is acceptable for a warning-only v1 and is precisely what the Spec 2 variety scoring (lat vs upper-back) will address; documented so it is a known limitation, not a silent gap.
- `muscleCoverageGaps(blueprint, pool) → Array<{ target; direct; min; ratio }>`: the targeted muscles whose weekly DIRECT sets fall below the band minimum, each carrying `ratio = direct / min` so gaps sort by severity (`side_delts 0/8` is very different from `side_delts 7/8`). Under-dose only (the table is a minimum-coverage floor); over-max is not warned in v1.

## Surface

1. **Diagnostic (primary value).** Extend `scripts/gen-routine.ts` to print a weekly per-muscle readout (all 13, so informational muscles are visible) plus a severity-sorted gap list with coverage ratios, e.g.:
   ```
   Weekly muscle volume (direct sets · target)
     Chest 12/10 (120%) · Back 9/12 (75%) [lats 3 / upper 6] · Side delts 3/8 (38%)
     Rear delts 3/6 (50%) · Biceps 3/8 (38%) · Triceps 3/8 (38%)
     Quads 12/10 (120%) · Hamstrings 6/8 (75%) · Glutes 8/8 (100%)
     (informational: front delts 0 · calves 4 · core 3)
   Potential gaps (worst first): Side delts 38%, Biceps 38%, Triceps 38%, Rear delts 50%, Back 75%, Hamstrings 75%
   ```
   This is the evidence instrument: run it across many configs to learn which styles / equipment / restriction combinations under-dose which muscles, before any generation change. Showing `effective` alongside `direct` is optional but useful (it makes the compound-overestimation gap visible).

2. **One user-facing warning.** Add `muscle_coverage_low` to `validateProgram` (`programValidation.ts`), emitted when `muscleCoverageGaps` is non-empty. Its `WARNING_COPY` lists the muscles with hedged, non-judgmental wording, e.g. "Some muscles may be getting less direct work than ideal: Side delts, Rear delts, Biceps." Single key, scalable. The existing push/pull check is untouched and coexists.

## Testing

- Pure unit tests for `weeklyMuscleSets` (direct + effective separated; the 0.5 factor exercised) and `muscleCoverageGaps` (severity/ratio ordering) over synthetic blueprints with known muscle assignments.
- **Back roll-up test:** `lats + upper_back` aggregates to the `back` target; a `lats 2 / upper_back 15` blueprint passes `back` (locks the documented v1 limitation).
- **Ambiguous-exercise fixtures:** rows (lat vs upper_back), presses (chest primary, front_delts/triceps secondary), and goblet squats (quads primary, glutes secondary) assert the attribution behaves predictably, so the coverage layer cannot quietly become a hidden selection policy.
- A seed-consistency test: every catalogue exercise has a valid `primary_muscle` (mirrors the `CANONICAL_ANCHORS` / `ISOLATION_QUALITY` name-key guards; reads the seed SQL).
- `validateProgram`: `muscle_coverage_low` fires on an under-dosed blueprint and stays silent on a balanced one; the informational muscles (`front_delts` / `calves` / `core`) never trigger it; the push/pull tests are unaffected.
- Golden stability: generation output is byte-identical (this spec changes no selection logic).

## Out of scope (explicit)

- **No generation/selection change.** Warn-only. Gap-fill is Spec 3.
- **Muscle-based variety scoring** (lat vs upper-back, delt-head diversity in `byPattern`) is Spec 2; it is also what addresses the `back` roll-up blind spot.
- **Replacing the push/pull warning**: deferred until evidence shows redundancy.
- **`front_delts` / `calves` / `core` warning targets**: informational-only in v1 (deliberate scope cut).
- **Over-volume (above max) warnings**: v1 is under-dose only.
- **`effective` in the gap logic**: computed and stored, not yet used to decide warnings.
- **Per-set / per-day muscle breakdowns in the app UI** beyond the single warning: not now.

## Follow-ons

- Feed the validated targets into Spec 3 (gap-fill) once evidence confirms them.
- A future `primary_muscle` could supersede the coarse `category` for the Progress volume bars (a finer reporting layer), but that is a separate reporting change, not this spec.

## Review reconciliation (Perplexity + ChatGPT + code-truth, 2026-06-16)

Both reviewers approved the prior draft with documentation hardening. Adopted: front-loaded limitations block; `effective` marked diagnostic-only / non-normative / tunable; `front_delts` / `calves` / `core` resolved to informational-only (ChatGPT's front-delt inconsistency, taken via his preferred Option A because the validated table deliberately omits front delts; calves/core per Perplexity's deliberate-scope-cut note); back roll-up owned by the aggregation function with an explicit test and a documented temporary-aggregation caveat; pattern-derived seed assignments labelled an initial heuristic, not truth; coverage-ratio / severity added to the gap output and diagnostic (ChatGPT); generator-quality-not-user-quality framing and hedged warning copy (both). Dismissed: ChatGPT's Option B (give front delts a target), which would false-flag routines without front raises, contradicting the validated science table.
