# Gender-aware routine generation via a persistent muscle priority

Date: 2026-06-05
Status: approved (design)

## Problem

Gender currently has exactly one effect on routine generation: `recommendStyle(count, gender)`
nudges the *default* program style for women toward a lower/glute-leaning split (4-day →
`ul-aesthetic-4`, 3-day → `fb-emphasis-3`). Once a style is chosen, gender no longer touches
volume, emphasis, exercise selection, or rep ranges. The roadmap always intended that bias to
become an explicit, user-driven priority (the planned "Muscle priority" item).

## Approach (approved)

Introduce a **persistent per-muscle priority** that the user controls, with gender only seeding
its default. The priority is the real personalization lever; it tilts emphasis and volume within
whatever split the user trains. This retires the female-only `recommendStyle` hack and delivers
the planned Muscle-priority feature in one pass.

Rep ranges stay goal-driven and are NOT changed by gender or priority (avoids pseudo-science).

## Data model

- New nullable column `priority_muscle` on `profiles`.
  - Values: `glutes | legs | chest | back | shoulders | arms | balanced`, plus `null`.
  - `null` = never chosen → the generation picker seeds its initial value from gender.
  - `balanced` = explicit "no priority". After the user has gone through the flow once, their
    stored choice (including `balanced`) is authoritative and gender never overrides it again.
- New type `PriorityMuscle = 'glutes' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms'`.
  `arms` expands to `biceps` + `triceps` wherever muscles/categories are enumerated.
- `Profile` gains `priority_muscle: PriorityMuscle | 'balanced' | null`.

## Generation mechanics

A pure helper maps a priority to the movement patterns it should boost:

| priority   | patterns boosted                       |
|------------|----------------------------------------|
| glutes     | `glute_iso`, `hinge`                   |
| legs       | `squat`, `lunge`                       |
| chest      | `horizontal_push`, `chest_iso`         |
| back       | `horizontal_pull`, `back_iso`          |
| shoulders  | `vertical_push`, `shoulder_iso`        |
| arms       | `biceps_iso`, `triceps_iso`            |

The generator (`generation.ts`) uses the resolved priority to:

1. **Emphasis tilt** — when a priority is set, prefer the emphasis whose slot list already includes
   the boosted patterns (e.g. glutes → `lower_post`). This is a selection bias among existing
   emphases, not a new emphasis library.
2. **Slot injection** — guarantee at least one isolation slot for the prioritized muscle in the
   session(s) that train it. If the session-time slot budget allows an extra slot, add one;
   otherwise swap the lowest-priority existing slot. Never exceed the existing per-session-time
   slot count.
3. **Volume target tilt** — bump the prioritized muscle's weekly set target in `VOLUME_TARGETS`
   (the table the Progress recovery/volume nudges already consume) so the dashboard stays
   coherent with the generated routine. Implemented as a pure `priorityAdjustedTargets(base,
   priority)` so the Progress side can apply the same tilt.

`recommendStyle` loses its `gender` parameter/branch — the default split becomes gender-agnostic;
the priority does the personalization.

## Gender seeding

- `genderDefault(gender): PriorityMuscle | 'balanced'` — `female → 'glutes'`, otherwise `'balanced'`.
- Used only to seed the picker's initial value when `profile.priority_muscle` is `null`.

## UI

- **RoutineSetupFlow** gains a "Priority" step: the 6 muscles + Balanced, pre-selected from
  `profile.priority_muscle ?? genderDefault(profile.gender)`. On completion it persists the choice
  to the profile (via `updatePriorityMuscle`) and passes the resolved priority into generation.
- **ProfileView** gains a "Training priority" setting (same control idiom as Gender/Units) to view
  and change it any time. Clearing it sets `balanced`.

## Plumbing (mirrors `gender` / `length_unit`)

- Dated migration adding `priority_muscle text check (... in (...))`, nullable.
- `types.ts` — `PriorityMuscle` + `Profile.priority_muscle`.
- `queries.ts` — add to `PROFILE_SELECT` + map in `loadProfile`.
- `actions/profile.ts` — `updatePriorityMuscle(value)` with validation + `revalidatePath`.
- `useProfile.ts` — default `priority_muscle: null`, optimistic `updatePriorityMuscle`.
- `PulseContext` + `PulseProvider` — expose `updatePriorityMuscle`.
- `api/pulse/profile/route.ts` — default `priority_muscle: null`.

## Testing

Pure-function unit tests in `generation`/`utils`:
- `genderDefault` mapping.
- priority → patterns mapping (incl. `arms` → biceps/triceps).
- emphasis selection prefers a priority-matching emphasis when one exists, else falls back.
- slot injection adds/swaps within the session-time budget, never exceeding it, and is a no-op
  when the priority's pattern is already present.
- `priorityAdjustedTargets` bumps only the prioritized muscle (arms → both biceps and triceps),
  leaves others unchanged, and is identity for `balanced`/`null`.
- Plumbing reuses the established `gender`/`length_unit` test patterns (profile mapping, optimistic
  hook update, query select string).

## Out of scope (separate sub-projects, already agreed)

- #2 Template library revision (templates may later carry priority/emphasis metadata).
- #3 Templates-tab filters (goal / experience / days-per-week / gender-fit).
