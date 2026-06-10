# Generation engine bug fixes — design & implementation plan

Date: 2026-06-10. Branch: `feature/generation-engine-bug-fixes`.

Fixes a confirmed set of generation-engine defects. All changes are in
`src/lib/pulse/generation.ts` plus its test file, except Issue 0 (deferred, see
below). Verified against the real seed data
(`docs/migrations/2026-06-06-11-28-49-exercise-metadata-fields-seed.sql` +
`2026-06-06-10-51-33-movement-pattern-correction.sql` +
`2026-06-03-exercise-generation-metadata-seed.sql`).

Baseline before work: 80 test files, **1038 tests passing**.

---

## Issue 0 — day-count → style mapping (DEFERRED to a visual draft)

**Finding (reconciliation, not the brief's premise):** the day count is NOT lost.
Both generation entry points (`OnboardingModal`, `GenerateRoutineButton`) use
`mode="quick"`, which maps the days/week answer straight through `SUGGESTED_DAYS`:
`'4'→[1,2,4,5]→ul-classic-4`, `'5-6'→[1,2,3,4,5]→ulppl-5`. Correct. The only quirk
is `SUGGESTED_DAYS['2-3'] = [1,3]` → a 2-day `fb-2` (locked by a passing
`constants.test.ts`), so the recommended 3-day `fb-3` is unreachable from quick
onboarding.

**User decision:** rework the days step into a **1–7 slider + a restored
Mon–Sun day picker** (replacing the 3-bucket question). This is a UX redesign,
not a one-line fix, and:
- The engine's `STYLES` only covers session counts 2–6. A true 1–7 slider needs
  new `STYLES[1]` (single full-body day) and `STYLES[7]`, plus a clean
  `recommendStyle`/`resolveStyle` path for them. That is a spec-first engine/data
  addition (new program styles), not a silent add.
- It is a visual UI change; deliver an HTML draft + the 1/7 handling proposal
  before building.

**Decision:** do the engine bugs (1–7) first (they are fully testable via
`generateRoutine` and never touch the setup UI), then handle Issue 0 as a focused
follow-up: HTML draft → approval → build. Issue 0 does NOT block the engine work.

---

## Bug 1 — cross-session avoid-set collapse (the `consistent` anchor is too broad)

**Root cause:** under `varietyPreference: 'consistent'`, the anchor map is keyed by
`MovementPattern` ALONE (`anchors: Map<MovementPattern, string>`). The first pick
for a pattern is recorded and then reused — bypassing the routine-wide `used`
avoid-set — across EVERY session that shares that pattern, regardless of focus.
So Push and Upper both seat the same `horizontal_push`; Legs and Lower both seat
the same `squat`/`hinge`. (The default `varied` path is unaffected: it uses no
anchor and the `used` avoid-set already keeps sessions disjoint until the pool is
genuinely exhausted.)

**Fix:** key the anchor map by **(focus, pattern)**, not pattern alone. Thread the
session `focus` into `selectForSession`. Then:
- Two same-focus sessions (Lower A + Lower B, both `lower`) share the (lower,
  squat) anchor → the consistent-anchor feature is preserved.
- Different-focus sessions (Push vs Upper) have distinct keys; the second one's
  fresh pick respects `used`, so they never share an exercise (except via the
  genuine thin-pool `candidates[0]` fallback when a pattern is truly exhausted).

Anchor map type: `Map<string, string>` keyed by `` `${focus}:${pattern}` ``.

**Backfill `candidates[0]` fallback:** confirmed correct — it only repeats an
exercise when the pattern is genuinely exhausted (the documented thin-pool
behavior, asserted by the `thin-pool fallback` test). No change.

**Golden-test safety:** anchors are only used under `consistent`; the default
`varied`/`balanced`/identity tests are untouched. The `consistent` tests use
`fb-hmhp-4` (all `full_body`) so all four sessions share one focus → still anchor
to one exercise. No existing `consistent` test relies on cross-FOCUS anchoring.

---

## Bug 2 — no canonical-anchor ranking (CGBP anchors horizontal_push) — this is roadmap "P0 3.1"

**Root cause (confirmed from seed data):** Barbell Bench Press and Close-Grip
Bench Press BOTH have `movement_pattern = horizontal_push`, `is_compound = true`,
`fatigue = 4`, `substitution_class = horizontal_press`. The anchor-pattern fatigue
tiebreak (`bFatigue - aFatigue`) ties them at 4, so selection falls through to
`id.localeCompare` on the UUIDs — effectively random by seed order. The same tie
affects vertical_push (Barbell OHP 4 vs DB Push Press 4), horizontal_pull (Barbell
Row 4 vs T-Bar Row 4), vertical_pull (Pull-Up 4 vs Chin-Up 4). squat (Barbell Squat
5, alone) and hinge (Deadlift/Sumo 5) already resolve on fatigue.

**Fix:** add a deterministic canonical-anchor rank as a tiebreak placed JUST
BEFORE the final `id.localeCompare`. Implemented as a constant map keyed by
movement pattern listing preferred anchor exercise NAMES in order (UUIDs are not
stable, names in the seed are). Add an optional `name?: string` to `ExerciseMeta`
and pass `name` through the pool mapping in `actions/routines.ts`. In `byPattern`,
compute `anchorRank(ex)` = index in `CANONICAL_ANCHORS[pattern]` (or `Infinity`
when absent); lower rank sorts first.

```
CANONICAL_ANCHORS: Partial<Record<MovementPattern, string[]>> = {
  horizontal_push: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Barbell Press', ...],
  squat:           ['Barbell Squat', ...],
  hinge:           ['Romanian Deadlift', 'Deadlift', ...],
  vertical_push:   ['Barbell Overhead Press', 'Dumbbell Overhead Press', ...],
  horizontal_pull: ['Barbell Row', 'Seated Cable Row', ...],
  vertical_pull:   ['Pull-Up', 'Lat Pulldown', ...],
}
```

Placement (before id.localeCompare, after fatigue) means it ONLY breaks ties that
currently fall to the random UUID order. It never overrides fatigue/freshness/
loading-lean. In every Bug-2 case the canonical lift is tied for top fatigue with
its variations, so the rank picks the canonical one (Barbell Bench Press first).

**Golden-test safety:** synthetic test pools use ids like `horizontal_push-1` (no
canonical name, and `meta()` sets no `name`) → all `Infinity` → no reordering →
byte-identical. The identity tests (base vs varied/balanced) compare same-pool runs
so they cannot break regardless. New focused test builds a pool with real names and
asserts Barbell Bench Press wins over Close-Grip Bench Press.

---

## Bug 3 — strength compound rep range should be 3-6, not 6-10

**Root cause:** not a wiring bug. `bias` DOES reach `repRange` (the observed 6-10
IS `repRange('strength', true)`), and no downstream normalization overrides reps
(the VOLUME/experience table only sets exercise count + sets, never reps). The
range is simply defined as 6-10; the desired strength compound band is 3-6.

**Fix:** in `repRange`, strength compound: `'6-10' → '3-6'`; strength compound +
lose_fat: `'8-12' → '6-10'` (keeps the one-notch-up shift). Strength isolation
unchanged (`10-15` / `12-20`). Update the `repRange` unit test and the
`'a strength-bias full-body compound gets 6-10'` generation test to `3-6`.
Powerbuilding tests compute `repRange('strength', true, ...)` dynamically → auto-adjust.

---

## Bug 4 — backfill calf explosion (no pattern-diversity scoring)

**Root cause:** the backfill loop sorts slots only by covered(0)/uncovered(1) —
binary. Once all emphasis patterns are covered, it revisits them in emphasis order
and can stack multiple of a high-availability pattern (calf has 7 seed options) when
neighbouring leg patterns are capped (heavy/unilateral) or equipment-thin.

**Fix (two parts):**
1. **Diversity scoring (primary):** sort backfill `slotsByPriority` by the current
   count of each pattern in `chosen` (ascending, stable), so least-represented
   patterns are preferred. A never-picked pattern (0) still sorts first (same as
   today's first backfill round); the change only matters when revisiting.
2. **Hard cap (safety rail):** no movement pattern may appear more than **2** times
   in a session. Enforced inside `pick()` (so it covers BOTH the first pass and
   backfill — this is also Bug 7). HARD, not relaxed: real emphases have ≥5
   distinct patterns so the target count stays reachable; the floor (3) is never
   threatened. The deliberate push/pull 6th slot (2× triceps_iso / back_iso) is
   exactly at the cap (2), so it is allowed.

**Golden-test safety:** deepPool has 2 options/pattern so no pattern naturally
exceeds 2; `time scaling` (exactly 6 / exactly 4) uses distinct patterns. The
`hinge fills the session` thin-pool test reaches 7 (≥7 asserted) — hinge tops out
at the cap (2) after the heavy-cap relax; previously it reached 8 via hinge-3 which
the cap now blocks, but the assertion is `≥7`. Verified by trace.

---

## Bug 5 — glutes tilt front-loads glute_iso over compounds

**Root cause:** `PRIORITY_PATTERNS.glutes = ['glute_iso', 'hinge']` lists isolation
FIRST. `tiltEmphasis` front-loads present priority patterns in that order, so
glute_iso jumps ahead of the hinge compound. (It does NOT inject — it is a
permutation of the existing slots — so that part of the brief is already satisfied;
the defect is purely ordering.)

**Fix:** reorder to the compound-first hierarchy `['hinge', 'squat', 'lunge',
'glute_iso']`. `tiltEmphasis` already (a) returns identity when no priority pattern
is present (upper sessions → no-op, no injection), (b) preserves the rest of the
slots. Update the `tiltEmphasis front-loads` unit test to expect the new order
(`lower_post` → `[hinge, lunge, glute_iso, calf, core]`). Add a test: no injection
(slot set unchanged) + hinge before glute_iso.

**Golden-test safety:** `tiltEmphasis` runs with `priority` from the profile;
`input()` test fixtures pass no priority (null) → identity. Only the explicit
`tiltEmphasis`/priority unit tests change. `PRIORITY_PATTERNS` is used ONLY by
`tiltEmphasis` (greped).

---

## Bug 6 — "Legs has no squat in the 5-day style" — RECONCILE: intended, not a bug

**Finding:** `ulppl-5`'s `legs` session uses emphasis `lower_post` =
`[hinge, glute_iso, lunge, calf, core]` (no squat) BY DESIGN. This is the P0 Group 1
quad/posterior leg-day differentiation (merged): `lower_quad` (squat, no hinge) is
the quad day, `lower_post` (hinge, no squat) is the posterior day, paired so squat
and hinge are each trained once across the week. The existing test
`'ulppl-5: lower (quad) has no hinge, legs (posterior) has no squat'` asserts this
as correct. The brief's premise ("squat is simply absent" by oversight) is a stale
read.

**Decision:** do NOT add squat to `lower_post`. Doing so would reintroduce
squat-in-both-leg-days (the exact problem P0 Group 1 fixed) and break a passing
test. It will NOT resolve via Bug 1 (the emphasis genuinely has no squat slot).
Reported as a design conflict: keeping the shipped quad/posterior split. If the
product owner wants a squat-pattern compound on every leg day, that is a deliberate
reversal of P0 Group 1 and a separate spec-first decision (it would also change the
`ul-classic-4` / `ul-aesthetic-4` posterior days).

---

## Bug 7 — exercise-uniqueness vs pattern-uniqueness

**Fix:** the Bug 4 pattern cap (max 2 per pattern) lives inside `pick()`, so it is
enforced at the slot-filling level (first pass AND backfill), not just backfill.
**Audit of EMPHASES:** the only patterns listed >1× in any emphasis are `push`
(2× triceps_iso) and `pull` (2× back_iso) — both exactly at the cap (2), so nothing
is silently removed. No emphasis exceeds 2 of a pattern. Reported, no slot removed.

---

## NOTE — vertical_pull on dumbbell-only — confirmed clean

When a slot's candidates are empty (e.g. `vertical_pull` for a dumbbell-only user
with no pull-up bar / lat pulldown), `pick()` returns `false` early: nothing is
added to `chosen`/`used`/`anchors`, and the first pass does not touch the backfill
`guard` (guard only increments per backfill round). The gap is covered by backfill
from other patterns. No fragility. No change.

---

## Test additions/updates (after-checklist from the brief)

1. No exercise in >1 session except the same-focus shared anchor (Bug 1).
2. Strength-bias compound rep ranges are 3-6 (Bug 3).
3. Glutes-priority Lower session has ≥1 hinge compound, hinge before any glute_iso
   in session order (Bug 5).
4. No session has >2 of one movement_pattern (Bug 4/7).
5. A Legs session in any multi-day style has ≥1 squat-pattern compound — NOTE:
   this conflicts with the P0 Group 1 posterior-leg design for `ulppl-5`'s
   `legs` day (Bug 6 reconciliation). The test will instead assert the routine as a
   WHOLE trains squat AND hinge (the real invariant), not that every "Legs"-named
   session has squat.

Updated existing tests: `repRange` strength rows; the `6-10` generation assertion;
the `tiltEmphasis front-loads` order.

---

## Review corrections (applied after the adversarial spec review + code review)

Two adversarial subagent panels (a pre-implementation 3-lens spec review and a
post-implementation 2-lens code review) ran on this work; both returned zero
blocking correctness bugs. Changes made vs the plan above:

1. **Bug 2 — dropped `squat` and `hinge` from `CANONICAL_ANCHORS`.** The rank sits
   AFTER the fatigue key, and on real seed data squat (Barbell Squat, fatigue 5) and
   hinge (Deadlift/Sumo, 5) already resolve on fatigue, so a rank entry for them
   would be inert/misleading. Only the four genuinely fatigue-tied patterns remain:
   `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`.
2. **Bug 2 — `name` threading made first-class (three files, not "generation.ts +
   test").** Without `name: row.name` in the `actions/routines.ts` pool map the rank
   is dead in production while tests stay green (a "tests-pass-feature-dead" trap).
   Added a catalog-consistency test that reads the metadata seed and asserts every
   `CANONICAL_ANCHORS` name exists, plus a code comment on the name-key fragility and
   a roadmap follow-up for an `anchor_rank` column.
3. **Bug 4 — corrected the thin-pool rationale.** The `hinge fills the session` test
   reaches 8 via `lunge-2` + `glute_iso-2` (each pattern naturally tops at 2); hinge
   stays at 1 and the heavy-cap relax never fires, so the max-2 cap is a no-op there.
   Added a direct calf-explosion regression test (90+ min, calf-deep, leg-thin) that
   asserts ≤2 calf and documents the cap is intentionally HARD (under-fill toward
   diversity) while the heavy/unilateral caps relax.
4. **Bug 6 — final decision is RELABEL (deferred).** Reviewers confirmed the
   quad/posterior split is sound; the product owner chose to keep it and relabel
   `ulppl-5`'s days ("Lower (Quad Focus)" / "Lower (Posterior Focus)"). That needs a
   per-session label mechanism (schema + ~8 UI surfaces) and is its own diff. A
   `lower_post` minimum-compound-guard note was added in `EMPHASES` (not fixed here).

**Result:** typecheck clean, 1049 tests pass (was 1038, +11). Issue 0 (days-step
slider + day picker) remains deferred; until it lands, the 3-day and 6-day onboarding
*UI* paths are not end-to-end testable (the engine covers those counts via direct
`generateRoutine` tests).
