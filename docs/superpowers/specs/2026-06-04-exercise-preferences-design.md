# Exercise Preferences (Hide / Never-Show) Design

**Date:** 2026-06-04
**Status:** Approved — ready for plan

## Goal

Let a user hide exercises they never want, so generation, recommendation, and (future) swap never surface them. Adherence-first: the highest-value personalization on the roadmap. v1 is hide-only; `'favorite'` weighting is a deliberate follow-up.

## Architecture

Follows the existing per-domain pattern (mirrors `notes`): a Supabase table → `'use server'` action → GET route + `queries.ts` loader → SWR hook → `PulseContext`. The generator reads the hidden set server-side and filters the candidate pool.

## Data

New table `user_exercise_preferences`:

```sql
create table user_exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  preference text not null check (preference in ('hidden')),  -- 'favorite' added later
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);
alter table user_exercise_preferences enable row level security;
create policy "own prefs" on user_exercise_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_uep_user on user_exercise_preferences (user_id);
```

Migration: `docs/migrations/2026-06-04-exercise-preferences.sql` (idempotent: `create table if not exists`, guarded policy). User applies it manually.

Type: `ExercisePreference = 'hidden'` (extensible). The hook/context surface a `Set<string>` of hidden exercise ids — the only shape consumers need.

## Server

`src/app/pulse/actions/exercises.ts` (the domain barrel re-exports it):

```ts
export async function setExercisePreference(exerciseId: string, preference: ExercisePreference | null): Promise<void>
```
- Validates `exerciseId` via `assertUuid`; `preference` ∈ {'hidden', null}.
- `null` → delete the row (un-hide). Non-null → upsert on `(user_id, exercise_id)`.
- Ownership: the row is keyed to `auth.uid()`; RLS enforces it. No cross-user write possible.

`src/lib/pulse/queries.ts`: `loadHiddenExerciseIds(supabase, userId): Promise<string[]>` selecting `exercise_id` where `preference = 'hidden'`.

GET route `src/app/api/pulse/preferences/route.ts` returns `string[]` (hidden ids) via the loader (mirrors notes route).

## Generation wiring

In `generateAndSaveRoutine` (`actions/routines.ts`): after building `pool`, load the user's hidden ids and filter them out **before** calling `generateRoutine`:

```ts
const hidden = new Set(await loadHiddenExerciseIds(supabase, user.id));
const pool = (...).filter((row) => !hidden.has(row.id)).map(...);
```

No change to `generation.ts` — the smaller pool flows through the existing equipment filter + avoid-set/thin-pool fallback. If hiding empties a movement pattern, that slot simply yields nothing (acceptable; the user chose to hide it).

This same `loadHiddenExerciseIds` is reused by the future mid-workout swap to skip hidden alternatives.

## Client

Hook `src/hooks/pulse/usePreferences.ts` (mirrors `useNotes`):
- `useSWR<string[]>('/api/pulse/preferences', fetcher, SWR_READ_OPTS)`, stable `EMPTY: string[] = []`.
- Exposes `hiddenExerciseIds: Set<string>` (memoized from the array) and `toggleHideExercise(exerciseId, hidden: boolean)` — optimistic `mutate` then `setExercisePreference`.

`PulseContext` gains `hiddenExerciseIds: Set<string>` and `toggleHideExercise`. `PulseProvider` composes the hook into a memoized sub-value.

UI in `src/components/pulse/views/library/ExercisesTab.tsx`:
- Each exercise row gets a hide toggle (eye-off icon button). Hidden rows render muted (reduced opacity) with an un-hide affordance.
- A "Show hidden" toggle next to the category filter; hidden exercises are filtered out of the list by default.
- Reuse existing Slate tokens and the row action button styling already present.

Routine editor (`RoutinesTab.tsx` / `RoutineExerciseRow.tsx`): a subtle "Hidden" marker on a row whose `exercise_id` is in `hiddenExerciseIds`, so the user knows a hidden exercise is still in the routine (non-destructive — we never auto-remove). No removal logic; the user removes manually if they want.

## Non-goals (v1)

- No `'favorite'` / weighting.
- No auto-removal of hidden exercises from existing routines.
- No hiding affecting template *display* (templates are curated); hiding affects generation/recommendation/swap only.

## Testing

- `queries`/action: hidden ids round-trip; `null` deletes; preference value validated.
- Generation: a routine generated with an exercise hidden never contains it; if a pattern is fully hidden, no crash and the rest still generate.
- Hook: optimistic add/remove updates `hiddenExerciseIds`.
- ExercisesTab: hide toggle calls `toggleHideExercise`; "Show hidden" reveals muted rows.
- PulseProvider/context mock updated for the new members (DesktopLayout strict mock, etc.).

## Files touched

- `docs/migrations/2026-06-04-exercise-preferences.sql` (new)
- `src/lib/pulse/types.ts` (`ExercisePreference`)
- `src/app/pulse/actions/exercises.ts` (`setExercisePreference`)
- `src/lib/pulse/queries.ts` (`loadHiddenExerciseIds`)
- `src/app/api/pulse/preferences/route.ts` (new GET)
- `src/app/pulse/actions/routines.ts` (`generateAndSaveRoutine` pool filter)
- `src/hooks/pulse/usePreferences.ts` (new)
- `src/context/PulseContext.ts` + `src/components/pulse/PulseProvider.tsx`
- `src/components/pulse/views/library/ExercisesTab.tsx` (hide toggle + show-hidden)
- `src/components/pulse/views/library/RoutineExerciseRow.tsx` (hidden marker)
- tests for the above
