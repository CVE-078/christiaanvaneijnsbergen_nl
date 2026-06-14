# Generation Engine Quality Audit (verified)

**Date:** 2026-06-14
**Branch:** `feature/generation-quality`
**Scope:** Routine generation quality before public launch. Review and root-cause only; the matching work plan is `docs/superpowers/plans/2026-06-14-generation-engine-quality-plan.md`.

Every root cause below was traced to source with file:line references and cross-checked against 10 real generation cases (full gym, dumbbell-only, machine-only, cable-only, every split, every training style, restrictions, beginner through advanced). The engine is structurally sound. The defects are concentrated in a few specific layers: full-body slot ordering, the count-vs-time disconnect, the rep-prescription model, incomplete catalogue tags, and the total absence of any whole-week judgement.

**Constraints honored by the plan:** no rewrite, no volume-first planner, keep the slot-first architecture, preserve determinism and the frozen goldens, prefer general invariants over special-case patches, separate catalogue-data problems from generation-logic problems.

---

## Precedence model (the spine of every fix)

The engine has no explicit conflict-resolution order today, which is why lower-priority preferences silently win. Adopt this strict precedence, highest first.

1. **Safety / restriction compliance.** A contraindicated lift never appears. Never relaxed.
2. **Essential movement coverage.** A labelled session/week must train its defining patterns. A full-body week must contain pulling.
3. **Duration fit.** A session must fit its selected band within tolerance, or warn.
4. **Split / label integrity.** A label only survives if its minimum structure survives.
5. **Training style.** Modulates rep/set character but never erases split identity or breaks 1 to 4.
6. **Priority muscle.** Shifts volume/order within the budget but never breaches balance or safety.
7. **Variety / behaviour preferences.** Influence which exercise fills a slot, never whether a required pattern is covered.
8. **Equipment preference.** A soft sort, lowest priority, never a hard filter.

Structural consequence: today the slot budget (`count`) is spent in slot order with no notion of "essential first" (`generation.ts:1158-1161`). Levels 2 to 4 must be enforced before the budget is exhausted on optional work.

---

## Confirmed root causes

### Issue 1 — Short full-body loses pulling (launch blocker)
- **What:** A 30-minute full-body week trains zero pulls (Cases 02, 10: lower + lower + push, no pull anywhere).
- **Why:** All three full-body emphases (`fb_strength`, `fb_hyper`, `fb_balanced`, `generation.ts:108-119`) place `horizontal_pull` at slot index 3. The first pass fills slots in order and breaks the instant `chosen.length >= count` (`generation.ts:1158-1161`). A 30-min beginner budget is 3 (`VOLUME`, `generation.ts:542-558`), so index 3+ is never visited. The compound floor cannot rescue it: it only fires below 2 compounds (a full-body first pass already has 2+), and `FLOOR_REGION['full_body'] = 'lower'` (`generation.ts:767-774`) so it searches squat/hinge/lunge only, never pull.
- **Layer:** Session emphasis definitions (slot order) + truncation logic + absent weekly coverage check.
- **Original review correct?** Yes.

### Issue 2 — Restrictions: logic correct, catalogue tags incomplete (launch blocker)
- **What:** Filtering is a correct hard filter (`isContraindicated` beside `hasEquipment`, never relaxed). The risk is tag coverage and silent degradation.
- **Why:** **Step-Up carries no knee flag** while its movement siblings Bulgarian Split Squat and Walking Lunge are knee-tagged (Case 06 used Step-Up under a knee restriction). Dumbbell OHP and Machine Shoulder Press carry no shoulder flag; most presses and curls carry no wrist flag; Hip Thrust carries no lower_back flag. Several are deliberate "keep one safe option per pattern" choices but the policy is undocumented and Step-Up is a genuine inconsistency. Separately, when a restriction empties a pattern, nothing tells the user: `LIMITED_VARIETY_WARNING` fires only for zero-compound sessions.
- **Layer:** Catalogue data (tags) + generator (degradation visibility) + coarse restriction taxonomy.
- **Original review correct?** Yes.

### Issue 3 — Low-value filler padding
- **What:** Two calves + two core in one session (Cases 01, 08 Lower B); repeated glute isolation (Abduction Machine + Cable Kickback); Dumbbell Pullover as primary back work.
- **Why:** `PATTERN_CAP = 2` is per-pattern (`generation.ts:1052`); `calf` and `core` are distinct patterns (`types.ts:483-499`), so two of each is allowed. Backfill re-sorts the emphasis's own slots by least-represented (`generation.ts:1221-1225`); the finisher-deflection escape only works when a fresh lower-bucket pattern exists, and on `lower_post` the only candidate (squat) is blocked as off-contract, so backfill seats a repeat finisher. Dumbbell Pullover is `back_iso` with `substitution_class=null` and secondary muscles chest/triceps, so it adds "back volume" with no dedup.
- **Layer:** Backfill (coverage-blind) + cap semantics + catalogue classification.
- **Original review correct?** Partially; it is backfill blindness + per-pattern cap + catalogue metadata together.

### Issue 4 — Labels do not match structure
- **What:** Full-body weeks with no pull (Issue 1); PHUL power and hypertrophy days nearly identical (Case 04); posterior days padded with calves/core.
- **Why (PHUL):** Under Powerbuilding, `resolveRepRange` ignores the day's bias and keys rep ranges off movement pattern (`generation.ts:670-672`). Both PHUL upper days are built from the same heavy upper patterns + isolations, so both read 3-6 compounds / 12-15 iso. Powerbuilding also collapses both days' effective bias to `strength` (`BIAS_REMAP`, `generation.ts:603-608`), so both get the set bump. Under Balanced (PHUL's documented intended style) the days differ correctly. The loss is real but only under the Powerbuilding+PHUL combination chosen in Case 04.
- **Layer:** Rep-range resolution (style/pattern interaction) + missing label-validity check.
- **Original review correct?** Yes.

### Issue 5 — Training style too weak or too strong
- **What:** Strength turns a 6-day routine into ~25 sets at 3-6 reps across nearly every session (Case 03). Powerbuilding erases PHUL contrast. Bodybuilding looks generic. Beginners get 3-6 rep prescriptions. General-fitness inherits strength reps.
- **Why:** `BIAS_REMAP` (`generation.ts:603-608`): Strength maps strength/balanced/hypertrophy all to strength; Powerbuilding maps everything to strength; Bodybuilding maps strength/balanced to hypertrophy (so it only flattens to 8-12, adding no isolation/volume character). Crucially, **experience never touches bias or rep range** (it only sizes volume via `volumeFor`), and **goal only branches on `lose_fat`** (`repRange`, `generation.ts:569-591`); `general_fitness` is identical to `build_muscle`. A beginner general-fitness user gets the `fb_strength` day's 3-6 reps because `fb_strength` leads the `fb-3` style (Case 02 Full Body A).
- **Layer:** `resolveBias` table + `repRange` + experience/goal not modulating bias.
- **Original review correct?** Yes.

### Issue 6 — Priority muscle is ordering-only
- **What:** Priority changes which exercise comes first, not weekly volume.
- **Why:** `tiltEmphasis` (`generation.ts:296-303`) only reorders patterns already present in the emphasis's slot list. It never adds a slot, never adds a set, never changes the exercise count (fixed by `volumeFor(sessionTime, experience)`). The one real effect: front-loading guarantees the priority pattern survives truncation on a slot-rich session. Total weekly direct sets for the priority muscle are unchanged versus balanced.
- **Layer:** Emphasis tilt + absence of any volume/frequency adjustment.
- **Original review correct?** Yes.

### Issue 7 — Duration is a label, not a constraint
- **What:** "45 to 60 minutes" produced "~65 min" sessions (Case 03).
- **Why:** `estimateSessionMinutes` (`utils.ts:369-380`) is computed in `ProgramView`, never referenced in `generation.ts`. Generation picks exercise/set counts from `VOLUME[sessionTime][experience]`, a count table with no time awareness. No guard checks the estimate against the band. `45-60 min` + advanced = 6 exercises x 4 sets ~= 25 sets; at 190s/set for compounds that is 64.2 min, rounded to 65. The estimate also ignores warmups (biases low), supersets (billed serial, biases high), intensity, unilateral, setup, transitions.
- **Layer:** Duration estimation + count-based VOLUME table + missing reconciliation.
- **Original review correct?** Yes.

### Issue 8 — Prescriptions do not match exercise type (launch blocker)
- **What:** Plank prescribed as "4 sets · 12-15 reps".
- **Why:** The catalogue's `default_reps` is free text and can hold "30-60s", "10-12 per leg", "to failure" (Plank is "30-60s"), but the generator discards it and overwrites with a numeric range via `repRange` (`generation.ts:569-591`, `1692`), which has only numeric branches. No time/per-side/distance field exists in the output model. Catalogue is also inconsistent (Walking Lunge "10-12" vs Bulgarian Split Squat "10-12 per leg" for the same movement class).
- **Layer:** Generator (rep assignment ignores exercise type) + schema (no prescription-type) + catalogue inconsistency.
- **Original review correct?** Yes.

### Issue 9 — No week-level judgement (the meta-finding)
- **What:** Nothing inspects the completed routine as a whole.
- **Why:** `selectForSession` is per-session; `generateRoutine` loops sessions independently (`generation.ts:1596-1597`) sharing only the avoid-set, substitution-class set, and anchor map (all of which influence which exercise, never whether a pattern is covered). Confirmed by grep: no weekly coverage, balance, duration, label, or filler check exists.
- **Layer:** Missing post-generation validation stage. This is the structural home for fixing Issues 1, 3, 4, 7 generally.
- **Original review correct?** Yes.

---

## Catalogue and schema findings

**Incorrect catalogue rows:**
- Straight-Arm Pulldown tagged `vertical_pull` + `is_compound=true` (it is a lat isolation). Lets it satisfy compound vertical-pull coverage (Cases 05, 09).
- JM Press tagged `triceps_iso` (a barbell pressing movement).
- Upright Row `substitution_class='lateral_raise'` (different movement grouped with side raises).
- Dumbbell Pullover `back_iso` with secondary muscles chest/triceps, used as primary back volume.
- Walking Lunge `default_reps="10-12"` vs Bulgarian Split Squat `"10-12 per leg"` for the same movement class.

**Missing catalogue values:**
- `substitution_class` null on Straight-Arm Pulldown, Dumbbell Pullover, Dumbbell Shrug, Russian Twist, Abduction Machine, disabling cross-session dedup.
- No Side Plank, Farmer's Carry, Good Morning, or Pistol Squat in the catalogue.

**Incomplete contraindication tags:**
- knee: missing on Step-Up (genuine inconsistency vs tagged siblings), Leg Press, Goblet/Sumo Squat.
- shoulder: missing on Dumbbell OHP, Machine Shoulder Press, Front Raise, incline presses.
- wrist: missing on all presses except three and all curls except Barbell Curl.
- lower_back: missing on Hip Thrust.
- Several are deliberate "safe alternative" choices; document the policy and verify each surviving option is truly safe.

**Exercise-classification problems:**
- Leg Curl / Dumbbell Leg Curl (Lying) classed `hinge` (proxy), Leg Extension classed `squat` (proxy), because no quad/hamstring isolation pattern exists.

**Prescription-format problems:**
- `default_reps` is free text and can hold "30-60s" / "10-12 per leg" / "to failure" / "to RIR", but the generator ignores it and emits numeric reps. Plank is the only time-stored row and still renders as reps.

**Schema limitations:**
- No prescription-type field (rep / time / per-side / distance) in the catalogue or output/blueprint model.
- No quad/hamstring isolation movement pattern (15-value enum).
- `DbExercise` omits `fatigue`/`unilateral`/`secondary_muscles`/`difficulty` (only some readers select them).

**Prod-vs-migration drift (operational):**
- Smith Machine Bench Press equipment is still `barbell+bench` in the live DB; the `{machines, bench}` correction migration was never applied. It leaks into barbell-only pools and is invisible to machine-only users. Apply on the P1.2 migration pass.

---

## Post-generation validator recommendation

Introduce a bounded post-generation validator. It is the highest-leverage change because it converts Issues 1, 3, 4, 7, 9 from per-case patches into general programme invariants, without altering the slot-first generator.

- **Validates:** weekly pattern coverage (essential patterns present, push/pull balance, vertical-pull presence when feasible), label integrity, duration fit, filler limits, restriction degradation, heavy-work limits.
- **Repairs (bounded):** a fixed, small number of single-slot swaps within the feasible pool. Never a re-plan, never a volume rewrite.
- **Warns:** degradations it cannot fix without breaching a higher-precedence rule (a pull genuinely impossible; a duration that cannot fit without dropping a compound below the floor; PHUL identity loss the user opted into).
- **Fails generation:** essentially nothing new; the zero-compound guard stays the only hard fail.
- **Determinism:** every check iterates sorted inputs; every repair is bounded, ordered, idempotent. Same routine in, same verdict and repair out.
- **Not a planner:** it only inspects and minimally repairs a finished blueprint. Cap repairs at a small constant so it cannot iterate into a planner.

---

## Deferred (with reasons)

- **Quad / hamstring isolation movement patterns.** Needs new enum members + catalogue re-tagging + emphasis updates. Catalogue-schema work, not launch-blocking.
- **Volume-first / full periodised planner.** Explicitly out of scope; the validator delivers the invariants.
- **Restriction sub-categorisation** (patellofemoral vs ligament, etc.). Needs product and clinical decisions plus catalogue enrichment.
- **Behaviour-driven promote / reason-aware volume tilt.** Roadmapped v1.6, gated on reason-tagged swaps.
- **Catalogue enrichment** (Side Plank, Farmer's Carry, more isolation). Wait until the prescription-type schema lands so new entries are typed correctly.
