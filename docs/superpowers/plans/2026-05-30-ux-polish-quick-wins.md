# UX Polish Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three independent UX improvements: standardise exercise names (DB → Dumbbell), auto-activate another routine when the active one is deleted, and allow editing an exercise's default sets/reps in the library.

**Architecture:** Task 1 is a data fix (SQL migration + data.ts strings). Task 2 is a server action behaviour change (one more Supabase query in `deleteRoutine`). Task 3 is a full-stack feature addition: extend `updateExercise` through the server action → hook → context → LibraryView UI. All three are independent and can be committed separately.

**Tech Stack:** Next.js App Router server actions, Supabase, TypeScript, React, Vitest + @testing-library/react.

---

## File Map

| Action | File | Task |
|--------|------|------|
| Create | `docs/migrations/2026-05-30-rename-db-to-dumbbell.sql` | T1 |
| Modify | `src/lib/pulse/data.ts` | T1 |
| Modify | `src/app/pulse/actions.ts` | T2 & T3 |
| Modify | `src/hooks/pulse/useRoutines.ts` | T3 |
| Modify | `src/hooks/pulse/__tests__/useRoutines.test.ts` | T3 |
| Modify | `src/context/PulseContext.ts` | T3 |
| Modify | `src/components/pulse/views/LibraryView.tsx` | T3 |
| Modify | `src/components/pulse/__tests__/LibraryView.test.tsx` | T3 |

---

## Task 1: Standardise exercise names — DB → Dumbbell

**Background:** Global exercises in the DB (and in `src/lib/pulse/data.ts` template descriptions) use the abbreviation "DB" (e.g. "DB Goblet Squat"). These should read "Dumbbell Goblet Squat" throughout for consistency.

**Files:**
- Create: `docs/migrations/2026-05-30-rename-db-to-dumbbell.sql`
- Modify: `src/lib/pulse/data.ts`

- [ ] **Step 1: Create the SQL migration**

Create `docs/migrations/2026-05-30-rename-db-to-dumbbell.sql`:

```sql
-- Rename global "DB " exercises to "Dumbbell " spelling.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
UPDATE exercises
SET name = CASE name
    WHEN 'DB Lateral Raise'              THEN 'Dumbbell Lateral Raise'
    WHEN 'DB Overhead Press'             THEN 'Dumbbell Overhead Press'
    WHEN 'DB Tricep Overhead Extension'  THEN 'Dumbbell Tricep Overhead Extension'
    WHEN 'DB Bent-Over Row'              THEN 'Dumbbell Bent-Over Row'
    WHEN 'DB Single-Arm Row'             THEN 'Dumbbell Single-Arm Row'
    WHEN 'DB Reverse Fly'                THEN 'Dumbbell Reverse Fly'
    WHEN 'DB Bicep Curl'                 THEN 'Dumbbell Bicep Curl'
    WHEN 'DB Hammer Curl'                THEN 'Dumbbell Hammer Curl'
    WHEN 'DB Face Pull bent-over'        THEN 'Dumbbell Face Pull (Bent-Over)'
    WHEN 'DB Goblet Squat'               THEN 'Dumbbell Goblet Squat'
    WHEN 'DB Romanian Deadlift'          THEN 'Dumbbell Romanian Deadlift'
    WHEN 'DB Bulgarian Split Squat'      THEN 'Dumbbell Bulgarian Split Squat'
    WHEN 'DB Sumo Squat'                 THEN 'Dumbbell Sumo Squat'
    WHEN 'DB Leg Curl lying on bench'    THEN 'Dumbbell Leg Curl (Lying)'
    WHEN 'DB Calf Raise'                 THEN 'Dumbbell Calf Raise'
    WHEN 'Incline DB Press'              THEN 'Incline Dumbbell Press'
    ELSE name
END
WHERE user_id IS NULL
  AND (name LIKE 'DB %' OR name LIKE 'Incline DB %');
```

- [ ] **Step 2: Update `src/lib/pulse/data.ts` — rename all DB references**

In `src/lib/pulse/data.ts`, find every exercise `name` field containing `'DB '` or `'Incline DB'` and apply the same rename mapping:

```ts
// Replace these occurrences:
'Incline DB Press'              → 'Incline Dumbbell Press'
'DB Lateral Raise'              → 'Dumbbell Lateral Raise'
'DB Overhead Press'             → 'Dumbbell Overhead Press'
'DB Tricep Overhead Extension'  → 'Dumbbell Tricep Overhead Extension'
'DB Bent-Over Row'              → 'Dumbbell Bent-Over Row'
'DB Single-Arm Row'             → 'Dumbbell Single-Arm Row'
'DB Reverse Fly'                → 'Dumbbell Reverse Fly'
'DB Bicep Curl'                 → 'Dumbbell Bicep Curl'
'DB Hammer Curl'                → 'Dumbbell Hammer Curl'
'DB Face Pull (bent-over)'      → 'Dumbbell Face Pull (Bent-Over)'
'DB Goblet Squat'               → 'Dumbbell Goblet Squat'
'DB Romanian Deadlift'          → 'Dumbbell Romanian Deadlift'
'DB Bulgarian Split Squat'      → 'Dumbbell Bulgarian Split Squat'
'DB Sumo Squat'                 → 'Dumbbell Sumo Squat'
'DB Leg Curl (lying on bench)'  → 'Dumbbell Leg Curl (Lying)'
'DB Calf Raise'                 → 'Dumbbell Calf Raise'
```

Also rename any load strings that contain "DB" (e.g. `'16–18kg per DB seated'` → `'16–18 kg per dumbbell seated'`).

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```
Expected: all tests PASS (data.ts changes are strings, no logic affected).

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/2026-05-30-rename-db-to-dumbbell.sql src/lib/pulse/data.ts
git commit -m "fix(data): rename DB abbreviation to Dumbbell throughout exercise names"
```

- [ ] **Step 6: Run the SQL migration in Supabase**

Open the Supabase Dashboard → SQL Editor → New query. Paste the contents of `docs/migrations/2026-05-30-rename-db-to-dumbbell.sql` and run it. This renames the global exercises in the live database. (This step is manual and cannot be committed.)

---

## Task 2: Auto-activate another routine when the active one is deleted

**Background:** When a user deletes their active routine, the app sets `active_routine_id = null` and leaves them with no routine. If other routines exist, the most recently created one should be activated automatically.

**Files:**
- Modify: `src/app/pulse/actions.ts` (server action `deleteRoutine`)

No unit test is possible for this server action without a real Supabase instance. The change is verified by code inspection and a manual smoke test.

- [ ] **Step 1: Update `deleteRoutine` in `src/app/pulse/actions.ts`**

Find the current block (around line 313–319):
```ts
if (profile?.active_routine_id === id) {
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ active_routine_id: null })
        .eq('id', user.id);
    if (profileError) throw new Error('Failed to clear active routine');
}
```

Replace with:
```ts
if (profile?.active_routine_id === id) {
    // Find the most recently created remaining routine to activate
    const { data: others } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    const nextId = others?.[0]?.id ?? null;

    const { error: profileError } = await supabase
        .from('profiles')
        .update({ active_routine_id: nextId })
        .eq('id', user.id);
    if (profileError) throw new Error('Failed to update active routine');
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pulse/actions.ts
git commit -m "fix(library): auto-activate another routine when the active routine is deleted"
```

---

## Task 3: Allow editing exercise default sets/reps in the library

**Background:** The edit form for user-created exercises in the Library only allows renaming. It should also allow changing `default_sets` and `default_reps`, since these affect how the exercise appears when added to a routine.

**Files:**
- Modify: `src/app/pulse/actions.ts`
- Modify: `src/hooks/pulse/useRoutines.ts`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/views/LibraryView.tsx`
- Modify: `src/components/pulse/__tests__/LibraryView.test.tsx`

- [ ] **Step 1: Write failing tests in `src/components/pulse/__tests__/LibraryView.test.tsx`**

Add these two tests inside `describe('LibraryView', ...)` (after the existing test that covers `updateExercise`):

```ts
it('shows sets and reps inputs when editing a user exercise', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('button', { name: /edit cable fly/i }));
    expect(screen.getByRole('spinbutton', { name: /default sets/i })).toBeInTheDocument();
    // Or if sets/reps are text inputs:
    expect(screen.getByLabelText(/default sets/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default reps/i)).toBeInTheDocument();
});

it('calls updateExercise with name, sets, and reps when edit is saved', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('button', { name: /edit cable fly/i }));

    const setsInput = screen.getByLabelText(/default sets/i);
    const repsInput = screen.getByLabelText(/default reps/i);

    await userEvent.clear(setsInput);
    await userEvent.type(setsInput, '4');
    await userEvent.clear(repsInput);
    await userEvent.type(repsInput, '10-15');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
        expect(mocks.updateExercise).toHaveBeenCalledWith('u1', 'Cable Fly', '4', '10-15');
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- LibraryView
```
Expected: both new tests FAIL — sets/reps inputs not present in the edit form.

- [ ] **Step 3: Extend `updateExercise` in `src/app/pulse/actions.ts`**

Replace the current `updateExercise` function (lines 240–257):

```ts
export async function updateExercise(
    id: string,
    name: string,
    defaultSets: string,
    defaultReps: string,
): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) throw new Error('Invalid exercise name');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid sets/reps');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('exercises')
        .update({ name: trimmedName, default_sets: trimmedSets, default_reps: trimmedReps })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update exercise');
}
```

- [ ] **Step 4: Update `updateExercise` in `src/hooks/pulse/useRoutines.ts`**

Replace (lines 129–132):
```ts
const updateExercise = useCallback(async (
    id: string,
    name: string,
    defaultSets: string,
    defaultReps: string,
): Promise<void> => {
    await serverUpdateExercise(id, name, defaultSets, defaultReps);
    await mutateExercises();
}, [mutateExercises]);
```

- [ ] **Step 5: Update `updateExercise` in `src/context/PulseContext.ts`**

Replace line 103:
```ts
updateExercise: (id: string, name: string) => Promise<void>;
```
With:
```ts
updateExercise: (id: string, name: string, defaultSets: string, defaultReps: string) => Promise<void>;
```

- [ ] **Step 6: Update the edit form in `src/components/pulse/views/LibraryView.tsx`**

**State additions** — after `const [editName, setEditName] = useState('');` (line 58), add:
```ts
const [editDefaultSets, setEditDefaultSets] = useState('');
const [editDefaultReps, setEditDefaultReps] = useState('');
```

**`startEdit` update** — replace the current `startEdit` function (lines 77–80):
```ts
function startEdit(ex: DbExercise) {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditDefaultSets(ex.default_sets);
    setEditDefaultReps(ex.default_reps);
}
```

**`handleEditSave` update** — replace the current function (lines 82–89):
```ts
function handleEditSave(id: string) {
    const name = editName.trim();
    if (!name) return;
    startTransition(async () => {
        await updateExercise(id, name, editDefaultSets.trim() || '3', editDefaultReps.trim() || '8-12');
        setEditingId(null);
    });
}
```

**Edit form JSX** — replace the `isEditing` block (lines 195–218). The current block only has a name input. Replace with:
```tsx
{isEditing ? (
    <div className="flex-1 flex flex-col gap-2">
        <input
            autoFocus
            aria-label={`Rename ${ex.name}`}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSave(ex.id);
                if (e.key === 'Escape') setEditingId(null);
            }}
            className={`${INPUT} w-full`}
        />
        <div className="flex gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted">Default sets</span>
                <input
                    aria-label="Default sets"
                    value={editDefaultSets}
                    onChange={(e) => setEditDefaultSets(e.target.value)}
                    className={INPUT}
                />
            </label>
            <label className="flex flex-col gap-0.5 flex-1">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted">Default reps</span>
                <input
                    aria-label="Default reps"
                    value={editDefaultReps}
                    onChange={(e) => setEditDefaultReps(e.target.value)}
                    className={INPUT}
                />
            </label>
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => handleEditSave(ex.id)}
                className={`${BTN_PRIMARY} shrink-0`}>
                Save
            </button>
            <button
                onClick={() => setEditingId(null)}
                className={`${BTN_GHOST} shrink-0`}>
                Cancel
            </button>
        </div>
    </div>
) : (
```

The closing `</>` of the old isEditing block and the rest of the non-editing JSX (`<>...name, badge, edit/delete buttons...</>`) remain unchanged.

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm run test:run -- LibraryView
```
Expected: all LibraryView tests PASS including the two new ones.

- [ ] **Step 8: Run full test suite**

```bash
npm run test:run
```
Expected: all tests PASS.

- [ ] **Step 9: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts src/components/pulse/views/LibraryView.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git commit -m "feat(library): allow editing default sets and reps for user exercises"
```

---

## Acceptance Criteria

- [ ] Exercise library shows "Dumbbell Goblet Squat" etc. (not "DB") after the SQL migration is run
- [ ] Template browser descriptions use "Dumbbell" throughout
- [ ] Deleting the active routine activates the most recently created remaining routine (or clears to null if none exist)
- [ ] Clicking Edit on a user exercise shows name + default sets + default reps inputs
- [ ] Saving the edit updates all three fields in the database
- [ ] Global exercises (user_id IS NULL) still have no Edit/Delete buttons
- [ ] All tests pass, typecheck clean
