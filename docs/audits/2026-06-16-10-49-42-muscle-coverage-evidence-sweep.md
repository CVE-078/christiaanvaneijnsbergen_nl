# Muscle-coverage evidence sweep (Tier-2 Spec 2 vs Spec 3)

Date: 2026-06-16. Branch: `feature/muscle-variety-scoring`. Purpose: before committing to Tier-2 Spec 2 (muscle-based variety scoring) or Spec 3 (minimum-coverage gap-fill), gather evidence with the just-shipped muscle-coverage layer to decide from data, not the "row/row/row" guess. The review loop explicitly asked for this "collect evidence over many programs" step before any selection change.

## Method

`scripts/muscle-sweep.ts` (committed): generates every program STYLE (13 styles, 2-6 days) across 3 equipment tiers (dumbbell = {dumbbells, bench}; home = {+barbell, pull_up_bar}; gym = {+cables, machines}), all at 45-60 min, intermediate, build_muscle. For each of the 39 configs it computes weekly per-muscle DIRECT-set volume vs `MUSCLE_SET_TARGETS` (the volume signal) and two variety signals: delt-head balance (side vs rear) and same-head `shoulder_iso` clustering within a session. Catalog from the local cache, `primary_muscle` backfilled via `deriveSeedPrimaryMuscle` (mirrors the migration seed).

## Headline finding

**The pervasive, structural failure is small-muscle VOLUME, not variety. The variety premise is refuted.**

### Volume: under-target frequency across 39 configs

| Muscle | configs under target | avg coverage |
|---|---|---|
| side_delts | **39 / 39** | 52% |
| biceps | 38 / 39 | 58% |
| rear_delts | 36 / 39 | 38% |
| triceps | 34 / 39 | 59% |
| hamstrings | 32 / 39 | 72% |
| glutes | 31 / 39 | 67% |
| chest | 27 / 39 | 92% |
| quads | 20 / 39 | 102% |
| back | 11 / 39 | 109% |

The small, isolation-dependent muscles (side delts, rear delts, biceps, triceps) are under-dosed in nearly every program and every equipment tier. The big compound-driven muscles (chest, quads, back) sit at or above target. This is the classic "arms and delts get neglected behind the compounds" hypertrophy gap, and the engine has it structurally: the emphases allocate roughly one isolation slot per small muscle per session, which at ~3 sets lands well below the 8-14 weekly targets.

### Variety: refuted

- **Same-head `shoulder_iso` clustering: 0 / 39 configs.** The engine never seats two same-head delt isolations in a session. The emphases list ~1 `shoulder_iso` slot per session, so there is nothing for a variety reorder to diversify. The only other intra-pattern muscle choice is `back_iso` (pullover/lats vs shrug/upper_back), and `back` is the least under-dosed target (11/39, avg 109%), so that variety is immaterial.
- **Delt-head imbalance (rear < 50% of side, rear option usable): 12 / 39 configs.** Real, but it is the rear-delt VOLUME gap (rear_delts avg 38%), not a wrong-pick-in-a-slot problem. A variety reorder cannot fix it: there is no second delt slot to redirect; rear delts simply get no slot. Fixing it needs an ADDED set (gap-fill), not reordering.

## Conclusion and recommendation

**Drop / defer Spec 2 (muscle-based variety scoring).** It targets same-pattern clustering, which occurs in 0/39 configs because the emphasis structure gives small muscles only one iso slot each. A `byPattern` reorder has no room to operate and would change almost nothing (and would be a no-op on the synthetic goldens regardless).

**Proceed to Spec 3 (minimum-coverage gap-fill) as the next Tier-2 spec.** The evidence the review loop wanted before gating gap-fill now exists and is unambiguous: small-muscle volume is the lever. Spec 3 should ensure a minimum number of direct sets for the under-dosed muscles when budget/structure allows, on top of the existing caps, compound floor, priority ceiling, and supersets. It is the highest-risk piece (it changes selection), so it goes spec-first with adversarial review.

### Open questions for the Spec 3 brainstorm (not decided here)

- **Are the targets realistic for a generalist program?** Hitting side_delts 8+ /week needs deliberate volume (2-3 lateral-raise efforts). Gap-fill could chase the full band, or aim for a softer floor (e.g. min ~6) so it nudges without bloating sessions. Decide in the spec.
- **Add a set to an existing exercise, add an exercise, or both?** Adding sets respects the session's exercise count; adding exercises grows it. Interaction with `over_time` and the session budget.
- **Priority order when several muscles are short** and how it composes with the existing priority-muscle ceiling and the pattern/heavy/unilateral caps.
- **Equipment honesty:** never chase a muscle the usable pool cannot train (the pool-scope guard principle already in `muscleCoverageGaps`).

## Caveats

- One session length (45-60 min) and one experience/goal (intermediate / build_muscle). 30-min sessions would be leaner (fewer slots, worse small-muscle coverage); 90+ would be better. The direction holds; the magnitudes shift.
- Targets are the intermediate-hypertrophy bands from the parent plan's cited table; "programming coverage, not biomechanical truth" still applies.
- `primary_muscle` is the seed heuristic (esp. lats vs upper_back); back-aggregate coverage is the least affected by that fuzziness.
