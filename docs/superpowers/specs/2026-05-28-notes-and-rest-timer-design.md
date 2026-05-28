# Notes per Exercise + Per-Exercise Rest Timer — Design Spec

**Date:** 2026-05-28  
**Features:** Exercise-level session notes in LogView; per-exercise rest duration stored in the routine

---

## Goals

1. **Notes per exercise:** After logging sets, a lifter can attach a short note to an exercise for that session — "left shoulder tight on set 3", "increase next week". One note per exercise per week.
2. **Per-exercise rest timer:** Each exercise in a routine can have a custom rest duration (e.g. squats = 3 min, lateral raises = 60 s). The rest timer starts at that duration automatically when a set is saved.

---

## What We're NOT Building

- Per-set notes (one note per exercise per session only)
- A note indicator in the collapsed ExerciseCard header (clean header, note visible only when expanded)
- Locking the timer to the exercise duration (the cycle button stays; per-exercise duration is just the starting point)
- Free-form rest duration input (preset select: Default / 60 s / 90 s / 2 min / 3 min)

---

## Database Migrations

### 1. `exercise_notes` table

```sql
CREATE TABLE exercise_notes (
  user_id          UUID     NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  week             SMALLINT NOT NULL CHECK (week BETWEEN 1 AND 52),
  routine_exercise_id UUID  NOT NULL,
  note             TEXT     NOT NULL CHECK (char_length(note) <= 500),
  PRIMARY KEY (user_id, week, routine_exercise_id)
);

ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes" ON exercise_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 2. `routine_exercises.rest_seconds` column

```sql
ALTER TABLE routine_exercises ADD COLUMN rest_seconds INTEGER CHECK (rest_seconds > 0);
```

`NULL` means "use the global timer default." No migration of existing rows needed.

---

## Data Model Changes

### `types.ts`

```ts
// New
export type Notes = Record<string, string>; // key: `${week}-${routineExerciseId}`

// Updated
export interface RoutineExercise {
  // ... existing fields ...
  rest_seconds: number | null;  // new
}
```

`LogEntry` is unchanged. Notes live in their own structure, not in `Logs`.

### `PulseContextValue`

Add four fields:

```ts
notes: Notes;
saveNote: (week: number, routineExerciseId: string, note: string) => Promise<void>;
deleteNote: (week: number, routineExerciseId: string) => Promise<void>;
timerDuration: number | null;  // alongside existing timerTrigger
```

Remove nothing — these are additive.

---

## Server Actions

### `saveNote(week, routineExerciseId, note)`

```ts
// Upserts a row in exercise_notes. Validates ownership of routineExerciseId.
// Throws if week out of range, note > 500 chars, or routine exercise not owned by user.
```

### `deleteNote(week, routineExerciseId)`

```ts
// Deletes the row. No-op if it doesn't exist.
```

### `updateRoutineExercise` — signature change

Add `restSeconds: number | null` as the last parameter. Updates `rest_seconds` column alongside existing fields.

---

## New Hook: `useNotes`

```ts
export function useNotes(initialNotes: Notes) {
  const { data, mutate } = useSWR<Notes>('/api/pulse/notes', fetcher, {
    fallbackData: initialNotes,
    revalidateOnFocus: false,
  });
  const notes = data ?? initialNotes;

  const saveNote = useCallback(async (week, rid, note) => {
    mutate({ ...notes, [`${week}-${rid}`]: note }, false);
    await serverSaveNote(week, rid, note);
  }, [notes, mutate]);

  const deleteNote = useCallback(async (week, rid) => {
    const updated = { ...notes };
    delete updated[`${week}-${rid}`];
    mutate(updated, false);
    await serverDeleteNote(week, rid);
  }, [notes, mutate]);

  return { notes, saveNote, deleteNote };
}
```

Optimistic updates, no retry logic needed (notes are low-stakes).

---

## New API Route: `GET /api/pulse/notes`

Returns `Notes` (`Record<string, string>`) for the authenticated user. Used by SWR revalidation.

---

## `useRestTimer` — signature change

`fireTrigger` gains an optional duration parameter:

```ts
// Before
fireTrigger: () => void

// After
fireTrigger: (durationSeconds?: number) => void
```

Internally: `useRestTimer` stores `timerDuration: number | null` alongside `timerTrigger`. `fireTrigger(d?)` increments the trigger and sets the duration.

`RestTimer` receives a `duration?: number` prop. When non-null, it starts at that value instead of the persisted global index. The cycle button remains and still cycles through the global [60, 90, 120, 180] presets from whatever value is current.

---

## Component Changes

### `(protected)/layout.tsx`

- Add `exercise_notes` to the parallel fetch: `supabase.from('exercise_notes').select('week, routine_exercise_id, note').eq('user_id', user.id)`
- Build `initialNotes: Notes` from the result
- Pass `initialNotes` to `PulseLayout`
- Update `routine_exercises` select to include `rest_seconds`

### `PulseLayout` / `PulseProvider`

- `PulseLayout` receives and forwards `initialNotes`
- `PulseProvider` calls `useNotes(initialNotes)`, adds `notes`, `saveNote`, `deleteNote` to context

### `ExerciseCard`

Three new props (LogView looks up the note from `notes` using `notes[\`${week}-${re.id}\`]` and passes it down — consistent with the existing props-based pattern):

```ts
note?: string;
onSaveNote: (note: string) => Promise<void>;
onDeleteNote: () => Promise<void>;
```

**Expanded state — below all set rows:**

```
┌─────────────────────────────────────┐
│ 01  90 kg × 8    ✓  2 RIR           │
│ 02  90 kg × 7    ✓  2 RIR           │
│ 03  87.5 kg × 8  ✓  2 RIR           │
│ 04  —                               │
├─────────────────────────────────────┤
│ + Add note                          │  ← if no note
├─────────────────────────────────────┤
│ Left shoulder tight on set 3.       │  ← if note exists (read-only)
│                          Edit · Clear│
└─────────────────────────────────────┘
```

- "+ Add note": dashed-border button, `text-pulse-dim`
- Clicking it: replaces with a `<textarea>`, auto-focused, saves on blur
- "Edit": shows textarea pre-filled with existing note, saves on blur
- "Clear": calls `deleteNote`, removes the note from local state
- Collapsed header: unchanged (no indicator)

### `LogView`

`handleSave` updated to pass exercise's `rest_seconds` to `fireTrigger`:

```ts
function handleSave(key: string, entry: LogEntry) {
  updateLog(key, entry);
  const firstDash = key.indexOf('-');
  const lastDash = key.lastIndexOf('-');
  const rid = key.slice(firstDash + 1, lastDash);
  const exercise = routineExercises.find((r) => r.id === rid);
  fireTrigger(exercise?.rest_seconds ?? undefined);
}
```

### `RoutineExerciseRow` (in `LibraryView`)

Edit mode gains a "Rest" select field:

| Label | Value |
|-------|-------|
| Default | `null` |
| 60 s | `60` |
| 90 s | `90` |
| 2 min | `120` |
| 3 min | `180` |

`handleSave` passes the `rest_seconds` value to `updateRoutineExercise`.

The `updateRoutineExercise` hook callback in `useRoutines` gains a `restSeconds` parameter, forwarded to the server action.

### `AppShell`

Pass `timerDuration` from context to `RestTimer` as the new `duration` prop. (`DesktopLayout` does not render `RestTimer` — no change needed there.)

---

## Testing

| What | How |
|------|-----|
| `useNotes` | renderHook: optimistic save, optimistic delete, SWR fallback |
| `saveNote` / `deleteNote` actions | Integration tests with Supabase mock |
| `RestTimer` with `duration` prop | Test that timer starts at provided value, not global default |
| `ExerciseCard` note flow | Render → expand → "+ Add note" → textarea → blur → note visible |
| `RoutineExerciseRow` rest field | Render in edit mode → select "2 min" → save → updateRoutineExercise called with `120` |
| `LogView.handleSave` | Unit test: correct `rest_seconds` passed to `fireTrigger` |

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `src/lib/pulse/types.ts` | Add `Notes` type; add `rest_seconds` to `RoutineExercise` |
| Create | `src/hooks/pulse/useNotes.ts` | New SWR hook |
| Create | `src/hooks/pulse/__tests__/useNotes.test.ts` | Hook tests |
| Create | `src/app/api/pulse/notes/route.ts` | GET notes API route |
| Modify | `src/app/pulse/actions.ts` | Add `saveNote`, `deleteNote`; update `updateRoutineExercise` |
| Modify | `src/app/pulse/(protected)/layout.tsx` | Fetch notes + rest_seconds; pass initialNotes |
| Modify | `src/components/pulse/PulseLayout.tsx` | Forward initialNotes |
| Modify | `src/components/pulse/PulseProvider.tsx` | Wire useNotes; add to context |
| Modify | `src/context/PulseContext.ts` | Add notes/saveNote/deleteNote to PulseContextValue |
| Modify | `src/hooks/pulse/useRestTimer.ts` | fireTrigger accepts durationSeconds? |
| Modify | `src/hooks/pulse/useRoutines.ts` | updateRoutineExercise gets restSeconds param |
| Modify | `src/components/pulse/ExerciseCard.tsx` | Note UI below set rows |
| Modify | `src/components/pulse/views/LogView.tsx` | handleSave passes rest_seconds to fireTrigger |
| Modify | `src/components/pulse/RestTimer.tsx` | Accept duration? prop |
| Modify | `src/components/pulse/AppShell.tsx` | Pass timerDuration to RestTimer |
| Modify | `src/components/pulse/views/LibraryView.tsx` | RoutineExerciseRow rest select + updateRoutineExercise call |
