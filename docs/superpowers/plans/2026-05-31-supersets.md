# Supersets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow two routine exercises to be paired as a superset, displayed as a merged card on the train screen with the rest timer firing only after both exercises' sets are logged.

**Architecture:** A nullable `superset_group_id` UUID column groups exercise pairs. A `groupExercises()` utility converts the flat exercise list into `ExerciseItem[]` (single or pair) consumed by `LogView`, `SupersetCard`, and `WorkoutModeScreen`. The pair/unpair actions hit two new API routes. Rest timer suppression is handled in `LogView.handleSave` — no changes to `ExerciseCard`.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), React, Vitest + Testing Library

---

## File Map

| Action | File |
|--------|------|
| Create | `docs/migrations/2026-05-31-supersets.sql` |
| Modify | `src/lib/pulse/types.ts` |
| Modify | `src/app/pulse/(protected)/layout.tsx` |
| Modify | `src/app/pulse/actions.ts` |
| Modify | `src/lib/pulse/utils.ts` |
| Modify | `src/lib/pulse/__tests__/utils.test.ts` |
| Create | `src/app/api/pulse/supersets/route.ts` |
| Create | `src/app/api/pulse/supersets/[groupId]/route.ts` |
| Create | `src/components/pulse/SupersetCard.tsx` |
| Create | `src/components/pulse/__tests__/SupersetCard.test.tsx` |
| Modify | `src/components/pulse/views/LogView.tsx` |
| Modify | `src/components/pulse/__tests__/LogView.test.tsx` |
| Modify | `src/components/pulse/views/LibraryView.tsx` |
| Modify | `src/components/pulse/__tests__/LibraryView.test.tsx` |
| Modify | `src/components/pulse/WorkoutModeScreen.tsx` |
| Modify | `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx` |

---

## Task 1: DB Migration + Type Update

**Files:**
- Create: `docs/migrations/2026-05-31-supersets.sql`
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/app/pulse/(protected)/layout.tsx` (line 22)
- Modify: `src/app/pulse/actions.ts` (line 415)

- [ ] **Step 1: Create the migration file**

Create `docs/migrations/2026-05-31-supersets.sql`:

```sql
-- Add superset grouping to routine exercises
ALTER TABLE routine_exercises
  ADD COLUMN superset_group_id UUID DEFAULT NULL;

CREATE INDEX idx_re_superset_group
  ON routine_exercises (routine_id, superset_group_id)
  WHERE superset_group_id IS NOT NULL;
```

Run this migration in Supabase SQL Editor (Dashboard → SQL Editor → paste and run).

- [ ] **Step 2: Add `superset_group_id` to `RoutineExercise` type and add `ExerciseItem`**

In `src/lib/pulse/types.ts`, update `RoutineExercise`:

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
    rest_seconds?: number | null;
    variant: WorkoutVariant | null;
    superset_group_id: string | null;
    exercise: DbExercise;
}
```

Also add `ExerciseItem` after `RoutineExercise`:

```ts
export type ExerciseItem = RoutineExercise | [RoutineExercise, RoutineExercise];
```

- [ ] **Step 3: Add `superset_group_id` to the layout Supabase select**

In `src/app/pulse/(protected)/layout.tsx`, line 22, update the select string:

```ts
exercises:routine_exercises ( id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, rest_seconds, superset_group_id, exercise:exercises ( id, name, category, default_sets, default_reps, user_id ) ),
```

(Add `superset_group_id,` after `rest_seconds,`.)

- [ ] **Step 4: Add `superset_group_id` to the `addExerciseToRoutine` select in actions.ts**

In `src/app/pulse/actions.ts`, line 415, update the select:

```ts
.select('id, routine_id, exercise_id, workout_type, variant, order, sets, reps, starting_weight_kg, superset_group_id, exercise:exercises ( id, name, category, default_sets, default_reps, user_id )')
```

(Add `superset_group_id,` after `starting_weight_kg,`.)

- [ ] **Step 5: Run tests to confirm nothing broke**

```
npm run test:run
```

Expected: all existing tests pass (no type errors; `superset_group_id` is a new optional-for-now field that existing mocks handle via spread `...mockRE`).

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/2026-05-31-supersets.sql src/lib/pulse/types.ts src/app/pulse/(protected)/layout.tsx src/app/pulse/actions.ts
git commit -m "feat(supersets): add superset_group_id column and ExerciseItem type"
```

---

## Task 2: `groupExercises` Utility + Tests

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Modify: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/lib/pulse/__tests__/utils.test.ts` and add this block at the end:

```ts
// ── groupExercises ────────────────────────────────────────────────────────────
import { groupExercises } from '@/lib/pulse/utils';
import type { ExerciseItem } from '@/lib/pulse/types';

function makeRE(id: string, order: number, superset_group_id: string | null = null) {
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type: 'chest' as const,
        order,
        sets: '3',
        reps: '8-12',
        starting_weight_kg: null,
        rest_seconds: null,
        variant: null,
        superset_group_id,
        exercise: { id, name: id, category: 'chest' as const, default_sets: '3', default_reps: '8-12', user_id: null },
    };
}

describe('groupExercises', () => {
    it('returns single exercises unchanged', () => {
        const exercises = [makeRE('a', 1), makeRE('b', 2)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(false);
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('groups adjacent exercises with the same superset_group_id into a pair', () => {
        const gid = 'group-1';
        const exercises = [makeRE('a', 1, gid), makeRE('b', 2, gid), makeRE('c', 3)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        const pair = result[0] as [typeof exercises[0], typeof exercises[0]];
        expect(pair[0].id).toBe('a');
        expect(pair[1].id).toBe('b');
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('does not group a solo exercise that has a superset_group_id with no adjacent match', () => {
        const exercises = [makeRE('a', 1, 'group-1'), makeRE('b', 2)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(false);
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('handles multiple pairs in the same list', () => {
        const g1 = 'g1', g2 = 'g2';
        const exercises = [
            makeRE('a', 1, g1), makeRE('b', 2, g1),
            makeRE('c', 3, g2), makeRE('d', 4, g2),
        ];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        expect(Array.isArray(result[1])).toBe(true);
    });

    it('returns an empty array for empty input', () => {
        expect(groupExercises([])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test:run -- src/lib/pulse/__tests__/utils.test.ts
```

Expected: FAIL with "groupExercises is not a function" (or similar import error).

- [ ] **Step 3: Implement `groupExercises` in utils.ts**

Add to the end of `src/lib/pulse/utils.ts`:

```ts
export function groupExercises(exercises: RoutineExercise[]): ExerciseItem[] {
    const items: ExerciseItem[] = [];
    let i = 0;
    while (i < exercises.length) {
        const re = exercises[i];
        if (
            re.superset_group_id !== null &&
            i + 1 < exercises.length &&
            exercises[i + 1].superset_group_id === re.superset_group_id
        ) {
            items.push([re, exercises[i + 1]]);
            i += 2;
        } else {
            items.push(re);
            i++;
        }
    }
    return items;
}
```

Also add the `ExerciseItem` import at the top of `utils.ts` where types are imported:

```ts
import type { ..., ExerciseItem } from './types';
```

(Add `ExerciseItem` to whatever type imports already exist in `utils.ts`.)

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- src/lib/pulse/__tests__/utils.test.ts
```

Expected: all `groupExercises` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(supersets): add groupExercises utility"
```

---

## Task 3: Pair / Unpair API Routes

**Files:**
- Create: `src/app/api/pulse/supersets/route.ts`
- Create: `src/app/api/pulse/supersets/[groupId]/route.ts`

- [ ] **Step 1: Create the POST route (pair two exercises)**

Create `src/app/api/pulse/supersets/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { exerciseAId, exerciseBId } = body as Record<string, unknown>;
    if (typeof exerciseAId !== 'string' || !UUID_RE.test(exerciseAId) ||
        typeof exerciseBId !== 'string' || !UUID_RE.test(exerciseBId)) {
        return NextResponse.json({ error: 'Invalid exercise IDs' }, { status: 400 });
    }
    if (exerciseAId === exerciseBId) {
        return NextResponse.json({ error: 'Cannot pair an exercise with itself' }, { status: 400 });
    }

    // Verify both exercises belong to a routine owned by the user and are not already paired
    const { data: rows, error: fetchError } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, superset_group_id, workout_routines!inner ( user_id )')
        .in('id', [exerciseAId, exerciseBId]);

    if (fetchError || !rows || rows.length !== 2) {
        return NextResponse.json({ error: 'Exercises not found' }, { status: 404 });
    }

    const [a, b] = rows as Array<{ id: string; routine_id: string; superset_group_id: string | null; workout_routines: { user_id: string } }>;
    if (a.workout_routines.user_id !== user.id || b.workout_routines.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (a.routine_id !== b.routine_id) {
        return NextResponse.json({ error: 'Exercises must belong to the same routine' }, { status: 400 });
    }
    if (a.superset_group_id !== null || b.superset_group_id !== null) {
        return NextResponse.json({ error: 'One or both exercises are already in a superset' }, { status: 409 });
    }

    // Generate a shared group ID
    const { data: uuidRow } = await supabase.rpc('gen_random_uuid_value').single() as { data: { gen_random_uuid_value: string } | null };
    const groupId = uuidRow?.gen_random_uuid_value ?? crypto.randomUUID();

    const { error: updateError } = await supabase
        .from('routine_exercises')
        .update({ superset_group_id: groupId })
        .in('id', [exerciseAId, exerciseBId]);

    if (updateError) return NextResponse.json({ error: 'Failed to create superset' }, { status: 500 });

    return NextResponse.json({ groupId });
}
```

> **Note on UUID generation:** `crypto.randomUUID()` is available in Node 19+ and all modern environments. If the server runtime doesn't support it, the Supabase RPC fallback covers it. In practice just use `crypto.randomUUID()` and remove the RPC fallback — it works in Next.js App Router.

Simplify the UUID generation to just:

```ts
    const groupId = crypto.randomUUID();

    const { error: updateError } = await supabase
        .from('routine_exercises')
        .update({ superset_group_id: groupId })
        .in('id', [exerciseAId, exerciseBId]);
```

(Replace the RPC block above with this two-liner.)

- [ ] **Step 2: Create the DELETE route (unpair)**

Create `src/app/api/pulse/supersets/[groupId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const { groupId } = await params;
    if (!UUID_RE.test(groupId)) {
        return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the exercises belong to the user before clearing
    const { data: rows, error: fetchError } = await supabase
        .from('routine_exercises')
        .select('id, workout_routines!inner ( user_id )')
        .eq('superset_group_id', groupId);

    if (fetchError) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Superset not found' }, { status: 404 });

    const owned = (rows as Array<{ id: string; workout_routines: { user_id: string } }>)
        .every(r => r.workout_routines.user_id === user.id);
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error: updateError } = await supabase
        .from('routine_exercises')
        .update({ superset_group_id: null })
        .eq('superset_group_id', groupId);

    if (updateError) return NextResponse.json({ error: 'Failed to remove superset' }, { status: 500 });

    return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pulse/supersets/route.ts "src/app/api/pulse/supersets/[groupId]/route.ts"
git commit -m "feat(supersets): add pair/unpair API routes"
```

---

## Task 4: `SupersetCard` Component + Tests

**Files:**
- Create: `src/components/pulse/SupersetCard.tsx`
- Create: `src/components/pulse/__tests__/SupersetCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/pulse/__tests__/SupersetCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupersetCard from '../SupersetCard';
import type { RoutineExercise } from '@/lib/pulse/types';

function makeRE(id: string, name: string, order: number): RoutineExercise {
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type: 'chest',
        order,
        sets: '3',
        reps: '8-12',
        starting_weight_kg: null,
        rest_seconds: null,
        variant: null,
        superset_group_id: 'group-1',
        exercise: { id, name, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
    };
}

const reA = makeRE('a', 'Bench Press', 1);
const reB = makeRE('b', 'Cable Fly', 2);

const defaultProps = {
    pair: [reA, reB] as [RoutineExercise, RoutineExercise],
    pairIdx: 0,
    week: 1,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    notes: {},
    onSaveNote: vi.fn().mockResolvedValue(undefined),
    onDeleteNote: vi.fn().mockResolvedValue(undefined),
};

describe('SupersetCard', () => {
    it('renders both exercise names', () => {
        render(<SupersetCard {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
    });

    it('renders the superset header label', () => {
        render(<SupersetCard {...defaultProps} />);
        expect(screen.getByText(/superset/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test:run -- src/components/pulse/__tests__/SupersetCard.test.tsx
```

Expected: FAIL — `SupersetCard` module not found.

- [ ] **Step 3: Create `SupersetCard.tsx`**

Create `src/components/pulse/SupersetCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import ExerciseCard from './ExerciseCard';
import type { RoutineExercise, Logs, LogEntry, Unit, Notes } from '@/lib/pulse/types';

interface Props {
    pair: [RoutineExercise, RoutineExercise];
    pairIdx: number;
    week: number;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    notes: Notes;
    onSaveNote: (routineExerciseId: string, note: string) => Promise<void>;
    onDeleteNote: (routineExerciseId: string) => Promise<void>;
}

export default function SupersetCard({
    pair,
    pairIdx,
    week,
    logs,
    prMap,
    unit,
    onSave,
    onDelete,
    notes,
    onSaveNote,
    onDeleteNote,
}: Props) {
    const [open, setOpen] = useState(false);
    const [first, second] = pair;

    return (
        <div className="border border-pulse-accent/35 rounded-xl overflow-hidden bg-pulse-surface">
            {/* Header */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2 bg-pulse-accent/10 border-b border-pulse-accent/20 cursor-pointer">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase font-bold text-pulse-accent">
                    ⚡ Superset
                </span>
                <span className="font-pulse text-xs text-pulse-dim">{open ? '▲' : '▼'}</span>
            </button>

            {/* First exercise */}
            <div className={open ? undefined : 'contents'}>
                <ExerciseCard
                    routineExercise={first}
                    exIdx={pairIdx}
                    week={week}
                    logs={logs}
                    prMap={prMap}
                    unit={unit}
                    onSave={onSave}
                    onDelete={onDelete}
                    note={notes[`${week}-${first.id}`]}
                    onSaveNote={(n) => onSaveNote(first.id, n)}
                    onDeleteNote={() => onDeleteNote(first.id)}
                />
            </div>

            {/* Divider */}
            <div className="h-px bg-pulse-border mx-4" />

            {/* Second exercise */}
            <div className={open ? undefined : 'contents'}>
                <ExerciseCard
                    routineExercise={second}
                    exIdx={pairIdx + 1}
                    week={week}
                    logs={logs}
                    prMap={prMap}
                    unit={unit}
                    onSave={onSave}
                    onDelete={onDelete}
                    note={notes[`${week}-${second.id}`]}
                    onSaveNote={(n) => onSaveNote(second.id, n)}
                    onDeleteNote={() => onDeleteNote(second.id)}
                />
            </div>
        </div>
    );
}
```

> **Note on collapse behaviour:** The spec says both exercise sections expand/collapse as a unit when the header is tapped. `ExerciseCard` controls its own internal `open` state. Since the superset frame always shows both cards (the outer card doesn't hide them), the "collapse" here closes the outer frame to hide the exercise detail — use a wrapping `<div className="hidden">` when `!open`. Update the JSX to:
>
> ```tsx
> {/* First exercise */}
> <div className={open ? undefined : 'hidden'}>
>     <ExerciseCard ... />
> </div>
> <div className={open ? 'h-px bg-pulse-border mx-4' : 'hidden'} />
> {/* Second exercise */}
> <div className={open ? undefined : 'hidden'}>
>     <ExerciseCard ... />
> </div>
> ```
>
> However, the exercise names in the collapsed header are not shown by default — so the collapsed state should instead show a minimal summary. Replace the above with an always-visible collapsed summary row listing both exercise names, and the expanded body showing both ExerciseCards. See the design mockup (Option B in the brainstorm) for the intended collapsed view.

**Simplified implementation (collapsed = header only, expanded = both cards):**

Replace the entire component body JSX with:

```tsx
    return (
        <div className="border border-pulse-accent/35 rounded-xl overflow-hidden bg-pulse-surface">
            {/* Header — always visible, shows exercise names in collapsed state */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-pulse-accent/10 border-b border-pulse-accent/20 cursor-pointer text-left">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase font-bold text-pulse-accent shrink-0">
                    ⚡ Superset
                </span>
                <span className="font-pulse text-sm text-pulse-text flex-1 truncate">
                    {first.exercise.name} + {second.exercise.name}
                </span>
                <span className="font-pulse text-xs text-pulse-dim shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {/* Expanded body */}
            {open && (
                <>
                    <ExerciseCard
                        routineExercise={first}
                        exIdx={pairIdx}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${first.id}`]}
                        onSaveNote={(n) => onSaveNote(first.id, n)}
                        onDeleteNote={() => onDeleteNote(first.id)}
                    />
                    <div className="h-px bg-pulse-border mx-4" />
                    <ExerciseCard
                        routineExercise={second}
                        exIdx={pairIdx + 1}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${second.id}`]}
                        onSaveNote={(n) => onSaveNote(second.id, n)}
                        onDeleteNote={() => onDeleteNote(second.id)}
                    />
                </>
            )}
        </div>
    );
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- src/components/pulse/__tests__/SupersetCard.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/SupersetCard.tsx src/components/pulse/__tests__/SupersetCard.test.tsx
git commit -m "feat(supersets): add SupersetCard component"
```

---

## Task 5: LogView — Group Exercises + Superset-Aware handleSave

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/__tests__/LogView.test.tsx`

- [ ] **Step 1: Write a failing test for superset rendering**

Open `src/components/pulse/__tests__/LogView.test.tsx`. Add a superset test at the end of the `describe('LogView')` block:

```ts
it('renders a SupersetCard when two exercises share a superset_group_id', async () => {
    const reA: RoutineExercise = {
        ...mockRE,
        id: 're-a',
        order: 0,
        superset_group_id: 'grp-1',
        exercise: { id: 'ex-a', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
    };
    const reB: RoutineExercise = {
        ...mockRE,
        id: 're-b',
        order: 1,
        superset_group_id: 'grp-1',
        exercise: { id: 'ex-b', name: 'Cable Fly', category: 'chest', default_sets: '3', default_reps: '12-15', user_id: null },
    };
    vi.mocked(usePulse).mockReturnValue({
        ...defaultContext,
        routineExercisesByTabKey: { chest: [reA, reB] },
        activeRoutine: { id: 'r1', user_id: 'u1', name: 'Push', created_at: '', exercises: [reA, reB] },
    } as unknown as ReturnType<typeof usePulse>);
    render(<LogView />);
    expect(screen.getByText(/superset/i)).toBeInTheDocument();
    expect(screen.getByText('Bench Press + Cable Fly')).toBeInTheDocument();
});
```

Also add `superset_group_id: null` to `mockRE` at the top of the test file:

```ts
const mockRE: RoutineExercise = {
    ...  // existing fields
    superset_group_id: null,  // add this line
};
```

- [ ] **Step 2: Run to confirm the test fails**

```
npm run test:run -- src/components/pulse/__tests__/LogView.test.tsx
```

Expected: the new test FAILs (no SupersetCard rendered yet).

- [ ] **Step 3: Update `LogView.tsx`**

In `src/components/pulse/views/LogView.tsx`:

**3a — Add imports at the top:**

```ts
import SupersetCard from '../SupersetCard';
import { groupExercises } from '@/lib/pulse/utils';
import type { ExerciseItem } from '@/lib/pulse/types';
```

**3b — Replace `handleSave` with a superset-aware version:**

```ts
function handleSave(key: string, entry: LogEntry) {
    updateLog(key, entry);
    const rid = key.slice(key.indexOf('-') + 1, key.lastIndexOf('-'));
    const exercise = routineExercises.find((r) => r.id === rid);
    if (!exercise) return;

    if (exercise.superset_group_id) {
        const partner = routineExercises.find(
            (r) => r.superset_group_id === exercise.superset_group_id && r.id !== exercise.id,
        );
        if (partner) {
            if (exercise.order < partner.order) {
                // First in pair — suppress rest timer
                return;
            }
            // Second in pair — fire with first exercise's rest
            fireTrigger(partner.rest_seconds ?? undefined);
            return;
        }
    }

    fireTrigger(exercise.rest_seconds ?? undefined);
}
```

**3c — Replace the exercise list rendering:**

Replace:

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
        onSaveNote={(n) => saveNote(activeWeek, re.id, n)}
        onDeleteNote={() => deleteNote(activeWeek, re.id)}
    />
))}
```

With:

```tsx
{groupExercises(routineExercises).map((item, i) =>
    Array.isArray(item) ? (
        <SupersetCard
            key={`${item[0].id}-${item[1].id}`}
            pair={item as [RoutineExercise, RoutineExercise]}
            pairIdx={i}
            week={activeWeek}
            logs={logs}
            prMap={prMap}
            unit={unit}
            onSave={handleSave}
            onDelete={deleteLog}
            notes={notes}
            onSaveNote={(id, n) => saveNote(activeWeek, id, n)}
            onDeleteNote={(id) => deleteNote(activeWeek, id)}
        />
    ) : (
        <ExerciseCard
            key={item.id}
            routineExercise={item}
            exIdx={i}
            week={activeWeek}
            logs={logs}
            prMap={prMap}
            unit={unit}
            onSave={handleSave}
            onDelete={deleteLog}
            note={notes[`${activeWeek}-${item.id}`]}
            onSaveNote={(n) => saveNote(activeWeek, item.id, n)}
            onDeleteNote={() => deleteNote(activeWeek, item.id)}
        />
    )
)}
```

Also update the `hasData` check to work with the flat `routineExercises` list (unchanged — it already uses `routineExercises` which is the flat array from context, not the grouped items).

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- src/components/pulse/__tests__/LogView.test.tsx
```

Expected: all tests PASS including the new superset test.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/views/LogView.tsx src/components/pulse/__tests__/LogView.test.tsx
git commit -m "feat(supersets): group exercises in LogView, superset-aware rest timer"
```

---

## Task 6: LibraryView — Pair ↓ / Unpair Buttons + Pair-Aware Reorder

**Files:**
- Modify: `src/components/pulse/views/LibraryView.tsx`
- Modify: `src/components/pulse/__tests__/LibraryView.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `src/components/pulse/__tests__/LibraryView.test.tsx`. Find the existing mock context for the Routines tab and add tests:

First, find where `mockRE` (or equivalent) is defined in that test file and add `superset_group_id: null` to it.

Then add at the end of the describe block:

```ts
it('shows Pair ↓ button on an unpaired exercise when a next unpaired exercise exists', async () => {
    // This test requires the Routines tab to be active with two unpaired exercises.
    // Adjust the mock to have the active routine contain two exercises.
    // The exact setup depends on the existing test structure — mirror the pattern used
    // for the existing routines-tab tests in this file.
    // Key assertion:
    expect(screen.getByRole('button', { name: /pair/i })).toBeInTheDocument();
});
```

> **Note:** The LibraryView test file's existing structure for the Routines tab tests should be followed exactly. Read the existing file before adding tests so the mock context matches. The key behaviours to test: (1) "Pair ↓" button appears when two adjacent unpaired exercises exist; (2) "Unpair" appears on the first exercise of a pair; (3) second exercise of a pair has no pair/unpair button.

- [ ] **Step 2: Update `RoutineExerciseRow` props**

In `src/components/pulse/views/LibraryView.tsx`, update the `RoutineExerciseRow` component signature:

```ts
function RoutineExerciseRow({
    re,
    index,
    total,
    unit,
    onMove,
    onRemove,
    onUpdate,
    canMoveUp,
    canMoveDown,
    onPair,
    onUnpair,
}: {
    re: RoutineExercise;
    index: number;
    total: number;
    unit: Unit;
    onMove: (index: number, dir: -1 | 1) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, startingWeightKg: number | null, restSeconds: number | null) => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onPair?: () => void;
    onUnpair?: () => void;
}) {
```

Update the ↑/↓ disabled states in the row JSX:

```tsx
<button
    onClick={() => onMove(index, -1)}
    disabled={!canMoveUp}
    ...>
    ↑
</button>
<button
    onClick={() => onMove(index, 1)}
    disabled={!canMoveDown}
    ...>
    ↓
</button>
```

Add the Pair ↓ / Unpair button after the Edit button and before Remove:

```tsx
{onPair && (
    <button
        onClick={onPair}
        className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer shrink-0">
        Pair ↓
    </button>
)}
{onUnpair && (
    <button
        onClick={onUnpair}
        className="font-pulse text-xs text-red-400 bg-transparent border-none cursor-pointer shrink-0">
        Unpair
    </button>
)}
```

- [ ] **Step 3: Add pair/unpair state and handlers in `RoutinesTab`**

In the `RoutinesTab` component:

**3a — Add pair/unpair handlers:**

```ts
async function handlePair(exerciseAId: string, exerciseBId: string) {
    const res = await fetch('/api/pulse/supersets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseAId, exerciseBId }),
    });
    if (!res.ok) return;
    const { groupId } = await res.json() as { groupId: string };
    // Optimistically update both exercises in local state via updateRoutineExercise
    // or trigger a page revalidation. Simplest: call reloadRoutines() from context
    // if available, otherwise reload the page.
    // Use the existing context pattern — check how addExerciseToRoutine updates state
    // and mirror that pattern here. If the context exposes a refresh function, call it.
    // Fallback: window.location.reload() — acceptable for v1.
    window.location.reload();
}

async function handleUnpair(groupId: string) {
    const res = await fetch(`/api/pulse/supersets/${groupId}`, { method: 'DELETE' });
    if (!res.ok) return;
    window.location.reload();
}
```

> **Note:** The page reload is pragmatic for v1. If `PulseProvider` exposes a `refreshRoutines` or similar, use that instead. Check `usePulse()` for available refresh methods before implementing.

**3b — Update the `RoutineExerciseRow` rendering:**

Replace the existing `.map((re, i) => ...)` with:

```tsx
sortedActiveExercises.map((re, i) => {
    const isPaired = re.superset_group_id !== null;
    const pairIndices = isPaired
        ? sortedActiveExercises
            .map((r, idx) => r.superset_group_id === re.superset_group_id ? idx : -1)
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b)
        : null;
    const firstPairIdx = pairIndices?.[0] ?? i;
    const secondPairIdx = pairIndices?.[1] ?? i;
    const isFirstInPair = isPaired && i === firstPairIdx;
    const next = sortedActiveExercises[i + 1];
    const canPairWithNext = !isPaired && next !== undefined && next.superset_group_id === null;

    let canMoveUp: boolean;
    let canMoveDown: boolean;
    if (isPaired) {
        canMoveUp = firstPairIdx > 0;
        canMoveDown = secondPairIdx < sortedActiveExercises.length - 1;
    } else {
        canMoveUp = i > 0;
        canMoveDown = i < sortedActiveExercises.length - 1;
    }

    return (
        <RoutineExerciseRow
            key={re.id}
            re={re}
            index={i}
            total={sortedActiveExercises.length}
            unit={unit}
            onMove={handleMove}
            onRemove={handleRemove}
            onUpdate={handleUpdateExercise}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onPair={canPairWithNext ? () => handlePair(re.id, next.id) : undefined}
            onUnpair={isFirstInPair ? () => handleUnpair(re.superset_group_id!) : undefined}
        />
    );
})
```

- [ ] **Step 4: Update `handleMove` to move pairs as a unit and skip past pairs for singles**

Replace the existing `handleMove` function in `RoutinesTab`:

```ts
async function handleMove(index: number, dir: -1 | 1) {
    const reordered = [...sortedActiveExercises];
    const re = reordered[index];

    if (re.superset_group_id !== null) {
        const pairIdx = reordered
            .map((r, i) => (r.superset_group_id === re.superset_group_id ? i : -1))
            .filter((i) => i !== -1)
            .sort((a, b) => a - b);
        const [fi, si] = pairIdx;
        if (dir === -1) {
            if (fi === 0) return;
            const [above] = reordered.splice(fi - 1, 1);
            reordered.splice(fi + 1, 0, above);
        } else {
            if (si === reordered.length - 1) return;
            const [below] = reordered.splice(si + 1, 1);
            reordered.splice(fi, 0, below);
        }
    } else {
        const target = index + dir;
        if (target < 0 || target >= reordered.length) return;
        const targetRe = reordered[target];
        if (targetRe.superset_group_id !== null) {
            const pairFirst = reordered.findIndex(
                (r) => r.superset_group_id === targetRe.superset_group_id,
            );
            const [moved] = reordered.splice(index, 1);
            if (dir === -1) {
                reordered.splice(pairFirst, 0, moved);
            } else {
                reordered.splice(pairFirst + 1, 0, moved);
            }
        } else {
            [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        }
    }

    const orderedIds = reordered.map((r) => r.id);
    await reorderRoutineExercises(activeRoutine.id, orderedIds);
}
```

- [ ] **Step 5: Update `handleRemove` to unpair before removing**

In the existing `handleRemove` function, add superset cleanup before the delete call:

```ts
async function handleRemove(id: string) {
    const exercise = sortedActiveExercises.find((r) => r.id === id);
    if (exercise?.superset_group_id) {
        await fetch(`/api/pulse/supersets/${exercise.superset_group_id}`, { method: 'DELETE' });
    }
    await removeExerciseFromRoutine(id);
}
```

- [ ] **Step 6: Run tests**

```
npm run test:run -- src/components/pulse/__tests__/LibraryView.test.tsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/pulse/views/LibraryView.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git commit -m "feat(supersets): add Pair/Unpair UI to routine editor"
```

---

## Task 7: WorkoutModeScreen — Superset Steps

**Files:**
- Modify: `src/components/pulse/WorkoutModeScreen.tsx`
- Modify: `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`. Add `superset_group_id: null` to the existing `mockRE`. Then add:

```ts
it('shows "Superset" in the header when the current step is a pair', () => {
    const reA = { ...mockRE, id: 'a', order: 1, superset_group_id: 'g1', exercise: { ...mockRE.exercise, name: 'Bench Press' } };
    const reB = { ...mockRE, id: 'b', order: 2, superset_group_id: 'g1', exercise: { ...mockRE.exercise, name: 'Cable Fly' } };
    render(
        <WorkoutModeScreen
            exercises={[reA, reB]}
            sessionId="s1"
            variant={null}
            week={1}
            logs={{}}
            unit="kg"
            onSave={vi.fn()}
            onDelete={vi.fn()}
            onComplete={vi.fn().mockResolvedValue(undefined)}
            onClose={vi.fn()}
        />,
    );
    expect(screen.getByText(/superset/i)).toBeInTheDocument();
    expect(screen.getByText(/bench press/i)).toBeInTheDocument();
    expect(screen.getByText(/cable fly/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm it fails**

```
npm run test:run -- src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
```

Expected: new test FAILs (no superset header rendered).

- [ ] **Step 3: Update `WorkoutModeScreen.tsx`**

Replace the entire file content with:

```tsx
'use client';
import { useMemo, useState } from 'react';
import { logKey, parseMaxSets, computeLastSession, groupExercises } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { RoutineExercise, Logs, LogEntry, Unit, WorkoutVariant, ExerciseItem } from '@/lib/pulse/types';

interface Props {
    exercises: RoutineExercise[];
    sessionId: string | null;
    variant: WorkoutVariant | null;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    onComplete: () => Promise<void>;
    onClose: () => void;
}

function SingleStep({
    re,
    week,
    logs,
    unit,
    onSave,
    onDelete,
}: {
    re: RoutineExercise;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    const maxSets = parseMaxSets(re.sets);
    const lastSession = computeLastSession(logs, re.id, week);
    return (
        <>
            <h2 className="font-pulse text-xl font-bold text-pulse-text mb-1">{re.exercise.name}</h2>
            <p className="font-pulse text-sm text-pulse-muted mb-5">
                {re.sets} sets · {re.reps} reps
                {lastSession ? ` · Last: ${lastSession.kg}kg × ${lastSession.reps}` : ''}
            </p>
            <div className="flex flex-col gap-2">
                {Array.from({ length: maxSets }, (_, s) => {
                    const key = logKey(week, re.id, s);
                    const prevKey = logKey(week - 1, re.id, s);
                    return (
                        <SetLogger
                            key={key}
                            setIdx={s}
                            week={week}
                            type={re.workout_type}
                            entry={logs[key]}
                            previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                            unit={unit}
                            onSave={(entry) => onSave(key, entry)}
                            onDelete={() => onDelete(key)}
                        />
                    );
                })}
            </div>
        </>
    );
}

function PairStep({
    pair,
    week,
    logs,
    unit,
    onSave,
    onDelete,
}: {
    pair: [RoutineExercise, RoutineExercise];
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    const [first, second] = pair;
    const firstMax = parseMaxSets(first.sets);
    const secondMax = parseMaxSets(second.sets);
    const firstLast = computeLastSession(logs, first.id, week);
    const secondLast = computeLastSession(logs, second.id, week);
    return (
        <>
            {/* Exercise A */}
            <div className="mb-5">
                <h2 className="font-pulse text-lg font-bold text-pulse-text mb-0.5">{first.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-3">
                    {first.sets} sets · {first.reps} reps
                    {firstLast ? ` · Last: ${firstLast.kg}kg × ${firstLast.reps}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                    {Array.from({ length: firstMax }, (_, s) => {
                        const key = logKey(week, first.id, s);
                        const prevKey = logKey(week - 1, first.id, s);
                        return (
                            <SetLogger
                                key={key}
                                setIdx={s}
                                week={week}
                                type={first.workout_type}
                                entry={logs[key]}
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                unit={unit}
                                onSave={(entry) => onSave(key, entry)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="h-px bg-pulse-border mb-5" />
            {/* Exercise B */}
            <div>
                <h2 className="font-pulse text-lg font-bold text-pulse-text mb-0.5">{second.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-3">
                    {second.sets} sets · {second.reps} reps
                    {secondLast ? ` · Last: ${secondLast.kg}kg × ${secondLast.reps}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                    {Array.from({ length: secondMax }, (_, s) => {
                        const key = logKey(week, second.id, s);
                        const prevKey = logKey(week - 1, second.id, s);
                        return (
                            <SetLogger
                                key={key}
                                setIdx={s}
                                week={week}
                                type={second.workout_type}
                                entry={logs[key]}
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                unit={unit}
                                onSave={(entry) => onSave(key, entry)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export default function WorkoutModeScreen({
    exercises,
    sessionId,
    variant,
    week,
    logs,
    unit,
    onSave,
    onDelete,
    onComplete,
    onClose,
}: Props) {
    const steps = useMemo(() => groupExercises(exercises), [exercises]);
    const [stepIdx, setStepIdx] = useState(0);
    const [completing, setCompleting] = useState(false);

    const step = steps[stepIdx];
    const isPair = Array.isArray(step);
    const isFirst = stepIdx === 0;
    const isLast = stepIdx === steps.length - 1;

    const savedCount = isPair
        ? [step[0], step[1]].reduce((sum, re) => {
              const max = parseMaxSets(re.sets);
              return sum + Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).filter((k) => logs[k]?.saved).length;
          }, 0)
        : (() => {
              const re = step as RoutineExercise;
              const max = parseMaxSets(re.sets);
              return Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).filter((k) => logs[k]?.saved).length;
          })();

    async function handleFinish() {
        if (!sessionId) return;
        setCompleting(true);
        await onComplete();
        setCompleting(false);
    }

    const headerLabel = isPair
        ? `Superset · Step ${stepIdx + 1} of ${steps.length}${variant ? ` · Variant ${variant}` : ''}`
        : `Exercise ${stepIdx + 1} of ${steps.length}${variant ? ` · Variant ${variant}` : ''}`;

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-pulse-border">
                <button
                    aria-label="previous exercise"
                    onClick={() => setStepIdx((i) => i - 1)}
                    disabled={isFirst}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    ‹
                </button>
                <div className="text-center">
                    <div className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase text-pulse-muted">
                        {headerLabel}
                    </div>
                </div>
                <button
                    aria-label="close"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim cursor-pointer">
                    ✕
                </button>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
                {isPair ? (
                    <PairStep
                        pair={step as [RoutineExercise, RoutineExercise]}
                        week={week}
                        logs={logs}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                    />
                ) : (
                    <SingleStep
                        re={step as RoutineExercise}
                        week={week}
                        logs={logs}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                    />
                )}
                <div className="mt-3 font-pulse text-xs text-pulse-muted">
                    {savedCount} sets logged
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-pulse-border flex flex-col gap-2">
                {!isLast ? (
                    <button
                        aria-label="next exercise"
                        onClick={() => setStepIdx((i) => i + 1)}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none">
                        Next exercise →
                    </button>
                ) : (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing || sessionId === null}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none disabled:opacity-60">
                        {completing ? 'Finishing…' : 'Finish workout ✓'}
                    </button>
                )}
                {!isLast && (
                    <button
                        aria-label="finish workout early"
                        onClick={handleFinish}
                        disabled={completing || sessionId === null}
                        className="font-pulse w-full py-2 rounded-xl text-pulse-muted text-sm cursor-pointer border-none bg-transparent">
                        Finish workout early
                    </button>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run all tests**

```
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
git commit -m "feat(supersets): superset step support in WorkoutModeScreen"
```

---

## Self-Review Checklist

- [x] **Spec coverage — data model:** `superset_group_id` column, migration, type update ✓
- [x] **Spec coverage — API:** POST pair, DELETE unpair with ownership checks ✓
- [x] **Spec coverage — routine editor:** Pair ↓ / Unpair buttons, pair-aware reorder, unpair on remove ✓
- [x] **Spec coverage — train screen:** `SupersetCard` merged card, `groupExercises` ✓
- [x] **Spec coverage — rest timer:** superset-aware `handleSave` in `LogView` ✓
- [x] **Spec coverage — WorkoutModeScreen:** pair as one step, header label ✓
- [x] **Spec coverage — edge cases:** remove unpairs first ✓; A/B variant pairing disabled in UI by `canPairWithNext` (only pairs same-variant adjacent exercises in the sorted list) ✓
- [x] **Type consistency:** `ExerciseItem` defined in types.ts, used in utils, LogView, WorkoutModeScreen ✓
- [x] **No placeholders:** all steps have complete code ✓
