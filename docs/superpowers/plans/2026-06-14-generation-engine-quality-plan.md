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
| P1.1 | Essential-coverage-first slot filling | 1 | TODO | |
| P1.2 | Restriction catalogue correction + visible degradation | 1 | TODO | |
| P1.3 | Exercise-specific prescriptions (time / per-side) | 1 | TODO | |
| P1.4 | Duration as a real constraint | 1 | TODO | |
| P1.5 | Label-validity floor (incl. PHUL identity) | 1 | TODO | |
| P2.1 | Coverage-aware backfill | 2 | TODO | |
| P2.2 | Bounded fatigue / heavy-work limits | 2 | TODO | |
| P2.3 | Post-generation programme validator | 2 | TODO | |
| P3.1 | Independent experience and goal | 3 | TODO | |
| P3.2 | Measurable priority muscle | 3 | TODO | |
| P3.3 | Style modulates without erasing identity | 3 | TODO | |
| P3.4 | Variety, split differentiation, equipment visibility | 3 | TODO | |

Each item below carries a **Done** line (filled when complete: what changed) and an **Impact** line (how it affects the user or the engine). This is the per-improvement record requested.

---

# Phase 1 — Launch blockers

## P1.1 Essential-coverage-first slot filling (Issue 1)

**Invariant:** A full-body week contains at least one horizontal_pull or vertical_pull unless every pull pattern is empty after equipment + restriction filtering. A 3-exercise full-body session = one lower + one push + one pull when the pool allows.

**Layer:** generator slot ordering / truncation. **Files:** `src/lib/pulse/generation.ts` (new `ESSENTIAL_PATTERNS: Record<Focus, MovementPattern[][]>` near `COMPOUND_FLOOR`; change the first-pass loop ~1157-1161 to fill essential groups before optional slots, capped at budget). **Test:** `src/lib/pulse/__tests__/generation.test.ts`.

**Approach:** For each focus define essential pattern groups (order-independent OR-groups). `full_body`: `[[squat,hinge,lunge],[horizontal_push,vertical_push],[horizontal_pull,vertical_pull]]`. The first pass fills one exercise from each unfilled essential group first (respecting caps/restrictions), then proceeds through the remaining emphasis slots in order. General rule keyed on focus, not a full-body special-case. An impossible group is skipped and recorded for the validator/warning.

**Dependencies:** none. **Regression risk:** low-medium. At count >= 6 (deep pool) all slots fill and `orderByRole` re-sorts, so 6-slot membership goldens are unaffected; behaviour changes mainly at count 3-4. Re-baseline only affected identity assertions.

**Acceptance test:** generate every full-body style at 30 min for beginner/intermediate/advanced on a deep pool; assert at least one pull exists across the week, and that a 3-exercise full-body session covers lower + push + pull.

- [ ] Write failing test: 30-min full-body week has weekly pull coverage.
- [ ] Add `ESSENTIAL_PATTERNS` + essential-first logic in the first pass.
- [ ] Run targeted + full suite; re-baseline affected short-session goldens.
- [ ] Code-review the diff; commit.

**Done:** _(pending)_
**Impact:** _(pending)_

## P1.2 Restriction catalogue correction + visible degradation (Issue 2)

**Invariant:** A restricted routine never uses an exercise tagged with an active contraindication (test-locked). When a restriction empties an essential pattern, the routine degrades visibly with a warning, never silently.

**Layer:** catalogue data + generator visibility. **Files:** new dated migration in `docs/migrations/` (Step-Up knee tag; Smith Machine Bench Press equipment fix; any other genuine inconsistencies); `generation.ts` (emit a restriction-degradation warning when an essential pattern is emptied by `isContraindicated`); `constants.ts` (`WARNING_COPY`); existing `GenerationWarningNotice` renders it. **Test:** `generation.test.ts` + a catalogue-consistency test.

**Approach:** (a) Correct the genuine inconsistency (Step-Up → knee). (b) Document the "one safe option per pattern" policy in the migration header and verify each surviving option per flag is truly safe. (c) Add a structured warning key (e.g. `RESTRICTED_PATTERN`) when an essential pattern has zero usable candidates after restriction filtering. (d) Add a test asserting, for each flag, no generated exercise carries it and at least one safe option survives per essential pattern (or a warning fires).

**Dependencies:** P1.1 (shares the warning surface + essential-pattern definitions). **Regression risk:** low; tag changes affect only restricted generations, warnings are additive. **Migration:** hand-apply on merge.

- [ ] Write failing catalogue-consistency + degradation-warning tests.
- [ ] Author the tag/equipment correction migration.
- [ ] Emit the degradation warning; add `WARNING_COPY`.
- [ ] Run suite; code-review; commit.

**Done:** _(pending)_
**Impact:** _(pending)_

## P1.3 Exercise-specific prescriptions (Issue 8)

**Invariant:** Isometric exercises never receive rep-only prescriptions. Per-side movements indicate per-side where the catalogue says so.

**Layer:** generator prescription step + catalogue + schema. **Files:** new migration (add `prescription_unit text default 'reps'` + optional hold range; tag core isometrics as `time`, unilateral lunges as `per_side`; fix Walking Lunge vs Bulgarian inconsistency); `types.ts` (`DbExercise` + output/blueprint prescription); `generation.ts` (branch the prescription assignment ~1692 on the unit); Plan/Train display reads the stored string. **Test:** `generation.test.ts`.

**Approach:** Add a `prescription_unit` enum (`'reps' | 'time' | 'per_side'`, default `'reps'`). For `time`, emit the catalogue hold (fallback "30-60s"); for `per_side`, emit "N-M per side"; otherwise the numeric range as today. Sets unchanged.

**Dependencies:** none. **Regression risk:** low-medium; goldens asserting `/^\d+-\d+$/` on core exercises need updating. **Migration:** hand-apply on merge.

- [ ] Write failing test: Plank gets a time prescription, never `\d+-\d+` reps.
- [ ] Author the migration (column + tagging).
- [ ] Add `prescription_unit` to types + the generator branch.
- [ ] Run suite; re-baseline affected goldens; code-review; commit.

**Done:** _(pending)_
**Impact:** _(pending)_

## P1.4 Duration as a real constraint (Issue 7) — has a product fork (see decision log)

**Invariant:** A session does not exceed its selected duration beyond the documented tolerance without a visible warning or a correction.

**Layer:** duration estimation + post-gen guard. **Files:** `utils.ts` (`estimateSessionMinutes`: add warmup time for heavy compounds, halve paired-superset time, scale rest by bias); `generation.ts` or the P2.3 validator (over-budget guard); `constants.ts` (tolerance, band bounds, warning copy). **Test:** `utils.test.ts` + `generation.test.ts`.

**Approach:** Improve the estimator first, then a deterministic guard: if estimate > band-max + tolerance, drop the lowest-role slot (finisher, then isolation) until within tolerance or at the compound floor; if still over (all compound), keep and warn. **Product fork:** auto-trim to fit vs keep-volume-and-warn-only (resolve before building this item).

**Dependencies:** best inside P2.3; can ship standalone. **Regression risk:** medium; trimming changes membership, scope it to fire only when over-budget so in-band sessions stay byte-identical.

- [ ] Resolve the product fork.
- [ ] Improve `estimateSessionMinutes` (warmups, supersets, bias rest) + tests.
- [ ] Add the over-budget guard per the chosen behaviour + tests.
- [ ] Run suite; re-baseline if trimming chosen; code-review; commit.

**Done:** _(pending)_
**Impact:** _(pending)_

## P1.5 Label-validity floor incl. PHUL identity (Issue 4) — has a product fork (see decision log)

**Invariant:** A session label is not applied when its minimum structural criteria are not met. PHUL power and hypertrophy days remain measurably distinct in rep range under every training style, or the combination warns.

**Layer:** label resolution + rep-range resolution + validator. **Files:** `generation.ts` (`focusLabelForEmphasis` + a label-check in the validator; the PHUL rep exemption in `resolveRepRange` if approved). **Test:** `generation.test.ts`.

**Approach:** Define minimum structural criteria per label (full-body: weekly pull present; quad day leads with squat; posterior leads with hinge; push day majority push patterns; PHUL power reps differ from hyp reps). On failure, qualify/drop the label or warn. **Product fork:** for PHUL+Powerbuilding, preserve the power/hyp contrast (exempt PHUL from the pattern-only rep override) vs keep current behaviour + warn.

**Dependencies:** P1.1, P2.3. **Regression risk:** medium for the PHUL rep change (re-baseline PHUL goldens); low for label checks.

- [ ] Resolve the PHUL product fork.
- [ ] Implement label-validity checks + (if approved) the PHUL rep exemption.
- [ ] Run suite; re-baseline PHUL goldens if changed; code-review; commit.

**Done:** _(pending)_
**Impact:** _(pending)_

---

# Phase 2 — Programme-quality validation

(Each becomes its own reviewed diff; P2.1 and P3.x carry high golden-regression risk and may warrant their own sub-plan before coding.)

## P2.1 Coverage-aware backfill (Issue 3)
**Invariant:** A standard lower session does not contain two calf or two core exercises unless explicitly configured. **Approach:** replace least-represented-slot backfill with a marginal-coverage scorer (reward missing pattern/muscle, penalise redundant substitution_class or repeat finisher, prefer unfilled higher role). **Files:** `generation.ts` backfill ~1204-1256 + `muscleMap.ts`. **Regression risk:** high (re-baseline several goldens); scope the scorer to differ only when the current pick would be a duplicate finisher or redundant class.
**Done:** _(pending)_ · **Impact:** _(pending)_

## P2.2 Bounded fatigue / heavy-work limits (Issue 5 partial)
**Invariant:** A strength programme respects defined heavy-work limits (warn or correct beyond them). **Approach:** deterministic counters (max heavy compounds/session, max heavy sessions/week, consecutive strength days, repeated heavy lower-back loading on adjacent days) → bounded correction or warning. No recovery model. **Files:** validator + `constants.ts`. **Regression risk:** medium.
**Done:** _(pending)_ · **Impact:** _(pending)_

## P2.3 Post-generation programme validator (Issue 9, the meta-fix)
**Responsibilities:** weekly coverage, label integrity, duration fit, filler limits, restriction degradation, heavy-work limits. **Outputs:** fail (only zero-compound, already guarded) / repair (bounded single-slot swaps) / warn / info. **Files:** new pure `src/lib/pulse/programValidation.ts`, called from `generateRoutine` tail; warnings flow through `warnings[]` + `GenerationWarningNotice`. **Determinism:** sorted inputs, bounded ordered repairs. Hosts P1.4, P1.5, P2.1, P2.2. **Regression risk:** medium; scope repairs to fire only on a violation so clean routines stay byte-identical.
**Done:** _(pending)_ · **Impact:** _(pending)_

---

# Phase 3 — Deeper personalisation

## P3.1 Independent experience and goal (Issue 5)
Experience modulates exercise complexity (use `difficulty`), demanding-compound count, volume tolerance; goal modulates rep distribution and density; decouple from "experience sizes volume, goal flips lose_fat only". **Regression risk:** high (rep ranges + selection). **Done:** _(pending)_ · **Impact:** _(pending)_

## P3.2 Measurable priority muscle (Issue 6)
Add bounded weekly direct volume for the priority muscle (e.g. +1 set on priority-pattern exercises, or an extra priority slot when budget allows), capped for safety/balance; define the measure (priority muscle gets >= N more direct weekly sets than balanced). **Regression risk:** medium. **Done:** _(pending)_ · **Impact:** _(pending)_

## P3.3 Style modulates without erasing identity (Issue 5)
Enforce split-identity-over-style; bodybuilding adds isolation/volume character; strength caps total weekly heavy volume on high-frequency splits. **Regression risk:** high. **Done:** _(pending)_ · **Impact:** _(pending)_

## P3.4 Controlled variety, split differentiation, equipment visibility (Issues 14-16)
`consistent` keeps anchors without forcing accessory duplication; `varied` reduces same-class repetition more strongly; differentiate similar 4/5-day lower days; make loading-lean more visibly effective. **Regression risk:** medium. **Done:** _(pending)_ · **Impact:** _(pending)_

---

# Decision log (product forks to resolve)

1. **P1.4 duration over-budget behaviour:** auto-trim the lowest-value slot to fit the band, OR keep the requested volume and warn only. _(unresolved)_
2. **P1.5 PHUL under Powerbuilding:** preserve the power/hypertrophy rep contrast even under Powerbuilding (split identity wins), OR keep current behaviour and warn. _(unresolved)_

---

# Tests to add (summary; details in each item)

- Regression (sample failures): full-body weekly pull; PHUL power-vs-hyp distinction; duplicate finisher; duration fit; isometric prescription; Step-Up under knee restriction.
- General invariants: restriction safety + safe-survival per pattern; label-matches-structure; priority measurable; heavy-work limits.
- Combination/pairwise: short × full-body × dumbbell-only; {knee+lower_back}×machine and {shoulder+wrist}×cable; Powerbuilding×PHUL; Strength×6-day.
- Catalogue-data validation: compound-pull genuineness; isometric prescription unit; safe-survival per flag; migration-intent consistency (prod drift).
- Action-level: `generateAndSaveRoutine` validation + restriction write-back + behaviour-load try/catch (using the mocked-Supabase harness).
- Property-based: random sweep asserting the universal invariants always hold.

Do not add new frozen literal goldens; prefer structural invariant assertions. Any selection change re-baselines the six existing goldens by hand.
