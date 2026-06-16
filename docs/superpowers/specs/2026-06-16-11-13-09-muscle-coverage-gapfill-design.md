# Minimum-coverage gap-fill (Tier-2, Spec 3 of 3)

Design for the final Tier-2 piece. Spec 1 (muscle-coverage warnings) shipped 2026-06-16 and gave us the evidence to gate this one. Spec 2 (variety scoring) was DROPPED: the evidence sweep (`docs/audits/2026-06-16-10-49-42-muscle-coverage-evidence-sweep.md`) found same-pattern clustering in 0/39 configs, so a `byPattern` reorder would fix a non-problem. Parent plan: `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`. Spec 1 design: `docs/superpowers/specs/2026-06-16-09-21-12-muscle-coverage-warnings-design.md`.

## Why this, and what the evidence says

The sweep (39 configs, 13 styles x 3 equipment tiers) showed the pervasive, structural failure is small-muscle VOLUME: side_delts under target in 39/39 configs (avg 52%), biceps 38/39, rear_delts 36/39 (38%), triceps 34/39. The emphases allocate roughly one isolation slot per small muscle, which lands well below the targets. The big compound-driven muscles (chest, quads, back) are fine. Gap-fill is the lever that fixes neglected delt/arm/hamstring volume in generated programs, and the review loop rated it the highest-value remaining generation improvement, with one condition: implement it conservatively.

## Goal

After a routine is generated, detect under-covered programming muscles and add a small, capped amount of targeted ISOLATION work to close the worst gaps, deterministically, without rewriting the program or bloating sessions. Eliminate zero-coverage muscles first; nudge below-floor muscles toward a modest floor second. Never touch compounds. No change to output when the pool lacks muscle attribution (synthetic pools), so all generation goldens stay byte-identical.

## Decisions (reconciled through the review loop)

- **Post-generation, routine-wide pass.** A pure `applyCoverageGapFill` step inside `generateRoutine`, after all sessions are selected + role-ordered, before the blueprint is returned (it needs per-session bias to set reps on anything it adds). Additive; it never reorders or removes existing selections.
- **Gated on muscle attribution.** If no exercise carries `primary_muscle` (synthetic test pools), the pass is a no-op, so the goldens stay byte-identical (the same guard pattern as Spec 1).
- **Two phases, zeros first.** Phase 1 eliminates EVERY zero-coverage targeted muscle the usable pool can train (zero direct work is a distinctly worse failure than below-floor). Phase 2 nudges below-floor muscles toward the floor with whatever budget remains. Never the reverse.
- **Explicit intervention floor table, NOT a multiplier.** `MUSCLE_COVERAGE_FLOOR` is a hand-chosen "worth fixing" table, SEPARATE from Spec 1's `MUSCLE_SET_TARGETS` "ideal" bands (the two serve different purposes: floor = the minimum gap-fill drives toward; band = the ideal the warning measures against). This replaces the earlier `0.6 x band_min` idea, which was a muddy second target. (Reconciliation note: the chosen floors run ~0.67-0.83 of the band min, slightly above the 0.6 sketch, but the per-routine cap keeps the actual added volume conservative regardless.)
- **Set-bump before exercise-insert (the cheap-first ladder).** At/above floor: do nothing. Below floor with an existing isolation for the muscle: bump that exercise's sets first (cheap, no session growth). Zero coverage, or below floor with nothing to bump: add ONE isolation exercise. Cannot (caps/pool): leave it to the `muscle_coverage_low` warning.
- **Isolation/accessory ONLY, never compounds.** Added exercises come strictly from isolation patterns (`*_iso` / `calf` / `core`); gap-fill never seats a row/bench/squat/OHP/RDL. The base generator owns compounds; gap-fill owns the neglected accessory volume the coverage layer exposed.
- **Hard caps.** Max +1 added exercise per session, max +2 added exercises per routine. Set-bumps respect the existing `PRIORITY_MUSCLE_SET_CEILING` (20 weekly direct sets/muscle). The existing per-session pattern cap (<=2 of one movement pattern) is respected (gap-fill never seats a 3rd `shoulder_iso`). Adding a zero-killing exercise may push a session a little over its time budget; that is the accepted trade (a 34-min session beats an untrained muscle), bounded by the +1/session cap, and it surfaces honestly via the existing `over_time` warning.
- **Warning interplay.** `muscle_coverage_low` keeps measuring against the full `MUSCLE_SET_TARGETS` band, NOT the floor, so after gap-fill it honestly reads "did what we could, X is still light."

## The floor table

```
MUSCLE_COVERAGE_FLOOR (weekly DIRECT sets the gap-fill drives toward):
  chest 8 · back 10 · side_delts 6 · rear_delts 4 ·
  biceps 6 · triceps 6 · quads 8 · hamstrings 6 · glutes 6
```

Same targeted set as Spec 1 (the 9 warning-targeted muscles; `back` is the lats+upper_back aggregate via `targetDirectSets`). `front_delts`, `calves`, `core` are NOT gap-filled (informational-only, consistent with Spec 1). Tunable named constant; re-baseline if the catalogue or targets change.

## Algorithm

Input: the freshly built blueprint (all sessions selected + ordered), the per-session emphasis/bias, the `usable` pool (equipment-filtered, non-contraindicated). Pure and deterministic.

```
if no exercise in the blueprint has primary_muscle: return blueprint unchanged   # no-op guard

direct = weeklyMuscleSets(blueprint, pool).direct                                # per Spec 1
addedThisRoutine = 0
ROUTINE_EXERCISE_CAP = 2

# --- Phase 1: eliminate zeros (worst failure class) ---
for muscle in TARGETED_MUSCLES, in fixed order, sorted zeros-first then by lowest ratio:
    if direct[muscle] > 0: continue
    if not poolCanTrain(muscle, usable): continue            # pool-scope: skip what can't be trained
    if addedThisRoutine >= ROUTINE_EXERCISE_CAP: break
    session = pickSession(muscle, blueprint, prefer = lowest-current-representation)
    if session is null: continue                             # no eligible session with budget + cap room
    seatIsolation(muscle, session)                           # via byPattern, isolation pattern only
    addedThisRoutine += 1; recompute direct[muscle]

# --- Phase 2: nudge below-floor partials toward the floor ---
for muscle in TARGETED_MUSCLES, sorted by lowest ratio (direct/floor):
    while direct[muscle] < FLOOR[muscle]:
        bumped = bumpExistingIsolationSets(muscle, blueprint)  # +1 set on its cheapest existing iso,
                                                               # respecting PRIORITY_MUSCLE_SET_CEILING
        if bumped: recompute direct[muscle]; continue
        # nothing to bump: try one exercise insert, within caps
        if addedThisRoutine >= ROUTINE_EXERCISE_CAP: break
        session = pickSession(muscle, blueprint, prefer = lowest-current-representation)
        if session is null: break
        seatIsolation(muscle, session); addedThisRoutine += 1; recompute direct[muscle]
return blueprint
```

### `pickSession(muscle, ...)` placement ladder (deterministic)

1. The session that already trains the muscle with an isolation (set-bumps land here; "augment existing exposure first").
2. Else, among eligible sessions (per `MUSCLE_REGION`) that the pool can supply this isolation into AND that are under the +1-exercise-per-session cap AND under the pattern cap for that iso pattern: the one with the LOWEST current direct representation of this muscle (spreads stimulus), tiebreak by fewest total exercises, then by `schedule` order.
3. Null if none qualifies.

### `MUSCLE_REGION` (eligible session focuses per muscle)

```
chest, side_delts, rear_delts, triceps   -> push, upper, full_body  (+ pull for rear_delts: rows/face-pull days)
biceps, back                             -> pull, upper, full_body
quads, hamstrings, glutes                -> legs, lower, full_body
```

`rear_delts` is eligible on pull/upper too (face pulls and reverse flyes live on back days). Conflicts resolve by the placement ladder's lowest-representation rule then `schedule` order. The map is explicit in the spec and the code.

### `seatIsolation(muscle, session)`

Picks the exercise through the existing `byPattern(isoPatternFor(muscle))` machinery FILTERED to `primary_muscle === muscle` (so a `rear_delts` insert picks a rear-delt fly, not a lateral raise, even though both are `shoulder_iso`), excluding already-chosen ids. This inherits `ISOLATION_QUALITY`, substitution-class freshness, and the avoid-set for free. Sets/reps come from the session's bias via the same `volumeFor` / `resolveRepRange` path the generator already uses. `isoPatternFor` maps each muscle to its isolation pattern (side/rear_delts -> shoulder_iso, biceps -> biceps_iso, triceps -> triceps_iso, chest -> chest_iso, back -> back_iso, quads -> quad_iso, hamstrings -> hamstring_iso, glutes -> glute_iso); it NEVER returns a compound anchor pattern.

## Architecture and seam

- `applyCoverageGapFill(blueprint, sessionsMeta, usablePool) -> blueprint` lives in `generation.ts` (or a focused `gapFill.ts` imported by it), pure. Called at the end of `generateRoutine`, after role ordering.
- It mutates a working copy of the blueprint's `exercises`: appends inserted isolations (new `order` at the end of their session, a fresh `superset_group_id: null`, `sets`/`reps` from the session bias) and increments `sets` on bumped rows.
- Reuses `weeklyMuscleSets` / `targetDirectSets` (Spec 1), `byPattern` + `ISOLATION_QUALITY` (existing), `volumeFor` / `resolveRepRange` (existing). No new selection algorithm.

## Determinism and goldens

- Fixed muscle-processing order, fixed placement tiebreaks (lowest representation -> fewest exercises -> schedule order), no `Date`/`Math.random`.
- Synthetic pools have no `primary_muscle` -> the no-op guard returns the blueprint untouched -> all generation goldens byte-identical. Locked by a golden identity test.

## Testing

- Pure-function unit tests on synthetic pools that DO carry `primary_muscle`:
  - zero-coverage muscle the pool can train -> exactly one isolation seated for it, in an eligible session.
  - below-floor-with-existing-isolation -> sets bumped (no new exercise) up to the floor or the ceiling.
  - below-floor-with-nothing-to-bump -> one exercise inserted.
  - pool cannot train the muscle -> skipped (no insert).
  - caps: never more than +1 exercise/session or +2/routine; never a 3rd of an iso pattern; set-bumps never exceed the 20-set ceiling.
  - never inserts a compound (assert the inserted exercise's pattern is an isolation pattern).
  - placement: prefers the session already training the muscle, then lowest representation.
  - determinism: same input -> identical output across runs; the same isolation is chosen for a given pool+pattern (ISOLATION_QUALITY stability).
- Golden byte-identity: every existing generation golden unchanged (no-op on synthetic pools).
- Real-catalogue check via `scripts/muscle-sweep.ts`: the zero-coverage cases (rear_delts 0% on dumbbell configs) become non-zero, and small-muscle coverage rises toward the floors without sessions ballooning (added exercises bounded by the caps). Re-run the sweep before/after.

## Out of scope (explicit)

- **Full-band chasing / frequency-scaled floors** (deferred; v1 chases the modest floor table, capped).
- **Preset / A-B configurability** of the constants (YAGNI; named tunable constants suffice for v1).
- **Dynamic per-pool ceilings** (hurts determinism; the static 20-set ceiling stays).
- **A separate audit-trail log** of additions (the `muscle_coverage_low` warning + the visible blueprint already surface what was and was not fixed).
- **Adding compounds** (hard-excluded by design).
- **Replacing the push/pull or muscle-coverage warnings** (unchanged; the warning still measures the full band).

## Review reconciliation (Claude.ai + Perplexity + code-truth, 2026-06-16)

Both reviewers approved with tightening. Adopted: the explicit `MUSCLE_COVERAGE_FLOOR` table replacing the 0.6 multiplier (cleaner, avoids a muddy derived target); zeros as a separate higher-priority phase; the placement ladder preferring existing exposure then lowest representation over raw budget; isolation/accessory-only (no compounds); the cheap-first ladder (existing -> add sets -> add exercise -> warning); caps +1/session and +2/routine; determinism + ISOLATION_QUALITY-stability tests; explicit `MUSCLE_REGION` map and documented tiebreaks. Dismissed: a preset/A-B-test framework and a dynamic ceiling (YAGNI and they would erode determinism); a separate audit-trail log (the warning and blueprint already make additions visible); Perplexity's cited sources (a Eurocode floor-vibration PDF and similar, irrelevant and not used). Flagged for the user's spec review: the floor table is slightly more aggressive than the 0.6 sketch the ambition question implied, but the +2/routine exercise cap bounds the real added volume, so the program stays conservative.
