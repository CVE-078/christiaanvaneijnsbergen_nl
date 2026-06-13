# Compound-first selection guard (generation 3.1), design

**Status:** Verified against the tree and implemented (`feature/generation-compound-first-spec`, 2026-06-13). Originally drafted for the review loop; a Phase 1 verification pass (prompted by a reviewer challenge that the `COMPOUND_FLOOR` guard does not exist / fails on knee+lower_back) resolved the open questions in place. Findings are folded into §3 and §6; the sibling-item disposition is §8.

**Author note:** Claims were verified against the live tree: a golden-impact measurement, a full catalog audit (compound/isolation partitioning), and a Phase 1 trace of the `COMPOUND_FLOOR` guard + the knee+lower_back contraindication path. The reviewer's challenge was grounded in the 2026-06-10 input-coverage audit, which **predates the floor** (shipped 2026-06-11) and is therefore stale on "no minimum-compound guard exists"; see §6.3.

## 1. Problem

Roadmap item 3.1: *"Isolation exercises can win a primary compound slot when the pool is thin."* The concern: when a session's compound options are scarce (restrictive equipment / movement restrictions), selection can seat an isolation where a compound belongs, and there is no `is_compound` term anywhere in `byPattern`/`pick` to prevent it.

## 2. How selection actually works (code-truth, `generation.ts`)

- A session's `emphasis.slots` is a fixed, ordered list of `MovementPattern`s. The first pass calls `pick(slot)` once per slot; backfill then revisits **only `emphasis.slots`** (least-represented first) to reach the target `count`. Backfill never pulls arbitrary patterns from outside the emphasis.
- `byPattern(p)` returns the candidates **for a single pattern `p`**, sorted by: (1) behaviour-demote [non-anchor only], (2) loading-lean equipment, (3) substitution-class freshness, (4) front-delt-isolation suppression, (5) canonical-anchor rank (`anchorRank`: finite for names in `CANONICAL_ANCHORS`, `Infinity` otherwise), (6) role-aware fatigue tiebreak (anchor patterns prefer **higher** fatigue, accessories **lower**), (7) alphabetical id.
- `pick` then takes the first not-yet-`used` candidate (`fresh ?? candidates[0]`).
- A `COMPOUND_FLOOR` guard runs between the first pass and backfill: if the compound count is below the per-focus floor (lower/legs/full_body 2, upper/push/pull 1), it seats compounds from `FLOOR_FALLBACK_PATTERNS` (own region only). The role model also keeps position 0 a compound.

## 3. Verified findings (these correct the roadmap's framing)

### 3.1 Movement patterns are *almost* compound/isolation-segregated, with exactly two mixed patterns

A full audit of the seed/correction migrations (independently verified) shows 13 of 15 patterns are pure:
- **Compound-only:** `squat`*, `hinge`*, `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `lunge`.
- **Isolation-only:** `back_iso`, `biceps_iso`, `chest_iso`, `shoulder_iso`, `triceps_iso`, `glute_iso`, `calf`, `core`.

The two **mixed** patterns (`*`):
- **`hinge`** holds the deadlift/RDL/hip-thrust compounds **and** `Leg Curl` / `Dumbbell Leg Curl (Lying)` (`is_compound=false`).
- **`squat`** holds the squat/leg-press compounds **and** `Leg Extension` (`is_compound=false`).

This is a documented compromise (`2026-06-06-10-51-33-movement-pattern-correction.sql`): there is **no `quad_iso` / `hamstring_iso` pattern** in the fixed 15-pattern vocabulary, so the leg-curl/extension knee-flexion/extension isolations were filed under the posterior/quad compound patterns as "the least-wrong fit."

**Consequence:** a `byPattern` `is_compound` term is **NOT inert** (the roadmap hedged that it would be a no-op only for pure-isolation patterns; in fact it is a no-op for *13* patterns and live for exactly the two mixed ones, `hinge` and `squat`). It is the right lever, but its blast radius is narrow and entirely within leg training.

### 3.2 Zero change on current coverage; behavioural change only outside it

Measured directly: adding the `is_compound` term to `byPattern` and running the full suite → **1379/1379 pass, zero changes** (measured on `main`). This is **not** "byte-identical therefore safe"; it is "the change is invisible to current test coverage." The guard is an *intentional behavioural change* in the uncovered thin-pool case (§3.3), locked by the new regression test (§5).

Why current coverage does not move: on `hinge`/`squat`, the canonical-anchor rank (step 5) already ranks the **named** compounds (deadlift, RDL, sumo, squat, leg press, hack squat) ahead of the unnamed leg curl/extension (finite rank < `Infinity`). So whenever a named compound is in the candidate pool, the compound already wins and the guard changes nothing, and every golden uses deep pools where a named compound is present.

### 3.3 The real gap the guard closes

The guard only changes behaviour when, within `hinge` or `squat`, **no named-anchor compound survives the equipment/restriction filter** but an *unnamed* compound and a leg curl/extension both do. Then step 5 ties (`Infinity` vs `Infinity`) and step 6 (fatigue) decides, and because `hinge`/`squat` are anchor patterns that prefer **higher** fatigue, a leg curl/extension with a higher fatigue value than the surviving unnamed compound would win the slot. The guard prevents that.

This is a narrow thin-pool edge case (no current named anchor is excluded by dumbbell-only setups, since Dumbbell RDL / Goblet Squat are themselves named), which is exactly why no golden covers it and why the bug has never been seen in practice.

## 4. Recommendation

**Invariant (the regression test's stated contract):** *Selection of a primary compound slot must prefer a compound over an isolation when both survive filtering.*

**Two-part recommendation, sequenced:**

1. **Ship the `is_compound` guard (cheap, correct rail).** Add a compound-status term to `byPattern`, placed **directly after the canonical-anchor-rank term and before the role-aware fatigue tiebreak**, so the chain reads *anchor > compound > fatigue* (behaviourally identical to placing it just above fatigue, but clearer as a policy statement: a named anchor still wins, then any compound beats any isolation, then fatigue tiebreaks within a tier). Zero change on current coverage (§3.2); closes the §3.3 gap.

   **Required code comment** (it is a defensive artifact, not a general policy): the term exists only because `hinge` and `squat` are mixed-pattern containers (`Leg Curl` / `Leg Extension` shoehorned in for lack of `quad_iso`/`hamstring_iso`); it is live for exactly those two patterns and a no-op for the other 13; it is expected to become effectively dead once `quad_iso`/`hamstring_iso` patterns are introduced; and it **must not be propagated to other ordering layers** (the floor already filters `is_compound`, `pick`/backfill walk fixed slots, the role model orders post-selection).

2. **Flag the root cause as the durable fix (separate, larger item, not this spec).** The only reason the guard is needed at all is that `Leg Curl` / `Leg Extension` are shoehorned into `hinge`/`squat`. Introducing `quad_iso` / `hamstring_iso` patterns (the documented gap in `2026-06-06-10-51-33-movement-pattern-correction.sql` and the roadmap's known-gap note) would make all patterns cleanly segregated, render this guard a true no-op, and unlock expressing leg-curl/extension as proper accessories (e.g. a leg curl on a Lower Power day, currently inexpressible). That is a data-model + emphasis-table change with its own review, not in scope here.

## 5. Test plan

Both (a) and (b) are required (TDD: write the failing case first).

- **(a) Comparator unit test** (the mechanism): construct a `hinge` (or `squat`) candidate pool with exactly one *unnamed* compound (not in `CANONICAL_ANCHORS`, e.g. Hip Thrust) at a **lower** fatigue value and one leg-curl/extension isolation at a **higher** fatigue value; assert the compound sorts first. Without the guard this fails (the anchor-pattern fatigue tiebreak picks the higher-fatigue isolation); with it, it passes.
- **(b) End-to-end generation regression** (the integration): generate a session with a restriction/equipment state that removes **all named-anchor compounds** from `hinge` (or `squat`) while leaving one unnamed compound and one higher-fatigue leg curl/extension in the pool, and assert the generated session **contains the unnamed compound and not the isolation**. Without the guard, the isolation takes the slot and the `COMPOUND_FLOOR` redundantly re-adds the compound as an extra (so the isolation is present and an accessory is displaced); with the guard, the compound fills its slot and the isolation is absent. This is the realizable case the comparator test abstracts.
- **(c) Inert-on-segregated assertion:** for a pure pattern (e.g. `horizontal_push`), the guard must not change ordering (all candidates share `is_compound`), so a same-pool ordering test stays identical.
- **Goldens:** the existing generation goldens must stay green, **1379/1379 unchanged** (already verified, §3.2).

## 6. Open questions for the review loop

1. **Is the cheap guard worth shipping before the quad/ham-iso patterns exist?** It is correct and free (byte-identical), but its real-world blast radius is tiny. Ship now as a cheap correctness rail, or fold it into the larger quad/ham-iso data-model work so we touch leg-pattern selection once? (Architecture lens.)
2. **Fatigue interaction:** is "a compound always beats an isolation in the same slot, regardless of fatigue" always coach-correct? For `hinge`/`squat` thin pools the answer is clearly yes (you want the squat over the leg extension). Confirm there is no slot where a higher-fatigue isolation is genuinely the better primary pick. (Science lens.)
3. **Scope check, RESOLVED in Phase 1 (replaces an earlier hand-wave).** Earlier drafts asserted the `COMPOUND_FLOOR` guard "fully protects the session-level compound count." The accurate version, verified against the tree:
   - The floor **exists** (`generation.ts:755`, `:1159`), runs between the first pass and backfill, and sources compounds via its **own `is_compound` filter** (`byPattern(p).filter(ex => ex.is_compound && ...)`, `:1172`), independent of this within-pattern guard. So 3.1 is confirmed a within-pattern tiebreaker that the floor does not depend on.
   - The floor provides session-level protection **whenever a safe lower compound survives filtering**, which the contraindication seed guarantees for the combos the review worried about: knee+lower_back leaves Goblet Squat / Sumo Squat / Leg Press (squat) and Hip Thrust (hinge) untagged, so neither `lower_quad` nor `lower_post` empties of compounds. It degrades to `LIMITED_VARIETY_WARNING` only when restriction **and** near-empty equipment remove every safe loaded lower compound, which is honest (there is no safe loaded option to give).
   - **Net:** the floor backstop means 3.1 does not change *whether* a compound is present (the floor recovers it); it changes *composition cleanliness* (the compound fills its own slot instead of an isolation taking the slot and the floor redundantly re-adding the compound, displacing an accessory). That is the real, narrow value, and what the §5(b) regression locks.

## 7. Non-goals

- No new pattern vocabulary (`quad_iso`/`hamstring_iso`) here; that is the durable fix (§4.2), separately specced.
- No change to `pick`, backfill, the `COMPOUND_FLOOR` guard, the role model, or any emphasis table.
- No migration.

## 8. Sibling item, not in scope here (Phase 1 disposition)

The reviewer flagged a worry, sourced from the 2026-06-10 input-coverage audit, that knee+lower_back produces all-isolation leg days with no session-level guard. **Phase 1 found this does not reproduce on the current tree:**

- The audit predates the `COMPOUND_FLOOR` guard (audit 2026-06-10, guard shipped 2026-06-11), so its "no minimum-compound guard exists" is stale.
- The audit's trace ("knee removes squat and lunge compounds, leaving glute_iso+calf+core") is also wrong on the data: the contraindication seed deliberately leaves safe lower compounds untagged (Goblet/Sumo Squat, Leg Press, Step-Up, Hip Thrust), so knee+lower_back keeps a loaded compound on both `lower_quad` and `lower_post`.

**Disposition:** there is **no missing session-level guard** to spec. The only residual is a *nicety*, not a bug: **intent-matched substitution** (offer a safe loaded alternative) for the rare restriction + near-empty-equipment combo where the floor today ships `LIMITED_VARIETY_WARNING`. It is low user impact (the warning is honest degradation) and is the v1.5 follow-on already noted for movement restrictions. **Do not implement it in this pass.** If ever picked up, it is its own small spec, sequenced with the `quad_iso`/`hamstring_iso` data-model work (§4.2), not with this guard.
