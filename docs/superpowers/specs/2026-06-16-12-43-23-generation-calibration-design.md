# Generation calibration pass (Spec 3.1)

A bounded, evidence-driven calibration of the generator after the Tier-2 muscle-coverage work shipped (#151 warnings, #152 gap-fill). Driven by a two-round ChatGPT + Perplexity review loop over 10 real-catalogue routines (`docs/audits/2026-06-16-12-25-04-generation-samples-for-review.md`). Both reviewers validated the core ("floors evidence-based and appropriate", "bands textbook-correct", "volume system good enough"); these are calibration + data fixes, not architecture. The bigger context-sensitive exercise-scoring lever is split into its own next spec.

## Scope (six changes; user-confirmed)

A. Exercise-specific rep floors for load-limited movements.
B. Frequency-scaled accessory gap-fill floors.
C. Chest as a conditional gap-fill target.
D. Session-level volume balancing in gap-fill.
E. Catalogue re-tags: Dips and Straight-Arm Pulldown.

Plus a documented no-op: back/quads warnings are ALREADY covered (see below).

## A. Load-limited rep floors

**Problem (both reviewers, Perplexity cited):** dumbbell-loaded lower compounds get heavy rep ranges that they cannot load hard enough to justify. Sample #1 had Dumbbell Goblet Squat 4x6-8 and Dumbbell Romanian Deadlift 3x6-8; at those loads 6-8 is a poor hypertrophy stimulus (insufficient mechanical tension for a grip/stability-limited lift).

**Change:** after `resolveRepRange` assigns a range in the generator's per-exercise loop (`generation.ts`, where `reps = resolveRepRange(...)`), pass it through a new pure `floorRepRangeForLoad(reps, ex)`:
- `isLoadLimited(ex)` = `ex.equipment` includes `'dumbbells'` and includes none of `'barbell' | 'machines' | 'cables'` (a pure dumbbell lift; barbell/machine/cable variants can be loaded heavy, so they are exempt).
- If `isLoadLimited(ex)` AND (`ex.movement_pattern` in {`squat`, `hinge`, `lunge`} with `is_compound`, OR `ex.is_compound === false`) AND the range's low end < 10, return `"10-15"`. Otherwise return `reps` unchanged.

So a dumbbell goblet squat / RDL assigned 3-6 or 6-8 becomes 10-15; dumbbell isolations already sit at 10-15/12-15 so they are unaffected (the isolation clause is a safety net for strength/powerbuilding styles). Barbell/machine/cable lifts and all upper-body dumbbell presses/rows are untouched. Pure, deterministic, and a no-op on synthetic golden pools (their exercises are not dumbbell-tagged the same way; confirm goldens stay byte-identical, and if any churns, tighten the predicate).

## B. Frequency-scaled accessory floors

**Problem (ChatGPT #1, HIGH):** the flat `MUSCLE_COVERAGE_FLOOR` (side 6, rear 4, biceps/triceps/hams/glutes 6) is right for 2-3 day plans but leaves 4-6 day plans sitting at ~75% of the ideal band for every accessory. With more frequency available, the floor should climb.

**Change:** make the gap-fill floor a function of training frequency (`schedule.length`, already available to `applyCoverageGapFill`):

| Muscle | 2-3 day | 4 day | 5-6 day |
|---|---|---|---|
| side_delts | 6 | 8 | 8 |
| rear_delts | 4 | 6 | 6 |
| biceps | 6 | 8 | 8 |
| triceps | 6 | 8 | 8 |
| hamstrings | 6 | 8 | 8 |
| glutes | 6 | 6 | 8 |

Capped intentionally at 8 (ChatGPT: "the floor prevents neglect, not specialization; once it forces 10-12 sets per accessory, session quality deteriorates"). The existing exercise caps (+1/session, +4/routine, 20-set ceiling) still bound the total added work, so on a 4-day plan the floors are aspirational within budget. Implement as `coverageFloor(muscle, dayCount)`; `MUSCLE_COVERAGE_FLOOR` becomes this lookup.

## C. Chest as a conditional gap-fill target

**Problem (both reviewers):** chest was excluded from gap-fill (the sweep's 92% average), but per-config it dips dangerously (aesthetic dumbbell #5 = 6 direct / 60%, time-crunch #10 = 3 direct, 2-day #7 = 6). "Backwards" to fill accessories while chest sits at 3.

**Change:** add `chest` to `GAP_FILL_TARGETS` with a modest, frequency-scaled floor (chest 6 for 2-3 day, 8 for 4-6 day). `ISO_PATTERN_FOR.chest = 'chest_iso'`; `MUSCLE_REGION.chest = ['push', 'upper', 'full_body']`. So when chest falls below the floor, gap-fill adds a chest isolation (fly), exactly as for the accessory muscles. **back and quads stay excluded** (the compounds reliably cover them; the sweep and both reviewers agree). Note: this fixes chest VOLUME; the deeper aesthetic-#5 issue (a missing Incline DB Press, a selection gap) is context-scoring territory, deferred.

## D. Session-level volume balancing

**Problem (both reviewers):** gap-fill closes a gap by piling sets onto one isolation in one session (Lateral Raise 6, Preacher 6, Triceps Ext 6), which reads algorithmic. A coach distributes (3+3 across two days) for better fatigue management. With the higher floors from (B) this matters more.

**Change:** add a per-exercise gap-fill cap `GAP_FILL_PER_EXERCISE_SETS = 4` and make Phase 2 distribute. Restructure the Phase 2 step so that, to add one set toward a muscle's floor, gap-fill targets the eligible session (per `MUSCLE_REGION`) with the LOWEST current direct sets of that muscle: if that session has an isolation for the muscle below `GAP_FILL_PER_EXERCISE_SETS`, bump it; otherwise insert a new isolation there (within the +1/session and +4/routine caps). This yields 3+3 / 4+4 distributions instead of 6+0. Existing caps still bound the total; when budget is exhausted before the floor, the remainder is reported by `muscle_coverage_low` (honest, unchanged). Set-bumps still do not count against the exercise cap; inserts still do.

## E. Catalogue re-tags (migration)

**Problem (both reviewers, confirmed against the catalogue):** two exercises are mis-classified, distorting both selection and accounting.
- **Dips** is `triceps_iso` / non-compound. It is a compound chest+triceps press. Re-tag: `movement_pattern = 'horizontal_push'`, `is_compound = true`, `substitution_class = 'horizontal_press'`, `primary_muscle = 'chest'`, `secondary_muscle_groups = {triceps, front_delts}`. (It floats below the canonical bench anchors, so it becomes an accessory chest press, not a primary.)
- **Straight-Arm Pulldown** is `vertical_pull` / compound. It is a lat isolation. Re-tag: `movement_pattern = 'back_iso'`, `is_compound = false`, `substitution_class = null`, `primary_muscle = 'lats'`. (Removes it from the primary vertical-pull pool, where it should never have anchored a pulling slot.)

A hand-applied migration updates both rows (and their `primary_muscle` / `secondary_muscle_groups` from Spec 1). Forward-only; affects real-catalogue generation, not the synthetic goldens. The `deriveSeedPrimaryMuscle` mirror in `muscleVolume.ts` should be updated so the seed-consistency test and diagnostic stay aligned (Dips -> chest via horizontal_push; Straight-Arm Pulldown -> lats via back_iso, which its existing back_iso rule already yields, but Dips needs its triceps_iso path to instead resolve through horizontal_push -> chest; verify the derivation matches the migration after the pattern change).

## Already covered (no change) and dismissed

- **Back / quads warning thresholds (reviewers asked for these):** already done. `muscle_coverage_low` (Spec 1) flags any of the nine targeted muscles, including back (band 12) and quads (band 10), below band; both warn earlier than the reviewers' suggested 8-10 threshold. No change.
- **Face Pull -> rear delts:** already correct (seed maps it `rear_delts`). No change.
- **"Two triceps isolations / pullover twice" in PPL:** the deliberate 6th-slot design (a 2nd `triceps_iso` / `back_iso`), not a defect.
- **Front delts "only 3 direct" despite pressing:** intended direct-only accounting (front delts ride pressing; never gap-filled). ChatGPT concedes it is "not a programming problem."
- **Quad vs hamstring/glute lower-day distinction:** already exists (`lower_quad` / `lower_post` emphases).

## Deferred to the next spec (context-sensitive exercise scoring)

The reviewers' #1 lever, genuinely bigger and architectural, NOT in this pass: an exercise x goal x split score (penalize Push Press at hypertrophy reps, Step-Up at low reps; reward Incline DB Press in aesthetic; per-exercise preferred rep windows), a Pullover frequency cap, style distinctiveness (balanced / bodybuilding / powerbuilding / time-crunch feel distinct), a weekly isolation-repetition soft cap, and an indirect compound-carryover credit for WARNINGS only. Its own spec after this pass.

## Testing

- Pure unit tests: `floorRepRangeForLoad` (dumbbell goblet squat 6-8 -> 10-15; barbell squat 6-8 unchanged; dumbbell isolation 12-15 unchanged; cable/machine unchanged). `coverageFloor(muscle, dayCount)` table. Chest added to gap-fill targets (a low-chest blueprint gains a chest_iso; back/quads never gap-filled). Session-balancing: a muscle needing 6 sets across two eligible sessions distributes (e.g. 3+3 / 4+ rather than 6+0), and never exceeds `GAP_FILL_PER_EXERCISE_SETS` via gap-fill.
- Golden byte-identity: synthetic pools no-op everywhere (the gap-fill gate + the load-floor predicate are both false on nameless/non-dumbbell synthetic exercises). Every existing generation golden unchanged. If any churns, the change leaked into the synthetic path; fix it, do not rebaseline.
- Seed-consistency test still green after the re-tags + `deriveSeedPrimaryMuscle` update.
- Real-catalogue verification via `scripts/muscle-sweep.ts` + `scripts/gen-routine.ts`: 4-6 day accessory coverage rises toward the new floors; chest no longer drops to 3 (#10) / 60% (#5) without a fly added; goblet squat / DB RDL read 10-15 on dumbbell plans; gap-fill distributes across sessions; Dips appears as a chest press, Straight-Arm Pulldown as a lat isolation.

## Migration

One hand-applied migration (`<timestamp>-exercise-dips-straightarm-reclassify.sql`): updates the two rows' `movement_pattern`, `is_compound`, `substitution_class`, `primary_muscle`, `secondary_muscle_groups`. Recorded in the Shipped roadmap bullet as hand-apply-on-merge.

## Reconciliation (ChatGPT + Perplexity, two rounds, 2026-06-16)

Adopted: load-limited rep floors (both, Perplexity-cited); frequency-scaled accessory floors (ChatGPT #1, evidence-aligned, capped at 8 per ChatGPT's own caution); chest conditional gap-fill (both; the one weak exclusion); session-level volume balancing (both; the "algorithmic 6-set block" complaint); Dips + Straight-Arm Pulldown re-tags (both; confirmed mis-tagged in the catalogue). Dismissed / already-handled: back/quads warnings (already in `muscle_coverage_low`), Face Pull mapping (already correct), the deliberate 6th-slot "redundancy" and front-delt direct-only accounting (by design), quad/hamstring day distinction (already exists). Deferred to its own spec: context-sensitive exercise scoring, per-exercise rep windows, Pullover frequency cap, style distinctiveness, isolation-repetition cap, indirect-carryover-for-warnings (the reviewers' highest-value lever, but a larger architectural layer than a calibration pass). Citations from both tools were science-substantive this round (MEV / effective-volume ranges, load-tension relationship); no irrelevant sources to discard.
