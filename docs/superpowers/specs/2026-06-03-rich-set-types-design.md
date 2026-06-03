# Pulse — Rich Set Types (drop / failure) Design Spec

**Date:** 2026-06-03
**Branch:** `feature/rich-set-types` (off `main`)

## 1. Goal

Add drop sets and failure tagging to the set logger, beyond the current warmup / working split. Roadmap near-term item.

- **Drop set:** a working set followed by one or more reduced-weight segments logged with no rest.
- **Failure:** a set taken to failure. Represented by the existing `rir = 0` with no new field, just surfaced visually.

## 2. Data model + migration

`set_logs` today: `{ user_id, week, routine_exercise_id, set_idx, kg, reps, rir, saved }`, one row per working set, unique on `(user_id, week, routine_exercise_id, set_idx)`. Warmup sets are computed and display-only (not persisted).

One new migration `docs/migrations/2026-06-03-set-logs-drops.sql`:

```sql
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS drops jsonb;
```

- A set whose `drops` is a non-empty array `[{ "kg": number, "reps": number }, ...]` is a drop set. No separate `set_type` column.
- `null` / absent / empty `drops` = a normal set. Fully backward compatible.
- Existing `set_logs` RLS policies (from the pending RLS migration) cover the new column. No policy change.
- This migration is applied manually to Supabase (no runner), like the RLS one.

## 3. Types + validation

- `LogEntry` (`src/lib/pulse/types.ts`) gains `drops?: Array<{ kg: number; reps: number }>`.
- `validateLogs` (`src/lib/pulse/validation.ts`) accepts the optional `drops`: when present it must be an array of length 1..6, each segment a finite `kg > 0` and integer `reps > 0`. A missing/empty `drops` is valid (normal set).

## 4. Persistence

- `saveLogs` (`src/app/pulse/actions.ts`): include `drops` in the upserted row (normalize empty array to `null`). Reuse the existing validation guard.
- `loadLogs` (`src/lib/pulse/queries.ts`), the `/api/pulse/logs` GET route, and the protected layout's logs load: add `drops` to the `set_logs` select and map it into the `LogEntry`.
- No change to `computePRMap`, `computeStreak`, per-muscle volume, or e1RM: a drop set's PR/volume is driven by the working set's `kg`/`reps` (the top of the drop). Drops are supplementary.

## 5. UI

- **Failure tag:** in `SetLogger` / `ExerciseCard`, when a saved set has `rir === 0`, render an "F" / "to failure" tag on the row (coral, matches Slate). Pure read of existing data.
- **Drop set editor:** in `SetLogger`, a control on a working set to mark it a drop and add reduced-weight segments (kg x reps rows, add/remove, capped at 6). Saving stores `drops`.
- **Display:** logged drop segments render beneath the working set in `ExerciseCard`, `WorkoutModeScreen`, and the history replay (`HistoryView`). Compact, Slate-styled.

## 6. Testing

- `validateLogs`: drops shape (valid, too long, bad kg/reps, empty/absent), failure path unaffected.
- `SetLogger`: adding a drop segment persists it; failure tag shows at RIR 0 and not otherwise.
- Keep all existing tests green; update any set-row snapshots/selectors touched.

## 7. Out of scope

- Super sets / giant sets (separate roadmap item).
- Per-segment RIR, AMRAP, rest-pause.
- Auto-suggesting drop weights.

## 8. Deployment note

Ships behind the new `drops` migration. It will not function in production until that migration AND the still-pending RLS migration are applied to the live Supabase DB.
