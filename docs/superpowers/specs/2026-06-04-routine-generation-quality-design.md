# Routine Generation Quality Redesign

**Date:** 2026-06-04
**Status:** Draft for review

## Problem

Generated routines are low quality. A real run (intermediate, dumbbells + bench, build muscle, 4 days Mon/Tue/Thu/Fri, 30 min) produced:

1. **Impossible exercises** for the selected equipment: Deadlift, Sumo Deadlift, Close-Grip Bench Press (barbell), Leg Press (machine), Pull-Up, Chin-Up (bar).
2. **Both Upper days identical and both Lower days identical**, with duplicate rows inside a workout type (Dumbbell Overhead Press ×2, Glute Bridge ×2).
3. **Too many exercises** for a 30-min session: the editor stacks Upper·A (4) + Upper·B (4) = 8 under one type, and the duplicates make it read as broken.

### Root causes

- **Equipment seed is prefix-only.** `2026-06-03-exercise-generation-metadata-seed.sql` derives equipment from the name prefix (`Dumbbell %`, `Barbell %`, `Machine %`). Anything without a recognized prefix falls through to an empty equipment array, which the generator treats as bodyweight / always-available. So un-prefixed barbell, machine, and bar compounds (Deadlift, Leg Press, Pull-Up, etc.) leak into a dumbbell-only routine.
- **A/B variation uses a rotation index, not an avoid-set.** `selectForSession` picks `candidates[rotation % len]` (A=0, B=1). When a movement pattern has one usable exercise, `1 % 1 = 0`, so B repeats A. With a correctly-narrowed dumbbell pool this collapse is the norm, producing identical days and duplicate rows.
- **Flat rep range and no session identity.** Every session uses the same `8-12` and the same slot order, so there is no principled reason for two same-focus days to differ.

## Goals

Produce routines comparable to a good coach's output for the selected equipment:

- Only exercises doable with the selected equipment.
- Repeated focuses (the two Upper days, two Lower days, three Full-Body days) differ by **emphasis**, not by accident.
- Exercise count matches the time budget; 30-min sessions use **supersets** to fit.
- Rep ranges vary by session bias and by compound vs isolation.

## Out of scope (deferred)

- Sex/gender bias (needs a new profile column + onboarding question; only a weighting nudge).
- Nutrition: protein/calorie targets, recomposition readouts.
- Height/age profile fields.

---

## Part A — Equipment data correctness

### A1. Add a `pull_up_bar` equipment key

`pull_up_bar` joins the existing keys so Pull-Up / Chin-Up / Hanging Leg Raise are gated, and users who own a bar can still get them.

- `src/lib/pulse/types.ts`: `EQUIPMENT_KEYS = ['dumbbells','barbell','bench','cables','machines','pull_up_bar']`.
- `src/components/pulse/RoutineSetupFlow.tsx`: add `{ key: 'pull_up_bar', label: 'Pull-up bar' }` to `EQUIPMENT_OPTIONS`.
- `src/lib/pulse/recommendation.ts`: `getEquipmentTier` ignores `pull_up_bar` (it must not bump a dumbbell user to the `home`/`gym` tier). No change to the existing tier conditions is required since they only test `cables`/`machines`/`barbell`.
- Existing `routine_templates.required_equipment` rows never list `pull_up_bar`, so template matching is unaffected.

### A2. New migration: explicit per-exercise equipment

Create `docs/migrations/2026-06-04-exercise-equipment-correction.sql`. Idempotent UPDATEs over `user_id IS NULL` exercises, replacing the leaky default with an explicit equipment array per exercise. Strategy: assign each global exercise its minimal real requirement, choosing the variant a home dumbbell+bench lifter can actually perform where one exists.

Classification (full list lives in the migration; rules below):

- **dumbbells**: Dumbbell-prefixed curls/raises/extensions/kickbacks, Lateral Raise, Rear Delt Fly, Arnold Press, Front Raise, Upright Row, Chest Fly, Concentration Curl, Tricep Kickback.
- **dumbbells + bench**: Dumbbell Bench Press, Incline Dumbbell Press / Incline Dumbbell Curl, Dumbbell Bulgarian Split Squat (rear foot on bench), Dumbbell Leg Curl (Lying), Chest-Supported Row, Skull Crusher, Spider Curl, Hip Thrust, Dumbbell Romanian Deadlift uses no bench (dumbbells only).
- **bench** (no dumbbells strictly required, but uses the bench): Step-Up (box/bench).
- **barbell**: Deadlift, Sumo Deadlift, Romanian Deadlift (generic), Close-Grip Bench Press, Incline Barbell Press, Decline Bench Press, Rack Pull, EZ-Bar Curl, JM Press, Barbell-prefixed lifts (already tagged, re-assert).
- **machines**: Leg Press, Leg Extension, Leg Curl, Hack Squat, Lat Pulldown, T-Bar Row, Pec Deck, Abduction Machine, Seated Calf Raise, Leg Press Calf Raise, Machine/Smith-prefixed (re-assert).
- **cables**: Cable-prefixed, Tricep Pushdown, Single-Arm Tricep Pushdown, Face Pull, Straight-Arm Pulldown, Seated Cable Row, Cable Kickback, Cable Crunch.
- **pull_up_bar**: Pull-Up, Chin-Up, Hanging Leg Raise.
- **bodyweight (empty array, intentional)**: Push-Up, Dips (bench dips), Glute Bridge, Walking Lunge, Standing Calf Raise, Single-Leg Calf Raise, Donkey Calf Raise, Plank, Crunch, Reverse Crunch, Sit-Up, Russian Twist, Mountain Climber, Ab Wheel Rollout.

The migration ends with a verification SELECT that should return zero rows where a known barbell/machine/bar exercise still has an empty `equipment`.

> The user applies this migration manually in the Supabase SQL Editor (no automated runner).

### A3. Seed the dumbbell + bodyweight pool to support variation

With equipment correct, the dumbbell+bench pool must be deep enough that emphasis-based variation does not immediately re-collapse. Audit per movement pattern and add any missing dumbbell/bodyweight exercises so each pattern a generator slot can request has **at least two** dumbbell-or-bodyweight options. Candidates to add if absent (global, `user_id IS NULL`, with category + equipment + movement_pattern + is_compound set directly in the same migration):

- vertical_push: Arnold Press (dumbbells) — already present; ensure tagged.
- horizontal_pull: Chest-Supported Row, Dumbbell Bent-Over Row — ensure present + dumbbell-tagged.
- hinge: Dumbbell Romanian Deadlift, Single-Leg Romanian Deadlift (add if missing, bodyweight/dumbbells).
- lunge: Reverse Lunge (add if missing, bodyweight/dumbbells), Dumbbell Bulgarian Split Squat, Walking Lunge.
- glute_iso: Glute Bridge, Dumbbell Hip Thrust.
- squat: Dumbbell Goblet Squat, Dumbbell Sumo Squat.
- chest_iso: Chest Fly (dumbbells).

The exact add-list is finalized during implementation by querying what already exists; the rule is: no generator slot reachable for a dumbbells+bench user may have fewer than two usable options unless that is genuinely true of the movement.

---

## Part B — Generator redesign

All changes in `src/lib/pulse/generation.ts`, exercised by pure-function tests. `generateAndSaveRoutine` in `actions.ts` changes only to (a) request `name` in the pool select if needed and (b) insert `superset_group_id`.

### B1. Session emphasis profiles

Define an emphasis per session. Repeated focuses get *different* emphases, in order.

```ts
type Bias = 'strength' | 'hypertrophy' | 'balanced';
interface Emphasis {
  bias: Bias;
  // Ordered preferred movement patterns; the slot filler walks this list.
  slots: MovementPattern[];
}
```

Assignment by split (sequence consumed in schedule-day order):

- **full_body**: `[strengthFB, hypertrophyFB, balancedFB]` cycled.
  - strengthFB.slots: `hinge, squat, horizontal_push, horizontal_pull, vertical_push, biceps_iso, core`
  - hypertrophyFB.slots: `lunge, hinge, horizontal_push, horizontal_pull, shoulder_iso, triceps_iso, biceps_iso`
  - balancedFB.slots: `squat, hinge, vertical_push, horizontal_pull, horizontal_push, shoulder_iso, core`
- **upper / lower** (4-day) — focus repeats twice, emphases differ:
  - upper[0] (chest/back): `horizontal_push, horizontal_pull, vertical_push, chest_iso, back_iso, biceps_iso`
  - upper[1] (shoulders/arms): `vertical_push, horizontal_pull, shoulder_iso, biceps_iso, triceps_iso, chest_iso`
  - lower[0] (quad): `squat, lunge, hinge, glute_iso, calf, core`
  - lower[1] (posterior): `hinge, glute_iso, lunge, squat, calf, core`
- **push / pull / legs**: keep the current `FOCUS_SLOTS` order; bias rotates `strength, hypertrophy, balanced` across the week so a focus repeated in a long split still shifts rep style.

`selectSplit` is unchanged; a new `emphasisFor(focus, occurrence, splitKind)` returns the `Emphasis` for the n-th occurrence of a focus.

### B2. Time-scaled slot count

Keep `volumeFor` (30→4, 45-60→6, 90+→8 for intermediate). The slot list per emphasis is longer than the count; the filler takes the first `count` slots it can fill, then backfills from the remaining slots.

### B3. Selection with a cross-session avoid-set

Replace `selectForSession`'s rotation argument with a mutable `used: Set<string>` carried across all sessions of the routine.

For each slot in emphasis order (until `count` reached):
1. `candidates = usable exercises matching the pattern`, sorted by id (stable).
2. Prefer candidates **not in `used`**; if all are used, fall back to the least-recently-used (any candidate) — repetition is allowed only when the pattern is genuinely exhausted across the week.
3. Never pick an exercise already chosen **in this session** (existing within-session dedup).
4. Push the choice, add to `used`.

Backfill loop (to reach `count`) walks the same emphasis slots again with the same avoid logic. This guarantees the two Upper days differ wherever the pool has ≥2 options for a pattern, and key compounds recur only when unavoidable.

`used` resets per routine (not per session), so a compound like Dumbbell Romanian Deadlift can still appear in two sessions if the hinge pool is thin, but accessories rotate first.

### B4. Rep ranges by bias and lift type

Replace flat `repRangeFor(goal)` with `repRange(bias, isCompound)`:

| bias | compound | isolation |
|------|----------|-----------|
| strength | `6-10` | `10-15` |
| hypertrophy | `8-12` | `12-15` |
| balanced | `8-12` | `10-15` |

`goal === 'lose_fat'` shifts both columns up one notch (compound→`8-12`/`10-15`, isolation→`12-20`) to bias toward density. `is_compound` comes from the exercise pool (already selected in the query). Lateral/calf isolation may use `12-20`; acceptable to keep the table simple and not special-case names.

Sets stay modest: `3` per exercise, `4` for the **first compound** of a strength-bias session.

### B5. Auto-supersets for 30-min sessions

When `sessionTime === '~30 min'`, pair the session's exercises into supersets so the work fits the time budget.

- Pairing rule: walk the ordered selection and greedily pair antagonist patterns (push↔pull, squat/lunge↔hinge/glute). Concretely, pair index 0 with the first later exercise of an antagonist family; repeat. Any leftover (odd count, or no antagonist) stays a solo finisher.
- Each pair gets a fresh `superset_group_id` (UUID generated server-side in the action via `crypto.randomUUID()`), and the two members must have **adjacent `order`** (the API invariant). The generator therefore assigns `order` so paired members are consecutive.
- `RoutineBlueprint.exercises[]` gains `superset_group_id: string | null`. `generateAndSaveRoutine` inserts it (replacing the hardcoded omission). 45-60 and 90+ sessions emit straight sets (`superset_group_id: null`).

### B6. Multi-session variant model (replaces the A/B-only assumption)

The current model represents at most two sessions per `workout_type` (variant A/B) and does **not** pin a schedule day to a variant, so multi-session full-body styles cannot be represented. Generalize:

- **`WorkoutVariant` widens from `'A' | 'B'` to `'A' | 'B' | 'C' | 'D'`** (`src/lib/pulse/types.ts`). `TabKey` already interpolates the variant; the tab list in `WorkoutTabs` and `orderTabKeys` already sort `type:X` keys by string, so `C`/`D` order correctly with no logic change. `tabKeyLabel` (`constants.ts`) formats the suffix; verify it handles C/D (it likely just appends the letter). Grep for any hardcoded `'A'`/`'B'` comparisons.
- **`routine_schedule` gains a `variant` column** (`WorkoutVariant | null`), pinning each day to its session. Migration `docs/migrations/2026-06-04-schedule-variant.sql` (new): `ALTER TABLE routine_schedule ADD COLUMN variant TEXT DEFAULT NULL`. `ScheduleEntry` gains `variant`. The protected-layout loader and `/api/pulse/routines` select already pull `*` or explicit columns — add `variant` to the schedule select if columns are listed.
- **Day selection pins the variant.** When the train screen resolves the active day (`PulseProvider` effect that sets `activeTab` from the day's `workout_type`), it now sets the full `TabKey` (`type` or `type:variant`) from the schedule entry's `variant`. So Monday = Upper A jumps straight to the Upper·A tab; the user no longer toggles manually.
- **Generation emits the pin.** `generateAndSaveRoutine` writes `variant` on each `routine_schedule` row from the blueprint's per-day variant.

This also resolves the original "two Upper days look identical" complaint at the UX layer: the days are now explicitly labeled and pinned (Upper A vs Upper B).

---

---

## Part C — Program styles & picker

The user wants "a couple of different variations" of routine. A **program style** is a named structure: a fixed sequence of `(focus, emphasisKey)` per scheduled day, plus a per-day `variant` so multi-session styles map onto the model in Part B6. The selection engine (equipment filter, slots, avoid-set, rep ranges, supersets) is shared across all styles.

### C1. Data model

```ts
interface ProgramStyle {
  key: string;          // 'ul-classic'
  name: string;         // 'Classic Upper / Lower'
  bestFor: string;      // one-line description for the picker
  sessions: Array<{ focus: Focus; emphasis: EmphasisKey; variant: WorkoutVariant | null }>;
}
```

`EmphasisKey` indexes the emphasis library from B1 (each → `{ bias, slots }`). `sessions.length` equals the session count. `variant` is assigned so each distinct session of the same `focus` gets a unique letter (e.g. two Upper days → A, B; three Full-Body days → A, B, C); a focus that appears once gets `null`.

### C2. Catalog (keyed by session count = `trainingDays.length`)

The research phase finalizes the exact `emphasis`/`slots` per session; the structures are:

- **3-day:** Full Body (FB strength/hyper/balanced) · Full Body — Emphasis Days (chest-back / legs / shoulders-arms) · Push/Pull/Legs · Upper/Lower/Full Body.
- **4-day:** Classic Upper/Lower (UA chest-back, LA quad, UB delts-arms, LB posterior) · Aesthetic Upper/Lower (both upper days upper-priority with more isolation, leaner lower) · Push/Pull/Legs + Full Body · Full Body (Heavy/Medium/Heavy/Pump — adds a `pump` bias, reps 12-20).
- **5-day:** Upper/Lower/Push/Pull/Legs · Push/Pull/Legs/Upper/Lower · Full Body + Upper/Lower hybrid.
- **2-day / 6-day:** single default each (2 → Full Body A/B; 6 → PPL twice). No picker shown when only one style exists for the count.

The **bro split is intentionally excluded** (the reference itself does not recommend it; low frequency).

`Bias` widens to `'strength' | 'hypertrophy' | 'balanced' | 'pump'`. `pump` → compound `12-15`, isolation `15-20`.

### C3. Recommended style

A `recommendStyle(sessionCount, goal, experience)` returns the default-selected style key (first/⭐ option per count: 3 → Full Body, 4 → Classic Upper/Lower, 5 → Upper/Lower/Push/Pull/Legs). The picker pre-selects it.

### C4. Setup flow picker

`RoutineSetupFlow.tsx` gains a step after day selection (so `sessionCount` is known): a list of styles available for the count, each showing `name` + `bestFor`, single-select, pre-selecting the recommendation. The chosen `styleKey` is passed to `onComplete` → `generateAndSaveRoutine`. Hidden when the count has one style.

### C5. Generator wiring

`generateRoutine` takes the resolved `ProgramStyle` (the action looks it up by key from a `STYLES` catalog in `generation.ts`). It iterates `style.sessions`, mapping `trainingDays[i]` → `{ focus, emphasis, variant }`, fills slots via the shared engine, and emits both `routine_exercises` (with `variant`, `superset_group_id`) and `routine_schedule` (with the pinned `variant`). `selectSplit` is removed (styles supersede it). `generateAndSaveRoutine` signature gains `styleKey: string`.

## Testing

Pure-function tests in `src/lib/pulse/__tests__/generation.test.ts` (extend existing):

1. **Equipment filter**: given a dumbbells+bench equipment set and a pool containing barbell/machine/bar exercises, generated routine contains none of them.
2. **Distinct same-focus days**: 4-day upper/lower with a pool that has ≥2 options per pattern → Upper·A and Upper·B share no exercise; Lower·A and Lower·B share no exercise.
3. **No within-session duplicates**: every session's exercise ids are unique.
4. **Thin-pool fallback**: a pattern with one option → that exercise may appear in both days, but no session lists it twice; assert no crash and count is respected.
5. **Time scaling**: 30-min → 4 exercises/session; 45-60 → 6.
6. **Supersets**: 30-min session → exercises are paired with shared `superset_group_id`, exactly 2 per group, adjacent order; 45-60 → all `superset_group_id` null.
7. **Rep ranges**: strength-bias compound → `6-10`; hypertrophy isolation → `12-15`; `lose_fat` shifts up; `pump` bias → `12-20`.
8. **Styles**: each catalog style for a given count produces `sessions.length` schedule days; same-focus sessions get distinct `variant` letters (A,B,C…); `recommendStyle` returns the ⭐ default.
9. **Schedule variant pin**: generated `routine_schedule` rows carry the per-day `variant` matching their session.

Existing tests touching `selectForSession`/`generateRoutine`/`selectSplit` signatures are updated to the new `used`-set / emphasis / style API. Provider + WorkoutTabs tests updated for A-D variants and schedule `variant`.

## Migration / rollout

1. Apply `2026-06-04-exercise-equipment-correction.sql` (equipment) and `2026-06-04-schedule-variant.sql` (schedule.variant) in Supabase (user-run).
2. Ship code (Parts A, B, C). Existing generated routines are not migrated; users regenerate via the setup flow to get the improved output.

## Files touched

- `docs/migrations/2026-06-04-exercise-equipment-correction.sql` (new)
- `docs/migrations/2026-06-04-schedule-variant.sql` (new — `routine_schedule.variant`)
- `src/lib/pulse/types.ts` (EQUIPMENT_KEYS + `pull_up_bar`; `WorkoutVariant` A-D; `ScheduleEntry.variant`; `RoutineBlueprint` gains `superset_group_id` + per-day variant; `ProgramStyle`/`EmphasisKey`/`Bias` types)
- `src/lib/pulse/constants.ts` (`tabKeyLabel` handles C/D)
- `src/lib/pulse/recommendation.ts` (`getEquipmentTier` ignores `pull_up_bar`)
- `src/components/pulse/RoutineSetupFlow.tsx` (equipment option + style-picker step)
- `src/components/pulse/PulseProvider.tsx` (day-select pins full TabKey from schedule `variant`)
- `src/lib/pulse/generation.ts` (emphasis library, STYLES catalog, `emphasisFor`/`recommendStyle`, avoid-set selection, rep ranges, supersets; remove `selectSplit`)
- `src/app/pulse/actions.ts` (`generateAndSaveRoutine` gains `styleKey`; inserts `superset_group_id` + schedule `variant`)
- `src/app/pulse/(protected)/layout.tsx` + `src/app/api/pulse/routines/route.ts` / `queries.ts` (add `variant` to schedule select if columns are explicit)
- `src/lib/pulse/__tests__/generation.test.ts` + provider/tabs tests (updated)
- `CLAUDE.md` (generation + A/B→A-D + schedule.variant notes)
