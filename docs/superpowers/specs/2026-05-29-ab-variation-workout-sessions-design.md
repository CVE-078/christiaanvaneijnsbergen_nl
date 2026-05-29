# A/B Exercise Variation + Workout Sessions — Design Spec

**Date:** 2026-05-29

---

## Overview

Two tightly coupled features:

1. **A/B exercise variation** — templates pre-populate two distinct exercise lists (A and B) for workout types that repeat within a week. The app automatically alternates between them each session.
2. **Workout sessions** — a `workout_sessions` table tracks each workout with its variant and timestamps, enabling reliable A/B alternation, duration tracking, and a dedicated logging UI.
3. **Workout mode screen** — a full-screen guided logging flow replacing the current passive card list for active workouts.

---

## 1. Database Schema

### 1.1 `workout_sessions` (new table)

```sql
CREATE TABLE workout_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) NOT NULL,
  routine_id    uuid REFERENCES workout_routines(id) ON DELETE SET NULL,
  workout_type  text NOT NULL,
  variant       text CHECK (variant IN ('A', 'B')),  -- null = no A/B for this workout type
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz                          -- null = session in progress
);
```

RLS: users can only read/write their own rows (`user_id = auth.uid()`).

### 1.2 `routine_exercises` — add `variant` column

```sql
ALTER TABLE routine_exercises
  ADD COLUMN variant text CHECK (variant IN ('A', 'B'));  -- null = always show (no A/B split)
```

Existing rows default to `null` (no variant, behaviour unchanged).

---

## 2. A/B Alternation Logic

When "Start workout" is tapped for a given `workout_type`:

1. Query the most recent **completed** session (`completed_at IS NOT NULL`) for `routine_id + workout_type`.
2. If last session variant was `'A'` → this session is `'B'`.
3. If last session variant was `'B'` → this session is `'A'`.
4. If no completed session exists → `'A'`.
5. If a session is already in progress (no `completed_at`) for this routine + workout_type, resume it (don't create a new one).

The variant is locked at session creation. In-progress sessions do not affect the alternation lookup — only completed sessions count.

---

## 3. Which Templates Get A/B Variants

| Template structure | A/B |
|---|---|
| Full Body (2–3×/week) | Yes — Full Body A + B |
| Upper/Lower (4×/week) | Yes — Upper A + B, Lower A + B |
| Push/Pull (4×/week) | Yes — Push A + B, Pull A + B |
| PPL (6×/week) | Yes — Push A + B, Pull A + B, Legs A + B |
| PPL (3×/week) | No — each type appears once per week |
| Bro Split | No — one distinct day per muscle group |
| Arnold Split | No — one distinct day per muscle group |

**A/B split principle:** A = flat/compound-first emphasis; B = incline/angle variation with accessory swap. Same muscle groups hit, different movements.

### Example — Upper/Lower Dumbbells (`upper-lower-db`)

| Slot | Upper A | Upper B |
|---|---|---|
| push | Dumbbell Bench Press | Incline DB Press |
| push | DB Overhead Press | DB Overhead Press |
| push | DB Lateral Raise | DB Lateral Raise |
| pull | DB Bent-Over Row | DB Single-Arm Row |
| pull | DB Bicep Curl | DB Hammer Curl |
| pull | DB Reverse Fly | DB Reverse Fly |

| Slot | Lower A | Lower B |
|---|---|---|
| legs | DB Goblet Squat | DB Bulgarian Split Squat |
| legs | DB Romanian Deadlift | DB Romanian Deadlift |
| legs | DB Bulgarian Split Squat | DB Sumo Squat |
| legs | DB Calf Raise | DB Calf Raise |

The same pattern (compound swap on key movements, accessories shared) is applied across all A/B-eligible templates.

---

## 4. Routine Editor

When a routine contains exercises with variant values, the workout type tabs expand to show both variants as separate tabs:

```
Upper/Lower routine:   [ Upper A ]  [ Upper B ]  [ Lower A ]  [ Lower B ]
Full Body routine:     [ Full Body A ]  [ Full Body B ]
PPL 6× routine:        [ Push A ]  [ Push B ]  [ Pull A ]  [ Pull B ]  [ Legs A ]  [ Legs B ]
Routines without A/B:  unchanged — [ Push ]  [ Pull ]  [ Legs ]  (etc.)
```

Each variant tab is an independent exercise list. Adding, removing, or reordering exercises in variant A has no effect on variant B. Users can freely edit either list after cloning a template.

---

## 5. Workout Mode Screen

A full-screen overlay that activates when the user taps "Start workout" on a workout type in the Log view.

### Flow

```
Log view (workout type selected)
  → tap "Start workout"
  → variant determined (A/B logic above), session row inserted
  → Workout Mode screen opens
      → Exercise 1 of N
          set 1: weight / reps / RIR → tap ✓ → rest timer fires
          set 2: weight / reps / RIR → tap ✓ → rest timer fires
          set 3: weight / reps / RIR → tap ✓
      → "Next exercise" → Exercise 2 of N
      → ...
      → "Finish workout"
  → session.completed_at written
  → summary shown (sets completed, total volume, duration)
  → return to Log view
```

### Per-exercise screen

- Exercise name + set/rep target at top
- Progress indicator: "Exercise 3 of 6"
- Set rows: weight input / reps input / RIR — pre-filled from last session's logged values
- Rest timer fires automatically after marking a set done (uses `routine_exercises.rest_seconds`)
- Collapsible note field (existing implementation)
- "Next exercise" fixed at bottom; back arrow or swipe to go to previous exercise

### Finishing

- "Finish workout" button accessible at any point (user may skip remaining exercises)
- If exercises remain unlogged: confirmation prompt before finishing
- On finish: `completed_at` written, summary screen shown, then return to Log view

---

## 6. Component Tree Changes

```
LogView
  └── "Start workout" button (per workout type tab)
        → creates/resumes WorkoutSession
        → opens WorkoutModeScreen

WorkoutModeScreen (new — full-screen overlay)
  ├── WorkoutModeHeader (exercise N of M, finish button)
  ├── ExerciseLogger (set rows, weight/reps/RIR inputs)
  ├── RestTimer (existing component, auto-fires)
  └── NoteField (existing, collapsible)

RoutineEditor (existing)
  └── WorkoutTypeTabs — now renders A/B variant tabs when variant data present

useWorkoutSession (new hook)
  - createSession(routineId, workoutType) → determines variant, inserts row
  - resumeSession(sessionId)
  - completeSession(sessionId)
  - getLastVariant(routineId, workoutType) → 'A' | 'B' | null
```

New API route: `POST /api/pulse/sessions` — creates a session row. `PATCH /api/pulse/sessions/[id]` — sets `completed_at`.

---

## 7. Testing

- **Unit — alternation logic:** pure function `(lastVariant) → nextVariant`. Cases: null → A, A → B, B → A.
- **Unit — session resume:** in-progress session is returned, not a new one created.
- **Unit — template A/B composition:** correct exercises in correct variant slots for each eligible template.
- **Component — WorkoutModeScreen:** start → log sets → next exercise → finish writes `completed_at`. Skip exercises. Back navigation.
- **Component — RoutineEditor:** A/B tabs render when variant data present; edits to A don't affect B; no tabs shown for non-A/B routines.

No E2E tests — Vitest + Testing Library only.

---

## 8. Out of Scope

- Periodized programs (variable-duration week-by-week progression) — planned as a future feature; requires workout sessions infrastructure from this feature as a prerequisite.
- Session history / calendar view — future feature.
- Explicit "workout scheduled for today" push notifications — future feature.
