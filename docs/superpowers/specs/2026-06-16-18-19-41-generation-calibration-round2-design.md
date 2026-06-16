# Generation calibration round 2 (external-review-driven) - design

**Date:** 2026-06-16
**Branch:** `feature/generation-calibration-round2`
**Driver:** the 20-routine external review (`docs/audits/2026-06-16-17-14-00-20-routines-for-review.md`) and its code-grounded reconciliation (`docs/audits/2026-06-16-18-19-41-20-routine-review-reconciliation.md`).

## Context

We ran 20 routines from the real slot-first generator (post context-sensitive scoring, #154) across the full input space and had ChatGPT, Perplexity, and Claude AI score them against an 8/10 bar. Scores: 8.3 / "not yet" / 6.6. Reconciled against code-truth, the structure, split logic, equipment handling, and restriction substitution are already strong (mainstream full-gym routines score 8+). What drags the consolidated score below 8 is a small set of **systematic, bounded defects**, not architecture. All three reviewers independently said the same: "refinement, not redesign."

This spec calibrates the existing engine. It does **not** rewrite the slot-first generator. The standing invariant holds: every change is gated on real-catalogue metadata (muscle attribution / names) so the synthetic-pool byte-identity goldens stay byte-identical, except where a deliberate golden rebaseline is explicitly called out (Item 6 only).

## Goals

- Push the consolidated 20-routine re-score to a reliable 8/10+, especially on the constrained and low-frequency cases that a real user (home gym, injury, short session) actually hits.
- Keep the engine deterministic, pure-where-possible, and import-cycle-free.
- Keep all existing generation byte-identity goldens green except the one rebaseline flagged in Item 6.

## Non-goals

- No new architecture, no candidate-routine search/scoring loop, no per-set fatigue model.
- No fractional-indirect volume model: it already exists (`effective` sets + `CARRYOVER_CREDITS`). See Item 0.
- No full restriction severity model in this round (documented as the follow-on in Item 5).

## Decisions already made (user, 2026-06-16)

1. Proceed spec-first with a bounded round before the Laldy rebrand.
2. Shoulder restriction = treat the current binary flag as **"moderate"** (exclude BB OHP, DB OHP, Arnold Press, Upright Row; keep machine/neutral/horizontal pressing, rows, pulldowns, face pulls, rear delts). Severity tiers are the follow-on.
3. MRV cap = a **soft** ceiling that trims the lowest-value accessory sets.

## Reviewer loop disposition (2026-06-16, ChatGPT + Perplexity)

Both reviewers endorsed the bounded plan. Perplexity confirmed the recommended answers to the open questions and added per-item implementation detail; ChatGPT red-teamed and added two refinements plus one out-of-scope redesign.

**Adopted:**
- **Invariant-enforcer structure (Perplexity).** Express Items 1-4 as one deterministic post-pipeline normalization pass with three declarative invariants, applied in order: (1) floor every trainable muscle, (2) ceiling every muscle (MRV trim), (3) no isolation out-sets its session's top compound. This replaces scattered cap-overrides with declarative rules and defuses the "competing optimizers" concern below.
- **Item 1 isolation-only-muscle exemption (ChatGPT).** The top-compound cap applies to isolations of muscles that also get compound stimulus (chest / back / triceps / biceps). Side delts and rear delts have no compound that trains them, so they are exempt from the top-compound reference; they still prefer spreading to a second exercise over piling sets onto one.
- **Item 2 low-frequency realism (both).** Zero-override fires only for true zeros of target muscles where a safe option exists; some accessory zeros are acceptable on a 2-day plan rather than overstuffing. Triceps-0-direct on a 2-day is largely covered by pressing carryover (now visible via Item 0).

**Escalated and resolved (user, 2026-06-16):** Item 5 "moderate" shoulder = exclude the free-weight overhead presses AND de-emphasise the vertical-press slot (lean into lateral / rear delts + horizontal), so a shoulder restriction visibly changes the program. This makes Item 5 a small generation change plus the seed migration, not data alone.

**Dismissed (escalation path, not this round):** ChatGPT's "muscle-role hierarchy" (role classes with per-role volume authority). The concern (systems oscillating over one budget) is valid, but the ordered single pass lifts toward `min` before and trims above `max` after, on disjoint conditions, so it does not oscillate, and the invariant-enforcer captures the same safety declaratively. A role-class allocator is a redesign and contradicts the locked bounded scope. Revisit only if the re-score still shows cross-split imbalance after this round.

---

## Item 0 - De-noise the diagnostic (do first, no engine change)

**Problem.** The diagnostic prints DIRECT sets per fine muscle only, so reviewers saw "lats 0" / "bench doesn't count triceps" and inferred the engine is blind to indirect volume. It is not (`weeklyMuscleSets.effective`, `muscleVolume.ts:80`; `CARRYOVER_CREDITS`, `:22-27`). This single framing cost is responsible for ChatGPT's entire #1 priority.

**Fix.** In `scripts/gen-routine.ts`, the muscle-volume readout should additionally print, per targeted muscle, the `effective` figure and show the `back` aggregate explicitly (it already drives the gap line but is not in the per-muscle row). Format suggestion: `triceps 6 dir / 12 eff /8`. Pure tooling, no engine change, no goldens.

**Why first.** It removes the largest non-bug from the next review round without touching the engine, so the re-score reflects the real defects.

---

## Item 1 - Gap-fill set-inflation cap

**Problem (REAL, strongest cross-reviewer signal).** Single isolations reach 6x or 8x while the session's primary compounds sit at 3-4x (e.g. Face Pull 6x, Upright Row 6x, Tricep Pushdown 8x in PHUL). It reads as junk volume and inverts the compound-first hierarchy.

**Root cause.** Base sets = 3 (4 for the strength first-compound, `generation.ts:2285-2289`). Gap-fill bumps an existing isolation one set at a time up to `2 * baseSets` (`gapFill.ts:266`), and prefers bumping a single exercise over inserting a second distinct one; nothing caps an iso at the session's top-compound set count.

**Fix (bounded, in `gapFill.ts`).**
- Cap any gap-fill-touched isolation's total sets at **the session's top compound set count** (so an iso never out-sets the day's main lift). With base 3, that is typically 3-4, not 6.
- When a muscle is still below floor after that cap, **prefer inserting a second distinct isolation** (subject to the existing `PER_SESSION_ADD_CAP` / `ROUTINE_ADD_CAP`) over continuing to bump one. Spreads 3+3 instead of 6+0.
- **Exempt the isolation-only muscles** (side_delts, rear_delts): no compound trains them, so the top-compound reference does not apply; they still prefer a second distinct exercise over bumping one past a sane per-exercise ceiling. (ChatGPT, adopted.)

**Open questions for the loop.**
- Is "top compound set count" the right ceiling, or a flat `baseSets + 1`? (top-compound is self-scaling with the strength bump; flat is simpler.)
- Does preferring inserts over bumps blow the per-session add cap on thin pools? (Likely interacts with Item 2.)

**Goldens.** Gap-fill is gated on muscle attribution; synthetic pools no-op, so generation byte-identity goldens stay byte-identical. New/updated coverage lives in the `gapFill.ts` unit tests + the `scripts/muscle-sweep.ts` evidence sweep.

---

## Item 2 - Muscle-level coverage floor (trainable-zero elimination on low-frequency / restricted routines)

**Problem (REAL, biggest).** Whole muscles fall to zero direct sets even when the safe pool could train them: triceps 0% (R11, 2-day full gym), side delts 0% (R15, machines), side+rear delts 0% (R16, barbell). Quads 30% under knee restriction (R12) is the partial case.

**Root cause.** Gap-fill Phase 1 already eliminates trainable zeros, but it is bounded by `PER_SESSION_ADD_CAP = 1` / `ROUTINE_ADD_CAP = 4`, which on a 2-day routine (max 2 inserts) cannot clear several zeros at once; severity ordering can spend the budget elsewhere. The restriction filter is purely subtractive (`isContraindicated`, `generation.ts:867`), and `COMPOUND_FLOOR` floors compounds-per-region, not muscles (`generation.ts:910-917`).

**Fix (bounded).**
- A **trainable-zero of a gap-fill TARGET muscle takes precedence** and may exceed the normal per-session insert cap (a trainable zero is worse than a tidy session). Scope it to true zeros only, so deep pools are unaffected.
- Confirm during implementation which safe options actually exist for the restricted cases (catalogue audit): is there a knee-safe quad option (leg press / partial-ROM) and a cable/machine lateral-raise for the machines case? If yes, the floor must use them; if a muscle is genuinely untrainable by the safe pool, **keep the honest warning** rather than force a bad pick.
- On very-low-frequency routines (2-day), **accept some accessory zeros** rather than overstuffing the session; a target muscle reached only by compound carryover (e.g. triceps via pressing) is not a true training gap. (Both reviewers, adopted.)

**Open questions for the loop.**
- How far may zero-elimination exceed the add caps before a 2-day session becomes overstuffed? (A session-length guard already runs after gap-fill.)
- Is intent-matched restriction substitution (the documented v1.5 follow-on) in scope here, or only the cap relaxation? Recommended: cap relaxation + use-existing-safe-options now; intent-matched substitution stays the follow-on.

**Goldens.** Same attribution gating; synthetic goldens byte-identical.

---

## Item 3 - Priority muscle reaches its target band

**Problem (REAL).** Priority chest produced chest at 80%, the worst-covered muscle (R6). ChatGPT's "only reorders" is wrong (it adds `PRIORITY_EXTRA_SETS_PER_WEEK = 4`, `generation.ts:308`), but +4 spread one-per-exercise over ~2 chest slots yields only ~+2 sets, short of a target of 10. Gap-fill ignores priority entirely.

**Fix (bounded).**
- Scale the priority allocation so the priority muscle reaches **at least its target `min` band** when the pool allows, rather than a flat +4 that can fall short on high-target muscles.
- Make **gap-fill give the priority muscle first claim** on its add budget.

**Open questions for the loop.**
- Cap the priority allocation at `max` (so priority + MRV from Item 4 do not fight)?
- Should non-priority competing muscles be trimmed (ChatGPT's -10%), or only the priority lifted? Recommended: lift the priority within session-length limits; do not actively starve others in v1.

**Goldens.** Priority defaults to `balanced` (no bump), so balanced goldens are unaffected. The existing end-to-end priority test (glutes) may need a deliberate rebaseline; add end-to-end tests for chest / back / shoulders / arms priority. Flag the rebaseline before changing.

---

## Item 4 - Soft MRV ceiling (decision: soft, trim accessories)

**Problem (REAL, lowest stakes).** No upper cap: quads 160-170%, chest 130-200% on high-frequency styles (`max` in `MUSCLE_SET_TARGETS` is unenforced, `muscleVolume.ts:101`). Mitigated in practice by training-time RIR ramps + deloads, but the static blueprint still reads as past-MRV.

**Fix (bounded, soft).** After gap-fill, when a muscle's projected weekly direct sets exceed its `max`, trim from the **lowest-value accessory sets first** (isolations before compounds, never below a compound's base). Soft: trim toward `max`, do not hard-fail.

**Open questions for the loop.**
- Use `MUSCLE_SET_TARGETS.max` directly, or a higher MRV landmark from the Phase 0 source material (`docs/superpowers/designs/2026-06-06-00-54-52-phase0-source-material.md`)? Recommended: the existing `max`, since it is already the calibrated band.
- Interaction order with priority (Item 3): priority lifts toward target, MRV trims above max; they should not oscillate. Define one pass order (priority → gap-fill → MRV trim).

**Goldens.** Attribution-gated; synthetic goldens byte-identical. New unit tests on the 6-day PPLx2 bodybuilding case.

---

## Item 5 - Shoulder restriction = "moderate" (decision baked)

**Problem (accurate).** A shoulder flag barely changes the program (R14 ≈ a normal U/L). DB OHP and Machine Shoulder Press survive because only BB OHP / Arnold / DB Push Press / Upright Row / Dips are tagged `shoulder`.

**Fix (v1, binary flag treated as moderate).** Two parts:
- **Seed migration:** add the `shoulder` contraindication to **DB Overhead Press** and **Arnold Press** (BB OHP + Upright Row already tagged). Keep Machine Shoulder Press, incline/horizontal pressing, rows, pulldowns, face pulls, rear-delt work. This removes free-weight overhead pressing under a shoulder flag while preserving machine/neutral and horizontal stimulus.
- **Generation change (`generation.ts`, restriction-aware):** when `restrictions` includes `shoulder`, **de-emphasise the vertical-press slot** (lower its priority or drop it from the emphasis) so volume shifts to lateral + rear delts and horizontal pressing. This makes the restriction visibly change the program (the R14 complaint), not just remove two lifts.

**Follow-on (documented, not this round).** A real severity model: `restriction: { shoulder: 'mild' | 'moderate' | 'severe' }` with per-exercise penalties rather than hard bans (user-supplied penalty table in the reconciliation doc). Mild keeps DB OHP / Machine SP and only removes Upright Row + de-emphasises heavy BB OHP; severe removes all overhead + front raises + deep dips.

**Resolved (user, 2026-06-16).** Moderate goes beyond exclusion: also de-emphasise the vertical-press slot, so Item 5 is a generation change plus the seed migration (see Fix above).

**Goldens.** Synthetic goldens carry no contraindications and no restrictions, so both parts leave the no-restriction goldens byte-identical. Restriction tests use real-ish data; add assertions that under a shoulder flag (a) free-weight overhead is absent and (b) the vertical-press slot is de-emphasised toward laterals / rear delts. Migration: hand-apply on merge.

---

## Item 6 - Full-body vertical-pull slot (OPTIONAL, forces a golden rebaseline)

**Problem (partly real).** `no_vertical_pull` fires on full-gym full-body and machine/barbell configs (R1, R11, R15). Part is honest (barbell-only / no pulldown), part is that the full-body EMPHASES lack a `vertical_pull` slot.

**Fix.** Add a `vertical_pull` slot to the full-body emphases (no-ops for dumbbell-only via the existing equipment skip + backfill, like the upper/pull emphases already do).

**Risk.** Unlike Items 1-5, this changes which patterns full-body sessions request, so it **changes the full-body byte-identity goldens** (they use synthetic pools but real EMPHASES). This is a deliberate rebaseline, not a no-op.

**Recommendation.** Lower priority than 1-5. Decide in the loop whether the coverage win justifies the rebaseline, or whether to leave `no_vertical_pull` as the honest warning it largely is. If included, do it last and rebaseline the goldens in its own commit.

---

## Sequencing

1. Item 0 (diagnostic) first, so the re-review is honest.
2. Items 1-4 as the **invariant enforcer**: a single post-pipeline normalization pass (floor → ceiling → compound-hierarchy), with the priority lift folded into the pre-pass allocation. Each invariant lands as its own commit, TDD. Pass order: base fill → priority lift → gap-fill (priority-first) → MRV trim → set-inflation cap → duration guard.
3. Item 5: seed migration (DB OHP + Arnold tagged `shoulder`, hand-apply on merge) plus the restriction-aware vertical-press de-emphasis in `generation.ts`.
4. Item 6 (loop-approved): full-body vertical-pull slot, last, isolated commit, deliberate golden rebaseline.

## Verification

- **Primary:** regenerate the same 20 configs (`scripts/gen-routine.ts` / a batch) and re-score (re-run the external loop). Target: the constrained/low-frequency routines (R6, R11, R12, R15, R16) clear their worst gaps; the over-volume routines (R5, R8, R17, R20) drop under `max`; no routine shows an iso out-setting its session's top compound.
- **Targets per item:** R6 chest ≥ target; R11 triceps > 0; R12 quads improved with knee-safe options (or honest warning if none); R15/R16 side/rear delts > 0 where trainable; R5/R8 quads/chest ≤ max.
- **Suite:** full `bun run test:run` green; typecheck clean. Generation byte-identity goldens unchanged except Item 6 (if taken).
- **Evidence sweep:** re-run `scripts/muscle-sweep.ts` and compare coverage deltas, as the gap-fill and Spec 3.1 work did.

## Resolved decisions (loop round 1, 2026-06-16)

Routed to ChatGPT (red-team) + Perplexity (architecture + web-cited science) and resolved:

- **A. Item 1 ceiling:** session top-compound set count (self-scaling), with side / rear delts exempt (isolation-only muscles).
- **B. Item 2 override:** true zeros of target muscles only, where a safe option exists; accept some accessory zeros at 2-day frequency. Intent-matched restriction substitution stays the follow-on.
- **C. Item 3 priority:** cap the priority lift at the muscle's `max`; do not trim competing muscles in v1.
- **D. Item 4 MRV:** trim toward the existing `MUSCLE_SET_TARGETS.max`; pass order base → priority lift → gap-fill (priority-first) → MRV trim → set-inflation cap → duration guard, structured as the invariant enforcer (see disposition).
- **E. Item 5 shoulder:** also de-emphasise the vertical-press slot, not exclusion alone (user decision).
- **F. Item 6 vertical pull:** approved; do it last in an isolated commit with a deliberate golden rebaseline.

Non-blocking science still worth a web-cited Perplexity pass while implementing: the per-muscle MRV maxes the Item 4 cap enforces, and whether excluding DB OHP + Arnold while keeping machine/neutral pressing matches shoulder-pain guidance. These tune constants, not structure.
