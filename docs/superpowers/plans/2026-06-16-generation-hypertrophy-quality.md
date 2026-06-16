# Generation engine, hypertrophy quality pass (2026-06-15/16)

Branch: `feature/generation-hypertrophy-fixes`. A pre-validation pass on the slot-first generator, driven by a Claude.ai-code-truth + ChatGPT + Perplexity review loop over real-catalog outputs. ChatGPT re-scored the baseline output **6.5 → 8.5/10** after the shipped fixes. This doc captures the diagnosis, the fixes, the validated data we still need, and the remaining work, so none of it is lost.

## Diagnostic tool
`scripts/gen-routine.ts` (committed): runs the REAL `generateRoutine` against the REAL seeded catalogue from a config, prints the routine + warnings. Catalogue is cached locally (`scripts/.catalog-cache.json`, gitignored; `--refresh` to re-pull from Supabase). This is the seed of the future deterministic generation gate. Example:
```
bun run scripts/gen-routine.ts --equipment dumbbells,bench --goal build_muscle \
  --days mon,wed,sat --time 30 --style fb-3 --variety consistent
```
The over-pessimism + quality issues below were all diagnosed by reproducing configs with this tool.

## Shipped fixes (committed on the branch)
- **#2 rep range (`3eb3bd2`).** A build-muscle full-body "heavy" day now uses **6–8**, not 3–6 (five compounds at 3–6 read as a power day, not balanced hypertrophy). Scoped to `full_body` focus + Balanced style in `resolveRepRange`, so PHUL power days, the ppl-x2 heavy days, and the explicit Strength/Powerbuilding styles keep their intended 3–6. Side effect: 6–8 isn't "heavy", so it stopped tripping `over_time`.
- **#4 push/pull validator (`c624e26`).** `programValidation.ts` dropped the undifferentiated `shoulders` muscle from the press bucket (the bridge lumps front/side/**rear** delts together, so reverse flyes + lateral raises were counted as "press"). Push/pull balance is now chest+triceps vs back+biceps; the false `push_pull_imbalance` on balanced programs is gone.
- **#1 30-min isolation (`5b7c73b`).** A build-muscle **full-body** 30-min session now earns the fuller exercise budget (via supersets) so it reaches an isolation slot instead of collapsing to 4 compounds + 0 isolation, WITHOUT dropping a compound. Scoped to pure full-body styles + intermediate/advanced (in `generateRoutine`, gated on `style.sessions.every(full_body)`), so other splits and beginners keep the lean coverage-first short session, and zero existing goldens churned. The fuller session honestly runs ~38 min and still notes `over_time` (accepted trade-off).
- **#5 estimator.** The spurious `over_time` on the hypertrophy path is resolved (a side effect of #2). The fuller full-body 30-min day legitimately exceeds 30 min, so it warns honestly. Tuning the duration estimator/band against real logged session durations stays the deferred #5-proper (the constants are explicitly placeholders).
- **#3 isolation-ranking quality (`dcd97f9`).** A name-keyed `ISOLATION_QUALITY` map (the validated 0-1 score table below) is wired into `byPattern`'s sort ABOVE the fatigue tiebreak, on non-anchor (isolation) patterns only, mirroring `CANONICAL_ANCHORS`. The accessory fatigue tiebreak (lower fatigue first) used to default to low-fatigue-but-poor isolations; quality now decides first. Unlisted / nameless exercises share `NEUTRAL_QUALITY` (0.80, above the explicitly poor scores, below the good ones), so synthetic-pool goldens stay byte-identical and a solid unscored option still beats the poor ones. Real-catalogue effect confirmed via `gen-routine.ts`: Concentration Curl, Front Raise, and Tricep Kickback are gone, replaced by Cable Curl / Preacher / Lateral Raise / Tricep Pushdown / overhead extensions. Map keys use the catalogue's exact names (the review's shorthand did not map 1:1, e.g. "Cable Pushdown" -> Tricep Pushdown; the catalogue's "Cable Kickback" is a glute movement, not the triceps one). A catalog-consistency test guards the name keys against drift.
- **#4-refinement: asymmetric push/pull threshold (`a2144af`).** Re-measuring the weighted ratios after #4's bucket change showed all 6 golden inputs are pull-favored or ~1:1; tightening symmetrically to 1.5 would have newly flagged ul-aesthetic-4 (~1.89:1 pull-heavy, an intentional back-focus). Resolved (user-confirmed) as a **directional** cap: PRESS-heavy flags at 1.5 (the posture / shoulder risk the warning copy names, science consensus), PULL-heavy tolerated up to 2.0 (slight pull-favor is healthiest), so an aesthetic back-lean is not false-flagged but an extreme pull lean past 2.0 still warns. All 6 goldens stay clean.

Suite at branch HEAD: **1642 green**, typecheck clean.

## Validated decisions + data (from the ChatGPT + Perplexity loop)
- **Rep ranges (Perplexity, cited):** hypertrophy works ~5–30 reps taken near failure, but moderate loads are the practical center; 3–6 across multiple compounds is strength-biased and a poor default for a hypertrophy full-body day. 6–8 heavy + 8–12 other compounds + 12–15/15–20 isolation is sound.
- **Dumbbell loading (cited):** goblet squat, dumbbell RDL, and dumbbell isolations are grip/stability/load-limited, so 3–6 is a poor stimulus; exercise-specific rep floors are warranted (a v1.6 follow-on, not yet built).
- **30-min hypertrophy (both):** keep the compound foundation and add isolation (6 exercises > 5 if not junk volume); beginners/strength stay lean. Implemented in #1.
- **Push/pull threshold (Perplexity, cited):** ~2:1 is too loose; recommend flagging at **~1.5:1** (1:1 ideal). NOT yet applied (see remaining #4-refinement). Current `PUSH_PULL_RATIO_MAX = 2.0`.

### Isolation quality scores (for fix #3), ChatGPT 0–1, Perplexity concurred
Higher = better hypertrophy default (loadability, resistance curve, stability, lengthened-position bias). Kickback + Concentration Curl confirmed below-average.

| Group | Scores (high → low) |
|---|---|
| Biceps | Cable Curl 1.0 · Incline DB Curl 0.95 · Preacher 0.95 · DB Curl 0.90 · Hammer 0.90 · Spider 0.85 · **Concentration 0.70** |
| Triceps | Cable Pushdown 1.0 · Overhead Extension 0.95 · Dips 0.95 · Skull Crusher 0.90 · Close-Grip Push-Up 0.80 · Cable Kickback 0.65 · **DB Kickback 0.55** |
| Side/rear delt | Lateral Raise 1.0 · Face Pull 0.95 · Rear Delt Fly 0.95 · Reverse Fly 0.90 · Upright Row 0.85 · Arnold Press 0.75 · Front Raise 0.60 |
| Chest iso | Cable Fly 1.0 · Chest Fly 0.90 |
| Back iso | Straight-Arm Pulldown 1.0 · Pullover 0.85 · Shrug 0.80 |

### Per-muscle weekly hard-set targets (for Tier-2 coverage), Perplexity, cited, intermediate hypertrophy
Chest 10–16 · Back 12–18 · Side delts 8–14 · Rear delts 6–12 · Biceps 8–12 · Triceps 8–12 · Quads 10–16 · Hamstrings 8–14 · Glutes 8–14. Use as minimum-coverage floors so smaller muscles aren't under-dosed behind compounds.

## Remaining work
- **Tier-2: muscle-volume-aware generation (the big lever).** Wire the existing muscle bridge (`muscleMap.ts`, already used for reporting + the P3.2 priority volume) into: (a) muscle-based warnings (chest_underdosed / lateral_delts_low replacing pattern push/pull), (b) minimum-coverage gap-fill using the target table above, (c) muscle-based variety scoring (lat vs upper-back pulls without new patterns). **Spec-first** (the big architectural lever, not a one-shot).
- **Deferred follow-ons:** exercise-specific rep floors (dumbbell loading); training style influencing exercise selection, not just reps (bodybuilding ≠ strength menu); estimator/band tuning vs real logged durations (#5-proper); a `quality` column next to `fatigue` to replace the name-keyed `ISOLATION_QUALITY` map (mirrors the `anchor_rank` follow-up).

## How this was validated
Real-catalogue reproduction via `gen-routine.ts` + a 10-config test matrix run past ChatGPT, plus a code-truth + ChatGPT + Perplexity review loop. The loop confirmed every change and surfaced that the engine is "mostly working, a few recurring defects drag the scores" rather than architecturally broken. The remaining gains are exercise-selection quality (#3) and muscle-level volume coverage (Tier-2), not structural.
