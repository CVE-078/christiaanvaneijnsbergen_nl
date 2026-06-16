# Minimum-coverage gap-fill (Tier-2, Spec 3 of 3)

Design for the final Tier-2 piece. Spec 1 (muscle-coverage warnings) shipped 2026-06-16 and gave us the evidence to gate this one. Spec 2 (variety scoring) was DROPPED: the evidence sweep (`docs/audits/2026-06-16-10-49-42-muscle-coverage-evidence-sweep.md`) found same-pattern clustering in 0/39 configs, so a `byPattern` reorder would fix a non-problem. Parent plan: `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`. Spec 1 design: `docs/superpowers/specs/2026-06-16-09-21-12-muscle-coverage-warnings-design.md`.

## Why this, and what the evidence says

The sweep (39 configs, 13 styles x 3 equipment tiers) showed the pervasive, structural failure is small-muscle VOLUME: side_delts under target in 39/39 configs (avg 52%), biceps 38/39, rear_delts 36/39 (38%), triceps 34/39, hamstrings 32/39 (72%), glutes 31/39 (67%). The big compound-driven muscles are basically fine on their own: chest avg 92%, quads 102%, back 109%. So gap-fill targets the accessory-dependent muscles the movement-pattern engine structurally under-doses, and leaves chest/back/quads to the base generator (warning-only). The review loop rated gap-fill the highest-value remaining generation improvement, on the condition that it stays conservative.

## Goal

After a routine is generated, detect under-covered accessory muscles and add a small, capped amount of targeted ISOLATION work to close the worst gaps, deterministically. Gap-fill is opportunistic, bounded, and never allowed to override the base program structure: it only appends isolation sets/exercises, never reorders, removes, or adds compounds. Eliminate zero-coverage muscles first; nudge below-floor muscles toward a modest floor second. No change to output when the pool lacks muscle attribution (synthetic pools), so all generation goldens stay byte-identical.

## Scope: which muscles gap-fill chases

**Gap-fill targets exactly these six accessory muscles:** `side_delts`, `rear_delts`, `biceps`, `triceps`, `hamstrings`, `glutes`.

**Excluded (warning-only, gap-fill never touches them):** `chest`, `back`, `quads` (the base generator's compounds cover them; the sweep shows them at/above target on their own). Also excluded, as in Spec 1: `front_delts`, `calves`, `core` (informational, never targeted). The Spec 1 `muscle_coverage_low` warning still measures ALL nine targeted muscles against the full band; gap-fill simply does not intervene on chest/back/quads. If future sweeps show real residual chest/back/quads deficits after the small-muscle fixes, widening scope is a later decision, deliberately deferred.

## Decisions (reconciled through two review-loop rounds)

- **Post-generation, routine-wide pass.** A pure `applyCoverageGapFill` step inside `generateRoutine`, after all sessions are selected + role-ordered, before the blueprint is returned (it needs per-session bias to set reps on anything it adds). Additive; never reorders or removes existing selections.
- **Gated on muscle attribution.** If no exercise carries `primary_muscle` (synthetic test pools), the pass is a no-op, so the goldens stay byte-identical (same guard as Spec 1).
- **Two phases, zeros first.** Phase 1 eliminates EVERY zero-coverage target muscle the usable pool can train (zero direct work is a distinctly worse failure than below-floor). Phase 2 nudges below-floor muscles toward the floor with whatever budget remains. Never the reverse.
- **The floor table is the ONLY intervention target; the warning band is reporting only.** `MUSCLE_COVERAGE_FLOOR` (below) is the minimum gap-fill drives toward. Spec 1's `MUSCLE_SET_TARGETS` band is the ideal the warning measures against and is NOT used by gap-fill. They are intentionally distinct so diagnosis and intervention do not conflate. The floor values are a deliberate POLICY choice ("worth fixing"), not a mathematically derived threshold.
- **Aspirational within budget, not a guarantee.** Because additions are capped, the floor is a best-effort target. On a tight pool gap-fill may not reach a muscle's floor; the residual is reported by the warning. Honest by construction.
- **Set-bump before exercise-insert (cheap-first ladder).** At/above floor: do nothing. Below floor with an existing isolation for the muscle: bump that exercise's sets first (cheap, no session growth), and a single muscle may receive MULTIPLE set-bumps in one pass until it reaches the floor or the bump ceiling stops it. Zero coverage, or below floor with nothing to bump: add ONE isolation exercise. Cannot (caps/pool/time): leave it to the `muscle_coverage_low` warning.
- **Isolation/accessory ONLY, never compounds.** Added exercises come strictly from isolation patterns (`*_iso` / `calf` / `core`); gap-fill never seats a row/bench/squat/OHP/RDL. The base generator owns compounds.

## The floor table

```
MUSCLE_COVERAGE_FLOOR (weekly DIRECT sets gap-fill drives toward; the six targets only):
  side_delts 6 · rear_delts 4 · biceps 6 · triceps 6 · hamstrings 6 · glutes 6
```

All six are single muscles (no `back`-style aggregation, since `back` is out of gap-fill scope). Tunable named constant; re-baseline if the catalogue or targets change.

## Caps and ceilings

- `PER_SESSION_ADD_CAP = 1`: a session grows by at most one added exercise across both phases.
- `ROUTINE_ADD_CAP = 4`: at most four added exercises per routine across both phases combined. Phase 1 (zeros) consumes this budget first, so zero-elimination is NOT throttled by a stingy cap (the earlier +2 would have left a zero unfixed when three muscles were neglected). Realistically the sweep shows 1-3 zeros per config, so 4 covers real cases; a pathological thin pool with more zeros leaves the remainder to the warning.
- Set-bumps do NOT count against `ROUTINE_ADD_CAP` (they add no exercise); they are bounded only by:
- `GAP_FILL_SET_CEILING = 20`: a muscle's total weekly direct sets never exceed this via gap-fill. (Currently equal to `PRIORITY_MUSCLE_SET_CEILING`; kept as its OWN named constant because the two express different intents -- user-requested extra volume vs engine repair -- and may diverge later.)
- The existing per-session pattern cap (<=2 of one movement pattern) is respected: gap-fill never seats a 3rd `shoulder_iso`.
- **Time-budget overflow rule:** a Phase 1 zero-kill insert MAY push a session past its time budget (within the +1/session cap) -- a 34-min session beats an untrained muscle, and it surfaces honestly via the existing `over_time` warning. A Phase 2 below-floor insert may NOT: it only goes into a session that still has time headroom. (Set-bumps are cheap and allowed in both phases.)

## Algorithm

Input: the freshly built blueprint (all sessions selected + ordered), the per-session emphasis/bias, the `usable` pool (equipment-filtered, non-contraindicated). Pure and deterministic.

```
if no exercise in the blueprint has primary_muscle: return blueprint unchanged   # no-op guard

direct = weeklyMuscleSets(blueprint, pool).direct                                # per Spec 1
added = 0                                                                        # added exercises, both phases

# --- Phase 1: eliminate zeros (worst failure class) ---
for muscle in GAP_FILL_TARGETS, sorted zeros-first then lowest ratio (fixed order):
    if direct[muscle] > 0: continue
    if not poolCanTrain(muscle, usable): continue            # pool-scope: skip what can't be trained
    if added >= ROUTINE_ADD_CAP: break
    session = pickSession(muscle, blueprint, allowOverTime = true)   # zero-kill may overflow time
    if session is null: continue                             # no eligible session under +1/session + pattern cap
    seatIsolation(muscle, session); added += 1; recompute direct[muscle]

# --- Phase 2: nudge below-floor partials toward the floor ---
for muscle in GAP_FILL_TARGETS, sorted by lowest ratio (direct/floor):
    while direct[muscle] < FLOOR[muscle]:
        if bumpExistingIsolationSets(muscle, blueprint):     # +1 set on its cheapest existing iso,
            recompute direct[muscle]; continue               #   capped by GAP_FILL_SET_CEILING; repeatable
        if added >= ROUTINE_ADD_CAP: break                   # nothing to bump -> try one insert, within budget
        session = pickSession(muscle, blueprint, allowOverTime = false)  # below-floor insert needs headroom
        if session is null: break
        seatIsolation(muscle, session); added += 1; recompute direct[muscle]
return blueprint
```

### `pickSession(muscle, allowOverTime)` placement ladder (deterministic)

1. The session that already trains the muscle with an isolation (set-bumps land here; "augment existing exposure first").
2. Else, among eligible sessions (per `MUSCLE_REGION`) that the pool can supply this isolation into, that are under the `PER_SESSION_ADD_CAP`, under the pattern cap for that iso pattern, and (when `allowOverTime` is false) still have time headroom: the one with the LOWEST current representation of this muscle, where **representation = the muscle's current direct sets in that session**. Tiebreak: fewest total exercises in the session, then `schedule` order.
3. Null if none qualifies.

### `MUSCLE_REGION` (eligible session focuses per target muscle)

```
side_delts, triceps   -> push, upper, full_body
rear_delts            -> push, pull, upper, full_body      (face pulls / reverse flyes live on back days too)
biceps                -> pull, upper, full_body
hamstrings, glutes    -> legs, lower, full_body
```

Conflicts resolve by the placement ladder's lowest-representation rule, then fewest exercises, then `schedule` order. The map is explicit in the spec and the code.

### `seatIsolation(muscle, session)`

Picks the exercise through the existing `byPattern(isoPatternFor(muscle))` machinery FILTERED to `primary_muscle === muscle` (so a `rear_delts` insert picks a rear-delt fly, not a lateral raise, though both are `shoulder_iso`), excluding already-chosen ids. This inherits `ISOLATION_QUALITY`, substitution-class freshness, and the avoid-set for free. Sets/reps come from the session's bias via the same `volumeFor` / `resolveRepRange` path the generator already uses. `isoPatternFor` maps each target to its isolation pattern (side/rear_delts -> shoulder_iso, biceps -> biceps_iso, triceps -> triceps_iso, hamstrings -> hamstring_iso, glutes -> glute_iso); it NEVER returns a compound anchor pattern. If `byPattern` yields no eligible candidate (pool exhausted under the caps), the insert is skipped and the muscle falls to the warning.

## Architecture and seam

- `applyCoverageGapFill(blueprint, sessionsMeta, usablePool) -> blueprint` lives in `generation.ts` (or a focused `gapFill.ts` imported by it), pure. Called at the end of `generateRoutine`, after role ordering.
- It mutates a working copy of the blueprint's `exercises`: appends inserted isolations (new `order` at the end of their session, `superset_group_id: null`, `sets`/`reps` from the session bias) and increments `sets` on bumped rows.
- Reuses `weeklyMuscleSets` / `targetDirectSets` (Spec 1), `byPattern` + `ISOLATION_QUALITY` (existing), `volumeFor` / `resolveRepRange` (existing). No new selection algorithm.

## Determinism and goldens

- Fixed target order, fixed placement tiebreaks (lowest representation -> fewest exercises -> schedule order), no `Date`/`Math.random`.
- Synthetic pools have no `primary_muscle` -> the no-op guard returns the blueprint untouched -> all generation goldens byte-identical. Locked by a golden identity test.

## Testing

- Pure-function unit tests on synthetic pools that DO carry `primary_muscle`:
  - zero-coverage target the pool can train -> exactly one isolation seated for it, in an eligible session.
  - below-floor-with-existing-isolation -> sets bumped (no new exercise), repeatedly, up to the floor or the ceiling.
  - below-floor-with-nothing-to-bump -> one exercise inserted (only if a session has headroom).
  - pool cannot train the muscle -> skipped (no insert).
  - excluded muscles (chest/back/quads) are never gap-filled even when below their Spec 1 band.
  - caps: never more than +1 exercise/session or +4/routine; never a 3rd of an iso pattern; set-bumps never exceed `GAP_FILL_SET_CEILING`.
  - zeros are fixed even when more than two muscles are at zero (Phase 1 is not throttled by a +2 cap).
  - time overflow: a zero-kill may push a session over budget; a below-floor insert may not.
  - never inserts a compound (assert the inserted exercise's pattern is an isolation pattern).
  - placement: prefers the session already training the muscle, then lowest representation.
  - determinism: same input -> identical output across runs; the same isolation is chosen for a given pool+pattern (ISOLATION_QUALITY stability).
- Golden byte-identity: every existing generation golden unchanged (no-op on synthetic pools).
- Real-catalogue check via `scripts/muscle-sweep.ts`: the zero-coverage cases (rear_delts 0% on dumbbell configs) become non-zero, and the six targets rise toward their floors without sessions ballooning (bounded by the caps). Re-run the sweep before/after.

## Out of scope (explicit)

- **Gap-filling chest / back / quads** (the generator covers them; warning-only for now, widen only if evidence shows residual deficits).
- **Full-band chasing / frequency-scaled floors** (v1 chases the modest floor table, capped).
- **Preset / A-B configurability** of the constants (YAGNI; named tunable constants suffice).
- **Dynamic per-pool ceilings** (hurts determinism; the static ceiling stays).
- **A separate audit-trail log** of additions (the `muscle_coverage_low` warning + the visible blueprint already surface what was and was not fixed).
- **Adding compounds** (hard-excluded by design).
- **Replacing the push/pull or muscle-coverage warnings** (unchanged; the warning still measures the full band for all nine targeted muscles).

## Review reconciliation (Claude.ai + Perplexity + code-truth, two rounds, 2026-06-16)

Round 1 adopted: explicit `MUSCLE_COVERAGE_FLOOR` table over a 0.6 multiplier; zeros as a separate higher-priority phase; placement preferring existing exposure then lowest representation; isolation-only (no compounds); the cheap-first ladder; determinism + ISOLATION_QUALITY-stability tests; explicit `MUSCLE_REGION` map.

Round 2 adopted: **(1)** split the caps so Phase 1 zero-elimination is not blocked by the routine exercise cap (per-session +1, routine +4, zeros first), fixing a contradiction with the no-zero principle (ChatGPT, critical); **(2)** narrowed gap-fill scope to the six accessory muscles, leaving chest/back/quads warning-only, since the sweep shows those three at/above target on their own (both reviewers, evidence-backed); **(3)** a separate named `GAP_FILL_SET_CEILING` (= 20, separable later); plus wording: floor as the sole intervention target and a policy choice ("aspirational within budget"), representation defined as in-session direct sets, time-overflow permitted only for zero-kill inserts, and explicit multi-bump in Phase 2.

Dismissed: a preset / A-B-test framework and dynamic per-pool ceilings (YAGNI and they erode determinism); a separate audit-trail log (the warning and blueprint already surface additions); both reviewers' cited sources (Eurocode floor-vibration PDFs, a Stanford CSLI workshop paper, generic ScienceDirect entries), which were irrelevant and not used. Flagged for the user's spec review: the scope narrowing to six muscles (chest/back/quads now warning-only) is the most consequential change from the prior draft.
