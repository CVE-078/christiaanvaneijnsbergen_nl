# Supersets — Design Spec

## Goals

- Allow two exercises in a routine to be grouped as a superset
- On the train screen, display the pair as a single merged card
- Rest timer fires once after both exercises' sets in a round are logged
- Guided mode (WorkoutModeScreen) treats the pair as one step

## Non-goals

- Tri-sets or giant sets (3+ exercises) — deferred to "Later" roadmap
- Creating supersets during a workout — routine editor only
- Per-superset rest duration field — the first exercise's `rest_seconds` is used

---

## Data Model

### Migration

```sql
ALTER TABLE routine_exercises
  ADD COLUMN superset_group_id UUID DEFAULT NULL;

CREATE INDEX idx_re_superset_group
  ON routine_exercises (routine_id, superset_group_id)
  WHERE superset_group_id IS NOT NULL;
```

### TypeScript

`RoutineExercise` in `src/lib/pulse/types.ts` gains:

```ts
superset_group_id: string | null;
```

### Pairing invariants (enforced in API)

- Both exercises must belong to the same routine
- Neither may already have a `superset_group_id`
- They must have consecutive `order` values

---

## API

### `POST /api/pulse/supersets`

Body: `{ exerciseAId: string, exerciseBId: string }`

Generates a UUID via `gen_random_uuid()` and sets it on both `routine_exercises` rows in a single transaction.

Returns: `{ groupId: string }`

### `DELETE /api/pulse/supersets/[groupId]`

Sets `superset_group_id = NULL` on all rows sharing that group ID (always 2).

---

## Routine Editor (`LibraryView`)

### `RoutineExerciseRow` changes

New "Pair ↓" button — visible only when:
- This exercise has `superset_group_id === null`, AND
- The next exercise exists and has `superset_group_id === null`

When paired, both rows render inside a `ss-frame` group (purple border, "⚡ Superset" header). The first exercise (lower `order`) shows an "Unpair" button that calls `DELETE /api/pulse/supersets/[groupId]`. The second exercise shows no pair/unpair button.

### Reorder behaviour

↑/↓ on a paired exercise moves the entire pair together — both rows shift by one position, swapping with the exercise above or below the group. This is handled in the existing `handleMove` logic: when moving a paired exercise, find its partner and move both.

### Props added to `RoutinesTab`

- `onPair(exerciseAId, exerciseBId)` — calls `POST /api/pulse/supersets`
- `onUnpair(groupId)` — calls `DELETE /api/pulse/supersets/[groupId]`

Both are passed down to `RoutineExerciseRow` (same pattern as `onMove` / `onRemove`).

---

## Train Screen (`LogView`)

### Exercise grouping

Before rendering, `routineExercisesByTabKey[tab]` is processed into an ordered list of `ExerciseItem`:

```ts
type ExerciseItem = RoutineExercise | [RoutineExercise, RoutineExercise];
```

A single-pass grouping loop collects consecutive exercises that share a `superset_group_id` into a pair. The pair's list position is determined by the first exercise's `order`.

- Single `RoutineExercise` → `<ExerciseCard>` (unchanged)
- Pair → `<SupersetCard>`

### `SupersetCard` component

New component at `src/components/pulse/SupersetCard.tsx`.

**Structure:**
- Outer card: purple border (`border-pulse-accent/35`), dark background
- Header row: "⚡ Superset" label
- Body: two `ExerciseCard` sections separated by a divider
- Expand/collapse: tapping the header toggles both exercise sections together

**Rest timer control:**

`SupersetCard` passes `suppressRestTimer={true}` to the first exercise (lower `order`) and omits it for the second. The second exercise uses the first exercise's `rest_seconds` (falling back to the global default) as the shared rest duration.

`ExerciseCard` gains an optional `suppressRestTimer?: boolean` prop. When true, it does not call `fireTrigger` on set save.

---

## WorkoutModeScreen

### Step model

Steps are built from the same `ExerciseItem[]` list:

- Single exercise → one step (unchanged)
- Superset pair → one step

### Superset step UI

- Header: "Superset · Exercise X–Y of N"
- Body: exercise A's set loggers followed by exercise B's set loggers
- Same `suppressRestTimer` logic — rest fires after exercise B's set

### "Next exercise →" enabled condition

For a superset step: at least one complete round must be logged (≥ 1 saved set from each exercise in the pair). Unchanged for single exercises.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Remove one exercise from a paired row | API unlinks the superset (`superset_group_id = NULL` on both) before deleting the exercise |
| Routine has only one exercise of a workout type | "Pair ↓" not shown (no next exercise) |
| Clone a template that has no supersets | No change — `superset_group_id` defaults to NULL |
| A/B variant exercises | "Pair ↓" is only shown between exercises of the same variant (or both null). Cross-variant pairing is not allowed — the two exercises would never appear in the same tab together. |
| Partner exercise deleted while app is open | `SupersetCard` falls back to rendering the surviving exercise as a plain `ExerciseCard` |
