# Exercise Notes + Per-Exercise Rest Timer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-exercise session note (one note per exercise per week, shown below set rows in ExerciseCard) and a per-exercise rest duration (stored on each routine exercise, passed to RestTimer when a set is saved).

**Architecture:** Notes live in a new `exercise_notes` Supabase table, managed via `useNotes` SWR hook, surfaced through PulseContext. Rest duration is a nullable integer column on `routine_exercises`; it flows through `fireTrigger(durationSeconds?)` → `timerDuration` in context → `RestTimer` `duration` prop. Both features are additive — no existing data is removed or migrated.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (PostgreSQL + RLS), SWR, Vitest + @testing-library/react, Tailwind v4 `pulse-*` tokens.

---

## Task 0: DB migrations (run in Supabase dashboard before writing any code)

**This task has no code changes.** Run the following SQL in the Supabase SQL editor before starting Task 1.

- [ ] **Step 1: Create `exercise_notes` table**

```sql
CREATE TABLE exercise_notes (
  user_id              UUID     NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  week                 SMALLINT NOT NULL CHECK (week BETWEEN 1 AND 52),
  routine_exercise_id  UUID     NOT NULL,
  note                 TEXT     NOT NULL CHECK (char_length(note) <= 500),
  PRIMARY KEY (user_id, week, routine_exercise_id)
);

ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes" ON exercise_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Add `rest_seconds` column to `routine_exercises`**

```sql
ALTER TABLE routine_exercises
  ADD COLUMN rest_seconds INTEGER CHECK (rest_seconds > 0);
```

`NULL` means "use global timer default." No backfill needed.

---

## Task 1: Type changes

**Files:**
- Modify: `src/lib/pulse/types.ts`

- [ ] **Step 1: Add `Notes` type and `rest_seconds` to `RoutineExercise`**

Open `src/lib/pulse/types.ts`. Make two changes:

**Add after `export type PRMap = ...` (around line 89):**
```ts
export type Notes = Record<string, string>; // key: `${week}-${routineExerciseId}`
```

**Add `rest_seconds` to `RoutineExercise` interface (after `starting_weight_kg`):**
```ts
export interface RoutineExercise {
    id: string;
    routine_id: string;
    exercise_id: string;
    workout_type: WorkoutType;
    order: number;
    sets: string;
    reps: string;
    starting_weight_kg: number | null;
    rest_seconds?: number | null;  // ← add this line
    exercise: DbExercise;
}
```

(Optional `?` avoids requiring fixture updates in all existing tests — `undefined` is treated the same as `null` everywhere it's used.)

- [ ] **Step 2: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/lib/pulse/types.ts
git commit -m "feat(notes+rest): add Notes type and rest_seconds to RoutineExercise"
```

---

## Task 2: Notes server actions + API route

**Files:**
- Modify: `src/app/pulse/actions.ts`
- Create: `src/app/api/pulse/notes/route.ts`

- [ ] **Step 1: Add `saveNote` and `deleteNote` to `src/app/pulse/actions.ts`**

Append at the end of the file:

```ts
export async function saveNote(week: number, routineExerciseId: string, note: string): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');
    const trimmed = note.trim();
    if (!trimmed || trimmed.length > 500) throw new Error('Invalid note');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('exercise_notes').upsert(
        { user_id: user.id, week, routine_exercise_id: routineExerciseId, note: trimmed },
        { onConflict: 'user_id,week,routine_exercise_id' },
    );
    if (error) throw new Error('Failed to save note');
}

export async function deleteNote(week: number, routineExerciseId: string): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    await supabase
        .from('exercise_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('week', week)
        .eq('routine_exercise_id', routineExerciseId);
}
```

- [ ] **Step 2: Create `src/app/api/pulse/notes/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Notes } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('exercise_notes')
        .select('week, routine_exercise_id, note')
        .eq('user_id', user.id);

    const notes: Notes = {};
    for (const row of data ?? []) {
        notes[`${row.week}-${row.routine_exercise_id}`] = row.note;
    }
    return NextResponse.json(notes);
}
```

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/app/pulse/actions.ts src/app/api/pulse/notes/route.ts
git commit -m "feat(notes): add saveNote/deleteNote actions and GET /api/pulse/notes route"
```

---

## Task 3: `useNotes` hook + tests

**Files:**
- Create: `src/hooks/pulse/useNotes.ts`
- Create: `src/hooks/pulse/__tests__/useNotes.test.ts`

- [ ] **Step 1: Write failing tests in `src/hooks/pulse/__tests__/useNotes.test.ts`**

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { saveNote as mockSaveNote, deleteNote as mockDeleteNote } from '@/app/pulse/actions';
import { useNotes } from '../useNotes';
import type { Notes } from '@/lib/pulse/types';

const mockMutate = vi.fn();
const UUID = 'aaaaaaaa-0000-4000-8000-000000000001';

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: {}, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
    mockMutate.mockClear();
    vi.mocked(mockSaveNote).mockClear();
    vi.mocked(mockDeleteNote).mockClear();
});

describe('useNotes', () => {
    it('returns notes from SWR data', () => {
        const notes: Notes = { [`3-${UUID}`]: 'tight shoulder' };
        vi.mocked(useSWR).mockReturnValue({ data: notes, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useNotes({}));
        expect(result.current.notes).toEqual(notes);
    });

    it('falls back to initialNotes when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReturnValue({ data: undefined, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const initialNotes: Notes = { [`1-${UUID}`]: 'felt good' };
        const { result } = renderHook(() => useNotes(initialNotes));
        expect(result.current.notes).toEqual(initialNotes);
    });

    it('saveNote calls mutate optimistically then calls server action', async () => {
        const { result } = renderHook(() => useNotes({}));
        await act(async () => {
            await result.current.saveNote(3, UUID, 'tight shoulder');
        });
        expect(mockMutate).toHaveBeenCalledWith({ [`3-${UUID}`]: 'tight shoulder' }, false);
        expect(mockSaveNote).toHaveBeenCalledWith(3, UUID, 'tight shoulder');
    });

    it('deleteNote removes the key optimistically then calls server action', async () => {
        const notes: Notes = { [`3-${UUID}`]: 'tight shoulder' };
        vi.mocked(useSWR).mockReturnValue({ data: notes, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useNotes(notes));
        await act(async () => {
            await result.current.deleteNote(3, UUID);
        });
        expect(mockMutate).toHaveBeenCalledWith({}, false);
        expect(mockDeleteNote).toHaveBeenCalledWith(3, UUID);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test:run -- useNotes
```
Expected: FAIL — `useNotes is not a function` (module not found).

- [ ] **Step 3: Create `src/hooks/pulse/useNotes.ts`**

```ts
import useSWR from 'swr';
import { useCallback } from 'react';
import {
    saveNote as serverSaveNote,
    deleteNote as serverDeleteNote,
} from '@/app/pulse/actions';
import type { Notes } from '@/lib/pulse/types';

const NOTES_KEY = '/api/pulse/notes';

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<T>;
}

export function useNotes(initialNotes: Notes) {
    const { data, mutate } = useSWR<Notes>(NOTES_KEY, fetcher, {
        fallbackData: initialNotes,
        revalidateOnFocus: false,
    });
    const notes = data ?? initialNotes;

    const saveNote = useCallback(async (week: number, routineExerciseId: string, note: string): Promise<void> => {
        const key = `${week}-${routineExerciseId}`;
        mutate({ ...notes, [key]: note }, false);
        await serverSaveNote(week, routineExerciseId, note);
    }, [notes, mutate]);

    const deleteNote = useCallback(async (week: number, routineExerciseId: string): Promise<void> => {
        const key = `${week}-${routineExerciseId}`;
        const updated = { ...notes };
        delete updated[key];
        mutate(updated, false);
        await serverDeleteNote(week, routineExerciseId);
    }, [notes, mutate]);

    return { notes, saveNote, deleteNote };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- useNotes
```
Expected: 4 tests PASS.

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/hooks/pulse/useNotes.ts src/hooks/pulse/__tests__/useNotes.test.ts
git commit -m "feat(notes): add useNotes SWR hook with optimistic updates"
```

---

## Task 4: Wire notes into context (layout → PulseLayout → PulseContext → PulseProvider)

**Files:**
- Modify: `src/app/pulse/(protected)/layout.tsx`
- Modify: `src/components/pulse/PulseLayout.tsx`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/PulseProvider.tsx`
- Modify: `src/components/pulse/__tests__/LogView.test.tsx` (add notes/saveNote/deleteNote to mock context)
- Modify: `src/components/pulse/__tests__/LibraryView.test.tsx` (same)

- [ ] **Step 1: Update `src/app/pulse/(protected)/layout.tsx` — fetch notes**

At the top of the file, add `Notes` to the type import from `@/lib/pulse/types`.

In the `Promise.all` array, add as a 6th entry:
```ts
supabase.from('exercise_notes').select('week, routine_exercise_id, note').eq('user_id', user.id),
```

So the destructure becomes:
```ts
const [logsResult, profileResult, bwResult, exercisesResult, routinesResult, notesResult] = await Promise.all([
    // ...existing 5 entries...,
    supabase.from('exercise_notes').select('week, routine_exercise_id, note').eq('user_id', user.id),
]);
```

After the existing `const routines = ...` block, add:
```ts
const initialNotes: Notes = {};
for (const row of notesResult.data ?? []) {
    initialNotes[`${row.week}-${row.routine_exercise_id}`] = row.note;
}
```

Pass `initialNotes` to `PulseLayout`:
```tsx
return (
    <PulseLayout
        initialLogs={logs}
        initialProfile={profile}
        initialBodyweightLogs={bodyweightLogs}
        initialExercises={exercises}
        initialRoutines={routines}
        initialNotes={initialNotes}
        email={user.email ?? ''}>
        {children}
    </PulseLayout>
);
```

- [ ] **Step 2: Update `src/components/pulse/PulseLayout.tsx`**

Add `Notes` to the import from `@/lib/pulse/types`. Add `initialNotes` to the `Props` interface and forward it to `PulseProvider`:

```tsx
'use client';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from './ToastContainer';
import type { View, Logs, Notes, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

const PATH_TO_VIEW: Record<string, View> = {
    '/pulse/train': 'train',
    '/pulse/plan': 'plan',
    '/pulse/progress': 'progress',
    '/pulse/profile': 'profile',
    '/pulse/explore': 'explore',
};

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    initialNotes: Notes;
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ children, ...providerProps }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = (pathname ? PATH_TO_VIEW[pathname] : undefined) ?? 'train';

    const navigate = useCallback((v: View) => {
        router.push(`/pulse/${v}`);
    }, [router]);

    return (
        <ToastProvider>
            <PulseProvider {...providerProps} navigate={navigate}>
                <AppShell view={view} navigate={navigate}>
                    {children}
                </AppShell>
                <ToastContainer />
            </PulseProvider>
        </ToastProvider>
    );
}
```

- [ ] **Step 3: Update `src/context/PulseContext.ts`**

Add `Notes` to the import from `@/lib/pulse/types`. Add three fields to `PulseContextValue` (after `deleteBodyWeight`):

```ts
notes: Notes;
saveNote: (week: number, routineExerciseId: string, note: string) => Promise<void>;
deleteNote: (week: number, routineExerciseId: string) => Promise<void>;
```

- [ ] **Step 4: Update `src/components/pulse/PulseProvider.tsx`**

Add imports:
```ts
import { useNotes } from '@/hooks/pulse/useNotes';
import type { ..., Notes } from '@/lib/pulse/types';
```

Add `initialNotes: Notes` to the `Props` interface and destructure it in the function signature.

After `const { timerTrigger, fireTrigger } = useRestTimer();`, add:
```ts
const { notes, saveNote, deleteNote } = useNotes(initialNotes);
```

In `contextValue`, add the three fields:
```ts
notes,
saveNote,
deleteNote,
```

In the `useMemo` dependency array, add:
```ts
notes,
saveNote,
deleteNote,
```

- [ ] **Step 5: Update `src/components/pulse/__tests__/LogView.test.tsx`**

In `defaultContext`, add:
```ts
notes: {},
saveNote: vi.fn().mockResolvedValue(undefined),
deleteNote: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 6: Update `src/components/pulse/__tests__/LibraryView.test.tsx`**

Find the mock context object passed to `vi.mocked(usePulse).mockReturnValue(...)` and add:
```ts
notes: {},
saveNote: vi.fn().mockResolvedValue(undefined),
deleteNote: vi.fn().mockResolvedValue(undefined),
```

(Read the file first to find where this object is defined — it may be inline or a `mockContext` variable.)

- [ ] **Step 7: Run all tests**

```
npm run test:run
```
Expected: all existing tests pass (no regressions).

- [ ] **Step 8: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 9: Commit**

```
git add src/app/pulse/(protected)/layout.tsx src/components/pulse/PulseLayout.tsx src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git commit -m "feat(notes): wire useNotes into context (layout → PulseProvider → PulseContext)"
```

---

## Task 5: ExerciseCard note UI

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx`
- Modify: `src/components/pulse/__tests__/ExerciseCard.test.tsx`

- [ ] **Step 1: Update `src/components/pulse/ExerciseCard.tsx`**

**Props interface** — add three props after `onDelete`:
```ts
note?: string;
onSaveNote: (note: string) => Promise<void>;
onDeleteNote: () => Promise<void>;
```

**Component signature** — destructure the new props:
```ts
export default function ExerciseCard({ routineExercise: re, exIdx, week, logs, prMap, unit, onSave, onDelete, note, onSaveNote, onDeleteNote }: Props) {
```

**Add two state variables** after `const [open, setOpen] = useState(false);`:
```ts
const [noteEditing, setNoteEditing] = useState(false);
const [noteDraft, setNoteDraft] = useState('');
```

**Note section** — add this block inside the expanded body div (after the `Array.from({ length: maxSets }, ...).map(...)` block that renders SetLogger rows), still inside the `{open && (...)}` branch:

```tsx
<div className="border-t border-pulse-border pt-3 mt-1">
    {noteEditing ? (
        <textarea
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={async () => {
                setNoteEditing(false);
                const trimmed = noteDraft.trim();
                if (trimmed) {
                    await onSaveNote(trimmed);
                } else {
                    await onDeleteNote();
                }
            }}
            placeholder="Add a note for this exercise…"
            maxLength={500}
            className="w-full bg-pulse-bg border border-pulse-border rounded-lg text-pulse-text font-pulse text-[0.8125rem] px-3 py-2 resize-none min-h-[60px] outline-none focus:border-pulse-accent/50"
        />
    ) : note ? (
        <div>
            <p className="font-pulse text-[0.8125rem] text-pulse-dim leading-relaxed">{note}</p>
            <div className="flex gap-3 mt-1 justify-end">
                <button
                    onClick={() => { setNoteDraft(note); setNoteEditing(true); }}
                    className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer">
                    Edit
                </button>
                <button
                    onClick={onDeleteNote}
                    className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer">
                    Clear
                </button>
            </div>
        </div>
    ) : (
        <button
            onClick={() => { setNoteDraft(''); setNoteEditing(true); }}
            className="w-full text-left font-pulse text-[0.8125rem] text-pulse-dim border border-dashed border-pulse-border rounded-lg px-3 py-2 cursor-pointer bg-transparent tracking-[0.02em]">
            + Add note
        </button>
    )}
</div>
```

- [ ] **Step 2: Update `src/components/pulse/__tests__/ExerciseCard.test.tsx`**

Add the new required props to `defaultProps`:
```ts
const defaultProps = {
    routineExercise,
    exIdx: 0,
    week: 1,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: () => {},
    onDelete: () => {},
    onSaveNote: vi.fn().mockResolvedValue(undefined),
    onDeleteNote: vi.fn().mockResolvedValue(undefined),
};
```

Add two new tests (at the end of the `describe` block):
```ts
it('shows "+ Add note" button when card is expanded and no note exists', async () => {
    render(<ExerciseCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
    expect(screen.getByRole('button', { name: /\+ add note/i })).toBeInTheDocument();
});

it('shows the note text when a note is provided and card is expanded', async () => {
    render(<ExerciseCard {...defaultProps} note="Left shoulder tight" />);
    await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
    expect(screen.getByText('Left shoulder tight')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

```
npm run test:run -- ExerciseCard
```
Expected: all tests PASS (including the 2 new ones).

- [ ] **Step 4: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/components/pulse/ExerciseCard.tsx src/components/pulse/__tests__/ExerciseCard.test.tsx
git commit -m "feat(notes): add note UI to ExerciseCard (expand → '+ Add note' → textarea → saves on blur)"
```

---

## Task 6: LogView — pass note props + update `handleSave` for rest timer

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1: Update `src/components/pulse/views/LogView.tsx`**

**Destructure** `notes`, `saveNote`, `deleteNote` from `usePulse()` (add to the existing destructure):
```ts
const {
    activeWeek,
    setActiveWeek,
    activeTab,
    activeDay,
    activeSchedule,
    logs,
    profile,
    prMap,
    activeRoutine,
    routineExercisesByType,
    navigate,
    updateLog,
    deleteLog,
    fireTrigger,
    notes,        // new
    saveNote,     // new
    deleteNote,   // new
} = usePulse();
```

**Update `handleSave`** to pass the exercise's rest duration to `fireTrigger`:
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

**Pass note props to each `ExerciseCard`** in the `.map()`:
```tsx
{routineExercises.map((re, i) => (
    <ExerciseCard
        key={re.id}
        routineExercise={re}
        exIdx={i}
        week={activeWeek}
        logs={logs}
        prMap={prMap}
        unit={unit}
        onSave={handleSave}
        onDelete={deleteLog}
        note={notes[`${activeWeek}-${re.id}`]}
        onSaveNote={(text) => saveNote(activeWeek, re.id, text)}
        onDeleteNote={() => deleteNote(activeWeek, re.id)}
    />
))}
```

- [ ] **Step 2: Run all tests**

```
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/components/pulse/views/LogView.tsx
git commit -m "feat(notes+rest): wire note props into LogView; pass rest_seconds to fireTrigger"
```

---

## Task 7: `useRestTimer` duration + `timerDuration` in context

**Files:**
- Modify: `src/hooks/pulse/useRestTimer.ts`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/PulseProvider.tsx`
- Modify: `src/components/pulse/AppShell.tsx`
- Modify: `src/components/pulse/__tests__/LogView.test.tsx` (add `timerDuration` to mock)
- Modify: `src/components/pulse/__tests__/LibraryView.test.tsx` (same)

- [ ] **Step 1: Update `src/hooks/pulse/useRestTimer.ts`**

Replace the file:
```ts
import { useState } from 'react';

export function useRestTimer() {
    const [timerTrigger, setTimerTrigger] = useState(0);
    const [timerDuration, setTimerDuration] = useState<number | null>(null);

    function fireTrigger(durationSeconds?: number) {
        setTimerDuration(durationSeconds ?? null);
        setTimerTrigger((t) => t + 1);
    }

    return { timerTrigger, timerDuration, fireTrigger };
}
```

- [ ] **Step 2: Add `timerDuration` to `src/context/PulseContext.ts`**

Add after `timerTrigger: number;`:
```ts
timerDuration: number | null;
```

- [ ] **Step 3: Update `src/components/pulse/PulseProvider.tsx`**

`useRestTimer` now returns three values — update the destructure:
```ts
const { timerTrigger, timerDuration, fireTrigger } = useRestTimer();
```

Add `timerDuration` to `contextValue`:
```ts
timerDuration,
```

Add `timerDuration` to the `useMemo` dependency array:
```ts
timerDuration,
```

- [ ] **Step 4: Update `src/components/pulse/AppShell.tsx`**

Add `timerDuration` to the `usePulse()` destructure:
```ts
const { activeWeek, streak, handleExport, timerTrigger, timerDuration, showOnboarding } = usePulse();
```

Pass it to `RestTimer`:
```tsx
<RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
```

- [ ] **Step 5: Add `timerDuration` to test mocks**

In `src/components/pulse/__tests__/LogView.test.tsx`, add to `defaultContext`:
```ts
timerDuration: null,
```

In `src/components/pulse/__tests__/LibraryView.test.tsx`, add `timerDuration: null` to the mock context.

- [ ] **Step 6: Run all tests**

```
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```
git add src/hooks/pulse/useRestTimer.ts src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx src/components/pulse/AppShell.tsx src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git commit -m "feat(rest): fireTrigger accepts durationSeconds; timerDuration flows through context to AppShell"
```

---

## Task 8: `RestTimer` duration prop

**Files:**
- Modify: `src/components/pulse/RestTimer.tsx`
- Modify: `src/components/pulse/__tests__/RestTimer.test.tsx`

- [ ] **Step 1: Write a failing test in `src/components/pulse/__tests__/RestTimer.test.tsx`**

Add a third test:
```ts
it('starts at the provided duration when duration prop is given', () => {
    render(<RestTimer trigger={1} duration={120} />);
    expect(screen.getByText('2:00')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm it fails**

```
npm run test:run -- RestTimer
```
Expected: 2 pass, 1 fail — `2:00` not found (timer starts at global default, not 120).

- [ ] **Step 3: Update `src/components/pulse/RestTimer.tsx`**

Add `duration?: number` to the `Props` interface:
```ts
interface Props {
    trigger: number;
    duration?: number;
}
```

Update the function signature:
```ts
export default function RestTimer({ trigger, duration }: Props) {
```

Update the trigger `useEffect` to use `duration` when provided:
```ts
useEffect(() => {
    if (trigger === 0) return;
    const start = duration ?? DURATIONS[durationIdx];
    totalRef.current = start;
    setRemaining(start);
}, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Run all RestTimer tests**

```
npm run test:run -- RestTimer
```
Expected: 3 tests PASS.

- [ ] **Step 5: Run all tests**

```
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```
git add src/components/pulse/RestTimer.tsx src/components/pulse/__tests__/RestTimer.test.tsx
git commit -m "feat(rest): RestTimer accepts optional duration prop; uses it as starting value over global default"
```

---

## Task 9: Rest timer in routine (action + useRoutines + LibraryView + layout query)

**Files:**
- Modify: `src/app/pulse/actions.ts`
- Modify: `src/hooks/pulse/useRoutines.ts`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/views/LibraryView.tsx`
- Modify: `src/app/pulse/(protected)/layout.tsx`

- [ ] **Step 1: Update `updateRoutineExercise` in `src/app/pulse/actions.ts`**

Add `restSeconds: number | null` as the last parameter and include it in the DB update:

```ts
export async function updateRoutineExercise(
    routineExerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    restSeconds: number | null,
): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');
    if (!sets.trim() || !reps.trim()) throw new Error('Sets and reps must not be empty');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: re } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, workout_routines!inner ( user_id )')
        .eq('id', routineExerciseId)
        .single();

    if (!re) throw new Error('Not found');

    const reData = re as unknown as { workout_routines: { user_id: string } };
    const routineUserId = reData.workout_routines?.user_id;
    if (routineUserId !== user.id) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('routine_exercises')
        .update({ sets, reps, starting_weight_kg: startingWeightKg, rest_seconds: restSeconds })
        .eq('id', routineExerciseId);
    if (error) throw new Error('Failed to update routine exercise');
}
```

- [ ] **Step 2: Update `src/context/PulseContext.ts` — `updateRoutineExercise` signature**

Change the `updateRoutineExercise` type in `PulseContextValue` to:
```ts
updateRoutineExercise: (
    routineExerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    restSeconds: number | null,
) => Promise<void>;
```

- [ ] **Step 3: Update `src/hooks/pulse/useRoutines.ts` — `updateRoutineExercise` callback**

```ts
const updateRoutineExercise = useCallback(async (
    routineExerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    restSeconds: number | null,
): Promise<void> => {
    await serverUpdateRoutineExercise(routineExerciseId, sets, reps, startingWeightKg, restSeconds);
    await mutateRoutines();
}, [mutateRoutines]);
```

- [ ] **Step 4: Update `RoutineExerciseRow` in `src/components/pulse/views/LibraryView.tsx`**

In `RoutineExerciseRow`:

**Props type** — update `onUpdate` signature:
```ts
onUpdate: (id: string, sets: string, reps: string, startingWeightKg: number | null, restSeconds: number | null) => void;
```

**Add `rest` state** (after the `weight` state):
```ts
const [rest, setRest] = useState<string>(
    re.rest_seconds != null ? String(re.rest_seconds) : ''
);
```

**Update the `useEffect`** to sync `rest` when the exercise changes:
```ts
useEffect(() => {
    if (!editing) {
        setSets(re.sets);
        setReps(re.reps);
        setWeight(re.starting_weight_kg !== null ? String(toDisplay(re.starting_weight_kg, unit)) : '');
        setRest(re.rest_seconds != null ? String(re.rest_seconds) : '');
    }
}, [re.id, re.sets, re.reps, re.starting_weight_kg, re.rest_seconds, unit, editing]);
```

**Update `handleSave`**:
```ts
function handleSave() {
    const trimmed = weight.trim();
    const raw = trimmed === '' ? NaN : parseFloat(trimmed);
    const kgValue = Number.isNaN(raw) ? null : toKg(raw, unit);
    const restValue = rest !== '' ? Number(rest) : null;
    onUpdate(re.id, sets, reps, kgValue, restValue);
    setEditing(false);
}
```

**Add Rest select to the edit form JSX** (after the Weight label, before the Save button):
```tsx
<label className="flex flex-col gap-1">
    <span className={SECTION_LABEL}>Rest</span>
    <select
        aria-label={`${re.exercise.name} rest duration`}
        value={rest}
        onChange={(e) => setRest(e.target.value)}
        className={INPUT}>
        <option value="">Default</option>
        <option value="60">60 s</option>
        <option value="90">90 s</option>
        <option value="120">2 min</option>
        <option value="180">3 min</option>
    </select>
</label>
```

**In `RoutinesTab`, update `handleUpdateExercise`**:
```ts
function handleUpdateExercise(id: string, sets: string, reps: string, startingWeightKg: number | null, restSeconds: number | null) {
    startTransition(async () => {
        await updateRoutineExercise(id, sets, reps, startingWeightKg, restSeconds);
    });
}
```

And update the `RoutineExerciseRow` render to pass `onUpdate={handleUpdateExercise}` (no change needed to the JSX call — the prop name stays the same, only the callback signature changed).

- [ ] **Step 5: Update `src/app/pulse/(protected)/layout.tsx` — add `rest_seconds` to query**

Find the `routine_exercises` select inside the `workout_routines` query and add `rest_seconds`:
```
exercises:routine_exercises ( id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, rest_seconds, exercise:exercises ( id, name, category, default_sets, default_reps, user_id ) ),
```

- [ ] **Step 6: Run all tests**

```
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

```
npm run typecheck
```
Expected: no errors.

- [ ] **Step 8: Lint**

```
npm run lint
```
Expected: no errors.

- [ ] **Step 9: Commit**

```
git add src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts src/components/pulse/views/LibraryView.tsx src/app/pulse/(protected)/layout.tsx
git commit -m "feat(rest): per-exercise rest duration — routine editor select, action, query"
```

---

## Acceptance Criteria

- [ ] In LogView, expanding an ExerciseCard and tapping "+ Add note" opens a textarea. Typing and blurring saves the note (persists to Supabase, reappears after refresh).
- [ ] A saved note shows directly when the card is expanded. "Edit" re-opens the textarea pre-filled. "Clear" removes the note.
- [ ] Collapsed card header is unchanged — no note indicator.
- [ ] In LibraryView → Routines tab → Edit, a "Rest" select appears with Default/60s/90s/2min/3min.
- [ ] Saving an exercise with a custom rest (e.g. 2 min) persists. In LogView, saving any set for that exercise starts the rest timer at 2:00.
- [ ] The cycle button on the rest timer still works after the per-exercise timer fires.
- [ ] All 246+ tests pass, typecheck clean.
