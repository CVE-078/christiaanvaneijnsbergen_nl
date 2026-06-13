# Compound-first selection guard (generation 3.1), design

**Status:** Draft for review (Claude.ai science lens + Perplexity architecture lens), then TDD. Engine change, so spec-first per the generation workflow. Not in the launch path.

**Author note:** This spec was drafted AFK. Two of its claims were independently verified against the live tree (a golden-impact measurement and a full catalog audit); both are reported below with their evidence. The headline correction vs the roadmap's framing is in §3.

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

### 3.2 The guard is byte-identical on every current golden test

Measured directly: adding `const aComp = a.is_compound ? 0 : 1; const bComp = b.is_compound ? 0 : 1; if (aComp !== bComp) return aComp - bComp;` to `byPattern` (after the front-delt term, before the fatigue tiebreak) and running the full suite → **1379/1379 pass, zero changes** (measured on `main`).

Why it is safe: on `hinge`/`squat`, the canonical-anchor rank (step 5) already ranks the **named** compounds (deadlift, RDL, sumo, squat, leg press, hack squat) ahead of the unnamed leg curl/extension (finite rank < `Infinity`). So whenever a named compound is in the candidate pool, the compound already wins and the guard changes nothing.

### 3.3 The real gap the guard closes

The guard only changes behaviour when, within `hinge` or `squat`, **no named-anchor compound survives the equipment/restriction filter** but an *unnamed* compound and a leg curl/extension both do. Then step 5 ties (`Infinity` vs `Infinity`) and step 6 (fatigue) decides, and because `hinge`/`squat` are anchor patterns that prefer **higher** fatigue, a leg curl/extension with a higher fatigue value than the surviving unnamed compound would win the slot. The guard prevents that.

This is a narrow thin-pool edge case (no current named anchor is excluded by dumbbell-only setups, since Dumbbell RDL / Goblet Squat are themselves named), which is exactly why no golden covers it and why the bug has never been seen in practice.

## 4. Recommendation

**Two-part recommendation, sequenced:**

1. **Ship the `is_compound` guard (cheap, safe, correct).** Add a compound-first term to `byPattern`, placed **after** the front-delt-isolation suppression and **before** the fatigue tiebreak (placement relative to `anchorRank` is behaviourally irrelevant since the guard is redundant with `anchorRank` for named compounds; keeping it just above fatigue reads as "a compound beats an isolation regardless of fatigue cost"). It is byte-identical on goldens (§3.2) and closes the §3.3 gap. Comment must record that it is live only for the `hinge`/`squat` mixed patterns.

2. **Flag the root cause as the durable fix (separate, larger item, not this spec).** The only reason the guard is needed at all is that `Leg Curl` / `Leg Extension` are shoehorned into `hinge`/`squat`. Introducing `quad_iso` / `hamstring_iso` patterns (the documented gap in `2026-06-06-10-51-33-movement-pattern-correction.sql` and the roadmap's known-gap note) would make all 15+ patterns cleanly segregated, render this guard a true no-op, and unlock expressing leg-curl/extension as proper accessories (e.g. a leg curl on a Lower Power day, currently inexpressible). That is a data-model + emphasis-table change with its own review, not in scope here.

## 5. Test plan

- **Byte-identity goldens:** the existing generation goldens must stay green (already verified, §3.2).
- **New thin-pool regression** (the scenario goldens don't cover): construct a `hinge` (or `squat`) candidate pool containing exactly one *unnamed* compound (not in `CANONICAL_ANCHORS`) with a **lower** fatigue value and one leg-curl/extension isolation with a **higher** fatigue value; assert `byPattern('hinge')[0]` is the compound. Without the guard this test fails (fatigue picks the isolation); with it, it passes. This locks the fix to its actual mechanism.
- **Inert-on-segregated assertion:** for a pure pattern (e.g. `horizontal_push`), the guard must not change ordering (all candidates share `is_compound`), so a same-pool ordering test stays identical.

## 6. Open questions for the review loop

1. **Is the cheap guard worth shipping before the quad/ham-iso patterns exist?** It is correct and free (byte-identical), but its real-world blast radius is tiny. Ship now as a cheap correctness rail, or fold it into the larger quad/ham-iso data-model work so we touch leg-pattern selection once? (Architecture lens.)
2. **Fatigue interaction:** is "a compound always beats an isolation in the same slot, regardless of fatigue" always coach-correct? For `hinge`/`squat` thin pools the answer is clearly yes (you want the squat over the leg extension). Confirm there is no slot where a higher-fatigue isolation is genuinely the better primary pick. (Science lens.)
3. **Scope check:** confirm there is no *cross-slot* manifestation (an isolation slot displacing a compound slot at the session level) that this within-pattern guard would miss. Analysis in §2 says backfill only walks `emphasis.slots` and the `COMPOUND_FLOOR` + role model already protect the session-level compound count, but the review should sanity-check that the bug is purely within-pattern (the two mixed patterns) and not a backfill/floor problem in disguise.

## 7. Non-goals

- No new pattern vocabulary (`quad_iso`/`hamstring_iso`) here; that is the durable fix (§4.2), separately specced.
- No change to `pick`, backfill, the `COMPOUND_FLOOR` guard, the role model, or any emphasis table.
- No migration.
