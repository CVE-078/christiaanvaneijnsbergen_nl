# Generation quality: EMPHASES data fixes (P0 Group 1)

**Date:** 2026-06-10
**Branch:** `feature/generation-emphasis-fixes`
**Roadmap:** P0 Group 1, subsection 1 (entries 1.1-1.4) of "Generation quality & setup flow, backlog".
**Status:** Design approved (Claude.ai science review folded in). Ready for implementation plan.

## Context

`EMPHASES` in `src/lib/pulse/generation.ts` is the per-session ordered list of movement-pattern slots the slot filler walks (and backfills from) to reach the session's exercise target. Four data defects there degrade every generated routine. All four are pure data edits to the `EMPHASES` table, no engine logic change. The compound-first ranking guard (roadmap 3.1) and the metadata seed migration (roadmap 2.x) are deliberately separate, later branches.

This spec covers only the `EMPHASES` edits (1.1-1.4).

## Problems

- **1.1 Lower and Legs are structurally identical.** `lower_quad`, `lower_post`, and `lower_lean` carry the same leg patterns reordered. Under `varietyPreference = 'consistent'` the anchor map pins `squat` and `hinge` (both in `COMPOUND_ANCHOR_PATTERNS`) to the same exercise across the week, so the two leg days of a UL split come out near-identical. Reordering alone cannot fix this: the post-selection tier sort (`patternTier`) flattens slot order for presentation, and equal pattern counts produce equal volume. Only different pattern *composition* differentiates the days.
- **1.2 Deadlift on Pull day.** `pull` carries a `hinge` slot, so an RDL/deadlift surfaces on Pull. In `ulppl-5`, `hinge` is then demanded by Lower, Pull, and Legs (3 of 5 sessions).
- **1.3 No vertical pulling anywhere.** `vertical_pull` appears in no emphasis slot list. The pattern was dropped globally to protect dumbbell-only users (no pull-up bar = no usable option), but that protection belongs to the equipment filter, not the slot list. Gym users with a lat pulldown never get a vertical pull in any routine.
- **1.4 Undesigned 6th exercise on Push/Pull.** `push` and `pull` list 5 slots, but `volumeFor('45-60 min', 'intermediate')` targets 6, so backfill picks an undesigned, pool-dependent 6th exercise.

## Goals

- Lower and Legs read as distinct quad-dominant vs posterior-dominant days under every variety setting.
- No hinge on Pull day.
- Gym users get a vertical pull on the back-focused upper/pull day of every split.
- Push and Pull have a deliberate, designed 6th slot.
- Dumbbell-only output stays effectively byte-identical (the `vertical_pull` additions no-op for them).
- No engine logic change. No absolute golden-snapshot rebaseline (none exists; the relative identity tests stay green).

## Non-goals

- The compound-first ranking guard (3.1). Until it lands, the lower-day 6th exercise is a backfill accessory, not a designed Leg Extension / Leg Curl.
- The metadata seed migration (2.x: `chest_fly` / `leg_curl` / `leg_extension` substitution classes, Smith Machine Calf Raise equipment).
- Any change to `legs`, `lower_general`, `fb_legs`, or the full-body emphases.

## The fixes

### 1.1 Lower split, clean separation

Quad days keep `squat` and drop `hinge`; the posterior day keeps `hinge` and drops `squat`. Each leg emphasis is always paired with its opposite within a routine, so squat and hinge are each still trained once across the week (standard Lower A / Lower B structure).

```
lower_quad:  [squat, lunge, hinge, glute_iso, calf, core]   ->  [squat, lunge, glute_iso, calf, core]
lower_post:  [hinge, glute_iso, lunge, squat, calf, core]   ->  [hinge, glute_iso, lunge, calf, core]
lower_lean:  [lunge, glute_iso, hinge, squat, calf, core]   ->  [lunge, squat, glute_iso, calf, core]
```

Each drops to 5 explicit slots. Backfill adds the 6th at 45-60 min (a 2nd accessory, typically `glute_iso`, pool-dependent).

**Why these three only.** They are the emphasis pairs that are *meant* to differ but came out identical:
- `ul-classic-4`: `lower_quad` (A) + `lower_post` (B)
- `ulppl-5`: `lower_quad` (lower) + `lower_post` (legs)
- `fb-ul-hybrid-5`: `lower_quad` (A) + `lower_post` (B)
- `ul-aesthetic-4`: `lower_lean` (A) + `lower_post` (B)

`legs`, `lower_general`, and `fb_legs` keep both compounds: they are single leg days, or (in `ppl-x2-6`) the *same* emphasis used twice, where identical main lifts under `consistent` is the intended behavior.

### 1.2 + 1.3 + 1.4 Push / Pull / Upper

```
push:          [horizontal_push, vertical_push, chest_iso, shoulder_iso, triceps_iso]
            -> [horizontal_push, vertical_push, chest_iso, shoulder_iso, triceps_iso, triceps_iso]

pull:          [horizontal_pull, hinge, back_iso, shoulder_iso, biceps_iso]
            -> [horizontal_pull, vertical_pull, back_iso, shoulder_iso, biceps_iso, back_iso]

upper_general:    [horizontal_push, horizontal_pull, vertical_push, shoulder_iso, biceps_iso, triceps_iso]
               -> [horizontal_push, horizontal_pull, vertical_pull, vertical_push, shoulder_iso, biceps_iso, triceps_iso]

upper_chest_back: [horizontal_push, horizontal_pull, vertical_push, chest_iso, back_iso, biceps_iso]
               -> [horizontal_push, horizontal_pull, vertical_pull, vertical_push, chest_iso, back_iso, biceps_iso]

upper_aesthetic_a:[horizontal_push, horizontal_pull, shoulder_iso, chest_iso, back_iso, biceps_iso]
               -> [horizontal_push, horizontal_pull, vertical_pull, shoulder_iso, chest_iso, back_iso, biceps_iso]
```

Each upper insert puts `vertical_pull` at position 3 (after `horizontal_pull`), taking each emphasis from 6 to 7 explicit slots. At the 6-exercise cap (45-60 min) the slot at position 7 falls past it for gym users:

| Emphasis | Slot dropped at 6-cap (gym) |
| --- | --- |
| `upper_general` | `triceps_iso` |
| `upper_chest_back` | `biceps_iso` |
| `upper_aesthetic_a` | `biceps_iso` |

- **pull** drops `hinge` (1.2), gains `vertical_pull` as a primary slot (1.3), and gets a deliberate 6th = a 2nd `back_iso` (1.4).
- **push** gets a deliberate 6th = a 2nd `triceps_iso` (1.4).
- **vertical_pull** is added to the back-focused upper days only: `pull`, `upper_general`, `upper_chest_back`, `upper_aesthetic_a`. The delts/arms upper days (`upper_delts_arms`, `upper_aesthetic_b`) do not get it (their pair day covers back).

## Decisions (resolved)

1. **Lower frequency: once-each is the default.** No light-hinge accessory on the quad day. That would recreate the contamination the fix removes; `lunge` already provides secondary posterior stimulus on the quad day, and the posterior day is in the same week. The 3-day single-lower case is a different emphasis (`lower_general`), left alone. (Confirmed, science review.)

2. **vertical_pull breadth: back-focused upper/pull days only.** Arms/delts days do not need a second back compound. (Confirmed, science review.)

3. **6th slots: push -> 2nd `triceps_iso`, pull -> 2nd `back_iso`.**
   - push: triceps are commonly undertrained in compound-focused programs; balances the day to chest 2 / shoulders 2 / triceps 2.
   - pull: after `horizontal_pull` + `vertical_pull` + `back_iso` + `biceps_iso`, biceps already get three movements. The 6th slot is the natural home for posterior-shoulder work (face pull, rear delt fly), which is `back_iso` in Pulse's taxonomy. Structural balance, not arm volume, is the deficit on a push-heavy program. (Changed from the initial symmetric `biceps_iso` proposal per science review.)

4. **The back-focused upper days becoming 7 slots is deliberate.** Inserting `vertical_pull` pushes each of these emphases to 7 explicit slots, so the trailing isolation falls past the 6-exercise cap at 45-60 min for gym users:
   - `upper_general`: trailing `triceps_iso` drops.
   - `upper_chest_back`: trailing `biceps_iso` drops.
   - `upper_aesthetic_a`: trailing `biceps_iso` drops.

   `vertical_pull` is a higher-value add than a trailing arm isolation on a back-focused day. This is intended behavior, made explicit by a dedicated test (see below) so it cannot become a silent regression. For dumbbell-only users `vertical_pull` no-ops and the trailing isolation fills the freed budget, so their output is unchanged.

## No-op safety and what changes

- **Dumbbell-only users:** the `vertical_pull` slot finds no candidates, `pick` returns false, and backfill restores the original picks. `upper_general` for a dumbbell user resolves to the original 6 (`vertical_pull` skipped, `triceps_iso` kept). So the `vertical_pull` additions are effectively byte-identical for dumbbell-only setups.
- **Gym users:** gain a vertical pull on the back-focused upper/pull day; on `upper_general` at 45-60 min they trade the trailing `triceps_iso` for it.
- **Lower split + push/pull 6th:** these deliberately change output for all users. There is no absolute golden snapshot in the suite; the relative identity tests (`varied == base`, `null/undefined flag == base`, `consistent` determinism) stay green because they compare two runs of the *same* `EMPHASES`.
- **Existing unit test:** `muscle priority > tiltEmphasis front-loads a priority pattern` asserts `tiltEmphasis(lower_quad, 'glutes')` front-loads `[glute_iso, hinge]`. Since `lower_quad` loses `hinge`, repoint that test to `lower_post` (which retains both `glute_iso` and `hinge`).

## Test strategy (TDD)

New `describe('P0 Group 1: emphasis data fixes')` in `src/lib/pulse/__tests__/generation.test.ts`:

- **1.1** quad days contain no `hinge`-pattern exercise; posterior day contains no `squat`-pattern exercise, for `ulppl-5`, `ul-classic-4`, `ul-aesthetic-4`.
- **1.1** under `consistent`, the two lower sessions of `ul-classic-4` share no `squat`- or `hinge`-pattern exercise id.
- **1.2** any `pull` session contains zero `hinge`-pattern exercises.
- **1.3** with `vertical_pull` available in pool + equipment: `pull`, `upper_general`, and `upper_chest_back` sessions each contain a `vertical_pull` exercise.
- **1.3 no-op safety** with a pool that has no `vertical_pull` rows: the same sessions still generate (length > 0), contain no `vertical_pull`, and the call does not throw.
- **1.4** at 6-exercise volume, a `push` session contains 2 `triceps_iso`-pattern exercises; a `pull` session contains 2 `back_iso`-pattern exercises.
- **Decision 4** with `vertical_pull` available, an `upper_general` session contains `vertical_pull` and does NOT contain a `triceps_iso` exercise (the 7th slot dropped at the 6-cap); with no `vertical_pull` in pool, the same session DOES contain `triceps_iso` (byte-identical fallback).
- Existing relative golden-identity tests remain green.

Pool-depth caveat: the synthetic `deepPool()` has 2 options per pattern, so accessory ids can collide across two same-focus sessions. Assert the precise fix invariants (no cross-compound, no shared squat/hinge) rather than a blanket "share at most 1 exercise overall", which is a pool-depth artifact.

## Files touched

- `src/lib/pulse/generation.ts`: the `EMPHASES` table only (`lower_quad`, `lower_post`, `lower_lean`, `push`, `pull`, `upper_general`, `upper_chest_back`, `upper_aesthetic_a`). Update the `vertical_pull` omission comment at the top of `EMPHASES`.
- `src/lib/pulse/__tests__/generation.test.ts`: new `describe` block; repoint the `tiltEmphasis` test to `lower_post`.
- `docs/roadmap.md` and `CLAUDE.md`: roadmap START/FINISH sync.

## Sequencing

This is P0 Group 1. It unblocks:
- **Group 2** (2.x metadata seed migration): independent, but confirm the four pending merged-feature migrations are applied to Supabase first (they touch the same `exercises` rows).
- **Group 3** (3.1 compound-first ranking guard): after this and Group 2 merge. Once 3.1 lands, the lower-day 6th slot can become a designed `squat`/`hinge` repeat that reliably seats Leg Extension / Leg Curl instead of today's backfill accessory.
