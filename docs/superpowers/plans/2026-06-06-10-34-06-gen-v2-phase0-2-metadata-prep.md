# Phase 0 #2 — exercise metadata: prep + a blocking `movement_pattern` finding (2026-06-06)

**Status:** prep only (autonomous). No code/migration committed — this doc gathers the architecture so the ChatGPT science step and the seed are one paste away, and surfaces a prerequisite data fix that needs your sign-off. The six new fields are research values, which is your ChatGPT-validation lane, not something I should invent.

---

## 0. BLOCKING FINDING — the seeded `movement_pattern`s are partly wrong (fix before #2)

The design doc froze the assumption "every Pulse exercise already has a correct, seeded `movement_pattern`, so don't let ChatGPT re-derive them." That assumption is **false for ~12 exercises.** The `2026-06-03` metadata seed tagged patterns with blunt `ILIKE` keyword rules, last-write-wins, so several rows are mis-tagged. Because the muscleMap bridge (Phase 0 #1) and all of generation key off `movement_pattern`, this is bad input that silently corrupts everything downstream (e.g. `Machine Chest Press` is tagged `vertical_pull`, which the bridge attributes to **back/biceps**, not chest).

**So: correct `movement_pattern` first (a small correction migration like the `2026-06-04` equipment one), then run the metadata seed.** Feeding the current wrong patterns to ChatGPT would propagate the error into secondary-muscle attribution.

### Clean corrections (high-confidence, the right pattern exists in Pulse's 15)

| Exercise | category | current pattern / is_compound | proposed |
|---|---|---|---|
| Machine Chest Press | chest | `vertical_pull` / true | `horizontal_push` / true |
| Smith Machine Bench Press | chest | `vertical_pull` / true | `horizontal_push` / true |
| Machine Shoulder Press | shoulders | `vertical_pull` / true | `vertical_push` / true |
| Smith Machine Calf Raise | calves | `vertical_pull` / true | `calf` / false |
| Abduction Machine | glutes | `vertical_pull` / true | `glute_iso` / false |
| Incline Barbell Press | chest | `chest_iso` / false | `horizontal_push` / true |
| Incline Dumbbell Press | chest | `chest_iso` / false | `horizontal_push` / true |
| Push-Up | chest | `chest_iso` / false | `horizontal_push` / true |
| Dumbbell Reverse Fly | back | `chest_iso` / false | `shoulder_iso` / false |

### Needs your call (Pulse's 15 patterns have no clean fit — a vocabulary gap)

| Exercise | current | the problem |
|---|---|---|
| Leg Curl | `squat` / true | knee-flexion hamstring isolation; no ham-iso pattern. `hinge` would over-credit glutes/back; `squat` over-credits quads/calves. Either accept imprecision, or this is the case that argues for the deferred quad/ham taxonomy split. |
| Leg Extension | `squat` / true | knee-extension quad isolation; same gap (no quad-iso pattern). |
| Rack Pull | `back_iso` / false | a partial deadlift; `hinge`/true is the closest of the 15 but `hinge` credits legs 0.5 / glutes 0.4, wrong for a back-dominant pull. |

Proposed correction SQL for the clean set (review before applying; this is data that drives generation):

```sql
-- movement_pattern + is_compound corrections for ILIKE-seed mis-tags
update exercises set movement_pattern = 'horizontal_push', is_compound = true
  where user_id is null and name in ('Machine Chest Press','Smith Machine Bench Press','Incline Barbell Press','Incline Dumbbell Press','Push-Up');
update exercises set movement_pattern = 'vertical_push' where user_id is null and name = 'Machine Shoulder Press';
update exercises set movement_pattern = 'calf', is_compound = false where user_id is null and name = 'Smith Machine Calf Raise';
update exercises set movement_pattern = 'glute_iso', is_compound = false where user_id is null and name = 'Abduction Machine';
update exercises set movement_pattern = 'shoulder_iso' where user_id is null and name = 'Dumbbell Reverse Fly';
```

(The three judgment cases are intentionally excluded pending your decision.)

This finding also means the muscleMap bridge (Phase 0 #1) is correct as a map but only as accurate as the patterns it reads — another reason to land the correction before wiring volume or generation to it.

---

## 1. The six new fields + proposed schema

All six are genuinely new (verified: `category`, `movement_pattern`, `is_compound`, `equipment`, `user_id` already exist on `exercises`; none of the six do). `primary` collapses to the existing `category`.

| field | type | allowed values |
|---|---|---|
| `secondary_muscles` | `text[]` | zero or more of the 10 categories: chest, shoulders, triceps, back, biceps, legs, glutes, calves, abs, other |
| `unilateral` | `boolean` | — |
| `fatigue` | `smallint` | 1-5 |
| `joint_stress` | `text` | low / med / high |
| `difficulty` | `text` | beginner / intermediate / advanced |
| `substitution_class` | `text` | a class key from §3 below |

Proposed DDL (nullable so user-created exercises are unaffected; globals get seeded):

```sql
alter table exercises
  add column secondary_muscles text[] not null default '{}',
  add column unilateral boolean not null default false,
  add column fatigue smallint check (fatigue between 1 and 5),
  add column joint_stress text check (joint_stress in ('low','med','high')),
  add column difficulty text check (difficulty in ('beginner','intermediate','advanced')),
  add column substitution_class text;
```

**Open decision:** store `secondary_muscles` as a plain category array (above, simplest, matches the draft) or as a weighted `jsonb` (`{"triceps":0.3}`) for finer volume attribution later. The muscleMap already gives pattern-level weights; per-exercise weighting is probably over-engineering for v1 — recommend the plain array, revisit if volume-first generation needs it.

## 2. Reconciliation: ChatGPT outputs the 10 categories directly

To avoid a mapping step and the draft's vocabulary drift, the prompt makes ChatGPT emit `secondary_muscles` already in Pulse's 10 categories. For reference, the collapse it must apply: upper_chest→chest; front/rear delts→shoulders; lats/mid_back/traps/lower_back→back; forearms/grip→biceps; quads/hamstrings/adductors/hip_flexors→legs; obliques→abs; stabilizers→other.

## 3. Substitution-equivalence classes (from the design doc §10)

`horizontal_press, vertical_press, lateral_raise, vertical_pull, horizontal_pull, squat_pattern, hinge_pattern, unilateral_leg, glute_pattern, core_stability, core_flexion, biceps_isolation, triceps_isolation, rear_delt_isolation`. A swap should stay within its class.

## 4. The ChatGPT prompt (run AFTER the pattern corrections)

> You are tagging strength exercises with metadata. I will give you a list of exercises, each with its fixed `movement_pattern`, `category`, and `is_compound` (these are correct and FROZEN — do not change or re-derive them). For each exercise, return ONLY these six fields as JSON, keyed by the exact exercise name:
> - `secondary_muscles`: array of 0-3 muscles, each STRICTLY one of: chest, shoulders, triceps, back, biceps, legs, glutes, calves, abs, other. Exclude the primary (its `category`). Use these exact tokens, no others.
> - `unilateral`: boolean (one limb at a time).
> - `fatigue`: integer 1-5 (systemic + local fatigue cost; a heavy deadlift is 5, a cable curl is 2).
> - `joint_stress`: "low" | "med" | "high".
> - `difficulty`: "beginner" | "intermediate" | "advanced" (technical skill to perform safely).
> - `substitution_class`: one of [horizontal_press, vertical_press, lateral_raise, vertical_pull, horizontal_pull, squat_pattern, hinge_pattern, unilateral_leg, glute_pattern, core_stability, core_flexion, biceps_isolation, triceps_isolation, rear_delt_isolation], or null if none fits.
> Output a single JSON object: `{ "<exact name>": { secondary_muscles, unilateral, fatigue, joint_stress, difficulty, substitution_class }, ... }`. No prose.
>
> Exercises: (paste the list from §5)

## 5. The canonical 94-exercise input (corrected patterns assumed)

Authoritative source is the live DB: `select name, category, movement_pattern, is_compound from exercises where user_id is null order by category, name;`. The current seeded list (apply the §0 corrections first so the patterns below are right for the flagged rows):

```
Ab Wheel Rollout | abs | core | false
Abduction Machine | glutes | glute_iso | false
Arnold Press | shoulders | shoulder_iso | false
Barbell Bench Press | chest | horizontal_push | true
Barbell Curl | biceps | biceps_iso | false
Barbell Overhead Press | shoulders | vertical_push | true
Barbell Row | back | horizontal_pull | true
Barbell Squat | legs | squat | true
Cable Crunch | abs | core | false
Cable Curl | biceps | biceps_iso | false
Cable Fly | chest | chest_iso | false
Cable Kickback | glutes | glute_iso | false
Cable Overhead Tricep Extension | triceps | triceps_iso | false
Chest Fly | chest | chest_iso | false
Chest-Supported Row | back | horizontal_pull | true
Chin-Up | back | vertical_pull | true
Close-Grip Bench Press | triceps | horizontal_push | true
Concentration Curl | biceps | biceps_iso | false
Crunch | abs | core | false
Deadlift | back | hinge | true
Decline Bench Press | chest | horizontal_push | true
Decline Dumbbell Press | chest | horizontal_push | true
Diamond / Close-Grip Push-Up | triceps | triceps_iso | false
Dips | triceps | triceps_iso | false
Donkey Calf Raise | calves | calf | false
Dumbbell Bench Press | chest | horizontal_push | true
Dumbbell Bent-Over Row | back | horizontal_pull | true
Dumbbell Bicep Curl | biceps | biceps_iso | false
Dumbbell Bulgarian Split Squat | glutes | lunge | true
Dumbbell Calf Raise | calves | calf | false
Dumbbell Curl | biceps | biceps_iso | false
Dumbbell Face Pull (Bent-Over) | back | shoulder_iso | false
Dumbbell Goblet Squat | legs | squat | true
Dumbbell Hammer Curl | biceps | biceps_iso | false
Dumbbell Lateral Raise | shoulders | shoulder_iso | false
Dumbbell Leg Curl (Lying) | legs | hinge | false
Dumbbell Overhead Press | shoulders | vertical_push | true
Dumbbell Pullover | back | back_iso | false
Dumbbell Push Press | shoulders | vertical_push | true
Dumbbell Reverse Fly | back | shoulder_iso | false
Dumbbell Romanian Deadlift | legs | hinge | true
Dumbbell Shrug | back | back_iso | false
Dumbbell Single-Arm Row | back | horizontal_pull | true
Dumbbell Sumo Squat | legs | squat | true
Dumbbell Tricep Overhead Extension | triceps | triceps_iso | false
EZ-Bar Curl | biceps | biceps_iso | false
Face Pull | back | shoulder_iso | false
Front Raise | shoulders | shoulder_iso | false
Glute Bridge | glutes | glute_iso | false
Hack Squat | legs | squat | true
Hanging Leg Raise | abs | core | false
Hip Thrust | glutes | hinge | true
Incline Barbell Press | chest | horizontal_push | true
Incline Dumbbell Curl | biceps | biceps_iso | false
Incline Dumbbell Press | chest | horizontal_push | true
JM Press | triceps | triceps_iso | false
Lat Pulldown | back | vertical_pull | true
Lateral Raise | shoulders | shoulder_iso | false
Leg Curl | legs | squat | true  (FLAGGED §0 — vocab gap)
Leg Extension | legs | squat | true  (FLAGGED §0 — vocab gap)
Leg Press | legs | squat | true
Leg Press Calf Raise | calves | calf | false
Machine Chest Press | chest | horizontal_push | true
Machine Shoulder Press | shoulders | vertical_push | true
Mountain Climber | abs | core | false
Pec Deck | chest | chest_iso | false
Plank | abs | core | false
Preacher Curl | biceps | biceps_iso | false
Pull-Up | back | vertical_pull | true
Push-Up | chest | horizontal_push | true
Rack Pull | back | back_iso | false  (FLAGGED §0 — hinge?)
Rear Delt Fly | back | shoulder_iso | false
Reverse Crunch | abs | core | false
Romanian Deadlift | legs | hinge | true
Russian Twist | abs | core | false
Seated Cable Row | back | horizontal_pull | true
Seated Calf Raise | calves | calf | false
Single-Arm Tricep Pushdown | triceps | triceps_iso | false
Single-Leg Calf Raise | calves | calf | false
Single-Leg Glute Bridge | glutes | glute_iso | false
Sit-Up | abs | core | false
Skull Crusher | triceps | triceps_iso | false
Smith Machine Bench Press | chest | horizontal_push | true
Smith Machine Calf Raise | calves | calf | false
Spider Curl | biceps | biceps_iso | false
Standing Calf Raise | calves | calf | false
Step-Up | glutes | lunge | true
Straight-Arm Pulldown | back | vertical_pull | true
Sumo Deadlift | glutes | hinge | true
T-Bar Row | back | horizontal_pull | true
Tricep Kickback | triceps | triceps_iso | false
Tricep Pushdown | triceps | triceps_iso | false
Upright Row | shoulders | shoulder_iso | false
Walking Lunge | legs | lunge | true
```

## 6. Transform to seed migration

ChatGPT returns the JSON object. A small script (or hand-written) emits a dated seed migration: per exercise, `update exercises set secondary_muscles = '{...}', unilateral = ..., fatigue = ..., joint_stress = '...', difficulty = '...', substitution_class = '...' where user_id is null and name = '...';`. Verify every name matched exactly (94 rows updated) and re-run the muscleMap golden tests + typecheck.

## 7. Open decisions for you (when back)

1. Sign off the §0 clean `movement_pattern` corrections, and decide the three vocab-gap cases (Leg Curl / Leg Extension / Rack Pull) — accept imprecision in the 10/15 vocab, or let this argue for the deferred quad/ham taxonomy split.
2. `secondary_muscles` storage: plain category array (recommended) vs weighted jsonb.
3. Then: apply the pattern-correction migration, run the ChatGPT prompt, generate the seed, apply, retest.
