# Mid-workout Exercise Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user swap an exercise for a same-movement-pattern alternative for the current week only, carrying their working weight across as a starting point.

**Architecture:** A small `exercise_swaps` table keyed by `(routine_exercise_id, week)` loads into a client `Swaps` map keyed `"<week>-<routineExerciseId>"` → substitute `exercise_id` (mirrors the existing Notes infrastructure exactly). The app is slot-centric (logs, PRs, volume, streaks key on `routineExerciseId`), so a swap only overrides the *displayed* exercise for one `(week, slot)`. Display surfaces resolve the exercise through the swaps map; data stays slot-keyed and untouched.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Supabase, SWR, Vitest + Testing Library. Package manager: `bun`. Verify with `bun run test:run`, `bun run typecheck`, `bun run lint`.

**Spec:** `docs/superpowers/specs/2026-06-04-11-50-47-exercise-swap-design.md`

---

## File Structure

**Create:**
- `docs/migrations/2026-06-04-11-50-47-exercise-swaps.sql` — table + RLS
- `src/hooks/pulse/useSwaps.ts` — SWR hook (mirrors `useNotes`)
- `src/app/api/pulse/swaps/route.ts` — GET handler
- `src/app/pulse/actions/swaps.ts` — `setExerciseSwap` / `clearExerciseSwap`
- `src/components/pulse/ExerciseSwapPicker.tsx` — candidate picker modal
- `src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`

**Modify:**
- `src/lib/pulse/types.ts` — add `Swaps` type
- `src/lib/pulse/utils.ts` — add `swapKey`, `resolveExercise`, `swapCandidates`
- `src/lib/pulse/queries.ts` — `loadSwaps`, extend `EXERCISES_SELECT`
- `src/app/pulse/actions.ts` — barrel re-export of `./actions/swaps`
- `src/context/PulseContext.ts` — `swaps`, `setSwap`, `clearSwap`
- `src/components/pulse/PulseProvider.tsx` — wire `useSwaps`
- `src/components/pulse/ExerciseCard.tsx` — optional swap props + resolved display
- `src/components/pulse/views/LogView.tsx` — resolve display, own picker state, wire card + guided mode
- `src/components/pulse/WorkoutModeScreen.tsx` — swap button per step
- `src/components/pulse/views/HistoryView.tsx` — swap-aware names

**Test:**
- `src/lib/pulse/__tests__/utils.test.ts` (or a new `swap.test.ts`) — helpers
- `src/lib/pulse/__tests__/queries.test.ts` — `loadSwaps` + `EXERCISES_SELECT` regression

---

## Task 1: SQL migration

**Files:**
- Create: `docs/migrations/2026-06-04-11-50-47-exercise-swaps.sql`

No automated migration runner exists; the user applies this against Supabase manually. No test.

- [ ] **Step 1: Write the migration**

```sql
-- Mid-workout exercise swap: per (routine_exercise, week) substitute exercise.
-- Week-scoped so history stays correct; the app is slot-centric and only the
-- displayed exercise changes for that week.
create table if not exists exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_exercise_id uuid not null references routine_exercises(id) on delete cascade,
  week int not null check (week between 1 and 12),
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, routine_exercise_id, week)
);

create index if not exists exercise_swaps_user_idx on exercise_swaps (user_id);

alter table exercise_swaps enable row level security;

create policy "exercise_swaps_select_own" on exercise_swaps
  for select using (auth.uid() = user_id);
create policy "exercise_swaps_insert_own" on exercise_swaps
  for insert with check (auth.uid() = user_id);
create policy "exercise_swaps_update_own" on exercise_swaps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercise_swaps_delete_own" on exercise_swaps
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-06-04-11-50-47-exercise-swaps.sql
git commit -m "feat(pulse): exercise_swaps table migration"
```

---

## Task 2: `Swaps` type + `swapKey` helper

**Files:**
- Modify: `src/lib/pulse/types.ts` (near the `Notes` type, ~line 110)
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/pulse/__tests__/utils.test.ts` (add `swapKey` to the existing import from `../utils`):

```typescript
describe('swapKey', () => {
    it('joins week and routine exercise id with a dash', () => {
        expect(swapKey(3, 'abc-123')).toBe('3-abc-123');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "swapKey"`
Expected: FAIL — `swapKey is not a function` (or import error).

- [ ] **Step 3: Add the type and helper**

In `src/lib/pulse/types.ts`, directly under the `Notes` type:

```typescript
export type Swaps = Record<string, string>; // key: `${week}-${routineExerciseId}` -> substitute exercise_id
```

In `src/lib/pulse/utils.ts` (near `logKey`):

```typescript
// Key for the per-(week, slot) exercise swap map. Mirrors the Notes keying.
export function swapKey(week: number, routineExerciseId: string): string {
    return `${week}-${routineExerciseId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "swapKey"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): Swaps type + swapKey helper"
```

---

## Task 3: `resolveExercise` helper

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `utils.test.ts` (import `resolveExercise`; the test builds minimal `DbExercise` and `RoutineExercise` shapes):

```typescript
describe('resolveExercise', () => {
    const original = { id: 'e1', name: 'Leg Press', category: 'legs', default_sets: '3', default_reps: '10', user_id: null };
    const sub = { id: 'e2', name: 'Hack Squat', category: 'legs', default_sets: '3', default_reps: '10', user_id: null };
    const re = { id: 'slot1', exercise: original } as unknown as import('../types').RoutineExercise;
    const byId = new Map([[original.id, original], [sub.id, sub]]) as Map<string, import('../types').DbExercise>;

    it('returns the substitute when a swap exists for the week/slot', () => {
        const swaps = { '4-slot1': 'e2' };
        expect(resolveExercise(re, 4, swaps, byId).name).toBe('Hack Squat');
    });

    it('returns the original when no swap exists', () => {
        expect(resolveExercise(re, 4, {}, byId).name).toBe('Leg Press');
    });

    it('falls back to the original when the substitute is missing from the lookup', () => {
        const swaps = { '4-slot1': 'gone' };
        expect(resolveExercise(re, 4, swaps, byId).name).toBe('Leg Press');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "resolveExercise"`
Expected: FAIL — `resolveExercise is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/pulse/utils.ts` (add `DbExercise`, `RoutineExercise`, `Swaps` to the type imports from `./types` if not already present):

```typescript
// Resolve the exercise a slot displays for a given week. A week-scoped swap
// overrides the slot's default exercise; falls back to the original if no swap
// exists or the substitute is gone (deleted/hidden).
export function resolveExercise(
    re: RoutineExercise,
    week: number,
    swaps: Swaps,
    exercisesById: Map<string, DbExercise>,
): DbExercise {
    const subId = swaps[swapKey(week, re.id)];
    if (!subId) return re.exercise;
    return exercisesById.get(subId) ?? re.exercise;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "resolveExercise"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): resolveExercise week-scoped swap helper"
```

---

## Task 4: `swapCandidates` helper

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe('swapCandidates', () => {
    const mk = (id: string, name: string, mp: string | null, eq: string[]) =>
        ({ id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null,
           movement_pattern: mp, equipment: eq } as unknown as import('../types').DbExercise);

    const original = mk('o', 'Barbell Bench', 'horizontal_push', ['barbell', 'bench']);
    const dbBench = mk('a', 'Dumbbell Bench', 'horizontal_push', ['dumbbell', 'bench']);
    const machine = mk('b', 'Machine Press', 'horizontal_push', ['machine']);
    const pushup = mk('c', 'Push-Up', 'horizontal_push', []);
    const row = mk('d', 'Row', 'horizontal_pull', ['dumbbell']);

    it('returns same-movement-pattern exercises, excluding the original', () => {
        const out = swapCandidates(original, [original, dbBench, machine, row], { excludeIds: new Set() });
        expect(out.map((e) => e.id)).toEqual(['a', 'b']); // 'a' first: shares 'bench' with original
    });

    it('excludes ids in excludeIds (hidden / already in session)', () => {
        const out = swapCandidates(original, [dbBench, machine], { excludeIds: new Set(['a']) });
        expect(out.map((e) => e.id)).toEqual(['b']);
    });

    it('drops exercises with no movement pattern', () => {
        const noMp = mk('x', 'Mystery', null, []);
        const out = swapCandidates(original, [pushup, noMp], { excludeIds: new Set() });
        expect(out.map((e) => e.id)).toEqual(['c']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "swapCandidates"`
Expected: FAIL — `swapCandidates is not a function`.

- [ ] **Step 3: Implement**

```typescript
// Candidate replacements for a swap: same movement pattern, excluding the
// original and any excluded ids (hidden + already in this session). Sorted by
// equipment overlap with the original (desc), then name. Exercises with no
// movement pattern are dropped.
export function swapCandidates(
    original: DbExercise,
    exercises: DbExercise[],
    opts: { excludeIds: Set<string> },
): DbExercise[] {
    const pattern = original.movement_pattern;
    if (!pattern) return [];
    const origEquip = new Set(original.equipment ?? []);
    const overlap = (e: DbExercise) => (e.equipment ?? []).filter((x) => origEquip.has(x)).length;
    return exercises
        .filter(
            (e) =>
                e.id !== original.id &&
                !opts.excludeIds.has(e.id) &&
                e.movement_pattern === pattern,
        )
        .sort((a, b) => {
            const d = overlap(b) - overlap(a);
            return d !== 0 ? d : a.name.localeCompare(b.name);
        });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "swapCandidates"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): swapCandidates ranking helper"
```

---

## Task 5: `loadSwaps` + extend `EXERCISES_SELECT`

**Files:**
- Modify: `src/lib/pulse/queries.ts`
- Test: `src/lib/pulse/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `queries.test.ts`. Import `loadSwaps` from `../queries` and reuse `UID` / `REID`:

```typescript
describe('loadExercises select', () => {
    it('includes movement_pattern and equipment for swap candidate ranking', async () => {
        const { client, calls } = makeClient({ data: [], error: null });
        await loadExercises(client, UID);
        expect(calls.select).toContain('movement_pattern');
        expect(calls.select).toContain('equipment');
    });
});

describe('loadSwaps', () => {
    it('builds a week-routineExerciseId keyed map of substitute exercise ids', async () => {
        const { client, calls } = makeClient({
            data: [{ week: 4, routine_exercise_id: REID, exercise_id: 'sub-1' }],
            error: null,
        });
        const swaps = await loadSwaps(client, UID);
        expect(calls.table).toBe('exercise_swaps');
        expect(swaps[`4-${REID}`]).toBe('sub-1');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts -t "loadSwaps"`
Expected: FAIL — `loadSwaps` is not exported.
Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts -t "swap candidate ranking"`
Expected: FAIL — select lacks `movement_pattern`.

- [ ] **Step 3: Implement**

In `src/lib/pulse/queries.ts`:

Change `EXERCISES_SELECT` (line ~15):

```typescript
const EXERCISES_SELECT = 'id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound';
```

Add a select constant near the others:

```typescript
const SWAPS_SELECT = 'week, routine_exercise_id, exercise_id';
```

Add `Swaps` to the type import from `@/lib/pulse/types`, then add the loader (after `loadNotes`):

```typescript
export async function loadSwaps(supabase: SupabaseServerClient, userId: string): Promise<Swaps> {
    const { data, error } = await supabase.from('exercise_swaps').select(SWAPS_SELECT).eq('user_id', userId);
    if (error) throw error;

    const swaps: Swaps = {};
    for (const row of data ?? []) {
        swaps[`${row.week}-${row.routine_exercise_id}`] = row.exercise_id;
    }
    return swaps;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts`
Expected: PASS (all, including existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/queries.ts src/lib/pulse/__tests__/queries.test.ts
git commit -m "feat(pulse): loadSwaps + movement_pattern/equipment in exercises select"
```

---

## Task 6: GET `/api/pulse/swaps` route

**Files:**
- Create: `src/app/api/pulse/swaps/route.ts`

No unit test (thin handler mirroring `notes/route.ts`; covered indirectly).

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadSwaps } from '@/lib/pulse/queries';
import type { Swaps } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let swaps: Swaps = {};
    try {
        swaps = await loadSwaps(supabase, user.id);
    } catch {
        swaps = {};
    }
    return NextResponse.json(swaps);
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pulse/swaps/route.ts
git commit -m "feat(pulse): GET /api/pulse/swaps route"
```

---

## Task 7: `setExerciseSwap` / `clearExerciseSwap` actions

**Files:**
- Create: `src/app/pulse/actions/swaps.ts`
- Modify: `src/app/pulse/actions.ts` (barrel)

No unit test (server action; auth helpers are mocked elsewhere and the logic mirrors the audited `notes.ts`). Verified via typecheck + manual run.

- [ ] **Step 1: Write the actions**

`src/app/pulse/actions/swaps.ts`:

```typescript
'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { assertOwnsRoutineExercise } from './_shared';

export async function setExerciseSwap(
    routineExerciseId: string,
    week: number,
    exerciseId: string,
): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 12) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    // The substitute must be a global exercise or one the user owns.
    const { data: exercise } = await supabase.from('exercises').select('user_id').eq('id', exerciseId).single();
    if (!exercise) throw new Error('Invalid exercise id');
    const exUserId = (exercise as { user_id: string | null }).user_id;
    if (exUserId !== null && exUserId !== user.id) throw new Error('Unauthorized');

    const { error } = await supabase.from('exercise_swaps').upsert(
        { user_id: user.id, routine_exercise_id: routineExerciseId, week, exercise_id: exerciseId },
        { onConflict: 'user_id,routine_exercise_id,week' },
    );
    if (error) throw new Error('Failed to save swap');
}

export async function clearExerciseSwap(routineExerciseId: string, week: number): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 12) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase
        .from('exercise_swaps')
        .delete()
        .eq('user_id', user.id)
        .eq('week', week)
        .eq('routine_exercise_id', routineExerciseId);
    if (error) throw new Error('Failed to clear swap');
}
```

- [ ] **Step 2: Add the barrel re-export**

In `src/app/pulse/actions.ts`, add a line after the other re-exports:

```typescript
export * from './actions/swaps';
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pulse/actions/swaps.ts src/app/pulse/actions.ts
git commit -m "feat(pulse): setExerciseSwap / clearExerciseSwap actions"
```

---

## Task 8: `useSwaps` hook + context wiring

**Files:**
- Create: `src/hooks/pulse/useSwaps.ts`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/PulseProvider.tsx`

No unit test for the hook (mirrors `useNotes`, which is covered); typecheck + the component tests downstream exercise it.

- [ ] **Step 1: Write the hook**

`src/hooks/pulse/useSwaps.ts`:

```typescript
import useSWR from 'swr';
import { useCallback } from 'react';
import { setExerciseSwap, clearExerciseSwap } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import { swapKey } from '@/lib/pulse/utils';
import type { Swaps } from '@/lib/pulse/types';

const SWAPS_KEY = '/api/pulse/swaps';
const EMPTY_SWAPS: Swaps = {};

export function useSwaps() {
    const { data, mutate, isLoading, error } = useSWR<Swaps>(SWAPS_KEY, fetcher, SWR_READ_OPTS);
    const swaps = data ?? EMPTY_SWAPS;

    const setSwap = useCallback(
        async (week: number, routineExerciseId: string, exerciseId: string): Promise<void> => {
            mutate({ ...swaps, [swapKey(week, routineExerciseId)]: exerciseId }, false);
            await setExerciseSwap(routineExerciseId, week, exerciseId);
            mutate();
        },
        [swaps, mutate],
    );

    const clearSwap = useCallback(
        async (week: number, routineExerciseId: string): Promise<void> => {
            const updated = { ...swaps };
            delete updated[swapKey(week, routineExerciseId)];
            mutate(updated, false);
            await clearExerciseSwap(routineExerciseId, week);
            mutate();
        },
        [swaps, mutate],
    );

    return { swaps, setSwap, clearSwap, loading: isLoading, error };
}
```

- [ ] **Step 2: Extend the context interface**

In `src/context/PulseContext.ts`, add to the imports `Swaps` from the types module, and add these members near `notes` (after the `deleteNote` line ~51):

```typescript
    swaps: Swaps;
    setSwap: (week: number, routineExerciseId: string, exerciseId: string) => Promise<void>;
    clearSwap: (week: number, routineExerciseId: string) => Promise<void>;
```

- [ ] **Step 3: Wire the provider**

In `src/components/pulse/PulseProvider.tsx`:

Add the import near the other hook imports:

```typescript
import { useSwaps } from '@/hooks/pulse/useSwaps';
```

Add the hook call near the `useNotes` line (~75):

```typescript
    const { swaps, setSwap, clearSwap } = useSwaps();
```

Add a memo near `notesValue` (~274):

```typescript
    const swapsValue = useMemo(() => ({ swaps, setSwap, clearSwap }), [swaps, setSwap, clearSwap]);
```

Spread it into the context value object alongside `...notesValue` and add `swapsValue` to that `useMemo`'s dependency array (both near lines 289–301).

- [ ] **Step 4: Typecheck + existing tests**

Run: `bun run typecheck && bun run test:run src/components/pulse/__tests__/PulseProvider.test.tsx`
Expected: no type errors; PulseProvider tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useSwaps.ts src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx
git commit -m "feat(pulse): useSwaps hook + context wiring"
```

---

## Task 9: `ExerciseSwapPicker` component

**Files:**
- Create: `src/components/pulse/ExerciseSwapPicker.tsx`
- Test: `src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`

The picker is presentational: the caller passes precomputed `candidates` (via `swapCandidates`) and select/revert/close callbacks.

- [ ] **Step 1: Write the failing test**

`src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import type { DbExercise } from '@/lib/pulse/types';

const mk = (id: string, name: string): DbExercise =>
    ({ id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null,
       movement_pattern: 'horizontal_push', equipment: [] }) as DbExercise;

const candidates = [mk('a', 'Dumbbell Bench'), mk('b', 'Machine Press')];

function setup(overrides = {}) {
    const props = {
        originalName: 'Barbell Bench',
        week: 4,
        candidates,
        isSwapped: false,
        onSelect: vi.fn(),
        onRevert: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
    render(<ExerciseSwapPicker {...props} />);
    return props;
}

describe('ExerciseSwapPicker', () => {
    it('lists candidates and calls onSelect with the chosen exercise id', async () => {
        const props = setup();
        await userEvent.click(screen.getByText('Dumbbell Bench'));
        expect(props.onSelect).toHaveBeenCalledWith('a');
    });

    it('shows a revert option only when a swap is active', () => {
        const { rerender } = render(
            <ExerciseSwapPicker originalName="Barbell Bench" week={4} candidates={candidates}
                isSwapped={false} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.queryByRole('button', { name: /revert/i })).not.toBeInTheDocument();
        rerender(
            <ExerciseSwapPicker originalName="Barbell Bench" week={4} candidates={candidates}
                isSwapped={true} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument();
    });

    it('shows an empty state when there are no candidates', () => {
        setup({ candidates: [] });
        expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

`src/components/pulse/ExerciseSwapPicker.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { DbExercise } from '@/lib/pulse/types';

interface Props {
    originalName: string;
    week: number;
    candidates: DbExercise[];
    isSwapped: boolean;
    onSelect: (exerciseId: string) => void;
    onRevert: () => void;
    onClose: () => void;
}

export default function ExerciseSwapPicker({
    originalName,
    week,
    candidates,
    isSwapped,
    onSelect,
    onRevert,
    onClose,
}: Props) {
    const [query, setQuery] = useState('');
    const filtered = query.trim()
        ? candidates.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
        : candidates;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label={`Swap ${originalName}`}
            onClick={onClose}>
            <div
                className="w-full sm:max-w-[440px] max-h-[80vh] flex flex-col bg-pulse-surface rounded-t-2xl sm:rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                    <h2 className="font-pulse text-base font-semibold text-pulse-text">Swap {originalName}</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="font-pulse text-pulse-muted bg-transparent border-none cursor-pointer text-lg leading-none">
                        ✕
                    </button>
                </div>
                <p className="font-pulse text-[0.75rem] text-pulse-dim mb-3">
                    Your week-{week} weight carries over as a starting point.
                </p>

                {isSwapped && (
                    <button
                        onClick={onRevert}
                        className="font-pulse text-sm font-semibold text-pulse-accent bg-pulse-accent/10 rounded-lg px-3 py-2.5 mb-3 border-none cursor-pointer text-left">
                        Revert to {originalName}
                    </button>
                )}

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search alternatives…"
                    className="w-full bg-pulse-bg border border-pulse-border rounded-lg text-pulse-text font-pulse text-sm px-3 py-2 mb-3 outline-none focus:border-pulse-accent/50"
                />

                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
                    {filtered.length === 0 ? (
                        <p className="font-pulse text-sm text-pulse-muted py-6 text-center">
                            No alternatives available.
                        </p>
                    ) : (
                        filtered.map((e) => (
                            <button
                                key={e.id}
                                onClick={() => onSelect(e.id)}
                                className="text-left bg-pulse-bg rounded-lg px-3.5 py-3 border-none cursor-pointer hover:bg-pulse-surface-2">
                                <div className="font-pulse text-[0.9375rem] font-medium text-pulse-text">{e.name}</div>
                                <div className="font-pulse text-[0.6875rem] tracking-[0.04em] uppercase text-pulse-muted mt-0.5">
                                    {WORKOUT_TYPE_LABELS[e.category as keyof typeof WORKOUT_TYPE_LABELS] ?? e.category}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
```

Note: `e.category` is an `ExerciseCategory`; the label lookup is best-effort and falls back to the raw category string.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/ExerciseSwapPicker.tsx src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx
git commit -m "feat(pulse): ExerciseSwapPicker component"
```

---

## Task 10: `ExerciseCard` resolved display + swap affordance

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx`
- Test: `src/components/pulse/__tests__/ExerciseCard.test.tsx`

New props are **optional** so existing callers (SupersetCard, tests) keep working; `displayExercise` defaults to `re.exercise`, and the swap UI only renders when `onSwap` is provided.

- [ ] **Step 1: Write the failing test**

Add to `src/components/pulse/__tests__/ExerciseCard.test.tsx` (follow the file's existing render helper/props; this shows the new behavior):

```typescript
it('renders the displayExercise name and a swapped-from line when swapped', async () => {
    const onSwap = vi.fn();
    renderCard({
        displayExercise: { id: 'sub', name: 'Hack Squat', category: 'legs', default_sets: '3', default_reps: '10', user_id: null },
        isSwapped: true,
        originalName: 'Leg Press',
        onSwap,
        onRevert: vi.fn(),
    });
    expect(screen.getByText('Hack Squat')).toBeInTheDocument();
    expect(screen.getByText(/swapped from leg press/i)).toBeInTheDocument();
});
```

If the existing test file has no `renderCard` helper, render `<ExerciseCard .../>` directly with the file's existing baseline props plus the overrides above.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/ExerciseCard.test.tsx -t "swapped"`
Expected: FAIL — name still shows the original / no swapped line.

- [ ] **Step 3: Implement**

In `src/components/pulse/ExerciseCard.tsx`:

Add to the `Props` interface:

```typescript
    // Display exercise for the active week (may differ from re.exercise when a
    // swap is active). Defaults to re.exercise. Swap controls render only when
    // onSwap is provided.
    displayExercise?: import('@/lib/pulse/types').DbExercise;
    isSwapped?: boolean;
    originalName?: string;
    onSwap?: () => void;
    onRevert?: () => void;
```

In the destructure, add `displayExercise, isSwapped = false, originalName, onSwap, onRevert` and near the top of the component body:

```typescript
    const display = displayExercise ?? re.exercise;
```

Replace the header name (`re.exercise.name`) and the subtitle/instruction references with `display`:
- Title: `{display.name}`
- aria-label: use `display.name`
- "How to perform" guard: `{display.user_id === null && onSwap === undefined ? ... }` — keep the instructions button using `display.id` / `display.name`; the `ExerciseInstructionModal` props become `exerciseId={display.id}` and `exerciseName={display.name}`.
- The PR toast still uses `re.id` (slot) and `re.exercise.name` is fine to switch to `display.name`.

Add the swap controls inside the expanded section (after the "How to perform" button), rendered only when `onSwap`:

```tsx
{onSwap && (
    <div className="self-start flex items-center gap-3">
        <button
            onClick={onSwap}
            className="flex items-center gap-1.5 font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-accent">
            ⇄ Swap exercise
        </button>
        {isSwapped && (
            <span className="font-pulse text-[0.75rem] text-pulse-muted">
                Swapped from {originalName}
                {onRevert && (
                    <button
                        onClick={onRevert}
                        className="ml-1.5 text-pulse-accent bg-transparent border-none cursor-pointer">
                        Revert
                    </button>
                )}
            </span>
        )}
    </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:run src/components/pulse/__tests__/ExerciseCard.test.tsx`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/ExerciseCard.tsx src/components/pulse/__tests__/ExerciseCard.test.tsx
git commit -m "feat(pulse): ExerciseCard resolved display + swap affordance"
```

---

## Task 11: Wire swap into `LogView` (train list + guided mode)

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/WorkoutModeScreen.tsx`

- [ ] **Step 1: Add resolution + picker state in LogView**

Pull `exercises`, `swaps`, `setSwap`, `clearSwap`, `hiddenExerciseIds` from `usePulse()` (add to the existing destructure). Add imports:

```typescript
import { useMemo, useState } from 'react';
import { resolveExercise, swapCandidates } from '@/lib/pulse/utils';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import type { DbExercise } from '@/lib/pulse/types';
```

Add derived data near the other `useMemo`s:

```typescript
    const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
    // Exercise ids already shown in this session (resolved), so candidates never duplicate one.
    const inSessionIds = useMemo(
        () => new Set(routineExercises.map((re) => resolveExercise(re, activeWeek, swaps, exercisesById).id)),
        [routineExercises, activeWeek, swaps, exercisesById],
    );
    const [swapTarget, setSwapTarget] = useState<RoutineExercise | null>(null);
```

- [ ] **Step 2: Render the picker overlay**

Near the other overlays (after `shareSession`), add:

```tsx
{swapTarget && (() => {
    const original = exercisesById.get(swapTarget.exercise_id) ?? swapTarget.exercise;
    const candidates = swapCandidates(original, exercises, {
        excludeIds: new Set([...hiddenExerciseIds, ...inSessionIds]),
    });
    const swapped = !!swaps[`${activeWeek}-${swapTarget.id}`];
    return (
        <ExerciseSwapPicker
            originalName={original.name}
            week={activeWeek}
            candidates={candidates}
            isSwapped={swapped}
            onSelect={(exId) => { setSwap(activeWeek, swapTarget.id, exId); setSwapTarget(null); }}
            onRevert={() => { clearSwap(activeWeek, swapTarget.id); setSwapTarget(null); }}
            onClose={() => setSwapTarget(null)}
        />
    );
})()}
```

- [ ] **Step 3: Pass resolved props to ExerciseCard**

In the `groupExercises(routineExercises).map(...)` block, for the non-array (`ExerciseCard`) branch, compute and pass:

```tsx
<ExerciseCard
    key={item.id}
    routineExercise={item}
    displayExercise={resolveExercise(item, activeWeek, swaps, exercisesById)}
    isSwapped={!!swaps[`${activeWeek}-${item.id}`]}
    originalName={(exercisesById.get(item.exercise_id) ?? item.exercise).name}
    onSwap={() => setSwapTarget(item)}
    onRevert={() => clearSwap(activeWeek, item.id)}
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
    lastSession={lastSessionMap.get(item.id) ?? null}
/>
```

(SupersetCard is left unchanged in this version — swapping a paired exercise is out of scope for v1 per the spec's edge-case note; pairs render as before.)

- [ ] **Step 4: Guided-mode swap (WorkoutModeScreen)**

`WorkoutModeScreen` receives `exercises` (already the variant-filtered list). To show swapped names and offer a swap button, pass two extra props from LogView: a resolver and a swap-open callback. In LogView where `<WorkoutModeScreen ... />` renders, add:

```tsx
resolveDisplay={(re: RoutineExercise) => resolveExercise(re, activeWeek, swaps, exercisesById)}
onSwapExercise={(re: RoutineExercise) => setSwapTarget(re)}
```

In `WorkoutModeScreen`, add to `Props`:

```typescript
    resolveDisplay?: (re: RoutineExercise) => DbExercise;
    onSwapExercise?: (re: RoutineExercise) => void;
```

(import `DbExercise` and `RoutineExercise` from types). Where the current step's exercise name is shown, use `(resolveDisplay?.(re) ?? re.exercise).name`. Add a small "⇄ Swap" button near the step header that calls `onSwapExercise?.(re)` for the current step's `RoutineExercise`. The picker itself lives in LogView and renders above the guided screen, so opening it from guided mode reuses the same overlay.

- [ ] **Step 5: Typecheck + run affected tests**

Run: `bun run typecheck && bun run test:run src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`
Expected: no type errors; tests pass (update any LogView/WorkoutModeScreen test mocks that now need `exercises`, `swaps`, `setSwap`, `clearSwap`, `hiddenExerciseIds` on the mocked context — add them as `[]`/`{}`/`new Set()`/`vi.fn()`).

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/views/LogView.tsx src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
git commit -m "feat(pulse): wire exercise swap into train list + guided mode"
```

---

## Task 12: HistoryView swap-aware names

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`
- Test: `src/components/pulse/__tests__/HistoryView` (only if one exists; otherwise verify via typecheck + manual)

History renders past sessions' sets per `routineExerciseId`. A set logged in a week that had a swap should display the substitute's name.

- [ ] **Step 1: Resolve names through swaps**

In `HistoryView`, pull `swaps` and `exercises` from `usePulse()` and build `exercisesById` (`new Map(exercises.map((e) => [e.id, e]))`). Wherever a session set's exercise name is rendered, the component already maps `routineExerciseId → RoutineExercise` (call it `reById`). Replace the name lookup with:

```typescript
// name for a set in a given week, honoring a week-scoped swap
const nameForSet = (routineExerciseId: string, week: number): string => {
    const re = reById.get(routineExerciseId);
    if (!re) return '';
    const subId = swaps[`${week}-${routineExerciseId}`];
    if (subId) return exercisesById.get(subId)?.name ?? re.exercise.name;
    return re.exercise.name;
};
```

Use `nameForSet(set.routineExerciseId, session.week)` where the name is rendered. (If `HistoryView` delegates names to `computeHistoryBundle`, thread `swaps` + `exercisesById` into that call and resolve there instead — keep the same fallback logic.)

- [ ] **Step 2: Typecheck + tests**

Run: `bun run typecheck && bun run test:run`
Expected: no type errors; full suite passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/views/HistoryView.tsx
git commit -m "feat(pulse): swap-aware exercise names in history"
```

---

## Task 13: Roadmap + full verification

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Move the feature to Shipped**

In `docs/roadmap.md`, remove the "Mid-workout exercise swap" row from the Near-term table and add a bullet under Shipped:

```markdown
- Mid-workout exercise swap — week-scoped `exercise_swaps` (per routine_exercise + week); same-movement-pattern candidate picker (`swapCandidates`) excluding hidden + in-session; `resolveExercise` overrides the displayed exercise for that week only (logs/PRs/volume stay slot-keyed); weight carries over via the existing slot suggestion; available from ExerciseCard, guided mode, and reflected in history
```

- [ ] **Step 2: Full verification**

Run: `bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests pass, lint clean (pre-existing `SetLogger` warning only).

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs(pulse): mark mid-workout exercise swap shipped"
```

---

## Manual verification (after merge + migration applied)

1. Apply `docs/migrations/2026-06-04-11-50-47-exercise-swaps.sql` against Supabase.
2. On `/train`, expand an exercise → "Swap exercise" → pick an alternative → confirm the card shows the new name and "Swapped from …".
3. Log a set → confirm the weight pre-filled from the slot's prior week.
4. Reload → swap persists for the current week.
5. Change the week selector → confirm the slot reverts to the original next week.
6. "Revert" → confirm the original returns.
7. Guided mode → swap from the step header → same behavior.
8. History → a swapped week shows the substitute name.
