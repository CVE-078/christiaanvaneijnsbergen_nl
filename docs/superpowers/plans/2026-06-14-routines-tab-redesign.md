# Library Routines tab redesign (Plan B core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Library > Routines tab into the card-based IA: routine cards, a "New routine" chooser sheet (Generate / Ad-hoc), a per-routine manage sheet, and a per-session exercise editor sheet, reusing the existing editor pieces and the hardened `ModalSheet`.

**Architecture:** A thin `RoutinesTab` orchestrator owns sheet state and the mutation handlers; presentational/sheet pieces (`RoutineCard`, `NewRoutineChooser`, `RoutineManageSheet`, `RoutineSessionEditor`) are new files. `RoutineExerciseRow` is restyled to an icon cluster; `AddRoutineExerciseForm` gains a `fixedType` prop. Two pure helpers (`routineSessionChips`, `reorderWithinSession`) live in `library.ts`. No new server action, no migration.

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict / Tailwind v4 / Vitest + Testing Library. Run tests with `bun run test:run <path>`, typecheck with `bun run typecheck`.

**Spec:** `docs/superpowers/specs/2026-06-14-19-30-25-routines-tab-redesign-design.md`. **Visual contract:** `.superpowers/brainstorm/97269-1781456849/content/routines-redesign.html` + `session-editor-final.html` (cards, chooser, manage sheet, session editor with variant-A icon row: link icon leftmost + conditional, ↑ ↓ ✎ 🗑 anchored, bin red).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/pulse/library.ts` | + `routineSessionChips`, `reorderWithinSession` | Modify |
| `src/lib/pulse/__tests__/library.test.ts` | + helper tests | Modify |
| `src/components/pulse/views/library/AddRoutineExerciseForm.tsx` | `fixedType` prop (hide type select; last-used default) | Modify |
| `src/components/pulse/views/library/RoutineExerciseRow.tsx` | icon-cluster action row (variant A) | Modify |
| `src/components/pulse/views/library/RoutineCard.tsx` | presentational routine card | Create |
| `src/components/pulse/views/library/NewRoutineChooser.tsx` | chooser ModalSheet (Generate / Ad-hoc) | Create |
| `src/components/pulse/views/library/RoutineSessionEditor.tsx` | per-session editor ModalSheet | Create |
| `src/components/pulse/views/library/RoutineManageSheet.tsx` | manage ModalSheet (scheduled / ad-hoc branch) | Create |
| `src/components/pulse/views/library/RoutinesTab.tsx` | orchestrator (rewrite) | Rewrite |
| `src/components/pulse/__tests__/LibraryView.test.tsx` | rewrite the routines cases to the new flow | Modify |

Build order is dependency-first: helpers -> leaf component changes -> new sheets -> orchestrator -> test rewrite -> finish. Each task commits independently.

---

## Task 1: Pure helpers (`routineSessionChips`, `reorderWithinSession`)

**Files:**
- Modify: `src/lib/pulse/library.ts`
- Test: `src/lib/pulse/__tests__/library.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/pulse/__tests__/library.test.ts`:

```ts
import { routineSessionChips, reorderWithinSession } from '@/lib/pulse/library';
import type { RoutineWithExercises } from '@/lib/pulse/types';

const reModel = (id: string, type: string, variant: string | null, order: number, group: string | null = null) => ({
    id, routine_id: 'r1', exercise_id: `e-${id}`, workout_type: type, variant, order,
    sets: '3', reps: '8-12', starting_weight_kg: null, superset_group_id: group,
    exercise: { id: `e-${id}`, name: id, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});
const routine = (over: Partial<RoutineWithExercises>): RoutineWithExercises => ({
    id: 'r1', user_id: 'u1', name: 'R', created_at: '2026-06-01', exercises: [], schedule: [], ...over,
} as RoutineWithExercises);

describe('routineSessionChips', () => {
    it('one compact chip per unique (type, variant) session, deduped across days', () => {
        const r = routine({ schedule: [
            { day_of_week: 1, workout_type: 'upper', variant: 'A' },
            { day_of_week: 2, workout_type: 'lower', variant: 'A' },
            { day_of_week: 4, workout_type: 'upper', variant: 'A' }, // duplicate day of Upper A
            { day_of_week: 5, workout_type: 'lower', variant: 'B' },
        ] });
        expect(routineSessionChips(r)).toEqual(['Upper A', 'Lower A', 'Lower B']);
    });
    it('returns ["Ad-hoc"] for a routine with no schedule', () => {
        expect(routineSessionChips(routine({ schedule: [] }))).toEqual(['Ad-hoc']);
    });
});

describe('reorderWithinSession', () => {
    const groupOf = (map: Record<string, string | null>) => (id: string) => map[id] ?? null;
    it('moves a single exercise down within its session, leaving other sessions in place', () => {
        // all = [push:a, push:b, pull:c]; move push a down -> [b, a, c]
        const next = reorderWithinSession(['a', 'b', 'c'], ['a', 'b'], 0, 1, groupOf({}));
        expect(next).toEqual(['b', 'a', 'c']);
    });
    it('is a no-op at the session boundary', () => {
        expect(reorderWithinSession(['a', 'b', 'c'], ['a', 'b'], 1, 1, groupOf({}))).toEqual(['a', 'b', 'c']);
        expect(reorderWithinSession(['a', 'b', 'c'], ['a', 'b'], 0, -1, groupOf({}))).toEqual(['a', 'b', 'c']);
    });
    it('moves a superset pair as one block', () => {
        // session [s, p1, p2] with p1+p2 paired; move s down past the pair -> [p1, p2, s]
        const next = reorderWithinSession(['s', 'p1', 'p2'], ['s', 'p1', 'p2'], 0, 1, groupOf({ p1: 'g', p2: 'g' }));
        expect(next).toEqual(['p1', 'p2', 's']);
    });
    it('reorders only the session members within the positions they occupy in the full list', () => {
        // full = [x(other), a, y(other), b]; session = [a, b]; move a down -> a/b swap in their slots
        const next = reorderWithinSession(['x', 'a', 'y', 'b'], ['a', 'b'], 0, 1, groupOf({}));
        expect(next).toEqual(['x', 'b', 'y', 'a']);
    });
});
```

- [ ] **Step 2: Run, expect fail** — `bun run test:run src/lib/pulse/__tests__/library.test.ts` (FAIL: not exported).

- [ ] **Step 3: Implement in `library.ts`** (add imports `WORKOUT_TYPE_LABELS` from `./constants`, `RoutineWithExercises` type):

```ts
import { WORKOUT_TYPE_LABELS } from './constants';
import type { RoutineWithExercises } from './types';

// Compact card chips, one per unique (type, variant) session, deduped across
// scheduled days. Ad-hoc routines (no schedule) show a single "Ad-hoc" chip.
export function routineSessionChips(routine: RoutineWithExercises): string[] {
    if (routine.schedule.length === 0) return ['Ad-hoc'];
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const s of routine.schedule) {
        const variant = s.variant ?? null;
        const key = `${s.workout_type}:${variant ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const base = WORKOUT_TYPE_LABELS[s.workout_type];
        chips.push(variant ? `${base} ${variant}` : base);
    }
    return chips;
}

// Reorder one exercise within its session and return the new FULL ordered id
// list (so the caller passes it to reorderRoutineExercises unchanged). A superset
// pair (adjacent ids sharing a group) moves as one block. Cross-session moves are
// not expressible: only session members are reordered, each kept within the
// positions it occupies in `allIds`.
export function reorderWithinSession(
    allIds: string[],
    sessionIds: string[],
    fromIndex: number,
    dir: -1 | 1,
    supersetGroupOf: (id: string) => string | null,
): string[] {
    // 1. Group the session into units: a lone id, or [id, id] for an adjacent pair.
    type Unit = string[];
    const units: Unit[] = [];
    for (let i = 0; i < sessionIds.length; i++) {
        const id = sessionIds[i];
        const g = supersetGroupOf(id);
        const next = sessionIds[i + 1];
        if (g && next && supersetGroupOf(next) === g) {
            units.push([id, next]);
            i++;
        } else {
            units.push([id]);
        }
    }
    // 2. Find the unit containing fromIndex; move that unit by dir among units.
    let acc = 0;
    let unitIdx = -1;
    for (let u = 0; u < units.length; u++) {
        if (fromIndex >= acc && fromIndex < acc + units[u].length) { unitIdx = u; break; }
        acc += units[u].length;
    }
    const target = unitIdx + dir;
    if (unitIdx === -1 || target < 0 || target >= units.length) return allIds; // boundary no-op
    [units[unitIdx], units[target]] = [units[target], units[unitIdx]];
    const reorderedSession = units.flat();
    // 3. Splice back: walk allIds, replacing session members in order.
    const sessionSet = new Set(sessionIds);
    let s = 0;
    return allIds.map((id) => (sessionSet.has(id) ? reorderedSession[s++] : id));
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** — `git add src/lib/pulse/library.ts src/lib/pulse/__tests__/library.test.ts && git commit -m "feat(pulse): routine card chips + within-session reorder helpers"`

---

## Task 2: `AddRoutineExerciseForm` gains `fixedType`

**Files:** Modify `src/components/pulse/views/library/AddRoutineExerciseForm.tsx`; test in the LibraryView suite (Task 9), so no standalone test here.

- [ ] **Step 1: Add the prop + hide the type select when fixed.** Change the signature to accept `fixedType?: WorkoutType`. When set, seed `addWorkoutType` from it, skip the `defaultWorkoutType` effect, and do not render the Workout type `<select>`. When unset, keep current behavior but **stop resetting to `'push'`** after add (last-used default).

Replace the component body's state init + effect + the type `<select>`:

```tsx
export default function AddRoutineExerciseForm({
    exercises,
    unit,
    onAdd,
    fixedType,
}: {
    exercises: DbExercise[];
    unit: Unit;
    onAdd: (exerciseId: string, sets: string, reps: string, startingWeightKg: number | null, workoutType: WorkoutType) => void;
    fixedType?: WorkoutType;
}) {
    const { favoriteExerciseIds } = usePulse();
    const [pickExerciseId, setPickExerciseId] = useState('');
    const [addSets, setAddSets] = useState('3');
    const [addReps, setAddReps] = useState('8-12');
    const [addWeight, setAddWeight] = useState('');
    const [addWorkoutType, setAddWorkoutType] = useState<WorkoutType>(fixedType ?? 'push');

    const selectedEx = exercises.find((e) => e.id === pickExerciseId);
    const sortedExercises = floatFavorites(exercises, favoriteExerciseIds);
    useEffect(() => {
        if (fixedType) return; // session editor: type is the session's type
        if (selectedEx) {
            const suggested = defaultWorkoutType(selectedEx.category as ExerciseCategory);
            if (suggested) setAddWorkoutType(suggested);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickExerciseId]);

    function handleAddExercise() {
        if (!pickExerciseId) return;
        const trimmed = addWeight.trim();
        const raw = trimmed === '' ? NaN : parseFloat(trimmed);
        const kgValue = Number.isNaN(raw) ? null : toKg(raw, unit);
        onAdd(pickExerciseId, addSets, addReps, kgValue, fixedType ?? addWorkoutType);
        setPickExerciseId('');
        setAddWeight('');
        // No type reset: keep the last-used type (ad-hoc), or the fixed type.
    }
    // ...render: render the Workout type <select> ONLY when `!fixedType`.
```

In the JSX, wrap the workout-type `<select>` (the second select, `aria-label="Workout type"`) in `{!fixedType && ( ... )}`.

- [ ] **Step 2: Typecheck** — `bun run typecheck` (PASS).
- [ ] **Step 3: Commit** — `git add src/components/pulse/views/library/AddRoutineExerciseForm.tsx && git commit -m "feat(pulse): AddRoutineExerciseForm fixedType prop + last-used type default"`

---

## Task 3: `RoutineExerciseRow` icon-cluster action row (variant A)

**Files:** Modify `src/components/pulse/views/library/RoutineExerciseRow.tsx`. Behavior + aria-labels preserved (so existing assertions hold); presentation becomes icons.

- [ ] **Step 1: Replace the `!editing` action row** (current lines ~89-142) with the icon cluster. Keep line 1 (index + name) and the `editing` block unchanged. Move `sets x reps` onto a second meta line and right-anchor the icon cluster on line 1. Add an `IconBtn` local helper.

Add near the top of the file (after imports):

```tsx
const ICONBTN = 'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border-none bg-transparent text-pulse-dim cursor-pointer hover:bg-white/[0.06] hover:text-pulse-text disabled:opacity-30 disabled:cursor-not-allowed';
```

Replace the row's return body (the outer container keeps `flex flex-col gap-1.5 bg-pulse-surface rounded-xl px-3 py-2.5`) with:

```tsx
{/* Line 1: index + name + right-anchored icon cluster (variant A) */}
<div className="flex items-center gap-2">
    <span className="font-pulse text-xs text-pulse-muted w-5 shrink-0">{displayNumber ?? index + 1}</span>
    <span className="font-pulse text-sm text-pulse-text flex-1 min-w-0 truncate">
        {re.exercise.name}
        {isHidden && (
            <span className="ml-2 font-pulse text-[0.5625rem] tracking-[0.08em] uppercase text-pulse-muted">Hidden</span>
        )}
    </span>
    {!editing && (
        <span className="flex shrink-0 items-center gap-0.5">
            {/* Pair (conditional) sits LEFT so the persistent icons never shift */}
            {onPair && (
                <button type="button" onClick={onPair} aria-label={`Pair ${re.exercise.name} with next`} className={`${ICONBTN} text-pulse-accent`}>
                    {/* link icon */}
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M6.5 9.5l3-3M5 8l-1.5 1.5a2.1 2.1 0 0 0 3 3L8 11M11 8l1.5-1.5a2.1 2.1 0 0 0-3-3L8 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
            )}
            {onUnpair && (
                <button type="button" onClick={onUnpair} aria-label={`Unpair ${re.exercise.name}`} className={`${ICONBTN} text-pulse-accent`}>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M3 8h7M7 5l3 3-3 3M13 4v8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
            )}
            <button type="button" onClick={() => onMove(index, -1)} disabled={!canMoveUp} aria-label={`Move ${re.exercise.name} up`} className={ICONBTN}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><polyline points="4 10 8 6 12 10" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" onClick={() => onMove(index, 1)} disabled={!canMoveDown} aria-label={`Move ${re.exercise.name} down`} className={ICONBTN}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><polyline points="4 6 8 10 12 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${re.exercise.name}`} className={ICONBTN}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" onClick={() => onRemove(re.id)} aria-label={`Remove ${re.exercise.name}`} className={`${ICONBTN} text-pulse-error hover:bg-pulse-error/10 hover:text-pulse-error`}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M3 4.5h10M6 4.5V3.2c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7v1.3M5 4.5l.5 8c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9l.5-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
        </span>
    )}
</div>
{/* Line 2: sets x reps meta (only when not editing) */}
{!editing && (
    <span className="font-pulse text-[0.6875rem] text-pulse-dim pl-7">
        {re.sets} × {re.reps}
        {re.starting_weight_kg !== null && <> · {toDisplay(re.starting_weight_kg, unit)} {unit}</>}
    </span>
)}
{editing && ( /* unchanged edit block */ )}
```

Keep the existing `editing` block exactly as is (it already has the Save button + fields with their aria-labels). Note `setEditing(true)` on the edit icon (open); the edit block's Save closes it via `handleSave`.

- [ ] **Step 2: Typecheck** — `bun run typecheck` (PASS). Behavior verified in Task 9 (the LibraryView suite queries Move/Edit/Remove by their unchanged aria-labels; Pair/Unpair now have aria-labels too).
- [ ] **Step 3: Commit** — `git add src/components/pulse/views/library/RoutineExerciseRow.tsx && git commit -m "feat(pulse): icon-cluster action row for RoutineExerciseRow (link-left, red bin)"`

---

## Task 4: `RoutineCard` (presentational)

**Files:** Create `src/components/pulse/views/library/RoutineCard.tsx`. Tested in Task 9.

- [ ] **Step 1: Create the component.**

```tsx
'use client';
import { routineSessionChips } from '@/lib/pulse/library';
import type { RoutineWithExercises } from '@/lib/pulse/types';

export default function RoutineCard({
    routine,
    isActive,
    progress,
    meta,
    onOpen,
}: {
    routine: RoutineWithExercises;
    isActive: boolean;
    /** Active routine only: { fraction 0-1, label } from formatProgramStatus. */
    progress?: { fraction: number; label: string } | null;
    /** Meta line (e.g. "6 days/week · 12-week plan" or "4 exercises · no fixed schedule"). */
    meta: string;
    onOpen: () => void;
}) {
    const chips = routineSessionChips(routine);
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Manage ${routine.name}`}
            className={`flex w-full flex-col gap-2 rounded-2xl border bg-pulse-surface px-3.5 py-3 text-left ${isActive ? 'border-pulse-accent/40' : 'border-pulse-border'}`}>
            <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-pulse text-[0.95rem] font-medium text-pulse-text">{routine.name}</span>
                {isActive && (
                    <span className="shrink-0 rounded-md border border-pulse-accent/35 bg-pulse-accent/10 px-2 py-0.5 font-pulse text-[0.5625rem] uppercase tracking-[0.06em] text-pulse-accent">Active</span>
                )}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-pulse-muted" aria-hidden><polyline points="6 3 11 8 6 13" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                    <span key={c} className="rounded-md bg-pulse-surface-2 px-2 py-0.5 font-pulse text-[0.66rem] text-pulse-dim">{c}</span>
                ))}
            </div>
            {isActive && progress && (
                <div className="h-[5px] overflow-hidden rounded-full bg-pulse-surface-2">
                    <div className="h-full rounded-full bg-pulse-accent" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
                </div>
            )}
            <span className="font-pulse text-[0.71rem] text-pulse-dim">{isActive && progress ? progress.label : meta}</span>
        </button>
    );
}
```

- [ ] **Step 2: Typecheck.** - [ ] **Step 3: Commit** — `git commit -m "feat(pulse): RoutineCard"`

---

## Task 5: `NewRoutineChooser` (ModalSheet)

**Files:** Create `src/components/pulse/views/library/NewRoutineChooser.tsx`. Tested in Task 9.

- [ ] **Step 1: Create.** Two choices; Ad-hoc reveals an inline name field. `ChoiceRow` mirrors the mockup (icon badge + title + subtitle, primary = accent).

```tsx
'use client';
import { useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';

export default function NewRoutineChooser({
    open,
    onClose,
    onGenerate,
    onAdHoc,
}: {
    open: boolean;
    onClose: () => void;
    onGenerate: () => void;
    onAdHoc: (name: string) => void;
}) {
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const submit = () => {
        const n = name.trim();
        if (!n) return;
        onAdHoc(n);
        setNaming(false);
        setName('');
    };
    return (
        <ModalSheet open={open} onClose={onClose} title="New routine">
            <div className="flex flex-col gap-2.5 px-6">
                <button type="button" onClick={onGenerate} className="flex items-center gap-3 rounded-[13px] border border-pulse-accent/40 bg-pulse-accent/[0.06] p-3.5 text-left">
                    {/* sparkle icon badge */}
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-pulse-accent text-pulse-bg">
                        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 1.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 10.4 4.7 12.2l.7-3.7L2.7 5.9l3.7-.5z"/></svg>
                    </span>
                    <span><span className="font-pulse text-[0.9rem] font-medium text-pulse-text">Generate a routine</span><span className="mt-0.5 block font-pulse text-[0.74rem] text-pulse-dim">Answer a few questions, we build and periodize it.</span></span>
                </button>

                {!naming ? (
                    <button type="button" onClick={() => setNaming(true)} className="flex items-center gap-3 rounded-[13px] border border-pulse-border p-3.5 text-left">
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-pulse-surface-2 text-pulse-accent">
                            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><line x1="8" y1="6" x2="8" y2="10"/><line x1="6" y1="8" x2="10" y2="8"/></svg>
                        </span>
                        <span><span className="font-pulse text-[0.9rem] font-medium text-pulse-text">Ad-hoc routine</span><span className="mt-0.5 block font-pulse text-[0.74rem] text-pulse-dim">Start empty and add exercises yourself.</span></span>
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <input autoFocus aria-label="Routine name" value={name} placeholder="Routine name"
                            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                            className="flex-1 rounded-[10px] border border-pulse-border bg-pulse-bg px-3 py-2.5 font-pulse text-sm text-pulse-text outline-none focus:border-pulse-accent" />
                        <button type="button" onClick={submit} className="rounded-[10px] bg-pulse-accent px-4 font-pulse text-sm font-semibold text-pulse-bg">Create</button>
                    </div>
                )}
            </div>
        </ModalSheet>
    );
}
```

- [ ] **Step 2: Typecheck.** - [ ] **Step 3: Commit** — `git commit -m "feat(pulse): NewRoutineChooser sheet (Generate / Ad-hoc)"`

---

## Task 6: `RoutineSessionEditor` (ModalSheet)

**Files:** Create `src/components/pulse/views/library/RoutineSessionEditor.tsx`. Tested in Task 9.

Houses the per-session exercise list + within-session reorder (via `reorderWithinSession`) + pair/unpair + the fixed-type add form. Reuses `RoutineExerciseRow` + `AddRoutineExerciseForm`.

- [ ] **Step 1: Create.** It receives the session's ordered exercises and callbacks; it computes `onMove` against the full list using `reorderWithinSession`.

```tsx
'use client';
import ModalSheet from '@/components/pulse/ModalSheet';
import RoutineExerciseRow from './RoutineExerciseRow';
import AddRoutineExerciseForm from './AddRoutineExerciseForm';
import { reorderWithinSession } from '@/lib/pulse/library';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { DbExercise, RoutineExercise, Unit, WorkoutType, WorkoutVariant } from '@/lib/pulse/types';

export default function RoutineSessionEditor({
    open, onClose, onBack, title, subtitle, sessionExercises, allExerciseIds, type, exercises, unit,
    onReorder, onRemove, onUpdate, onAdd, onPair, onUnpair,
}: {
    open: boolean;
    onClose: () => void;
    onBack: () => void;
    title: string;
    subtitle?: string;
    sessionExercises: RoutineExercise[]; // this session's rows, in order
    allExerciseIds: string[];            // full routine order (for reorderWithinSession)
    type: WorkoutType;
    exercises: DbExercise[];
    unit: Unit;
    onReorder: (orderedIds: string[]) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, kg: number | null, rest: number | null) => void;
    onAdd: (exerciseId: string, sets: string, reps: string, kg: number | null, workoutType: WorkoutType) => void;
    onPair: (aId: string, bId: string) => void;
    onUnpair: (groupId: string) => void;
}) {
    const sessionIds = sessionExercises.map((re) => re.id);
    const groupOf = (id: string) => sessionExercises.find((re) => re.id === id)?.superset_group_id ?? null;

    const handleMove = (index: number, dir: -1 | 1) => {
        onReorder(reorderWithinSession(allExerciseIds, sessionIds, index, dir, groupOf));
    };

    return (
        <ModalSheet open={open} onClose={onClose} onBack={onBack} title={title} subtitle={subtitle}>
            <div className="flex flex-col gap-2 px-6">
                {sessionExercises.map((re, i) => {
                    const isPaired = re.superset_group_id !== null;
                    const pairIdx = isPaired ? sessionExercises.map((r, idx) => (r.superset_group_id === re.superset_group_id ? idx : -1)).filter((x) => x !== -1) : null;
                    const isFirstInPair = isPaired && i === (pairIdx?.[0] ?? i);
                    const next = sessionExercises[i + 1];
                    const canPairWithNext = !isPaired && next !== undefined && next.superset_group_id === null;
                    return (
                        <RoutineExerciseRow
                            key={re.id}
                            re={re}
                            index={i}
                            displayNumber={i + 1}
                            total={sessionExercises.length}
                            unit={unit}
                            onMove={handleMove}
                            onRemove={onRemove}
                            onUpdate={onUpdate}
                            canMoveUp={i > 0}
                            canMoveDown={i < sessionExercises.length - 1}
                            onPair={canPairWithNext ? () => onPair(re.id, next.id) : undefined}
                            onUnpair={isFirstInPair ? () => onUnpair(re.superset_group_id!) : undefined}
                        />
                    );
                })}
                <p className="mt-3 font-pulse text-[0.6rem] uppercase tracking-[0.12em] text-pulse-muted">Add to this session</p>
                <AddRoutineExerciseForm exercises={exercises} unit={unit} onAdd={onAdd} fixedType={type} />
            </div>
        </ModalSheet>
    );
}
```

Note: `index` here is the session-local index; `handleMove` maps it through `reorderWithinSession` to the full order. `canMoveUp/Down` are session-local bounds (within-session reorder).

- [ ] **Step 2: Typecheck.** - [ ] **Step 3: Commit** — `git commit -m "feat(pulse): RoutineSessionEditor sheet"`

---

## Task 7: `RoutineManageSheet` (ModalSheet)

**Files:** Create `src/components/pulse/views/library/RoutineManageSheet.tsx`. Tested in Task 9.

Branches: scheduled routine -> session preview list (each opens the session editor); ad-hoc (no schedule) -> inline editor (`RoutineExerciseRow`s grouped by type + an `AddRoutineExerciseForm` WITH the type select). Action row: Set active / Rename (inline) / Delete (confirm).

- [ ] **Step 1: Create.** Use `sessionTypeFor` (from utils) to roll exercises into session groups, mirroring the current `RoutinesTab` grouping. The scheduled branch lists groups with counts; the ad-hoc branch renders the rows + add form inline.

Key structure (full code in execution; the contract):

```tsx
interface ManageProps {
    open: boolean;
    routine: RoutineWithExercises;
    isActive: boolean;
    exercises: DbExercise[];
    unit: Unit;
    onClose: () => void;
    onSetActive: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onOpenSession: (group: { type: WorkoutType; variant: WorkoutVariant | null }) => void;
    // ad-hoc inline editor handlers (same as the session editor's):
    onReorder: (orderedIds: string[]) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, kg: number | null, rest: number | null) => void;
    onAdd: (exerciseId: string, sets: string, reps: string, kg: number | null, workoutType: WorkoutType) => void;
    onPair: (aId: string, bId: string) => void;
    onUnpair: (groupId: string) => void;
}
```

- Header: `title={routine.name}`, `subtitle` = the meta line.
- Action row (top of body): three buttons. Rename toggles an inline input (like today's `renamingId`); Delete calls `window.confirm` then `onDelete`.
- `const scheduled = routine.schedule.length > 0;`
- **Scheduled:** map the unique `(type, variant)` session groups (dedup like `routineSessionChips` but keep `{type, variant}`), render a row per group: label (`WORKOUT_TYPE_LABELS[type] + variant`, or `sessionFocusLabel` for the verbose lower split if you prefer the spacious label) + exercise count + a chevron; `onClick={() => onOpenSession(group)}`.
- **Ad-hoc:** compute session groups via the same grouping as `RoutinesTab` (`sessionTypeFor` over the exercises), render each group's `RoutineExerciseRow`s (with within-group reorder via `reorderWithinSession`, scoped to that group's ids) + a single `AddRoutineExerciseForm` (no `fixedType`, so the Type select shows). Empty routine -> a one-line empty state above the add form.

Reuse `reorderWithinSession` for the ad-hoc within-group moves exactly as the session editor does.

- [ ] **Step 2: Typecheck.** - [ ] **Step 3: Commit** — `git commit -m "feat(pulse): RoutineManageSheet (scheduled session list + ad-hoc inline editor)"`

---

## Task 8: `RoutinesTab` orchestrator (rewrite)

**Files:** Rewrite `src/components/pulse/views/library/RoutinesTab.tsx`.

- [ ] **Step 1: Rewrite.** Pull `routines`, `activeRoutine`, `programPosition`, `profile`, and all the mutation actions from `usePulse` (same set the current file uses, plus `createRoutine` for Ad-hoc). Render: a count row + accent "New routine" button (opens `NewRoutineChooser`), then a `RoutineCard` per routine. Own state: `chooserOpen`, `manageRoutineId`, `editorSession`.

Key wiring:
- Active card progress: `const status = activeRoutine && programPosition ? formatProgramStatus(programPosition, activeRoutine.program_weeks ?? 12) : null;` pass `progress={{ fraction: status.progressFraction, label: status.weekLabel }}` to the active card (confirm the exact `FormattedProgramStatus` field names in `utils.ts` and use them; the spec references `formatProgramStatus`).
- Meta line per card: scheduled -> `${routineSessionChips(r).length} sessions · ${r.program_weeks ?? 12}-week plan`; ad-hoc -> `${r.exercises.length} exercises · no fixed schedule`.
- New routine: `onGenerate` -> close chooser + trigger the existing Generate flow. The current file renders `<GenerateRoutineButton label="Generate" .../>`; keep a `GenerateRoutineButton` mounted (hidden trigger) or render it as the Generate choice's action. Simplest: have `onGenerate` set a state that renders `<GenerateRoutineButton autoOpen />` — but `GenerateRoutineButton` opens its own flow on click. Cleanest: keep `GenerateRoutineButton` as the actual Generate control inside the chooser (render it in place of the plain Generate button) so its existing onboarding/tune handoff is unchanged. Verify `GenerateRoutineButton`'s props (`label`, `className`) and render it as the chooser's first choice.
- Ad-hoc: `onAdHoc={(name) => { startTransition(async () => { const r = await createRoutine(name); setChooserOpen(false); setManageRoutineId(r.id); }); }}` (open the new routine's manage sheet so the user can add exercises immediately; confirm `createRoutine` returns the created routine).
- Manage sheet: render `<RoutineManageSheet>` when `manageRoutineId` matches a routine; wire `onSetActive`/`onRename`/`onDelete`/`onOpenSession` + the exercise handlers (move via `reorderRoutineExercises`, add via `addExerciseToRoutine`, etc., same handlers the current file has).
- Session editor: render `<RoutineSessionEditor>` when `editorSession` is set; `onBack={() => setEditorSession(null)}` (returns to manage); compute `sessionExercises` = the routine's exercises for that `(type, variant)` group (using `sessionTypeFor` + variant match), `allExerciseIds` = the routine's exercises sorted by `order` mapped to ids.
- Preserve the existing `handlePair`/`handleUnpair` (the `/api/pulse/supersets` POST/DELETE + `mutate('/api/pulse/routines')`) and `handleRemove` (superset cleanup) logic; pass them down.

- [ ] **Step 2: Typecheck** (PASS). Behavior verified in Task 9.
- [ ] **Step 3: Commit** — `git commit -m "feat(pulse): rewrite RoutinesTab as card + sheet orchestrator"`

---

## Task 9: Rewrite the LibraryView routines tests

**Files:** Modify `src/components/pulse/__tests__/LibraryView.test.tsx`. The exercises-tab tests stay; rewrite the ~16 routines-tab cases to the new flow. The `next/navigation` mock already exists.

- [ ] **Step 1: Rewrite the routines cases** to drive the new UI. Examples (full set covers create / set-active / rename / delete / add / edit / reorder / pair / unpair / session grouping):

```tsx
// helper: open the manage sheet for a routine by clicking its card
const openManage = async (name: RegExp) => userEvent.click(screen.getByRole('button', { name: new RegExp(`Manage.*`) /* card */ }));

it('creates an ad-hoc routine from the chooser', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
    await userEvent.click(screen.getByRole('button', { name: /new routine/i }));
    await userEvent.click(screen.getByRole('button', { name: /ad-hoc routine/i }));
    await userEvent.type(screen.getByLabelText(/routine name/i), 'Leg Day');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(mocks.createRoutine).toHaveBeenCalledWith('Leg Day'));
});

it('sets a routine active from its manage sheet', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage pull day/i }));
    await userEvent.click(screen.getByRole('button', { name: /set active/i }));
    await waitFor(() => expect(mocks.setActiveRoutine).toHaveBeenCalledWith('r2'));
});

it('edits a routine exercise inside the session editor', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
    await userEvent.click(screen.getByRole('button', { name: /chest/i })); // open the session group row
    await userEvent.click(screen.getByRole('button', { name: /edit bench press/i }));
    const setsInput = screen.getByLabelText(/bench press sets/i);
    await userEvent.clear(setsInput); await userEvent.type(setsInput, '4');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mocks.updateRoutineExercise).toHaveBeenCalledWith('re1', '4', '8-12', 60, null));
});
```

Carry over the superset Pair/Unpair and the reorder cases, now reached through the session editor (open the manage sheet, open the session). The active routine `Push Day` has a `schedule: []` in the current fixture, so it is treated as **ad-hoc** (inline editor in the manage sheet) — either add a `schedule` to that fixture so it drills into a session editor, or assert the ad-hoc inline path. Pick per-test: scheduled fixtures for session-editor tests, the `schedule: []` fixture for the ad-hoc inline test.

- [ ] **Step 2: Run the suite** — `bun run test:run src/components/pulse/__tests__/LibraryView.test.tsx` until green, then the full suite `bun run test:run`.
- [ ] **Step 3: Commit** — `git commit -m "test(pulse): rewrite RoutinesTab cases for the card + sheet flow"`

---

## Task 10: Finish

- [ ] **Step 1:** `bun run typecheck && bun run lint` clean; `bun run test:run` fully green.
- [ ] **Step 2:** Format only the touched files (`npx prettier --write <files>`).
- [ ] **Step 3: Roadmap + CLAUDE.md FINISH** (clean-sheet flow): move the In-progress line to a Shipped bullet (date + `feature/routines-tab-redesign`, no PR#), clear `In progress:` to `(none)`, update the CLAUDE.md "Library redesign" section to describe the Routines tab redesign (cards + chooser + manage sheet + session editor, within-session reorder, ad-hoc inline editor) and note Templates fold-in remains the follow-up. No migration. Commit `docs: ship Library Routines tab redesign`.
- [ ] **Step 4:** Final code-review subagent over the branch diff; address findings.

---

## Notes / verify-at-execution
- `FormattedProgramStatus` field names (Task 8 progress bar): read `formatProgramStatus` in `utils.ts` and use its actual `progressFraction` / `weekLabel` (or equivalent) fields.
- `createRoutine` return shape (Task 8 ad-hoc): confirm it resolves to the created `RoutineWithExercises` (the current `RoutinesTab` calls `await createRoutine(name)`; the LibraryView test mock returns `inactiveRoutine`).
- `GenerateRoutineButton` integration (Task 8): reuse it as the chooser's Generate control so its onboarding/tune handoff is unchanged; do not re-implement generation.
- Manage-sheet session label: use the compact `WORKOUT_TYPE_LABELS[type] + variant` for the session rows (matches the card chips); `sessionFocusLabel` is available if the verbose lower-split label is preferred.
