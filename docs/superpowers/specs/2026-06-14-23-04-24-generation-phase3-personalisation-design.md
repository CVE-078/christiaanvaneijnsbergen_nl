# Generation Engine Quality, Phase 3 - Personalisation (design)

**Date:** 2026-06-14
**Branch:** `feature/generation-quality` (Phase 1 + P2.1 + P2.2 shipped; this designs Phase 3)
**Status:** SPEC for review (route through the Claude.ai science lens + Perplexity architecture lens before TDD, per process). Findings + root causes: `docs/superpowers/specs/2026-06-14-21-51-23-generation-engine-quality-audit.md`.

Phase 3 is the deeper personalisation that the launch-blocker work deliberately left alone because it changes rep ranges / set counts / selection (so it re-baselines the six frozen goldens) and rests on coaching-science and product calls. Three items: P3.1 independent experience + goal, P3.2 measurable priority muscle, P3.3 training style that modulates without erasing split identity.

**Hard constraints (unchanged from Phase 1):** keep the slot-first architecture, preserve determinism, the Balanced-style / no-priority / default-experience paths must stay byte-identical (the rollout-safety invariant), and any real change re-baselines the affected goldens by hand. Precedence model (from the audit): safety > coverage > duration > split identity > training style > priority > variety > equipment.

---

## P3.1 Experience and goal become independently meaningful (Issue 5)

**Today:** `experience` only sizes volume (`volumeFor`, exercise + set counts); `goal` only branches on `lose_fat` in `repRange`. So a beginner and an advanced lifter get the same rep ranges and the same exercise complexity, and `general_fitness` is identical to `build_muscle`. A beginner on a Balanced full-body still gets 3-6 reps on the strength day.

**Invariant to add:** experience independently influences exercise complexity, the number of demanding compounds, and rep-range suitability; goal independently influences rep distribution and density. A beginner choosing Strength is still a beginner (guardrails on complexity / heavy singles), and an advanced lifter choosing General Fitness differs from a beginner choosing it.

**Proposed mechanism (bounded, slot-first preserved):**
- **Experience -> complexity filter (selection layer).** Use the existing `difficulty` field (`beginner | intermediate | advanced`) as a soft sort in `byPattern`: a beginner deprioritises `advanced`-difficulty lifts (never hard-excludes, so thin pools still fill). This needs `difficulty` threaded onto `ExerciseMeta` + the projection (it exists in the DB, not yet on the meta).
- **Experience -> rep-range floor.** A beginner never receives the heaviest strength range (3-6) on a compound; clamp the beginner strength compound to a moderate range (e.g. 5-8 or 6-10). Implement as an `experience`-aware clamp inside `resolveRepRange` (additive arg), leaving intermediate/advanced unchanged (so goldens at the default `intermediate` are byte-identical).
- **Goal -> density / distribution.** `general_fitness` should bias toward moderate reps + more full-body balance rather than inheriting the strength day's 3-6. Add a `general_fitness` branch in `repRange` (today it falls through to the non-lose_fat default). `lose_fat` stays as-is.

**Acceptance:**
- A beginner Balanced full-body never shows a 3-6 compound prescription (it shows the moderate floor).
- An `advanced` + `general_fitness` routine differs (rep distribution and/or selection) from a `beginner` + `general_fitness` routine on the same split.
- `intermediate` + `build_muscle` (the golden baseline) is byte-identical to today.

**Regression risk:** HIGH. Re-baselines goldens if the beginner/general_fitness paths are exercised by any golden (they are captured at intermediate/build_muscle, so likely safe, but the `byPattern` difficulty layer must be a no-op when `difficulty` is absent, like the behavior-demote layer). **Product/science decisions:** the exact beginner rep floor; the `general_fitness` rep distribution; whether complexity is a soft sort or also caps the count of demanding compounds.

---

## P3.2 Priority muscle becomes measurable (Issue 6)

**Today:** `tiltEmphasis` only reorders the patterns already in a session's slot list. It never adds a slot or a set, and the exercise/set counts come solely from `volumeFor(sessionTime, experience)`. So a "priority: chest" routine has the same weekly chest set total as a balanced one, just chest earlier in the session.

**Invariant to add:** a priority routine differs measurably from its balanced baseline in weekly direct volume for the priority muscle, without creating unsafe total volume or destroying the balance of the rest of the programme.

**Proposed mechanism (bounded):** one of (decide in review):
- (a) **+1 set on priority-pattern exercises**, capped at a small per-week total (e.g. +N sets/week), so a priority chest day's pressing gets an extra set. Simple, measurable, low selection risk; goldens unaffected when `priority` is null (already the no-op path).
- (b) **An extra priority slot when the session has spare budget**, biased to the priority patterns. More invasive (changes counts), higher golden risk.
- (c) **Frequency**: add a priority-biased accessory to a second session. Most invasive.

Recommend (a) as the v1 measurable difference: a `priority`-aware set bump in the set-assignment loop, capped weekly, leaving non-priority work untouched. Define the measure: priority muscle gets >= N more direct weekly sets than the balanced baseline (propose N = 2-4).

**Acceptance:** generate priority-X vs an otherwise identical balanced routine; assert priority-X has >= N more direct weekly sets mapped to muscle X (via the `muscleMap` bridge). Total weekly sets stay within a safe cap. Null priority is byte-identical.

**Regression risk:** LOW-MEDIUM with option (a) (null path unchanged). **Product decisions:** the per-week extra-set budget N; whether priority may also reduce a lower-priority muscle's volume to stay within a total cap (the audit warns: do not assume priority just adds sets).

---

## P3.3 Training style modulates without erasing split identity (Issue 5)

**Today:** `BIAS_REMAP` collapses aggressively. Strength maps strength/balanced/hypertrophy -> strength (pump -> hypertrophy). Bodybuilding maps strength/balanced -> hypertrophy but adds no isolation/volume character (it just flattens rep ranges). Powerbuilding maps everything -> strength at the bias level. PHUL identity is now protected (P1.5), but the general principle "split identity > training style" is not enforced for other splits, and Bodybuilding still "looks generic".

**Invariant to add (precedence level 4 > 5):** a training style changes rep/set character but never erases a split's defining structure. Bodybuilding should read as bodybuilding (more isolation / volume character, not just 8-12 everywhere); Strength should not make a high-frequency split unrecoverable (now flagged by P2.2's `demanding_week`, but a correction is the deeper fix).

**Proposed mechanism (bounded, decide in review):**
- **Bodybuilding character:** under Bodybuilding, allow one extra isolation slot / a higher isolation rep range (pump) on accessory patterns, so the session has more hypertrophy character than a flat 8-12. Scoped so Balanced is untouched.
- **Strength recoverability:** keep P2.2's warning; optionally cap the weekly strength-session count by down-shifting the least-important strength day to balanced on very high frequency (a bounded correction). Product call: warn-only (shipped) vs correct.

**Acceptance:** a Bodybuilding routine has measurably more isolation volume than the same split under Balanced; a Strength 6-day either warns (shipped) or is corrected per the decision. Balanced is byte-identical.

**Regression risk:** MEDIUM-HIGH (touches rep ranges / set counts / slot composition). **Product/science decisions:** what specifically makes a routine "look like bodybuilding"; whether Strength should auto-correct or stay warn-only.

---

## Cross-cutting implementation notes

- **No-op invariants are mandatory** (the rollout-safety pattern every Phase 1 axis followed): null priority, Balanced style, intermediate experience, build_muscle goal must each leave output byte-identical, locked by identity tests, so the six frozen goldens hold until a path is deliberately exercised and re-baselined.
- **`difficulty` must reach `ExerciseMeta`** (it is in the DB + DbExercise gap noted in the audit) for P3.1's complexity layer. Additive projection change.
- **Muscle volume measurement** reuses the `muscleMap` bridge (`PATTERN_MUSCLE_MAP`, `muscleContributions`) already in the repo, so "direct weekly sets for muscle X" is computable for the P3.2 acceptance test.
- **Sequencing:** P3.2 (lowest risk, clear value) first; then P3.1 (experience/goal); then P3.3 (highest risk). Each its own reviewed diff with goldens re-baselined deliberately.

## Open product decisions (resolve before TDD)

1. P3.1: beginner strength-compound rep floor (5-8 vs 6-10?); general_fitness rep distribution.
2. P3.2: priority extra-set budget N per week; may priority reduce other muscles' volume to stay capped?
3. P3.3: what defines "bodybuilding character"; Strength high-frequency = warn-only (shipped) or auto-correct?

## Deferred (still out of scope)

quad/hamstring isolation patterns (catalogue/schema), the full P2.3 validator module (push/pull balance + label-validity as a consolidated stage; the high-value checks already ship as inline warnings), P1.4b estimator refinement (tune against real logged durations), P1.3b log-timed-holds, behaviour-driven promote.
