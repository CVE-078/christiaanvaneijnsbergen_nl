# Routine Templates + Onboarding — Design Spec

**Date:** 2026-05-26
**Branch:** feature/routine-templates (new, off main)

---

## Overview

New users currently land in an empty Library with no exercises or routines pre-loaded. This feature adds:

1. **Global routine templates** — seeded in the DB, browsable in the Library, cloneable into a user's own routine with one tap.
2. **Onboarding flow** — a 5-step modal that collects user context and recommends the best matching template. Auto-triggers on first visit with no routines; also accessible from Profile.

---

## 1. Database Schema

### 1.1 New tables

```sql
CREATE TABLE routine_templates (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                text NOT NULL,
  slug                text NOT NULL UNIQUE,          -- e.g. 'ppl-home', 'full-body-gym'
  required_equipment  text[] NOT NULL,               -- e.g. '{dumbbells}', '{dumbbells,barbell,bench}'
  days_per_week       text NOT NULL,                 -- e.g. '2-3', '4', '3-6'
  experience_level    text NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  session_time        text NOT NULL,                 -- e.g. '30-45 min', '45-60 min', '60-90 min'
  description         text NOT NULL
);

CREATE TABLE template_exercises (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id  uuid REFERENCES routine_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id  uuid REFERENCES exercises(id) NOT NULL,
  workout_type text NOT NULL CHECK (workout_type IN ('push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms')),
  "order"      integer NOT NULL,
  sets         text NOT NULL,
  reps         text NOT NULL
);
```

RLS: `routine_templates` and `template_exercises` are read-only for all authenticated users (no insert/update/delete policies for users). No `user_id` column — these are global.

### 1.2 `routine_exercises` — add `workout_type` column

This is an architectural change required to support templates whose sessions don't map to push/pull/legs (Bro Split, Arnold Split). Previously, workout_type was derived at runtime from `exercises.category`. It must now be stored explicitly so each routine can define its own tab structure.

```sql
ALTER TABLE routine_exercises
  ADD COLUMN workout_type text NOT NULL DEFAULT 'push'
    CHECK (workout_type IN ('push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms'));
```

The `DEFAULT 'push'` is only needed for the migration (to satisfy NOT NULL on existing rows). After migration, the application always supplies the value explicitly.

`addExerciseToRoutine` server action gains a `workoutType: WorkoutType` parameter. The `PulseProvider` computation of `routineExercisesByType` switches from category-lookup to a direct groupBy on `routine_exercises.workout_type`. `WorkoutTabs` renders tabs dynamically based on which workout types are present in the active routine (instead of hardcoded push/pull/legs).

### 1.3 Profiles change

```sql
ALTER TABLE profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
```

### 1.3 New global exercise seed (gym equipment)

Added to the existing `exercises` seeding block (`user_id = NULL`):

**Push — gym**
- Barbell Bench Press, Incline Barbell Press, Cable Lateral Raise, Barbell Overhead Press, Cable Tricep Pushdown, Chest Fly Machine

**Pull — gym**
- Barbell Row, Cable Row, Lat Pulldown, Face Pull (cable), Barbell Bicep Curl, Cable Hammer Curl

**Legs — gym**
- Barbell Squat, Leg Press, Barbell Romanian Deadlift, Leg Curl Machine, Leg Extension Machine, Calf Raise Machine

---

## 2. Templates

Thirteen templates seeded at migration time with stable explicit UUIDs. Three routine structures are added beyond the original 8: Push/Pull, Bro Split, Arnold Split.

**Skipped from the top-10 list:** PHUL and PHAT (require distinct power/hypertrophy day schemes not supported by the current tracking model), Body Part Specialization (too individual to template), Hybrid Strength + Cardio (includes non-gym activities the app doesn't track).

A "home" tier sits between dumbbell-only and full-gym.

**Equipment vocabulary** (used in `required_equipment` and the onboarding multi-select):

| Key | Label |
|---|---|
| `dumbbells` | Dumbbells |
| `barbell` | Barbell & plates |
| `bench` | Weight bench |
| `cables` | Cable machine |
| `machines` | Gym machines (leg press, lat pulldown, etc.) |

| Slug | Name | Required equipment | Days | Session | Experience | Description |
|---|---|---|---|---|---|---|
| `full-body-db` | Full Body — Dumbbells | `[dumbbells]` | 2–3 | 30–45 min | beginner | One session works everything. Great for building the habit. |
| `full-body-home` | Full Body — Home Gym | `[dumbbells, barbell, bench]` | 2–3 | 45–60 min | beginner | Full body with a barbell for heavier compound work. |
| `full-body-gym` | Full Body — Gym | `[barbell, bench, cables, machines]` | 2–3 | 45–60 min | beginner | Barbells, cables, and machines. Fastest beginner progress. |
| `upper-lower-home` | Upper/Lower — Home Gym | `[dumbbells, barbell, bench]` | 4 | 45–60 min | intermediate | Upper/lower split with barbell compounds at home. |
| `upper-lower-gym` | Upper/Lower — Gym | `[barbell, bench, cables, machines]` | 4 | 45–60 min | intermediate | Upper/lower split with full gym access. |
| `ppl-db` | PPL — Dumbbells | `[dumbbells, bench]` | 3–6 | 45–60 min | intermediate | Push, pull, legs. Run 3×/week or repeat for 6×/week. |
| `ppl-home` | PPL — Home Gym | `[dumbbells, barbell, bench]` | 3–6 | 60–90 min | intermediate | Classic PPL with a barbell. 3× or 6×/week. |
| `ppl-gym` | PPL — Gym | `[barbell, bench, cables, machines]` | 3–6 | 60–90 min | intermediate | Classic PPL with full gym access. 3× or 6×/week. |

**New templates:**

| Slug | Name | Required equipment | Days | Session | Experience | Description |
|---|---|---|---|---|---|---|
| `push-pull-db` | Push/Pull — Dumbbells | `[dumbbells, bench]` | 4 | 45–60 min | intermediate | Push and pull days, no dedicated legs session. |
| `push-pull-gym` | Push/Pull — Gym | `[barbell, bench, cables, machines]` | 4 | 45–60 min | intermediate | Push/pull with full gym. |
| `bro-split-gym` | Bro Split — Gym | `[barbell, bench, cables, machines]` | 5 | 60–90 min | intermediate | One muscle group per day: Chest / Back / Shoulders / Arms / Legs. |
| `arnold-split-gym` | Arnold Split — Gym | `[barbell, bench, cables, machines]` | 6 | 60–90 min | advanced | Arnold's classic: Chest+Back / Shoulders+Arms / Legs, repeated twice. |
| `arnold-split-home` | Arnold Split — Home Gym | `[dumbbells, barbell, bench]` | 6 | 60–90 min | advanced | Arnold split with home gym barbells. |

**Template matching:** a template is eligible when the user's selected equipment set is a superset of the template's `required_equipment`.

**Workout types per template structure:**

| Structure | Tab labels | Workout type values used |
|---|---|---|
| Full Body | Push / Pull / Legs | push, pull, legs |
| Upper/Lower | Push / Pull / Legs | push (upper), pull (upper), legs (lower) |
| PPL | Push / Pull / Legs | push, pull, legs |
| Push/Pull | Push / Pull | push, pull |
| Bro Split | Chest / Back / Shoulders / Arms / Legs | chest, back, shoulders, arms, legs |
| Arnold Split | Chest / Back / Shoulders / Arms / Legs | chest, back, shoulders, arms, legs |

`WorkoutTabs` renders tabs dynamically based on which workout_type values are present in the active routine's exercises — not hardcoded to push/pull/legs.

---

## 3. Clone Action

### `cloneTemplate(templateSlug: string): Promise<WorkoutRoutine>`

Server action. Called when user taps "Use this" on a template card (after confirmation) or "Start with this routine" in onboarding.

Steps:
1. Fetch `routine_templates` row by slug + all `template_exercises` joined with `exercises`.
2. Insert new `workout_routines` row for the user (name = template name).
3. Insert `routine_exercises` rows for each template exercise (maps `template_exercises.exercise_id`, `sets`, `reps`, `order`; `starting_weight_kg = null`).
4. Call `setActiveRoutine(newRoutineId)` — sets `profiles.active_routine_id`.
5. Return the new `WorkoutRoutine`.

`cloneTemplate` does **not** set `onboarding_completed`. That is the onboarding modal's responsibility, kept separate so Library "Use this" does not mark onboarding as done.

Validation: slug must exist in `routine_templates`. User must be authenticated.

### `completeOnboarding(): Promise<void>`

Separate server action. Sets `profiles.onboarding_completed = true` for the current user. Called by the onboarding modal after `cloneTemplate` succeeds.

---

## 4. Library — Templates Tab

The Library view already has a tab structure (Exercises / Routines). A third tab **Templates** is added.

### Templates tab layout

- **Equipment filter pills** at the top: All / Dumbbells / Home Gym / Full Gym. Default: All. "Home Gym" matches templates that require `[dumbbells, barbell, bench]`; "Full Gym" matches templates that require cables or machines.
- **Template cards** — one per matching template, sorted by experience level (beginner first).

### Template card

```
┌─────────────────────────────────────────────┐
│ Full Body — Dumbbells          [Use this]   │
│ 🌱 Beginner  · 2–3×/week · 30–45 min       │
│ · 🏠 Dumbbells                              │
│                                             │
│ One session works everything. Great for     │
│ building the habit and learning the         │
│ movements.                                  │
└─────────────────────────────────────────────┘
```

Fields: name, level badge (colour-coded: green=beginner, amber=intermediate, red=advanced), metadata tags (days, equipment), description.

**"Use this" button behaviour:**
- If user has no active routine: clone immediately, set active, navigate to Log view.
- If user has an active routine: show `window.confirm("This will replace your current active routine. Continue?")`. On confirm: clone + activate.

---

## 5. Onboarding Flow

### Trigger conditions

- **Auto:** User opens `/pulse` and `profiles.onboarding_completed = false` AND user has no routines (`routines.length === 0`). The modal appears over the Log view.
- **Manual:** "Retake quiz" button in Profile view. Always opens the modal regardless of `onboarding_completed`.

### Modal structure

Full-screen overlay (`position: fixed, inset: 0`) with the step content centred. Not dismissible by tapping outside — user must either complete all steps or click a "Skip" link on the first step only.

**Skip behaviour:** Visible on Step 1 only. Tapping "Skip" closes the modal without cloning a routine and without setting `onboarding_completed`. The auto-trigger condition (`onboarding_completed = false` AND no routines) means the modal will appear again next time the user opens the app. Once the user has at least one routine (created manually or via Library "Use this"), the auto-trigger condition no longer fires regardless of `onboarding_completed`.

### 5 steps

**Step 1 — Equipment** (multi-select checkboxes — select all that apply)
- Dumbbells
- Barbell & plates
- Weight bench
- Cable machine
- Gym machines (leg press, lat pulldown, etc.)

At least one option must be selected to proceed. The selection is stored as a `Set<string>` of equipment keys.

**Step 2 — Experience**
- Options: Beginner (< 1 year) / Intermediate (1–3 years) / Advanced (3+ years)

**Step 3 — Goal**
- Options: Build muscle / Lose fat / General fitness

**Step 4 — Days per week**
- Options: 2–3 days / 4 days / 5–6 days

**Step 5 — Session length**
- Options: ~30 min / 45–60 min / 90+ min

Each step: progress bar (step N of 5), question, radio-style option rows (icon + label + description), Next button. Back navigation via back arrow in header.

### Recommendation screen

After step 5, compute the recommendation:

**If goal = "Build muscle" or "Lose fat":** single recommended template.

Recommendation table:

| Experience | Days | → Template type |
|---|---|---|
| Beginner | any | Full Body |
| Intermediate | 2–3 | Full Body |
| Intermediate | 4 | Upper/Lower |
| Intermediate | 5–6 | PPL |
| Advanced | 2–3 | Full Body |
| Advanced | 4 | Upper/Lower |
| Advanced | 5–6 | PPL |

Equipment picks the variant (e.g., Full Body + dumbbells → `full-body-db`).

Result screen shows: "Recommended for you" label, template name, summary sentence ("Based on your answers: intermediate, muscle building, 4 days, 45–60 min"), metadata tags, "Start with this routine" button, "Not quite right? Browse all templates" link (navigates to Library → Templates tab, closes modal).

**If goal = "General fitness":** show all templates matching the selected equipment as selectable cards. User picks one, then taps "Start with this routine".

### State

Onboarding answers are ephemeral (React state only, not persisted). They exist only to compute the recommendation within the modal session. No DB storage of individual answers.

On completing onboarding (tapping "Start with this routine"):
- Call `cloneTemplate(slug)` → clones routine, sets active, sets `onboarding_completed = true`.
- Close modal, navigate to Log view.

---

## 6. Profile Integration

ProfileView gets a "Retake quiz" button (or link) in the routines section. Tapping it sets a local `showOnboarding` state to `true`, which renders the onboarding modal. Completing or skipping the modal closes it and resets `showOnboarding`.

---

## 7. New TypeScript Types

```typescript
export type EquipmentKey = 'dumbbells' | 'barbell' | 'bench' | 'cables' | 'machines';

export interface RoutineTemplate {
  id: string;
  name: string;
  slug: string;
  required_equipment: EquipmentKey[];
  days_per_week: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  session_time: string;
  description: string;
}

// Pure helper — true when user's equipment covers all template requirements
export function templateMatchesEquipment(
  template: RoutineTemplate,
  userEquipment: Set<EquipmentKey>,
): boolean {
  return template.required_equipment.every((e) => userEquipment.has(e));
}
```

`RoutineTemplate` is read from `/api/pulse/templates` (new API route) with SWR, or passed as initial data from the server component.

### Exercise category overhaul

The existing `ExerciseCategory = 'push' | 'pull' | 'legs' | 'other'` is replaced with granular muscle-group categories:

```typescript
export type ExerciseCategory =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'back'
  | 'biceps'
  | 'legs'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'other';
```

A pure utility function maps category → workout tab type:

```typescript
// WorkoutType is expanded to cover Bro Split and Arnold Split tabs
export type WorkoutType = 'push' | 'pull' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms';

// Default workout_type suggestion when a user manually adds an exercise to a routine.
// Not used for templates (workout_type is explicit per template_exercise).
export function defaultWorkoutType(cat: ExerciseCategory): WorkoutType | null {
  const map: Record<ExerciseCategory, WorkoutType | null> = {
    chest: 'chest', shoulders: 'shoulders', triceps: 'arms',
    back: 'back', biceps: 'arms',
    legs: 'legs', glutes: 'legs', calves: 'legs',
    abs: null,
    other: null,
  };
  return map[cat];
}
```

`WorkoutType = 'push' | 'pull' | 'legs'` is unchanged — it drives the log tabs. Abs exercises map to `null` because they are accessories added to whichever session the user prefers; they do not appear in templates automatically.

**DB impact:** The `exercises.category` CHECK constraint is updated to the new set. Existing seeded exercises are re-categorised:

| Exercise | New category |
|---|---|
| Dumbbell Bench Press | chest |
| Incline DB Press | chest |
| DB Lateral Raise | shoulders |
| DB Overhead Press | shoulders |
| DB Tricep Overhead Extension | triceps |
| Diamond / Close-Grip Push-Up | triceps |
| DB Bent-Over Row | back |
| DB Single-Arm Row | back |
| DB Reverse Fly | back |
| DB Face Pull bent-over | back |
| DB Bicep Curl | biceps |
| DB Hammer Curl | biceps |
| DB Goblet Squat | legs |
| DB Romanian Deadlift | legs |
| DB Bulgarian Split Squat | glutes |
| DB Sumo Squat | legs |
| DB Leg Curl lying on bench | legs |
| DB Calf Raise | calves |

### Global exercise seed expansion

The existing dumbbell-only seed is kept as-is. The following exercises are added (`user_id = NULL`). Near-duplicates of existing exercises are noted but kept as separate entries since they refer to different equipment or variations.

**Chest**

| Name | Category |
|---|---|
| Barbell Bench Press | chest |
| Incline Barbell Press | chest |
| Chest Fly | chest |
| Cable Fly | chest |
| Push-Up | chest |
| Dips | triceps |
| Machine Chest Press | chest |
| Decline Bench Press | chest |
| Pec Deck | chest |
| Smith Machine Bench Press | chest |

*Note: Dips appears in both chest and triceps — seeded once as triceps (primary mover).*

**Back**

| Name | Category |
|---|---|
| Deadlift | back |
| Pull-Up | back |
| Lat Pulldown | back |
| Barbell Row | back |
| Seated Cable Row | back |
| T-Bar Row | back |
| Chest-Supported Row | back |
| Straight-Arm Pulldown | back |
| Rack Pull | back |

*Note: Single-Arm Dumbbell Row already exists as "DB Single-Arm Row". Seated Cable Row and Straight-Arm Pulldown are new.*

**Shoulders**

| Name | Category |
|---|---|
| Barbell Overhead Press | shoulders |
| Lateral Raise | shoulders |
| Rear Delt Fly | back |
| Face Pull | back |
| Arnold Press | shoulders |
| Front Raise | shoulders |
| Upright Row | shoulders |
| Machine Shoulder Press | shoulders |
| Cable Lateral Raise | shoulders |

*Note: DB Overhead Press and DB Lateral Raise already exist. Rear Delt Fly and Face Pull are categorised as back (rear deltoid is anatomically back). Cable Lateral Raise already seeded as a gym exercise.*

**Biceps**

| Name | Category |
|---|---|
| Barbell Curl | biceps |
| Dumbbell Curl | biceps |
| Preacher Curl | biceps |
| Cable Curl | biceps |
| Incline Dumbbell Curl | biceps |
| EZ-Bar Curl | biceps |
| Concentration Curl | biceps |
| Spider Curl | biceps |
| Chin-Up | back |

*Note: DB Bicep Curl and DB Hammer Curl already exist. Hammer Curl already exists. Chin-Up is categorised as back (primary mover). Barbell Curl differs from existing "Barbell Bicep Curl" — both kept.*

**Triceps**

| Name | Category |
|---|---|
| Tricep Pushdown | triceps |
| Close-Grip Bench Press | triceps |
| Skull Crusher | triceps |
| Cable Overhead Tricep Extension | triceps |
| Single-Arm Tricep Pushdown | triceps |
| JM Press | triceps |
| Tricep Kickback | triceps |

*Note: DB Tricep Overhead Extension and Diamond Push-Up already exist. Dips already added under Chest. Cable Tricep Pushdown already seeded as a gym exercise.*

**Legs**

| Name | Category |
|---|---|
| Barbell Squat | legs |
| Romanian Deadlift | legs |
| Leg Press | legs |
| Walking Lunge | legs |
| Leg Extension | legs |
| Leg Curl | legs |
| Hack Squat | legs |

*Note: DB Bulgarian Split Squat, DB Goblet Squat, DB Sumo Squat, DB Romanian Deadlift, DB Leg Curl, DB Calf Raise, Barbell Squat, Leg Press, Leg Extension Machine, Leg Curl Machine, Calf Raise Machine already exist.*

**Glutes**

| Name | Category |
|---|---|
| Hip Thrust | glutes |
| Glute Bridge | glutes |
| Cable Kickback | glutes |
| Step-Up | glutes |
| Sumo Deadlift | glutes |
| Abduction Machine | glutes |

*Note: Bulgarian Split Squat and Walking Lunge are in Legs above. Romanian Deadlift already covered.*

**Calves**

| Name | Category |
|---|---|
| Standing Calf Raise | calves |
| Seated Calf Raise | calves |
| Leg Press Calf Raise | calves |
| Single-Leg Calf Raise | calves |
| Donkey Calf Raise | calves |
| Smith Machine Calf Raise | calves |

*Note: DB Calf Raise and Calf Raise Machine already exist. Farmer's Walk, Jump Rope, Box Jump, Sprint omitted — these are conditioning/cardio, not strength exercises consistent with the app's tracking model.*

**Abs**

| Name | Category |
|---|---|
| Crunch | abs |
| Cable Crunch | abs |
| Hanging Leg Raise | abs |
| Plank | abs |
| Russian Twist | abs |
| Ab Wheel Rollout | abs |
| Reverse Crunch | abs |
| Mountain Climber | abs |
| Sit-Up | abs |

*Note: Toe Touch omitted (near-duplicate of Crunch). Abs exercises are not included in templates — users add them manually to any day.*

**Library impact:** The category filter in the Exercises tab is updated to show all new categories as filter pills.

---

## 8. API Routes

New route: `GET /api/pulse/templates` — returns all `routine_templates` rows. Public to all authenticated users. No user_id filter needed (all templates are global).

---

## 9. Component Tree

```
LibraryView
  ├── Tabs: Exercises | Routines | Templates (new)
  └── TemplatesTab (new)
        ├── EquipmentFilter (filter pills)
        └── TemplateCard[] (new)

OnboardingModal (new)
  ├── Step1_Equipment
  ├── Step2_Experience
  ├── Step3_Goal
  ├── Step4_Days
  ├── Step5_Time
  └── RecommendationScreen
        ├── SingleRecommendation (Build muscle / Lose fat)
        └── TemplatePicker (General fitness)

ProfileView
  └── "Retake quiz" button → opens OnboardingModal
```

`OnboardingModal` is rendered in `AppShell` (or `PulseProvider`) so it can appear above any view.

---

## 10. Testing

- Unit tests for the recommendation logic function (pure function: `(answers) => slug`).
- Unit tests for `cloneTemplate` server action (mock Supabase).
- Component tests for `OnboardingModal` — step navigation, back/forward, correct recommendation computed, "Browse all templates" link.
- Component tests for `TemplatesTab` — equipment filter, "Use this" confirmation dialog.
- No E2E tests — Vitest + Testing Library only.

---

## 11. Migration

New migration file: `docs/migrations/2026-05-27-routine-templates.sql`

Includes:
1. Create `routine_templates` and `template_exercises` tables.
2. RLS policies.
3. Seed gym exercises into `exercises`.
4. Seed 6 templates into `routine_templates`.
5. Seed `template_exercises` rows (explicit UUIDs for stability).
6. `ALTER TABLE profiles ADD COLUMN onboarding_completed`.

---

## Appendix — Template Exercise Composition

Exercise names reference the global `exercises` seed. All sets/reps use the same format as existing routine exercises.

### Full Body — Dumbbells (`full-body-db`)

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Dumbbell Bench Press | 3 | 8-12 | 1 |
| push | DB Overhead Press | 3 | 8-12 | 2 |
| pull | DB Bent-Over Row | 3 | 8-12 | 3 |
| pull | DB Bicep Curl | 3 | 10-14 | 4 |
| legs | DB Goblet Squat | 4 | 10-15 | 5 |
| legs | DB Romanian Deadlift | 3 | 8-12 | 6 |

### Full Body — Gym (`full-body-gym`)

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Barbell Bench Press | 3 | 6-10 | 1 |
| push | Barbell Overhead Press | 3 | 6-10 | 2 |
| pull | Barbell Row | 3 | 6-10 | 3 |
| pull | Lat Pulldown | 3 | 8-12 | 4 |
| legs | Barbell Squat | 4 | 5-8 | 5 |
| legs | Leg Press | 3 | 10-15 | 6 |

### Upper/Lower — Dumbbells (`upper-lower-db`)

Upper day (push + pull tabs):

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Dumbbell Bench Press | 4 | 8-12 | 1 |
| push | DB Overhead Press | 3 | 8-12 | 2 |
| push | DB Lateral Raise | 3 | 12-16 | 3 |
| pull | DB Bent-Over Row | 4 | 8-12 | 4 |
| pull | DB Bicep Curl | 3 | 10-14 | 5 |
| pull | DB Reverse Fly | 3 | 12-16 | 6 |

Lower day (legs tab):

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| legs | DB Goblet Squat | 4 | 10-15 | 7 |
| legs | DB Romanian Deadlift | 3 | 8-12 | 8 |
| legs | DB Bulgarian Split Squat | 3 | 10-12 per leg | 9 |
| legs | DB Calf Raise | 3 | 15-20 | 10 |

### Upper/Lower — Gym (`upper-lower-gym`)

Upper day:

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Barbell Bench Press | 4 | 6-10 | 1 |
| push | Barbell Overhead Press | 3 | 6-10 | 2 |
| push | Cable Lateral Raise | 3 | 12-16 | 3 |
| pull | Barbell Row | 4 | 6-10 | 4 |
| pull | Lat Pulldown | 3 | 8-12 | 5 |
| pull | Face Pull (cable) | 3 | 15-20 | 6 |

Lower day:

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| legs | Barbell Squat | 4 | 5-8 | 7 |
| legs | Leg Press | 3 | 10-15 | 8 |
| legs | Barbell Romanian Deadlift | 3 | 8-12 | 9 |
| legs | Leg Curl Machine | 3 | 12-15 | 10 |
| legs | Calf Raise Machine | 3 | 15-20 | 11 |

### PPL — Dumbbells (`ppl-db`)

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Dumbbell Bench Press | 4 | 8-12 | 1 |
| push | Incline DB Press | 3 | 10-14 | 2 |
| push | DB Overhead Press | 3 | 8-12 | 3 |
| push | DB Lateral Raise | 3 | 12-16 | 4 |
| push | DB Tricep Overhead Extension | 3 | 10-15 | 5 |
| pull | DB Bent-Over Row | 4 | 8-12 | 6 |
| pull | DB Single-Arm Row | 3 | 10-14 | 7 |
| pull | DB Reverse Fly | 3 | 12-16 | 8 |
| pull | DB Bicep Curl | 3 | 10-14 | 9 |
| pull | DB Hammer Curl | 3 | 10-14 | 10 |
| legs | DB Goblet Squat | 4 | 10-15 | 11 |
| legs | DB Bulgarian Split Squat | 3 | 10-12 per leg | 12 |
| legs | DB Romanian Deadlift | 3 | 8-12 | 13 |
| legs | DB Leg Curl lying on bench | 3 | 12-15 | 14 |
| legs | DB Calf Raise | 3 | 15-20 | 15 |

### PPL — Gym (`ppl-gym`)

| workout_type | Exercise | sets | reps | order |
|---|---|---|---|---|
| push | Barbell Bench Press | 4 | 6-10 | 1 |
| push | Incline Barbell Press | 3 | 8-12 | 2 |
| push | Barbell Overhead Press | 3 | 6-10 | 3 |
| push | Cable Lateral Raise | 3 | 12-16 | 4 |
| push | Cable Tricep Pushdown | 3 | 12-15 | 5 |
| push | Chest Fly Machine | 3 | 12-15 | 6 |
| pull | Barbell Row | 4 | 6-10 | 7 |
| pull | Lat Pulldown | 3 | 8-12 | 8 |
| pull | Cable Row | 3 | 10-14 | 9 |
| pull | Face Pull (cable) | 3 | 15-20 | 10 |
| pull | Barbell Bicep Curl | 3 | 8-12 | 11 |
| pull | Cable Hammer Curl | 3 | 10-14 | 12 |
| legs | Barbell Squat | 4 | 5-8 | 13 |
| legs | Leg Press | 3 | 10-15 | 14 |
| legs | Barbell Romanian Deadlift | 3 | 8-12 | 15 |
| legs | Leg Curl Machine | 3 | 12-15 | 16 |
| legs | Leg Extension Machine | 3 | 12-15 | 17 |
| legs | Calf Raise Machine | 3 | 15-20 | 18 |
