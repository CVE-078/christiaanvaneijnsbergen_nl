# Generation Engine Quality Improvement Plan

> **For agentic workers:** implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax. Findings + root causes live in `docs/superpowers/specs/2026-06-14-21-51-23-generation-engine-quality-audit.md`.

**Goal:** Make Pulse routine generation consistently judge whether a finished routine is a good programme, without rewriting the slot-first generator.

**Architecture:** Bounded improvements to the existing pipeline plus one new pure post-generation validator/repair pass. General programme invariants, not per-case patches. Determinism and the frozen goldens are preserved; any selection change re-baselines goldens by hand.

**Tech Stack:** TypeScript (strict), pure functions in `src/lib/pulse/`, Vitest. Hand-written SQL migrations in `docs/migrations/` (applied to Supabase by hand).

---

## Status legend

`TODO` not started · `WIP` in progress · `DONE` implemented + tests green + committed · `BLOCKED` waiting on a product decision.

## Progress tracker (update as each item lands)

| Item | Title | Phase | Status | Commit |
|------|-------|-------|--------|--------|
| P1.1 | Essential-coverage-first slot filling | 1 | DONE | feature/generation-quality |
| P1.2 | Restriction tag fixes + visible degradation | 1 | DONE | feature/generation-quality (migration hand-apply) |
| P1.3 | Exercise-specific prescriptions (time / per-side) | 1 | DONE | feature/generation-quality (migration hand-apply) |
| P1.3b | Log timed holds in Train/guided | 2 | TODO | deeper logging feature, deferred |
| P1.4 | Duration over-band warning | 1 | DONE | feature/generation-quality |
| P1.4b | Estimator refinement (warmups/superset/intensity) | 2 | DONE | feature/generation-quality |
| P1.5 | PHUL identity preserved across styles | 1 | DONE | feature/generation-quality |
| P1.5b | Label-validity floor (quad/posterior/push/pull structure) | 2 | TODO | folds into P2.3 validator |
| P2.1 | Coverage-aware backfill (no duplicate finisher) | 2 | DONE | feature/generation-quality |
| P2.2 | Bounded heavy-work limit (demanding-week warning) | 2 | DONE | feature/generation-quality |
| P2.3 | Post-generation programme validator | 2 | TODO | |
| P3.1 | Experience/goal rep floor (beginner + general-fitness) | 3 | DONE | feature/generation-quality |
| P3.1b | Difficulty-based exercise-complexity filter | 3 | DONE | feature/generation-quality |
| P3.2 | Measurable priority muscle | 3 | DONE | feature/generation-quality |
| P3.3 | Style modulates without erasing identity | 3 | TODO | |
| P3.4 | Variety, split differentiation, equipment visibility | 3 | TODO | |

Each item below carries a **Done** line (filled when complete: what changed) and an **Impact** line (how it affects the user or the engine). This is the per-improvement record requested.

---

# Phase 1 - Launch blockers

## P1.1 Essential-coverage-first slot filling (Issue 1)

**Invariant:** A full-body week contains at least one horizontal_pull or vertical_pull unless every pull pattern is empty after equipment + restriction filtering. A 3-exercise full-body session = one lower + one push + one pull when the pool allows.

**Layer:** generator slot ordering / truncation. **Files:** `src/lib/pulse/generation.ts` (new `ESSENTIAL_PATTERNS: Record<Focus, MovementPattern[][]>` near `COMPOUND_FLOOR`; change the first-pass loop ~1157-1161 to fill essential groups before optional slots, capped at budget). **Test:** `src/lib/pulse/__tests__/generation.test.ts`.

**Approach:** For each focus define essential pattern groups (order-independent OR-groups). `full_body`: `[[squat,hinge,lunge],[horizontal_push,vertical_push],[horizontal_pull,vertical_pull]]`. The first pass fills one exercise from each unfilled essential group first (respecting caps/restrictions), then proceeds through the remaining emphasis slots in order. General rule keyed on focus, not a full-body special-case. An impossible group is skipped and recorded for the validator/warning.

**Dependencies:** none. **Regression risk:** low-medium. At count >= 6 (deep pool) all slots fill and `orderByRole` re-sorts, so 6-slot membership goldens are unaffected; behaviour changes mainly at count 3-4. Re-baseline only affected identity assertions.

**Acceptance test:** generate every full-body style at 30 min for beginner/intermediate/advanced on a deep pool; assert at least one pull exists across the week, and that a 3-exercise full-body session covers lower + push + pull.

- [x] Write failing test: 30-min full-body week has weekly pull coverage.
- [x] Add `ESSENTIAL_PATTERNS` + essential-first logic in the first pass.
- [x] Run targeted + full suite (no goldens broke; reservation is byte-identical when essentials fit).
- [x] Code-review the diff (clean); commit.

**Done:** Added `ESSENTIAL_PATTERNS` (full_body only today) in `generation.ts` and rebuilt the `selectForSession` first pass to reserve budget for each still-uncovered essential OR-group (one lower, one push, one pull), plus an inject step that covers a group whose patterns are absent from the slot list or had no candidates (degrades safely). 2 new tests; full suite 1570 green, typecheck clean. No frozen golden changed.
**Impact:**
- **User:** a short (30-min) full-body routine now always trains a pull, and a 3-exercise full-body day is lower + push + pull instead of two legs + a press. Longer full-body sessions and every non-full-body split regenerate byte-identically, so existing users see no churn.
- **Engine:** truncation is now "essentials first" for full_body; other focuses use empty groups (a no-op path), so determinism and all six frozen goldens are preserved. The reservation only bites when the budget would otherwise drop a defining pattern.

## P1.2 Restriction catalogue correction + visible degradation (Issue 2)

**Invariant:** A restricted routine never uses an exercise tagged with an active contraindication (test-locked). When a restriction empties an essential pattern, the routine degrades visibly with a warning, never silently.

**Layer:** catalogue data + generator visibility. **Files:** new dated migration in `docs/migrations/` (Step-Up knee tag; Smith Machine Bench Press equipment fix; any other genuine inconsistencies); `generation.ts` (emit a restriction-degradation warning when an essential pattern is emptied by `isContraindicated`); `constants.ts` (`WARNING_COPY`); existing `GenerationWarningNotice` renders it. **Test:** `generation.test.ts` + a catalogue-consistency test.

**Approach:** (a) Correct the genuine inconsistency (Step-Up → knee). (b) Document the "one safe option per pattern" policy in the migration header and verify each surviving option per flag is truly safe. (c) Add a structured warning key (e.g. `RESTRICTED_PATTERN`) when an essential pattern has zero usable candidates after restriction filtering. (d) Add a test asserting, for each flag, no generated exercise carries it and at least one safe option survives per essential pattern (or a warning fires).

**Dependencies:** P1.1 (shares the warning surface + essential-pattern definitions). **Regression risk:** low; tag changes affect only restricted generations, warnings are additive. **Migration:** hand-apply on merge.

- [x] Write failing degradation-warning tests (warn / no-warn).
- [x] Author the tag/equipment correction migration (conservative policy in the header).
- [x] Emit the degradation warning (`missing_pattern`); add `WARNING_COPY`.
- [x] Run suite; commit.

**Done:** Added a `missing_pattern` warning emitted when an essential movement group is left uncovered for a focus after selection (full_body today), so a restriction/equipment gap that empties a defining pattern is visible instead of silent. Authored migration `2026-06-14-22-17-31-restriction-tag-corrections.sql` (hand-apply on merge): Step-Up -> knee (fixes the case-06 inconsistency vs its tagged siblings), Smith Machine Bench Press -> {machines, bench} (fixes prod drift). The conservative "one safe option per pattern" policy is documented in the migration header. 2 new tests; suite 1575 green, typecheck clean.
**Impact:**
- **User (restricted):** the catalogue no longer seats a Step-Up for a knee-restricted lifter, machine-only users now see Smith Machine Bench Press, and when a restriction empties a key movement (e.g. all pulls) the Plan page shows a "Missing a key movement" notice instead of silently dropping it. The restriction filter itself was already correct and is unchanged.
- **Engine:** the degradation warning reuses the P1.1 essential-coverage groups (full_body); warning-only output with no selection change, so all goldens hold. Per-focus coverage detection generalises with the P2.3 validator.

## P1.3 Exercise-specific prescriptions (Issue 8)

**Invariant:** Isometric exercises never receive rep-only prescriptions. Per-side movements indicate per-side where the catalogue says so.

**Layer:** generator prescription step + catalogue + schema. **Files:** new migration (add `prescription_unit text default 'reps'` + optional hold range; tag core isometrics as `time`, unilateral lunges as `per_side`; fix Walking Lunge vs Bulgarian inconsistency); `types.ts` (`DbExercise` + output/blueprint prescription); `generation.ts` (branch the prescription assignment ~1692 on the unit); Plan/Train display reads the stored string. **Test:** `generation.test.ts`.

**Approach:** Add a `prescription_unit` enum (`'reps' | 'time' | 'per_side'`, default `'reps'`). For `time`, emit the catalogue hold (fallback "30-60s"); for `per_side`, emit "N-M per side"; otherwise the numeric range as today. Sets unchanged.

**Dependencies:** none. **Regression risk:** low-medium; goldens asserting `/^\d+-\d+$/` on core exercises need updating. **Migration:** hand-apply on merge.

- [x] Write failing test: Plank gets a time prescription, never a rep range.
- [x] Author the migration (column + Plank 'time' + unilateral 'per_side').
- [x] Add `prescription_unit` to types + a pure `formatPrescription` helper (verbose + compact).
- [x] Wire all three DISPLAY surfaces; run suite; code-review (clean); commit.

**Done:** Added `prescription_unit` ('reps' | 'time' | 'per_side') to the exercise model, a pure `formatPrescription` helper (verbose + compact modes, defensive hold guard), and threaded a compact `prescription` through `SessionTargetRow`. All three display prescription surfaces render correctly: the Plan accordion (`PlanSessionList`, verbose), the next-session preview (`NextSessionCard`), and the library routine editor (`RoutineExerciseRow`). The generator and stored `routine_exercises.reps` are deliberately UNCHANGED, so the rep-based logger and every generation golden are untouched. Migration `2026-06-14-22-27-38-exercise-prescription-unit.sql` (hand-apply): column + Plank -> 'time' + unilateral -> 'per_side'. 6 new formatter tests + a query-projection baseline update; suite 1580 green, typecheck clean. Second-opinion review: clean.
**Impact:**
- **User:** a Plank now reads "30-60s hold" instead of "12-15 reps", and unilateral lifts read per side ("10-12 reps/side" / "10-12/side"), consistently across the Plan, next-session, and routine-editor surfaces.
- **Engine:** display-layer fix only. The generator, stored reps, and the rep-based logger are unchanged, so all goldens hold. Logging a timed hold in Train/guided (the logger accepting seconds, not reps) is a deeper deferred feature, tracked as P1.3b.

## P1.4 Duration as a real constraint (Issue 7) - has a product fork (see decision log)

**Invariant:** A session does not exceed its selected duration beyond the documented tolerance without a visible warning or a correction.

**Layer:** duration estimation + post-gen guard. **Files:** `utils.ts` (`estimateSessionMinutes`: add warmup time for heavy compounds, halve paired-superset time, scale rest by bias); `generation.ts` or the P2.3 validator (over-budget guard); `constants.ts` (tolerance, band bounds, warning copy). **Test:** `utils.test.ts` + `generation.test.ts`.

**Approach:** Improve the estimator first, then a deterministic guard: if estimate > band-max + tolerance, drop the lowest-role slot (finisher, then isolation) until within tolerance or at the compound floor; if still over (all compound), keep and warn. **Product fork:** auto-trim to fit vs keep-volume-and-warn-only (resolve before building this item).

**Dependencies:** best inside P2.3; can ship standalone. **Regression risk:** medium; trimming changes membership, scope it to fire only when over-budget so in-band sessions stay byte-identical.

- [x] Resolve the product fork (warn, keep volume).
- [x] Add the over-band warning (`over_time`) emitted per session at generation + tests.
- [ ] Improve `estimateSessionMinutes` (warmups, supersets, bias rest) -> deferred to Phase 2 (P1.4b); the current estimator already fires correctly on the 45-60 overshoot and stays quiet on fitting 30-min sessions.

**Done:** Imported `estimateSessionMinutes` into the generator, added `SESSION_TIME_MAX_MIN` band bounds and an `over_time` warning (with `WARNING_COPY`). After building each session the generator estimates its minutes and pushes `over_time` when the rounded estimate exceeds the band max (45-60 -> >60, ~30 -> >30; 90+ uncapped), keeping all requested volume. 2 new tests; suite 1573 green, typecheck clean. No selection change, so all goldens hold.
**Impact:**
- **User:** a routine that will run long now shows a "May run long" notice on the Plan page instead of silently mislabelling the time. No exercises are dropped, so you keep your volume.
- **Engine:** per-session duration is now checked against the selected band as warning-only output. No selection or rep/set change, so existing routines and all goldens are unaffected. The estimator's accuracy refinement (warmups, superset halving, intensity-scaled rest) is tracked separately as P1.4b.

## P1.5 Label-validity floor incl. PHUL identity (Issue 4) - has a product fork (see decision log)

**Invariant:** A session label is not applied when its minimum structural criteria are not met. PHUL power and hypertrophy days remain measurably distinct in rep range under every training style, or the combination warns.

**Layer:** label resolution + rep-range resolution + validator. **Files:** `generation.ts` (`focusLabelForEmphasis` + a label-check in the validator; the PHUL rep exemption in `resolveRepRange` if approved). **Test:** `generation.test.ts`.

**Approach:** Define minimum structural criteria per label (full-body: weekly pull present; quad day leads with squat; posterior leads with hinge; push day majority push patterns; PHUL power reps differ from hyp reps). On failure, qualify/drop the label or warn. **Product fork:** for PHUL+Powerbuilding, preserve the power/hyp contrast (exempt PHUL from the pattern-only rep override) vs keep current behaviour + warn.

**Dependencies:** P1.1, P2.3. **Regression risk:** medium for the PHUL rep change (re-baseline PHUL goldens); low for label checks.

- [x] Resolve the PHUL product fork (preserve contrast, decided).
- [x] PHUL identity: phul_* emphases bypass the training-style bias remap.
- [x] Run suite (PHUL goldens hold; new Powerbuilding test green); commit.
- [ ] Label-validity structural checks (quad/posterior/push/pull/full-body) -> folded into P2.3 validator (tracked as P1.5b).

**Done:** PHUL emphases (`phul_*`) now resolve their bias, rep range, and set bump from their own per-day emphasis (via a session-level `styleForBias`), bypassing the training-style remap. Byte-identical under Balanced, so all PHUL goldens hold; 1 new test for PHUL under Powerbuilding. Suite 1571 green, typecheck clean. The broader label-validity floor (drop/qualify a label whose structure is missing, quad/posterior/push/pull minimums) moves to the P2.3 validator (P1.5b) since it is a whole-routine check.
**Impact:**
- **User:** a PHUL routine now keeps heavy Power days and moderate Hypertrophy days under every training style. Picking Powerbuilding (or Strength/Bodybuilding) no longer flattens the two days to look identical. PHUL under Balanced is unchanged.
- **Engine:** split identity now outranks training style for PHUL, scoped to `phul_*` emphases via a session check, so no other split and no Balanced-path output changes.

---

# Phase 2 - Programme-quality validation

(Each becomes its own reviewed diff; P2.1 and P3.x carry high golden-regression risk and may warrant their own sub-plan before coding.)

## P2.1 Coverage-aware backfill (Issue 3) - DONE
**Invariant:** A standard lower session does not stack a duplicate finisher (2 calf / 2 core) when a more valuable accessory can fill the slot. **Done:** extended the finisher-deflection so that, before seating a REPEAT calf/core, backfill also tries a non-compound accessory in an emphasis non-finisher pattern that the heavy-dedup cap would otherwise block (a leg curl on the hinge), via a new `accessoryInHeavy` flag on `pick` that allows a non-compound (never a 2nd heavy compound). Scoped to the duress path: deep pools fill the slot with a non-finisher before reaching the deflection, so all 6 frozen goldens are byte-identical. 1 new test; suite 1581 green, typecheck clean. Second-opinion review: clean. No migration. (The broader marginal-coverage scorer / muscle-aware backfill remains a larger future option, but this fixes the observed duplicate-finisher cases.)
**Impact:**
- **User:** on thin pools (e.g. dumbbell-only posterior leg day) the routine now seats a hamstring/quad accessory instead of a 2nd calf + 2nd core, so the session does real work rather than padding.
- **Engine:** duress-only change to backfill; deep pools (and every golden) are unchanged. The heavy-dedup cap still blocks a 2nd heavy compound; the accessory path only admits non-compound work.

## P2.2 Bounded heavy-work limit (Issue 5 partial) - DONE
**Invariant:** A week is flagged when too many sessions are strength-biased (heavy). **Done:** a weekly counter of strength-bias sessions; when it exceeds `HEAVY_WEEK_SESSION_LIMIT` (4, i.e. 5+ heavy days) the routine carries a `demanding_week` warning. Catches the 6-day-under-Strength case (Case 03) without false-positiving on PHUL/4-day or Balanced weeks. Warning-only (keep the plan; the user opted into the style), no selection/golden change, no migration. 2 new tests; suite 1583 green, typecheck clean.
**Impact:**
- **User:** a very heavy week (5+ strength days) shows a "Demanding week" notice suggesting a lighter style or fewer days if recovery suffers.
- **Engine:** a counter + threshold warning at the end of generation; no selection change, all goldens hold. (Per-session heavy-compound count and consecutive-day checks were not needed; the weekly count maps directly to the finding. A fatigue MODEL / auto-correction stays out of scope.)

## P2.3 Post-generation programme validator (Issue 9, the meta-fix)
**Responsibilities:** weekly coverage, label integrity, duration fit, filler limits, restriction degradation, heavy-work limits. **Outputs:** fail (only zero-compound, already guarded) / repair (bounded single-slot swaps) / warn / info. **Files:** new pure `src/lib/pulse/programValidation.ts`, called from `generateRoutine` tail; warnings flow through `warnings[]` + `GenerationWarningNotice`. **Determinism:** sorted inputs, bounded ordered repairs. Hosts P1.4, P1.5, P2.1, P2.2. **Regression risk:** medium; scope repairs to fire only on a violation so clean routines stay byte-identical.
**Done:** _(pending)_ · **Impact:** _(pending)_

---

# Phase 3 - Deeper personalisation

## P3.1 Independent experience and goal (Issue 5) — rep floor DONE
**Done (rep floor):** `resolveRepRange` gained an `experience` arg and a clamp: a beginner OR a general_fitness compound never gets the 3-6 range, it is floored to 6-10. Threaded `answers.experience` to the call site. Intermediate/advanced build_muscle (the golden baseline) is byte-identical (the clamp only fires for beginner/general_fitness). 3 new tests; suite 1589 green, typecheck clean. Decision applied: 6-10 floor; general_fitness reuses the same floor (moderate-heavy on the heavy day).
**Impact:**
- **User:** beginners and general-fitness users no longer see powerlifting-style 3-6 prescriptions on the heavy day; they get a moderate 6-10. Intermediate/advanced muscle-building is unchanged.
- **Engine:** a scoped clamp keyed on experience/goal; golden baseline byte-identical.
**P3.1b DONE (difficulty filter):** `difficulty` threaded onto `ExerciseMeta` + the action pool (select + `ExercisePoolRow` + map, additive). `selectForSession` gained an `experience` arg; `byPattern` got a no-op-when-absent layer that soft-deprioritises `advanced`-difficulty lifts for a beginner (never excludes). Goldens byte-identical (synthetic pools have no `difficulty`; non-beginner is a no-op). 1 new test; suite 1590 green, typecheck clean. **Impact (user):** a beginner now gets simpler exercise choices where the catalogue tags difficulty; intermediate/advanced unchanged. **Impact (engine):** an early `byPattern` sort layer keyed on `experience` + `difficulty`, no-op by default.

## P3.2 Measurable priority muscle (Issue 6) — DONE
**Done:** a weekly budget of `PRIORITY_EXTRA_SETS_PER_WEEK` (3) extra sets is spent one-per-exercise across the priority muscle's patterns (`PRIORITY_PATTERNS`) already selected, deepening existing priority work without injecting slots or touching other muscles. Null priority -> 0 budget, so the no-priority path (and every golden) is byte-identical. 3 new tests (bounded delta, lands on the priority patterns, null identity); suite 1586 green, typecheck clean. No migration. Decision applied: +3 capped, additive only.
**Impact:**
- **User:** choosing a priority muscle now visibly adds ~3 sets/week of that muscle's work on top of the reordering, so priority is measurably different from balanced (Issue 6 fixed) without blowing up total volume.
- **Engine:** a capped weekly counter + a +1 in the set-assignment loop; null priority unchanged, so goldens hold. Combines with the strength set-bump (a priority lift that is also the strength lead gets both).

## P3.3 Style modulates without erasing identity (Issue 5)
Enforce split-identity-over-style; bodybuilding adds isolation/volume character; strength caps total weekly heavy volume on high-frequency splits. **Regression risk:** high. **Done:** _(pending)_ · **Impact:** _(pending)_

## P3.4 Controlled variety, split differentiation, equipment visibility (Issues 14-16)
`consistent` keeps anchors without forcing accessory duplication; `varied` reduces same-class repetition more strongly; differentiate similar 4/5-day lower days; make loading-lean more visibly effective. **Regression risk:** medium. **Done:** _(pending)_ · **Impact:** _(pending)_

---

# Decision log (product forks, resolved 2026-06-14)

1. **P1.2 restriction tagging:** RESOLVED - conservative + warn. Fix only clear inconsistencies (Step-Up -> knee), keep one genuinely-safe option per pattern, and emit a visible warning when a restriction still empties an essential pattern.
2. **P1.4 duration over-budget behaviour:** RESOLVED - warn, keep volume. Improve the estimate (warmups, supersets, intensity) and warn when a session runs long; never silently drop requested work. No auto-trim.
3. **P1.5 PHUL under Powerbuilding:** RESOLVED - preserve the contrast. Split identity outranks training style: PHUL always uses its own power/hypertrophy day biases for rep ranges and the set bump, so it looks like PHUL under any training style.

---

# Tests to add (summary; details in each item)

- Regression (sample failures): full-body weekly pull; PHUL power-vs-hyp distinction; duplicate finisher; duration fit; isometric prescription; Step-Up under knee restriction.
- General invariants: restriction safety + safe-survival per pattern; label-matches-structure; priority measurable; heavy-work limits.
- Combination/pairwise: short × full-body × dumbbell-only; {knee+lower_back}×machine and {shoulder+wrist}×cable; Powerbuilding×PHUL; Strength×6-day.
- Catalogue-data validation: compound-pull genuineness; isometric prescription unit; safe-survival per flag; migration-intent consistency (prod drift).
- Action-level: `generateAndSaveRoutine` validation + restriction write-back + behaviour-load try/catch (using the mocked-Supabase harness).
- Property-based: random sweep asserting the universal invariants always hold.

Do not add new frozen literal goldens; prefer structural invariant assertions. Any selection change re-baselines the six existing goldens by hand.
