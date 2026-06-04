# Mid-workout exercise swap — design

Date: 2026-06-04
Status: Approved (pre-implementation)

## Goal

Let the user swap an exercise for a same-movement-pattern alternative while training (busy machine, or just don't feel like it today), carrying their working weight across as a starting point. This is the #1 near-term roadmap item ("adherence beats optimization").

## Decisions (locked)

- **Scope: this week only.** A swap applies to the current week's slot and reverts next week. Past weeks stay untouched.
- **Carryover: pre-fill, editable.** The new exercise's sets pre-fill from the slot's prior weight as an editable starting point.
- **Surface: train list + guided mode.** Swap is available from `ExerciseCard` in `/train` and from `WorkoutModeScreen`.
- **Candidates: same movement pattern**, excluding the original, hidden exercises, and exercises already in the current session; ranked by equipment overlap then name. No hard equipment filter (the user's equipment set is not persisted).
- **History labels: in v1.** A past swapped session shows the substitute it was actually performed with.

## Key architectural fact

The app is **slot-centric**. Set logs are keyed `"week-routineExerciseId-setIdx"`. PRs (`computePRMap`), volume, last-session, streaks, and history are all keyed by `routineExerciseId`. The exercise *name* is a label resolved live from `routine_exercises.exercise_id`.

Consequence: a week-scoped swap only needs to **override the displayed exercise** for one `(week, slot)`. Logs, PRs, volume, and streaks remain slot-keyed and unchanged. This is why the feature is small.

Accepted limitation: because PRs are slot-keyed, a one-week swap's sets are compared against the slot's E1RM history (which spans both exercises). At current scale (2 users) this is acceptable and noted, not solved.

## Data model

New migration `docs/migrations/2026-06-04-11-50-47-exercise-swaps.sql`:

```sql
create table exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_exercise_id uuid not null references routine_exercises(id) on delete cascade,
  week int not null check (week between 1 and 12),
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, routine_exercise_id, week)
);
alter table exercise_swaps enable row level security;
-- RLS: owner can select/insert/update/delete their own rows (policies mirror exercise_notes).
create index exercise_swaps_user_idx on exercise_swaps (user_id);
```

Client representation: `Swaps = Record<string, string>` keyed `"<week>-<routineExerciseId>"` → substitute `exercise_id`. Identical keying to `Notes`.

## Read path

- `loadSwaps(supabase, userId): Promise<Swaps>` in `src/lib/pulse/queries.ts` — select `week, routine_exercise_id, exercise_id`, build the keyed map.
- `GET /api/pulse/swaps/route.ts` — returns the map (reuses `loadSwaps`).
- Extend `EXERCISES_SELECT` to `id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound`. `DbExercise` already declares these as optional. This lets the picker filter candidates by movement pattern and rank by equipment overlap entirely client-side.

## Write path (server actions, `src/app/pulse/actions/`)

- `setExerciseSwap(routineExerciseId, week, exerciseId)`:
  - Validate UUIDs and `1 <= week <= 12`.
  - `assertOwnsRoutineExercise(routineExerciseId, user.id)`.
  - Assert the substitute exercise is global (`user_id null`) or owned by the user (same check as `addExerciseToRoutine`).
  - Upsert on `(user_id, routine_exercise_id, week)`.
- `clearExerciseSwap(routineExerciseId, week)`:
  - Validate, assert ownership, delete the row.

## Hook + context

- `useSwaps()` in `src/hooks/pulse/useSwaps.ts` — SWR keyed `/api/pulse/swaps`, optimistic mutate (mutate immediately, await action, revalidate). Mirrors `useNotes`. Returns `{ swaps, setSwap, clearSwap, loading, error }`.
- `PulseProvider` wires it; `PulseContext` exposes `swaps`, `setSwap(week, reId, exId)`, `clearSwap(week, reId)`.

## Pure helpers (`src/lib/pulse/utils.ts`, unit-tested)

- `swapKey(week: number, routineExerciseId: string): string` → `"<week>-<reId>"` (shared so Notes-style callers don't inline it).
- `resolveExercise(re: RoutineExercise, week: number, swaps: Swaps, exercisesById: Map<string, DbExercise>): DbExercise` → returns the substitute `DbExercise` if a swap exists for `(week, re.id)` and the substitute is found in `exercisesById`; otherwise `re.exercise`. Graceful fallback if the substitute was deleted/hidden.
- `swapCandidates(original: DbExercise, exercises: DbExercise[], opts: { excludeIds: Set<string> }): DbExercise[]` → exercises with the same `movement_pattern`, excluding the original id and `excludeIds` (hidden + already-in-session); sorted by equipment overlap with the original (descending), then name. Exercises with no `movement_pattern` are excluded.

## Display wiring

- `LogView` builds `exercisesById` (from context `exercises`) and the in-session id set (from `routineExercisesByTabKey[activeTab]`), resolves each card's display exercise for `activeWeek`, and passes display-ready props down. Resolution lives in the view so `ExerciseCard`/`WorkoutModeScreen` stay presentational.
- `ExerciseCard` new props: `displayExercise: DbExercise`, `isSwapped: boolean`, `originalName: string`, `onSwap: () => void`, `onRevert: () => void`. Renders the resolved name/subtitle; "How to perform" uses `displayExercise`; a "Swap exercise" affordance sits in the expanded area; when swapped, a "Swapped from {originalName} · Revert" line shows. Opening the picker calls `onSwap`.
- `WorkoutModeScreen` exposes the same swap action in its guided header for the current step, using the resolved exercise for the active week.
- `HistoryView` resolves exercise names through `swaps` when rendering a session's sets, so a past swapped week shows the substitute.

## Swap picker — `ExerciseSwapPicker`

- Slate-styled modal/bottom-sheet reusing `ExerciseInstructionModal`'s overlay shell.
- Header: "Swap {original name}".
- Optional search input filtering the candidate list by name.
- Scrollable candidate list (`swapCandidates`): each row shows name · category · equipment hint. Tap → `setSwap(activeWeek, reId, exerciseId)` + close.
- When a swap is already active for this slot/week: a "Revert to {original}" row at the top → `clearSwap` + close.
- Caption: "Your week-{w} weight carries over as a starting point."
- Empty state when no candidates exist.

## Weight carryover

No new logic. `SetLogger` already pre-fills from the slot's previous-week saved entry via `computeSuggestion`. After a swap, the new exercise's sets pre-fill from the original's prior weight — exactly "carry across" — and remain editable.

Known limitation (documented, not solved): a week that reverts immediately after a swapped week pre-fills from the swapped week's numbers. Acceptable at current scale.

## Security / CSP

No new external origins. No CSP change. Substitute-exercise authorization enforced in `setExerciseSwap`.

## Testing

- **Pure:** `swapCandidates` (movement-pattern filter, exclusion of original/hidden/in-session, equipment-overlap sort, drops null-pattern), `resolveExercise` (present / absent / missing-substitute fallback), `swapKey`.
- **Queries/actions:** `loadSwaps` mapping; `setExerciseSwap` auth + upsert; `clearExerciseSwap` delete; regression test that `EXERCISES_SELECT` includes `movement_pattern` and `equipment`.
- **Components:** `ExerciseSwapPicker` renders + sorts + selects + revert row; `ExerciseCard` shows swapped label + revert; `LogView` passes resolved props.

## Edge cases

- Deleted/hidden substitute → `resolveExercise` falls back to the original.
- Superset slot → swap allowed; `superset_group_id` untouched; only the label resolves.
- Swap target already in the session → excluded from candidates (no duplicate exercise in one session).

## Out of scope (v1)

- Permanent / "keep this swap" toggle.
- Equipment hard-filtering (no persisted user equipment set).
- Exercise-level (rather than slot-level) PR tracking.
