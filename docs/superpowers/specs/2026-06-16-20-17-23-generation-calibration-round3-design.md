# Generation calibration round 3 - lat coverage + full-body vertical pull (design)

**Date:** 2026-06-16
**Follows:** calibration round 2 (`feature/generation-calibration-round2`, Items 0-5 shipped, Item 6 deferred).
**Driver:** the round-3 review-loop pass (Perplexity + ChatGPT) over the shipped round-2 engine.

## Context

The loop returned a round-3 pass. Reconciled against the live code + catalogue (cache refreshed post-migration), most of it is already shipped or an honest catalogue gap, not new engine work:

- **Already shipped:** isolation set cap + diversify-before-inflate (round-2 Item 1), trainable-zero override (Item 2), priority-to-band (Item 3), soft MRV trim (Item 4), moderate shoulder (Item 5).
- **Already tuned:** shoulder-isolation quality is exactly the desired order via the `quality` column (Lateral Raise 1.00, Rear Delt Fly / Face Pull 0.95, Reverse Fly 0.90, Upright Row 0.85, Front Raise 0.60).
- **Honest catalogue gaps, not bugs:** knee restriction -> quads 30% (Leg Extension is the only quad isolation and is correctly knee-contraindicated; no knee-safe quad isolation exists); machine/cable -> side delts 0% (all three side-delt isolations are dumbbell-only; there is no Cable or Machine Lateral Raise in the seed). These are correctly left as honest warnings by Item 2. The fix is catalogue CONTENT (see "Out of scope" below), not the engine.

The one genuinely new, real engine kernel: **lat-coverage visibility and vertical-pull exposure.** Today `back` is a single aggregate target (lats + upper_back, min 12), so a row-only routine satisfies `back` while lats sit at 0, and full-body templates carry no `vertical_pull` slot at all. This round makes lat deficits visible and ensures vertical-pull exposure where equipment and session budget allow. It also subsumes (and resolves) the deferred round-2 Item 6.

## Goals

- Make lat under-dosing visible (stop the `back` aggregate from masking it) and fillable where the pool allows.
- Give full-body templates a vertical pull on sessions that can afford one, WITHOUT regressing the deliberate "30-min full-body earns an isolation" invariant.
- Deterministic; bounded; attribution-gated so synthetic-pool byte-identity goldens stay byte-identical, except a deliberate full-body rebaseline (Item B).

## Non-goals

- No catalogue content additions in this spec (the cable/machine lateral raise + knee-safe quad are a separate content task; see below).
- No re-doing shipped round-2 items.
- No priority overshoot retune (ChatGPT's 120-160% ask): the round-2 reach-min / cap-at-max already lands a priority muscle at 100-160% of its band min. Optional micro-tune later.

## Item A - Lat coverage (split the back aggregate)

**Problem.** `back` is one aggregate target (lats + upper_back). Rows seed to `upper_back`, vertical pulls to `lats`. A horizontal-pull-only routine reads `back` at target while lats = 0 (the documented v1 simplification in `muscleVolume.ts`).

**Fix.** Track `lats` and `upper_back` as separate targets so a lat deficit surfaces, and make `lats` a gap-fill target so it can be filled where the pool allows. Catalogue support exists: `lats` is trainable by the vertical-pull compounds (Pull-Up / Chin-Up / Lat Pulldown) and, crucially for gap-fill (isolation-only), by the non-compound `back_iso` lat-override lifts **Dumbbell Pullover** (dumbbells + bench) and **Straight-Arm Pulldown** (cables).

Touch points: `MUSCLE_SET_TARGETS` (split `back` into `lats` + `upper_back`, or add `lats` alongside), `targetDirectSets` (drop / adjust the back roll-up), `GAP_FILL_TARGETS` + `coverageFloor` + `ISO_PATTERN_FOR` (`lats` -> `back_iso`) + `MUSCLE_REGION` (`lats` -> pull / upper / full_body), and `PRIORITY_TARGET_MUSCLES.back` (now `['lats','upper_back']`).

**Open questions for the loop.**
- Min values: lats and upper_back minimums (e.g. lats 6 + upper_back 8, vs the old `back` 12). What does the literature say for separate lat vs upper-back floors?
- Keep the `back` aggregate (for the warning copy / UI) alongside the split, or replace it entirely?
- Make `lats` a gap-fill TARGET (so gap-fill seats a Pullover / Straight-Arm Pulldown when lats is low and the pool has one), or warning-only? Recommended: gap-fill target, since the non-compound options exist; barbell-only / machine-without-pulldown users stay honest-zero.

**Goldens.** Attribution-gated (no `primary_muscle` -> no change), so synthetic-pool goldens are byte-identical. Existing `back`-target tests rebaseline deliberately for the split.

## Item B - Full-body vertical pull, budget-gated (resolves deferred Item 6)

**Problem.** Full-body emphases (`fb_strength` / `fb_hyper` / `fb_balanced` / `fb_pump`) carry no `vertical_pull` slot, so full-gym full-body days never train the lats directly and fire `no_vertical_pull`. Round-2 Item 6 added the slot but regressed the "30-min full-body earns an isolation" invariant: on a ~5-exercise budget the new primary slot displaces the isolation.

**Fix.** Add `vertical_pull` to the full-body emphases ONLY when the session budget can afford it without displacing the isolation, i.e. gate it by session length: include it on 45-60 min (and 90+) full-body sessions, keep the current slots on ~30 min full-body (preserving the isolation invariant; the `no_vertical_pull` warning stays honest there). Recommended mechanism: a session-time-conditional emphasis (build the full-body emphasis with the `vertical_pull` slot only when `sessionTime !== '~30 min'`), so the 30-min path is untouched. dumbbell-only no-ops (the equipment filter skips `vertical_pull`, backfill covers), so dumbbell-only full-body output is unchanged; only pools with a vertical-pull option gain the lat work.

**Open questions for the loop.**
- Gate on `sessionTime` or on a computed `exCount` threshold? (exCount is the truer signal; sessionTime is simpler.)
- On the fuller session, which existing slot does `vertical_pull` displace (it should push out a trailing isolation / finisher, never a compound or the single horizontal pull)?

**Goldens.** This changes full-body 45-60 outputs -> a DELIBERATE rebaseline of the affected full-body goldens (`fb-2` / `fb-3` / `ulf-3` F-day / `ppl-fb-4` / `fb-hmhp-4` / `fb-ul-hybrid-5`) and the `fb-hmhp-4` / `ppl-fb-4` byte-identity guards, in its own isolated commit. The hard-coded snapshot goldens (`ppl-3` / `ul-classic-4` / `ulppl-5`) are non-full-body and unaffected.

## Item C - Front-delt suppression under shoulder restriction (minor)

**Problem.** Round-2 Item 5 de-emphasises the vertical-press slot under a shoulder restriction, which disables the existing front-delt-isolation suppression (it triggers on a vertical press being present), letting Front Raise (quality 0.60) back into a shoulder-restricted day.

**Fix.** Keep the `front_delt_isolation` suppression active when the press slot was de-emphasised by a shoulder restriction (suppress front-delt isolation under a shoulder flag regardless of the press slot). Small, bounded.

## Out of scope, flagged: catalogue content (parallel task)

These turn the remaining HONEST zeros into covered muscles via the existing Item 2 machinery, with NO engine change. They are content additions (a migration inserting exercises) and need a domain call:
- **Cable Lateral Raise + Machine Lateral Raise** (`shoulder_iso`, primary `side_delts`): unblocks machine/cable side delts (R15).
- **A knee-safe quad option** (e.g. partial-ROM leg press or reverse Nordic; Leg Extension is correctly excluded): unblocks knee-restricted quads (R12). Needs the user's coaching call on the substitute.

## Pass order

Unchanged from round 2 (base-fill -> priority lift -> gap-fill -> MRV trim -> duration guard). Item A plugs into the existing gap-fill / warning; Item B is selection-time (emphasis). The lats gap-fill target rides the same Phase 1 / Phase 2 as the other targets.

## Tests

- A rows-only routine now surfaces a lats deficit (was masked by the `back` aggregate).
- Lats gap-fill seats a Dumbbell Pullover / Straight-Arm Pulldown when lats is low and the pool has one; barbell-only stays honest-zero with the warning.
- A full-gym 45-60 full-body routine includes a vertical pull and lats > 0.
- A ~30 min full-body routine STILL earns an isolation (the round-2 invariant holds).
- dumbbell-only full-body output is byte-identical (vertical_pull no-ops).
- Shoulder-restricted days no longer select Front Raise (Item C).
- The `back`-target tests rebaseline cleanly for the lats / upper_back split.

## Verification

Regenerate the same 20 configs and re-score. Targets: the full-gym full-body routines (R1, R17) gain a vertical pull and lats > 0; lats deficits surface where real; no other routine loses coverage; 30-min full-body unchanged.

## Open questions to route through the loop (before TDD)

1. Item A: lats / upper_back min values; keep or drop the `back` aggregate; lats as a gap-fill target vs warning-only.
2. Item B: gate the full-body vertical pull on `sessionTime` or `exCount`; which slot it displaces on the fuller session.
3. Confirm the catalogue-content task (cable/machine lateral raise + knee-safe quad) is tracked separately, and decide the knee-safe quad substitute.

Route the science (separate lat vs upper-back floors, vertical-pull necessity) to Perplexity (web-cited); the architecture (back-split touch points, the session-length gate, golden rebaseline scope) to Perplexity; ChatGPT as a red-team vote.
