# Library Redesign - Plan A (Exercises tab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Library Exercises tab into a findable, informative catalog (search + filters + grouped list + detail/form sheets + favorites), capturing generation metadata on custom exercises, and fix two consistency defects (solid `SegmentedTabs`, `ModalSheet`).

**Architecture:** A pure-logic seam (`src/lib/pulse/library.ts`) holds all filter/search/group/reps logic, unit-tested in isolation. The data layer extends the existing preference path (hidden + favorite) and the create/update-exercise actions (category + generation metadata). The UI is composed from small focused components on the shared `ModalSheet` / `SegmentedTabs` primitives; visual fidelity is governed by the locked mockups in `.superpowers/brainstorm/48630-1781421264/content/` (`overview-v2.html`, `exercises-detail.html`, `edit-exercise.html`, `responsive-v2.html`) and verified in the running browser per this project's workflow.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind v4 (`pulse-*` tokens), SWR, Supabase, Vitest + Testing Library (jsdom). Tests run with `bun run test:run <path>`.

**Spec:** `docs/superpowers/specs/2026-06-14-11-00-00-library-redesign-design.md` (sections referenced per task). This plan is **Plan A only**; Plan B (Routines tab + Templates fold-in) is a separate later plan.

**Scope boundary:** Do NOT touch the Routines tab, Templates tab, or the routine exercise editor in this plan. Do NOT add `substitution_class`/`contraindications` input. No virtualization.

**Conventions for every task:** before committing, ensure `bun run typecheck` is clean and the touched test files pass; only `git add` the exact paths listed (never run a repo-wide `bun run format`); commit messages use `feat(pulse):` / `test(pulse):` / `fix(pulse):`, subject line only, no body, no Co-Authored-By.

---

## File structure

Logic / data:
- Create `src/lib/pulse/library.ts` - pure: `filterExercises`, `groupByCategory`, `parseRepRange`, `composeRepRange`, `floatFavorites`.
- Modify `src/lib/pulse/types.ts` - widen `ExercisePreference`.
- Modify `src/app/pulse/actions/exercises.ts` - widen preference guard; extend `createExercise` / `updateExercise`.
- Modify `src/lib/pulse/queries.ts` - `loadExercisePreferences` returns hidden + favorite.
- Modify `src/app/api/pulse/preferences/route.ts` - return `{ hidden, favorite }`.
- Modify `src/hooks/pulse/usePreferences.ts` - expose `favoriteExerciseIds` + `toggleFavorite`.
- Modify `src/context/PulseContext.ts` + `src/components/pulse/PulseProvider.tsx` - thread favorites + extended create/update.
- Create `docs/migrations/2026-06-14-12-00-00-exercise-preferences-favorite.sql`.

UI:
- Create `src/components/pulse/views/library/ExerciseRow.tsx`
- Create `src/components/pulse/views/library/ExerciseDetailSheet.tsx` (replaces `ExerciseInstructionModal`)
- Create `src/components/pulse/views/library/ExerciseFilterControl.tsx`
- Create `src/components/pulse/views/library/ExerciseFormSheet.tsx`
- Rewrite `src/components/pulse/views/library/ExercisesTab.tsx`
- Modify `src/components/pulse/views/LibraryView.tsx` (solid `SegmentedTabs`)
- Delete `src/components/pulse/ExerciseInstructionModal.tsx` (after its content moves)
- Modify `src/components/pulse/ExerciseSwapPicker.tsx` + `src/components/pulse/views/library/AddRoutineExerciseForm.tsx` (favorites float)

---

## Task 1: Widen the exercise-preference type and action guard

**Files:**
- Modify: `src/lib/pulse/types.ts` (the `ExercisePreference` line, currently `export type ExercisePreference = 'hidden';`)
- Modify: `src/app/pulse/actions/exercises.ts:15` (the `preference !== 'hidden'` guard)

- [ ] **Step 1: Widen the type**

In `src/lib/pulse/types.ts`, change:
```ts
export type ExercisePreference = 'hidden' | 'favorite';
```

- [ ] **Step 2: Widen the action guard**

In `src/app/pulse/actions/exercises.ts`, the `setExercisePreference` validation currently reads:
```ts
if (preference !== null && preference !== 'hidden') throw new Error('Invalid preference');
```
Change to:
```ts
if (preference !== null && preference !== 'hidden' && preference !== 'favorite')
    throw new Error('Invalid preference');
```
The upsert on `onConflict: 'user_id,exercise_id'` already makes hidden/favorite mutually exclusive (one row per pair), which is the intended tri-state (see spec section 6).

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: clean (no consumers break; the union only widened).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/types.ts src/app/pulse/actions/exercises.ts
git commit -m "feat(pulse): allow 'favorite' exercise preference"
```

---

## Task 2: Migration to allow the 'favorite' preference value

**Files:**
- Create: `docs/migrations/2026-06-14-12-00-00-exercise-preferences-favorite.sql`

- [ ] **Step 1: Write the migration (defensive; verify the live CHECK name first)**

```sql
-- Allow 'favorite' alongside 'hidden' for user_exercise_preferences.preference.
-- v1 stored only 'hidden'. The column may carry a CHECK constraint limiting it.
-- This drops the known check (if present) and recreates it to allow both values.
-- VERIFY the live constraint name first:
--   select conname from pg_constraint
--   where conrelid = 'public.user_exercise_preferences'::regclass and contype = 'c';
-- If the name differs from the guess below, edit the DROP line to match.
-- If the column has NO check (free text), this is a harmless no-op add of one.
--
-- Apply by hand against Supabase (no automated runner in this repo).

alter table user_exercise_preferences
    drop constraint if exists user_exercise_preferences_preference_check;

alter table user_exercise_preferences
    add constraint user_exercise_preferences_preference_check
    check (preference in ('hidden', 'favorite'));
```

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-06-14-12-00-00-exercise-preferences-favorite.sql
git commit -m "feat(pulse): migration allowing 'favorite' exercise preference"
```

Hand-off: the user applies this against prod (the classifier blocks the agent from running prod DDL). Favorites writes will fail until it is applied if a CHECK exists.

---

## Task 3: Pure library helpers + tests

**Files:**
- Create: `src/lib/pulse/library.ts`
- Test: `src/lib/pulse/__tests__/library.test.ts`

Reuse existing helpers: `hasEquipment(ex, equipment)` and `isContraindicated(ex, restrictions)` from `src/lib/pulse/generation.ts`, and `EXERCISE_CATEGORIES` from `src/lib/pulse/types.ts`. `DbExercise`, `ExerciseCategory`, `EquipmentKey`, `RestrictionFlag` from `types.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { filterExercises, groupByCategory, parseRepRange, composeRepRange, floatFavorites } from '../library';
import type { DbExercise } from '../types';

const ex = (over: Partial<DbExercise>): DbExercise =>
    ({
        id: over.id ?? 'x', name: over.name ?? 'Bench Press', category: over.category ?? 'chest',
        default_sets: '3', default_reps: '8-12', user_id: over.user_id ?? null,
        equipment: over.equipment, movement_pattern: over.movement_pattern, is_compound: over.is_compound,
        substitution_class: null, contraindications: over.contraindications,
    }) as DbExercise;

describe('filterExercises', () => {
    const list = [
        ex({ id: 'a', name: 'Barbell Bench Press', category: 'chest', equipment: ['barbell', 'bench'] }),
        ex({ id: 'b', name: 'Dumbbell Lateral Raise', category: 'shoulders', equipment: ['dumbbells'] }),
        ex({ id: 'c', name: 'Back Squat', category: 'legs', equipment: ['barbell'], contraindications: ['knee'] }),
    ];

    it('matches the query across name, category, and equipment (case-insensitive)', () => {
        expect(filterExercises(list, { query: 'bench' }).map((e) => e.id)).toEqual(['a']);
        expect(filterExercises(list, { query: 'shoulders' }).map((e) => e.id)).toEqual(['b']);
        expect(filterExercises(list, { query: 'dumbbell' }).map((e) => e.id)).toEqual(['b']);
    });

    it('narrows by category', () => {
        expect(filterExercises(list, { category: 'legs' }).map((e) => e.id)).toEqual(['c']);
    });

    it('fits-my-gear keeps only exercises usable with the equipment set', () => {
        expect(filterExercises(list, { fitsGear: true, equipmentSet: ['dumbbells'] }).map((e) => e.id)).toEqual(['b']);
    });

    it('respects-restrictions hides contraindicated exercises', () => {
        expect(filterExercises(list, { respectsRestrictions: true, restrictions: ['knee'] }).map((e) => e.id)).toEqual([
            'a',
            'b',
        ]);
    });

    it('hides hidden exercises unless showHidden is set', () => {
        expect(filterExercises(list, { hiddenIds: new Set(['a']) }).map((e) => e.id)).toEqual(['b', 'c']);
        expect(filterExercises(list, { hiddenIds: new Set(['a']), showHidden: true }).map((e) => e.id)).toEqual([
            'a',
            'b',
            'c',
        ]);
    });

    it('favorites filter keeps only favorited', () => {
        expect(filterExercises(list, { favorites: true, favoriteIds: new Set(['c']) }).map((e) => e.id)).toEqual(['c']);
    });
});

describe('groupByCategory', () => {
    it('returns a Favorites group first (when any), then categories in catalog order, each with a count', () => {
        const list = [ex({ id: 'a', category: 'chest' }), ex({ id: 'b', category: 'legs' }), ex({ id: 'c', category: 'chest' })];
        const groups = groupByCategory(list, new Set(['b']));
        expect(groups[0]).toMatchObject({ key: 'favorites', label: 'Favorites', count: 1 });
        expect(groups.find((g) => g.key === 'chest')).toMatchObject({ count: 2 });
        expect(groups.some((g) => g.count === 0)).toBe(false); // empty categories omitted
    });

    it('omits the Favorites group when there are none', () => {
        const groups = groupByCategory([ex({ id: 'a', category: 'chest' })], new Set());
        expect(groups.some((g) => g.key === 'favorites')).toBe(false);
    });
});

describe('parseRepRange / composeRepRange', () => {
    it('parses a min-max range', () => {
        expect(parseRepRange('8-12')).toEqual({ from: '8', to: '12', freeform: null });
    });
    it('parses a single value as from only', () => {
        expect(parseRepRange('5')).toEqual({ from: '5', to: '', freeform: null });
    });
    it('keeps a non-conforming value as freeform (data-integrity fallback)', () => {
        expect(parseRepRange('AMRAP')).toEqual({ from: '', to: '', freeform: 'AMRAP' });
        expect(parseRepRange('8 to 12')).toEqual({ from: '', to: '', freeform: '8 to 12' });
    });
    it('composes from/to back to the canonical string', () => {
        expect(composeRepRange({ from: '8', to: '12', freeform: null })).toBe('8-12');
        expect(composeRepRange({ from: '5', to: '', freeform: null })).toBe('5');
        expect(composeRepRange({ from: '', to: '', freeform: 'AMRAP' })).toBe('AMRAP');
    });
});

describe('floatFavorites', () => {
    it('moves favorited exercises to the front, preserving relative order otherwise', () => {
        const list = [ex({ id: 'a' }), ex({ id: 'b' }), ex({ id: 'c' })];
        expect(floatFavorites(list, new Set(['c'])).map((e) => e.id)).toEqual(['c', 'a', 'b']);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/library.test.ts`
Expected: FAIL ("filterExercises is not a function" / module not found).

- [ ] **Step 3: Implement `src/lib/pulse/library.ts`**

```ts
import { EXERCISE_CATEGORIES } from './types';
import type { DbExercise, ExerciseCategory, EquipmentKey, RestrictionFlag } from './types';
import { hasEquipment, isContraindicated } from './generation';

export interface ExerciseFilter {
    query?: string;
    category?: 'all' | ExerciseCategory;
    favorites?: boolean;
    fitsGear?: boolean;
    respectsRestrictions?: boolean;
    showHidden?: boolean;
    equipmentSet?: EquipmentKey[];
    restrictions?: RestrictionFlag[];
    hiddenIds?: Set<string>;
    favoriteIds?: Set<string>;
}

// Single, testable filter seam. Order: hidden visibility, then category, then
// favorites, then fits-gear, then respects-restrictions, then free-text query.
export function filterExercises(list: DbExercise[], f: ExerciseFilter): DbExercise[] {
    const q = (f.query ?? '').trim().toLowerCase();
    const restrictions = new Set(f.restrictions ?? []);
    return list.filter((ex) => {
        if (!f.showHidden && f.hiddenIds?.has(ex.id)) return false;
        if (f.category && f.category !== 'all' && ex.category !== f.category) return false;
        if (f.favorites && !f.favoriteIds?.has(ex.id)) return false;
        if (f.fitsGear && !hasEquipment(ex, f.equipmentSet ?? [])) return false;
        if (f.respectsRestrictions && isContraindicated(ex, restrictions)) return false;
        if (q) {
            const hay = `${ex.name} ${ex.category} ${(ex.equipment ?? []).join(' ')}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

export interface ExerciseGroup {
    key: 'favorites' | ExerciseCategory;
    label: string;
    count: number;
    exercises: DbExercise[];
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Favorites pinned first (when any), then categories in catalog order. Empty
// categories are omitted. The caller decides whether to render grouped (category
// = 'all') or flat (a specific category chip selected).
export function groupByCategory(list: DbExercise[], favoriteIds: Set<string>): ExerciseGroup[] {
    const groups: ExerciseGroup[] = [];
    const favs = list.filter((e) => favoriteIds.has(e.id));
    if (favs.length > 0) groups.push({ key: 'favorites', label: 'Favorites', count: favs.length, exercises: favs });
    for (const cat of EXERCISE_CATEGORIES) {
        const inCat = list.filter((e) => e.category === cat);
        if (inCat.length > 0) groups.push({ key: cat, label: cap(cat), count: inCat.length, exercises: inCat });
    }
    return groups;
}

export interface RepRange {
    from: string;
    to: string;
    freeform: string | null;
}

const RANGE_RE = /^(\d+)\s*-\s*(\d+)$/;
const SINGLE_RE = /^(\d+)$/;

// Parse the stored default_reps string into the two-field model. A value that is
// neither "min-max" nor a single number is preserved verbatim as `freeform` so
// editing cannot corrupt it (data-integrity, spec 3.4).
export function parseRepRange(reps: string): RepRange {
    const s = (reps ?? '').trim();
    const range = s.match(RANGE_RE);
    if (range) return { from: range[1], to: range[2], freeform: null };
    const single = s.match(SINGLE_RE);
    if (single) return { from: single[1], to: '', freeform: null };
    return { from: '', to: '', freeform: s };
}

export function composeRepRange(r: RepRange): string {
    if (r.freeform !== null && r.freeform !== '') return r.freeform.trim();
    const from = r.from.trim();
    const to = r.to.trim();
    if (from && to) return `${from}-${to}`;
    return from;
}

export function floatFavorites(list: DbExercise[], favoriteIds: Set<string>): DbExercise[] {
    const fav = list.filter((e) => favoriteIds.has(e.id));
    const rest = list.filter((e) => !favoriteIds.has(e.id));
    return [...fav, ...rest];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/library.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/library.ts src/lib/pulse/__tests__/library.test.ts
git commit -m "feat(pulse): pure library filter/group/reps helpers"
```

---

## Task 4: Favorites in the data layer (loader, route, hook, context)

**Files:**
- Modify: `src/lib/pulse/queries.ts` (`loadHiddenExerciseIds` → add `loadExercisePreferences`)
- Modify: `src/app/api/pulse/preferences/route.ts`
- Modify: `src/hooks/pulse/usePreferences.ts`
- Test: `src/hooks/pulse/__tests__/usePreferences.test.tsx`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/PulseProvider.tsx`

- [ ] **Step 1: Loader returns both preferences**

In `src/lib/pulse/queries.ts`, add alongside `loadHiddenExerciseIds` (keep the old one if other callers use it; otherwise replace):
```ts
export async function loadExercisePreferences(
    supabase: SupabaseServerClient,
    userId: string,
): Promise<{ hidden: string[]; favorite: string[] }> {
    const { data, error } = await supabase
        .from('user_exercise_preferences')
        .select('exercise_id, preference')
        .eq('user_id', userId);
    if (error) throw error;
    const hidden: string[] = [];
    const favorite: string[] = [];
    for (const r of (data ?? []) as { exercise_id: string; preference: string }[]) {
        if (r.preference === 'hidden') hidden.push(r.exercise_id);
        else if (r.preference === 'favorite') favorite.push(r.exercise_id);
    }
    return { hidden, favorite };
}
```

- [ ] **Step 2: Route returns `{ hidden, favorite }`**

In `src/app/api/pulse/preferences/route.ts`, swap the loader call to `loadExercisePreferences` and return its object (replacing the prior `string[]` body). Keep auth/error handling identical to the sibling routes.

- [ ] **Step 3: Write the failing hook test**

In `src/hooks/pulse/__tests__/usePreferences.test.tsx`, update the SWR mock to return `{ hidden: ['a'], favorite: ['b'] }` and assert:
```ts
expect(result.current.hiddenExerciseIds.has('a')).toBe(true);
expect(result.current.favoriteExerciseIds.has('b')).toBe(true);
// toggling favorite on a hidden exercise clears hidden (mutual exclusivity)
await act(() => result.current.toggleFavorite('a', true));
expect(serverSetExercisePreference).toHaveBeenCalledWith('a', 'favorite');
```

- [ ] **Step 4: Implement the hook**

Rewrite `src/hooks/pulse/usePreferences.ts` to consume `{ hidden, favorite }`:
```ts
import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { setExercisePreference as serverSetExercisePreference } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';

const PREFERENCES_KEY = '/api/pulse/preferences';
const EMPTY = { hidden: [] as string[], favorite: [] as string[] };

export function usePreferences() {
    const { data, mutate, isLoading, error } = useSWR<{ hidden: string[]; favorite: string[] }>(
        PREFERENCES_KEY,
        fetcher,
        SWR_READ_OPTS,
    );
    const prefs = data ?? EMPTY;
    const hiddenExerciseIds = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
    const favoriteExerciseIds = useMemo(() => new Set(prefs.favorite), [prefs.favorite]);

    const toggleHideExercise = useCallback(
        async (exerciseId: string, hidden: boolean): Promise<void> => {
            // Mutually exclusive: hiding clears any favorite locally.
            const next = hidden
                ? { hidden: [...new Set([...prefs.hidden, exerciseId])], favorite: prefs.favorite.filter((id) => id !== exerciseId) }
                : { ...prefs, hidden: prefs.hidden.filter((id) => id !== exerciseId) };
            mutate(next, false);
            await serverSetExercisePreference(exerciseId, hidden ? 'hidden' : null);
            mutate();
        },
        [prefs, mutate],
    );

    const toggleFavorite = useCallback(
        async (exerciseId: string, favorite: boolean): Promise<void> => {
            const next = favorite
                ? { hidden: prefs.hidden.filter((id) => id !== exerciseId), favorite: [...new Set([...prefs.favorite, exerciseId])] }
                : { ...prefs, favorite: prefs.favorite.filter((id) => id !== exerciseId) };
            mutate(next, false);
            await serverSetExercisePreference(exerciseId, favorite ? 'favorite' : null);
            mutate();
        },
        [prefs, mutate],
    );

    return { hiddenExerciseIds, favoriteExerciseIds, toggleHideExercise, toggleFavorite, loading: isLoading, error };
}
```

- [ ] **Step 5: Thread through context + provider**

In `src/context/PulseContext.ts`, add to `PulseContextValue`:
```ts
favoriteExerciseIds: Set<string>;
toggleFavorite: (exerciseId: string, favorite: boolean) => Promise<void>;
```
In `src/components/pulse/PulseProvider.tsx`, destructure `favoriteExerciseIds` + `toggleFavorite` from `usePreferences()` and pass them into the context value (next to `hiddenExerciseIds` / `toggleHideExercise`).

- [ ] **Step 6: Run tests + typecheck**

Run: `bun run test:run src/hooks/pulse/__tests__/usePreferences.test.tsx` then `bun run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pulse/queries.ts src/app/api/pulse/preferences/route.ts src/hooks/pulse/usePreferences.ts src/hooks/pulse/__tests__/usePreferences.test.tsx src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx
git commit -m "feat(pulse): favorites in the exercise-preference data layer"
```

---

## Task 5: Extend createExercise / updateExercise (category + generation metadata)

**Files:**
- Modify: `src/app/pulse/actions/exercises.ts` (`createExercise`, `updateExercise`)
- Modify: `src/context/PulseContext.ts` (the two signatures) + `src/components/pulse/PulseProvider.tsx` / the exercises hook that wraps them

- [ ] **Step 1: Extend the action signatures**

Add an optional metadata object so existing callers stay valid:
```ts
export interface ExerciseMetaInput {
    movement_pattern?: string | null;
    equipment?: string[] | null;
    is_compound?: boolean | null;
}

export async function createExercise(
    name: string, category: string, defaultSets: string, defaultReps: string, meta?: ExerciseMetaInput,
): Promise<DbExercise> {
    // ...existing validation...
    const insert: Record<string, unknown> = {
        user_id: user.id, name: trimmed, category, default_sets: trimmedSets, default_reps: trimmedReps,
    };
    if (meta?.movement_pattern !== undefined) insert.movement_pattern = meta.movement_pattern;
    if (meta?.equipment !== undefined) insert.equipment = meta.equipment;
    if (meta?.is_compound !== undefined) insert.is_compound = meta.is_compound;
    const { data, error } = await supabase
        .from('exercises')
        .insert(insert)
        .select('id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound, substitution_class, contraindications')
        .single();
    if (error || !data) throw new Error('Failed to create exercise');
    return data as DbExercise;
}
```

`updateExercise` gains `category` and the same optional `meta`:
```ts
export async function updateExercise(
    id: string, name: string, category: string, defaultSets: string, defaultReps: string, meta?: ExerciseMetaInput,
): Promise<void> {
    assertUuid(id);
    // ...existing name/sets/reps validation...
    if (!EXERCISE_CATEGORIES.includes(category as ExerciseCategory)) throw new Error('Invalid category');
    const update: Record<string, unknown> = { name: trimmedName, category, default_sets: trimmedSets, default_reps: trimmedReps };
    if (meta?.movement_pattern !== undefined) update.movement_pattern = meta.movement_pattern;
    if (meta?.equipment !== undefined) update.equipment = meta.equipment;
    if (meta?.is_compound !== undefined) update.is_compound = meta.is_compound;
    const { error } = await supabase.from('exercises').update(update).eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to update exercise');
}
```

- [ ] **Step 2: Update the context signatures + the optimistic wrapper**

In `src/context/PulseContext.ts`, change `updateExercise` to `(id, name, category, defaultSets, defaultReps, meta?) => Promise<void>` and `createExercise` to accept the optional `meta`. Update the wrapping hook (the one exposing `createExercise`/`updateExercise`, in the provider or an exercises hook) to forward `category` + `meta` and keep its optimistic cache update including the metadata fields on the returned row.

- [ ] **Step 3: Typecheck (find the broken call sites)**

Run: `bun run typecheck`
Expected: errors at the existing `updateExercise(...)` call in `ExercisesTab` (now needs `category`). That call site is rewritten in Task 9/10; for now make the type compile by routing through the new sheet. If a transient call remains, pass the exercise's current category.

- [ ] **Step 4: Commit**

```bash
git add src/app/pulse/actions/exercises.ts src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx
git commit -m "feat(pulse): capture category + generation metadata on custom exercises"
```

---

## Task 6: `LibraryView` - solid SegmentedTabs, two tabs

**Files:**
- Modify: `src/components/pulse/views/LibraryView.tsx`
- Test: `src/components/pulse/views/__tests__/LibraryView.test.tsx` (create if absent)

- [ ] **Step 1: Failing test**

```tsx
// Render LibraryView, assert the tablist uses SegmentedTabs and shows exactly
// "Exercises" and "Routines" (no "Templates"), and that the active tab has the
// solid styling (aria-selected true). Mock usePulse minimally (loading false).
expect(screen.getByRole('tab', { name: 'Exercises' })).toBeInTheDocument();
expect(screen.getByRole('tab', { name: 'Routines' })).toBeInTheDocument();
expect(screen.queryByRole('tab', { name: 'Templates' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/components/pulse/views/__tests__/LibraryView.test.tsx`
Expected: FAIL (Templates tab still present / no SegmentedTabs).

- [ ] **Step 3: Implement**

Replace the inline pill-button `role="tablist"` block in `LibraryView.tsx` with the shared `SegmentedTabs` (`variant="solid"`), tabs `[{ id: 'exercises', label: 'Exercises' }, { id: 'routines', label: 'Routines' }]`, default tab `'exercises'`. Render `{tab === 'exercises' && <ExercisesTab />}` and `{tab === 'routines' && <RoutinesTab />}`. Remove the `TemplatesTab` import and its branch (Templates moves to Plan B's chooser; until then it is simply not a tab). Keep the page container and `PageTitle` unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:run src/components/pulse/views/__tests__/LibraryView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/views/LibraryView.tsx src/components/pulse/views/__tests__/LibraryView.test.tsx
git commit -m "feat(pulse): Library two-tab solid SegmentedTabs"
```

---

## Task 7: `ExerciseRow` component

**Files:**
- Create: `src/components/pulse/views/library/ExerciseRow.tsx`
- Test: `src/components/pulse/views/library/__tests__/ExerciseRow.test.tsx`

Visual reference: `overview-v2.html` (the row). Props interface:
```ts
interface ExerciseRowProps {
    exercise: DbExercise;
    favorite: boolean;
    hidden: boolean;
    showCategory: boolean; // false inside a category group, true in flat search results
    onOpen: (ex: DbExercise) => void;
    onToggleFavorite: (ex: DbExercise) => void;
}
```

- [ ] **Step 1: Failing test**

Assert: the name renders; the metadata line shows equipment + "Compound"/"Isolation" derived from `is_compound`, and the category only when `showCategory`; the favorite star has `aria-pressed={favorite}`; clicking the row body calls `onOpen`; the chevron button has `aria-label="Open details"`; clicking the star calls `onToggleFavorite` (and does NOT call `onOpen`).

- [ ] **Step 2: Run to verify it fails.** `bun run test:run src/components/pulse/views/library/__tests__/ExerciseRow.test.tsx` → FAIL.

- [ ] **Step 3: Implement** the row: a star button (left, `aria-pressed`, accent when favorite, `stopPropagation` on click), a clickable main area (name + metadata line built from `[showCategory && cap(category), equipment.join('/'), is_compound ? 'Compound' : 'Isolation'].filter(Boolean).join(' · ')`) calling `onOpen`, a chevron with `aria-label="Open details"`. Dimmed (`opacity-50`) when `hidden`. Use `pulse-*` tokens, match `overview-v2.html`.

- [ ] **Step 4: Run to verify it passes.** PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/views/library/ExerciseRow.tsx src/components/pulse/views/library/__tests__/ExerciseRow.test.tsx
git commit -m "feat(pulse): ExerciseRow with metadata + favorite star"
```

---

## Task 8: `ExerciseDetailSheet` on ModalSheet (replaces ExerciseInstructionModal)

**Files:**
- Create: `src/components/pulse/views/library/ExerciseDetailSheet.tsx`
- Test: `src/components/pulse/views/library/__tests__/ExerciseDetailSheet.test.tsx`
- (Delete `src/components/pulse/ExerciseInstructionModal.tsx` in Task 10 once no longer imported.)

Visual reference: `exercises-detail.html`. It fetches instructions from `/api/pulse/exercises/${id}/instructions` (reuse the exact fetch the current `ExerciseInstructionModal` uses). Props:
```ts
interface ExerciseDetailSheetProps {
    exercise: DbExercise;
    favorite: boolean;
    hidden: boolean;
    similar: DbExercise[]; // same substitution_class, ranked; computed by the caller
    open: boolean;
    onClose: () => void;
    onToggleFavorite: (ex: DbExercise) => void;
    onToggleHide: (ex: DbExercise) => void;
    onEdit?: (ex: DbExercise) => void; // present only for custom (user_id != null)
}
```

- [ ] **Step 1: Failing test** - render on `ModalSheet`; assert: metadata badges (category, equipment, Compound, movement pattern); a "Targets" section from mocked instructions; a "How to" section from cues (and that it is ABSENT when the exercise is custom / has no cues); a "Similar exercises" section listing the `similar` names; Favorite and Hide actions present and mutually exclusive (favoriting calls `onToggleFavorite` and the rendered Hide reflects cleared state); Edit shown only when `onEdit` is provided.

- [ ] **Step 2: Run to verify it fails.** FAIL.

- [ ] **Step 3: Implement** on the shared `ModalSheet` (`title={exercise.name}`, `subtitle` = `${cap(category)} · ${is_compound ? 'Compound' : 'Isolation'}`, `onClose`). Body sections per the mockup; "Similar exercises" header (NOT "Swap"); actions row (Favorite `aria-pressed`, Hide; Edit/Delete only for custom - Delete may live behind Edit's sheet, so the detail sheet shows Edit which opens the form). Move the muscles/cues rendering from `ExerciseInstructionModal`.

- [ ] **Step 4: Run to verify it passes.** PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/views/library/ExerciseDetailSheet.tsx src/components/pulse/views/library/__tests__/ExerciseDetailSheet.test.tsx
git commit -m "feat(pulse): exercise detail sheet on ModalSheet"
```

---

## Task 9: `ExerciseFilterControl` (advanced filters)

**Files:**
- Create: `src/components/pulse/views/library/ExerciseFilterControl.tsx`
- Test: `src/components/pulse/views/library/__tests__/ExerciseFilterControl.test.tsx`

Responsive like the `Why` affordance: a non-modal popover on desktop, a `ModalSheet` on mobile (branch on `useMediaQuery('(min-width: 1024px)')`). Props:
```ts
interface FilterState { favorites: boolean; fitsGear: boolean; respectsRestrictions: boolean; showHidden: boolean; }
interface ExerciseFilterControlProps {
    value: FilterState;
    activeProfileName: string | null; // shown on the Fits-my-gear row when set
    onChange: (next: FilterState) => void;
}
```

- [ ] **Step 1: Failing test** - the trigger button shows an active-count badge equal to the number of true flags, with `aria-live="polite"`; opening it shows four toggles each with `aria-checked`; toggling "Fits my gear" calls `onChange` with that flag flipped; the "Fits my gear" row shows the profile name when provided; the "Safe" toggle label reads "Respects my restrictions" (not "Safe for me").

- [ ] **Step 2: Run to verify it fails.** FAIL.

- [ ] **Step 3: Implement.** Trigger = filter icon + count badge. Panel = four toggle rows (`role="switch"`/`aria-checked`), labels: "Favorites", "Fits my gear" (+ profile name), "Respects my restrictions", "Show hidden". Desktop popover portaled to body + viewport-clamped (mirror `WhyPopover`); mobile `ModalSheet`.

- [ ] **Step 4: Run to verify it passes.** PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/views/library/ExerciseFilterControl.tsx src/components/pulse/views/library/__tests__/ExerciseFilterControl.test.tsx
git commit -m "feat(pulse): exercise advanced-filter control"
```

---

## Task 10: `ExerciseFormSheet` (add + edit) on ModalSheet

**Files:**
- Create: `src/components/pulse/views/library/ExerciseFormSheet.tsx`
- Test: `src/components/pulse/views/library/__tests__/ExerciseFormSheet.test.tsx`

Visual reference: `edit-exercise.html` / `new-exercise.html`. Uses `parseRepRange`/`composeRepRange` from `library.ts`. Props:
```ts
interface ExerciseFormSheetProps {
    mode: 'add' | 'edit';
    initial?: DbExercise; // required for edit
    open: boolean;
    onClose: () => void;
    onSubmit: (input: {
        name: string; category: ExerciseCategory; defaultSets: string; defaultReps: string;
        meta: { movement_pattern: string | null; equipment: string[] | null; is_compound: boolean | null } | null;
    }) => Promise<void>;
    onDelete?: (ex: DbExercise) => void; // edit + custom only
}
```

- [ ] **Step 1: Failing test** - add mode: the generation toggle defaults OFF and the metadata fields are hidden; turning it on reveals movement pattern + equipment multi-select + compound/isolation; reps are two fields (from/to). Edit mode: fields pre-filled from `initial` including category; reps from `parseRepRange(initial.default_reps)`; a non-conforming `initial.default_reps` ("AMRAP") shows a single free-text reps field instead of from/to; `onDelete` shown. Submitting composes reps via `composeRepRange` and calls `onSubmit` with the composed string and (when the toggle is on) the meta object; with the toggle off, `meta` is `null`.

- [ ] **Step 2: Run to verify it fails.** FAIL.

- [ ] **Step 3: Implement** on `ModalSheet` (`title` = "New exercise" / "Edit exercise"). Basics (name, category select, default sets, reps from/to or freeform fallback), an opt-in "Use in auto-generated routines" toggle (default off) revealing the metadata, footer Save/Cancel, and for edit+custom a destructive Delete. On a category change in edit mode where `initial` differs and the exercise has history, show a confirm note (a simple `window.confirm` is acceptable for v1; copy: "Changing the category rewrites this exercise's past volume in Progress. Continue?"). Movement-pattern friendly labels: map `MovementPattern` values to readable strings in a local `PATTERN_LABELS` const.

- [ ] **Step 4: Run to verify it passes.** PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/views/library/ExerciseFormSheet.tsx src/components/pulse/views/library/__tests__/ExerciseFormSheet.test.tsx
git commit -m "feat(pulse): add/edit exercise form sheet with generation metadata"
```

---

## Task 11: Rebuild `ExercisesTab` (toolbar, grouped list, sheets, empty state)

**Files:**
- Rewrite: `src/components/pulse/views/library/ExercisesTab.tsx`
- Modify: existing `src/components/pulse/views/library/__tests__/ExercisesTab.test.tsx` (or create)
- Delete: `src/components/pulse/ExerciseInstructionModal.tsx` (no longer imported)

Visual references: `overview-v2.html`, `responsive-v2.html`. Pulls from `usePulse()`: `exercises`, `hiddenExerciseIds`, `favoriteExerciseIds`, `toggleHideExercise`, `toggleFavorite`, `createExercise`, `updateExercise`, `deleteExercise`, the active equipment set (`resolveEquipmentPrefill(equipmentProfiles, activeEquipmentProfileId, nowIso, timezone)`), and `profile.movement_restrictions`.

- [ ] **Step 1: Failing tests**

Cover: search input filters the list (via `filterExercises`); the filter control toggles update results; the list renders grouped with a pinned Favorites header when favorites exist (`groupByCategory`); selecting a category chip flattens to that category; tapping a row opens `ExerciseDetailSheet`; "+ New" on the count row opens `ExerciseFormSheet` in add mode; an empty-results state appears (naming the active filters + a Clear button) when filters exclude everything, distinct from a truly empty catalog; on desktop the rows render in a 2-column grid (assert the grid container class under a mocked `useMediaQuery` true).

- [ ] **Step 2: Run to verify it fails.** FAIL.

- [ ] **Step 3: Implement** the assembly:
  - Toolbar (layout A): search input (`aria-label="Search exercises"`) + `ExerciseFilterControl`; removable active-filter chips below.
  - Count row: "N exercises" left, "+ New" button right (opens the form sheet, add mode).
  - List: when category = 'all', map `groupByCategory(filtered, favoriteIds)` to section headers (real heading elements) + `ExerciseRow`s (`showCategory={false}`); when a query is active or a specific category is selected, render a flat list (`showCategory={!!query}`). Desktop: rows under each header in a 2-col grid; mobile/tablet single column.
  - Sheets: `ExerciseDetailSheet` (computing `similar` via `swapCandidates`/`rankSubstitutes` over `exercises`), `ExerciseFormSheet` (add from "+ New"; edit from the detail sheet's `onEdit`, which first closes the detail sheet so the two never stack), wired to `createExercise` / `updateExercise(id, name, category, sets, reps, meta)` / `deleteExercise`.
  - Empty-results state: when `filtered.length === 0 && exercises.length > 0`, show the active-filters message + "Clear filters" (resets the filter state + query + category).
  - Delete the now-unused `ExerciseInstructionModal.tsx`.

- [ ] **Step 4: Run to verify it passes + full check**

Run: `bun run test:run src/components/pulse/views/library/__tests__/ExercisesTab.test.tsx` then `bun run typecheck` and `bun run lint`.
Expected: PASS, clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/views/library/ExercisesTab.tsx src/components/pulse/views/library/__tests__/ExercisesTab.test.tsx
git rm src/components/pulse/ExerciseInstructionModal.tsx
git commit -m "feat(pulse): rebuild Exercises tab (search, filters, grouping, sheets)"
```

---

## Task 12: Float favorites in the swap + add pickers

**Files:**
- Modify: `src/components/pulse/ExerciseSwapPicker.tsx`
- Modify: `src/components/pulse/views/library/AddRoutineExerciseForm.tsx` (confirm exact path; the routine-editor add-exercise form)
- Test: extend each component's existing test

- [ ] **Step 1: Failing test** - given a favorite set, the picker lists favorited candidates first (via `floatFavorites`), preserving other ordering.

- [ ] **Step 2: Run to verify it fails.** FAIL.

- [ ] **Step 3: Implement** - read `favoriteExerciseIds` from `usePulse()` and apply `floatFavorites(candidates, favoriteExerciseIds)` to the rendered list (after the existing same-pattern/search filtering, before render). Do not change ranking semantics otherwise.

- [ ] **Step 4: Run to verify it passes.** PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/pulse/ExerciseSwapPicker.tsx src/components/pulse/views/library/AddRoutineExerciseForm.tsx
git commit -m "feat(pulse): float favorites in swap + add pickers"
```

---

## Task 13: Verify, roadmap, finish

- [ ] **Step 1: Full suite + checks**

Run: `bun run test:run` then `bun run typecheck` then `bun run lint`.
Expected: all green; lint shows only the pre-existing `SetLogger` warning. Fix any straggler fixtures (a new required field can ripple into other component tests).

- [ ] **Step 2: Manual browser verification** (this project's workflow): run `bun run dev`, drive the logged-in app to `/pulse/library`, and verify against the locked mockups at mobile / tablet / desktop: search, each filter, grouped list + favorites, row → detail sheet, + New → form sheet (toggle off by default), edit incl. category + reps range, favorites floating in a swap. Confirm the detail/form sheets never stack.

- [ ] **Step 3: Roadmap START/FINISH + CLAUDE.md**

Before implementation began, the START should have marked `In progress: Library redesign Plan A` on this branch (do it as the first commit if not already). At finish: move the Library Exercises work to a dated Shipped bullet (or keep "In review" until merge per the ritual), update the suite count, and add a short "Library (Exercises)" note to the relevant CLAUDE.md section. Commit the sync on this branch.

- [ ] **Step 4: Code review** - request a code-reviewer subagent pass on the cumulative diff (new-logic tasks 3/4/5 especially) before opening the PR; the reviewer expectation on this project is a second-opinion pass on substantive diffs.

---

## Self-review notes (author)

- Spec coverage: search/filter/group (T3, T11), favorites + migration (T1, T2, T4, T12), custom metadata + category edit + reps range/fallback (T5, T10), detail sheet on ModalSheet + "Similar exercises" + mutual exclusivity (T8), filter control + honest "Respects my restrictions" + profile name (T9), empty-results state + desktop 2-col + no-stacking (T11), solid SegmentedTabs (T6), a11y (T7/T8/T9 aria), pickers float (T12). Routines/Templates correctly excluded (Plan B).
- Migration constraint name is unknown; T2 includes the live-verify step and a defensive drop-if-exists.
- `AddRoutineExerciseForm` exact path to be confirmed at T12 (grep `add.*routine.*exercise`); it is the routine-editor add form referenced in the inventory.
- The detail sheet's `similar` is computed in `ExercisesTab` (T11) via the existing `swapCandidates` + `rankSubstitutes` so the sheet stays presentational.
