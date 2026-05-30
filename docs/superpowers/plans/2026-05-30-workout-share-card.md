# Workout Share Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a polished screenshot-friendly summary card automatically after a user finishes a workout session.

**Architecture:** A pure `computeShareStats` function computes all display data from existing context (session, logs, exercises, prMap). A `ShareCard` full-screen overlay component renders it. `LogView` captures the completed session and renders `ShareCard` after `WorkoutModeScreen` closes.

**Tech Stack:** React useState, Next.js App Router, TypeScript, Tailwind v4 `pulse-*` tokens, Vitest + @testing-library/react.

---

## File Map

| Action | File | Role |
|--------|------|------|
| Modify | `src/lib/pulse/types.ts` | Add `ShareStats` interface |
| Modify | `src/lib/pulse/utils.ts` | Add `computeShareStats` function |
| Modify | `src/lib/pulse/__tests__/utils.test.ts` | Tests for `computeShareStats` |
| Create | `src/components/pulse/ShareCard.tsx` | Full-screen overlay component |
| Create | `src/components/pulse/__tests__/ShareCard.test.tsx` | Component tests |
| Modify | `src/components/pulse/views/LogView.tsx` | Wire share state + render ShareCard |

---

## Task 1: `ShareStats` type + `computeShareStats` utility

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/utils.ts`
- Modify: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Add `ShareStats` interface to `src/lib/pulse/types.ts`**

Append after the `BestSet` interface (after line 102):

```ts
export interface ShareStats {
    workoutLabel: string;
    date: string;
    durationMin: number;
    totalSets: number;
    topLifts: Array<{ name: string; displayWeight: number; reps: number; isPR: boolean }>;
    prCount: number;
}
```

- [ ] **Step 2: Write failing tests in `src/lib/pulse/__tests__/utils.test.ts`**

Add `computeShareStats` and `ShareStats` to the import at the top of the file (alongside the existing imports):

```ts
import {
    // ... existing imports ...
    computeWarmupSets,
    computeShareStats,
} from '../utils';
import type { Logs, RoutineExercise, WorkoutType, WorkoutSession } from '../types';
```

(Replace the existing `import type { Logs, RoutineExercise, WorkoutType } from '../types';` line.)

Then append this `describe` block at the end of the file:

```ts
describe('computeShareStats', () => {
    const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
    const RE_ID_2 = 'bbbbbbbb-0000-4000-8000-000000000002';

    const session: WorkoutSession = {
        id: 'sess-1',
        user_id: 'u1',
        routine_id: 'r1',
        workout_type: 'push',
        variant: null,
        started_at: '2026-05-30T10:00:00.000Z',
        completed_at: null,
    };
    const completedAt = '2026-05-30T10:47:00.000Z';

    const exercises: RoutineExercise[] = [
        {
            id: RE_ID,
            routine_id: 'r1',
            exercise_id: 'ex-1',
            workout_type: 'push',
            variant: null,
            order: 0,
            sets: '3',
            reps: '8',
            starting_weight_kg: null,
            exercise: { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
        },
        {
            id: RE_ID_2,
            routine_id: 'r1',
            exercise_id: 'ex-2',
            workout_type: 'push',
            variant: null,
            order: 1,
            sets: '3',
            reps: '12',
            starting_weight_kg: null,
            exercise: { id: 'ex-2', name: 'Overhead Press', category: 'shoulders', default_sets: '3', default_reps: '12', user_id: null },
        },
    ];

    const logs: Logs = {
        [`3-${RE_ID}-0`]: { kg: 100, reps: 8, rir: 2, saved: true },
        [`3-${RE_ID}-1`]: { kg: 100, reps: 7, rir: 2, saved: true },
        [`3-${RE_ID}-2`]: { kg: 97.5, reps: 8, rir: 2, saved: true },
        [`3-${RE_ID_2}-0`]: { kg: 60, reps: 10, rir: 2, saved: true },
    };

    it('computes workoutLabel from workout_type', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Push Day');
    });

    it('appends variant to workoutLabel when session has a variant', () => {
        const variantSession = { ...session, variant: 'A' as const };
        const stats = computeShareStats(variantSession, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Push Day · Variant A');
    });

    it('handles full_body workout type', () => {
        const s = { ...session, workout_type: 'full_body' };
        const stats = computeShareStats(s, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Full Body');
    });

    it('computes duration in minutes', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.durationMin).toBe(47);
    });

    it('returns 0 duration for invalid timestamps', () => {
        const bad = { ...session, started_at: 'not-a-date' };
        const stats = computeShareStats(bad, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.durationMin).toBe(0);
    });

    it('counts total saved sets for this week and these exercises only', () => {
        const logsWithNoise: Logs = {
            ...logs,
            // different week — should be ignored
            [`2-${RE_ID}-0`]: { kg: 95, reps: 8, rir: 3, saved: true },
            // unsaved — should be ignored
            [`3-${RE_ID}-3`]: { kg: 100, reps: 8, rir: 2, saved: false },
        };
        const stats = computeShareStats(session, completedAt, exercises, logsWithNoise, {}, 3, 'kg');
        expect(stats.totalSets).toBe(4);
    });

    it('returns up to 3 top lifts sorted by e1RM descending', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.topLifts).toHaveLength(2);
        expect(stats.topLifts[0].name).toBe('Bench Press');
        expect(stats.topLifts[1].name).toBe('Overhead Press');
    });

    it('picks the best set per exercise (not one row per set)', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.reps).toBe(8);
        expect(bench.displayWeight).toBe(100);
    });

    it('marks isPR true when the best set e1RM matches the prMap entry', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.isPR).toBe(true);
    });

    it('marks isPR false when e1RM is below the prMap entry', () => {
        const prMap = { [RE_ID]: calcE1RM(120, 8) };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.isPR).toBe(false);
    });

    it('counts prCount across all exercises not just topLifts slice', () => {
        // Give all exercises a matching PR
        const prMap = {
            [RE_ID]: calcE1RM(100, 8),
            [RE_ID_2]: calcE1RM(60, 10),
        };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        expect(stats.prCount).toBe(2);
    });

    it('returns displayWeight in lbs when unit is lbs', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'lbs');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.displayWeight).toBeCloseTo(220.5, 0);
    });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm run test:run -- utils
```
Expected: `computeShareStats is not a function` errors on the new tests. All existing utils tests still pass.

- [ ] **Step 4: Add imports and implement `computeShareStats` in `src/lib/pulse/utils.ts`**

Update the import line at the top of `utils.ts` to add `WorkoutSession`, `PRMap`, and `ShareStats`:

```ts
import type { Phase, Logs, HistorySession, LogEntry, Unit, RoutineExercise, WorkoutType, BestSet, WorkoutSession, PRMap, ShareStats } from './types';
```

Add a label map constant after the existing `UUID_RE` constant (after line 5):

```ts
const WORKOUT_LABELS: Partial<Record<WorkoutType, string>> = {
    push: 'Push Day',
    pull: 'Pull Day',
    legs: 'Leg Day',
    chest: 'Chest Day',
    back: 'Back Day',
    shoulders: 'Shoulder Day',
    arms: 'Arms Day',
    upper: 'Upper Day',
    lower: 'Lower Day',
    full_body: 'Full Body',
};
```

Append the function at the end of `utils.ts` (after `computeLastSession`):

```ts
export function computeShareStats(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
): ShareStats {
    const startMs = new Date(session.started_at).getTime();
    const endMs = new Date(completedAt).getTime();
    const diff = endMs - startMs;
    const durationMin = isNaN(diff) || diff < 0 ? 0 : Math.floor(diff / 60000);

    const baseLabel = WORKOUT_LABELS[session.workout_type as WorkoutType] ?? session.workout_type;
    const workoutLabel = session.variant ? `${baseLabel} · Variant ${session.variant}` : baseLabel;

    const date = new Date(completedAt).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    const exerciseIds = new Set(exercises.map((e) => e.id));
    const nameMap = new Map(exercises.map((e) => [e.id, e.exercise.name]));
    const bestByExercise = new Map<string, { kg: number; reps: number; e1rm: number }>();
    let totalSets = 0;

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const w = parseInt(key.slice(0, firstDash), 10);
        if (w !== week) continue;
        const rid = key.slice(firstDash + 1, lastDash);
        if (!exerciseIds.has(rid)) continue;
        totalSets++;
        const e1rm = calcE1RM(val.kg, val.reps);
        const existing = bestByExercise.get(rid);
        if (!existing || e1rm > existing.e1rm) {
            bestByExercise.set(rid, { kg: val.kg, reps: val.reps, e1rm });
        }
    }

    const allLifts = [...bestByExercise.entries()]
        .sort(([, a], [, b]) => b.e1rm - a.e1rm)
        .map(([rid, { kg, reps, e1rm }]) => {
            const isPR = (prMap[rid] ?? 0) > 0 && e1rm >= prMap[rid];
            return {
                name: nameMap.get(rid) ?? rid,
                displayWeight: toDisplay(kg, unit),
                reps,
                isPR,
            };
        });

    return {
        workoutLabel,
        date,
        durationMin,
        totalSets,
        topLifts: allLifts.slice(0, 3),
        prCount: allLifts.filter((l) => l.isPR).length,
    };
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:run -- utils
```
Expected: all utils tests PASS (existing + new).

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(share): add ShareStats type and computeShareStats utility"
```

---

## Task 2: `ShareCard` component

**Files:**
- Create: `src/components/pulse/ShareCard.tsx`
- Create: `src/components/pulse/__tests__/ShareCard.test.tsx`

- [ ] **Step 1: Write failing tests in `src/components/pulse/__tests__/ShareCard.test.tsx`**

Create the file with this content:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareCard from '../ShareCard';
import { calcE1RM } from '@/lib/pulse/utils';
import type { WorkoutSession, RoutineExercise, Logs } from '@/lib/pulse/types';

const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

const session: WorkoutSession = {
    id: 'sess-1',
    user_id: 'u1',
    routine_id: 'r1',
    workout_type: 'push',
    variant: null,
    started_at: '2026-05-30T10:00:00.000Z',
    completed_at: null,
};
const completedAt = '2026-05-30T10:47:00.000Z';

const exercises: RoutineExercise[] = [
    {
        id: RE_ID,
        routine_id: 'r1',
        exercise_id: 'ex-1',
        workout_type: 'push',
        variant: null,
        order: 0,
        sets: '3',
        reps: '8',
        starting_weight_kg: null,
        exercise: { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
    },
];

const logs: Logs = {
    [`3-${RE_ID}-0`]: { kg: 100, reps: 8, rir: 2, saved: true },
    [`3-${RE_ID}-1`]: { kg: 100, reps: 7, rir: 2, saved: true },
    [`3-${RE_ID}-2`]: { kg: 97.5, reps: 8, rir: 2, saved: true },
};

const defaultProps = {
    session,
    completedAt,
    exercises,
    logs,
    prMap: {},
    week: 3,
    unit: 'kg' as const,
    onDismiss: vi.fn(),
};

describe('ShareCard', () => {
    it('renders the workout label', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Push Day')).toBeInTheDocument();
    });

    it('renders duration', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('47 min')).toBeInTheDocument();
    });

    it('renders total sets', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('3 sets')).toBeInTheDocument();
    });

    it('renders the week chip', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Week 3')).toBeInTheDocument();
    });

    it('renders top lift with exercise name and weight', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText(/100 kg × 8/)).toBeInTheDocument();
    });

    it('shows PR badge when lift is a PR', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        render(<ShareCard {...defaultProps} prMap={prMap} />);
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('shows PR count line when prCount > 0', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        render(<ShareCard {...defaultProps} prMap={prMap} />);
        expect(screen.getByText(/1 PR this session/)).toBeInTheDocument();
    });

    it('hides PR count line when no PRs', () => {
        render(<ShareCard {...defaultProps} prMap={{}} />);
        expect(screen.queryByText(/PR this session/)).not.toBeInTheDocument();
    });

    it('shows screenshot hint text', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText(/screenshot to share/i)).toBeInTheDocument();
    });

    it('calls onDismiss when Done button is clicked', async () => {
        const onDismiss = vi.fn();
        render(<ShareCard {...defaultProps} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: /done/i }));
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- ShareCard
```
Expected: FAIL — `Cannot find module '../ShareCard'`.

- [ ] **Step 3: Create `src/components/pulse/ShareCard.tsx`**

```tsx
'use client';
import { computeShareStats } from '@/lib/pulse/utils';
import type { WorkoutSession, RoutineExercise, Logs, PRMap, Unit } from '@/lib/pulse/types';

interface Props {
    session: WorkoutSession;
    completedAt: string;
    exercises: RoutineExercise[];
    logs: Logs;
    prMap: PRMap;
    week: number;
    unit: Unit;
    onDismiss: () => void;
}

export default function ShareCard({ session, completedAt, exercises, logs, prMap, week, unit, onDismiss }: Props) {
    const stats = computeShareStats(session, completedAt, exercises, logs, prMap, week, unit);

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Branding */}
                <div className="mb-6 text-center">
                    <span className="font-pulse font-bold text-[1.125rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <p className="font-pulse text-[0.6875rem] text-pulse-muted tracking-[0.06em] mt-0.5">
                        Your workout, logged.
                    </p>
                </div>

                {/* Card */}
                <div className="w-full max-w-[340px] bg-pulse-surface border border-pulse-border rounded-2xl p-5">
                    {/* Workout header */}
                    <div className="mb-4">
                        <h2 className="font-pulse text-xl font-bold text-white">{stats.workoutLabel}</h2>
                        <p className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">{stats.date}</p>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[`${stats.durationMin} min`, `${stats.totalSets} sets`, `Week ${week}`].map((label) => (
                            <span
                                key={label}
                                className="font-pulse text-[0.6875rem] font-semibold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 rounded-full px-2.5 py-1 tracking-[0.04em]"
                            >
                                {label}
                            </span>
                        ))}
                    </div>

                    {/* Top lifts */}
                    {stats.topLifts.length > 0 && (
                        <div className="flex flex-col gap-1.5 mb-3">
                            {stats.topLifts.map((lift, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="font-pulse text-[0.8125rem] text-pulse-text flex-1 truncate">
                                        {lift.name}
                                    </span>
                                    <span className="font-pulse text-[0.8125rem] font-semibold text-white shrink-0">
                                        {lift.displayWeight} {unit} × {lift.reps}
                                    </span>
                                    {lift.isPR && (
                                        <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                            PR
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PR summary */}
                    {stats.prCount > 0 && (
                        <p className="font-pulse text-[0.75rem] font-semibold text-pulse-accent">
                            {stats.prCount} {stats.prCount === 1 ? 'PR' : 'PRs'} this session 🏆
                        </p>
                    )}
                </div>

                {/* Screenshot hint */}
                <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-4 tracking-[0.04em]">
                    📸 Screenshot to share
                </p>
            </div>

            {/* Done button */}
            <div className="px-6 pb-8">
                <button
                    aria-label="Done"
                    onClick={onDismiss}
                    className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none">
                    Done
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- ShareCard
```
Expected: all 10 ShareCard tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/ShareCard.tsx src/components/pulse/__tests__/ShareCard.test.tsx
git commit -m "feat(share): add ShareCard component"
```

---

## Task 3: Wire ShareCard into LogView

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1: Add `ShareCard` import and `WorkoutSession` type to `LogView.tsx`**

Update the existing import lines at the top of `src/components/pulse/views/LogView.tsx`:

```ts
import ShareCard from '../ShareCard';
import type { LogEntry, RoutineExercise, WorkoutSession } from '@/lib/pulse/types';
```

(Replace `import type { LogEntry, RoutineExercise } from '@/lib/pulse/types';`)

- [ ] **Step 2: Add `shareSession` state inside `LogView`**

After the existing `const [workoutModeOpen, setWorkoutModeOpen] = useState(false);` line, add:

```ts
const [shareSession, setShareSession] = useState<{ session: WorkoutSession; completedAt: string } | null>(null);
```

Also add `useState` is already imported — no change needed there.

- [ ] **Step 3: Replace `handleCompleteWorkout` to capture session before clearing**

Replace the existing `handleCompleteWorkout` function:

```ts
async function handleCompleteWorkout() {
    if (!session) return;
    const completedAt = new Date().toISOString();
    const completedSession = session;
    try {
        await completeSession(completedSession.id);
    } catch {
        // ignore — session may have already been completed or network failed
    }
    setWorkoutModeOpen(false);
    setShareSession({ session: completedSession, completedAt });
}
```

- [ ] **Step 4: Render `ShareCard` in the JSX**

In the `return (...)` block of `LogView`, add the `ShareCard` render directly after the `WorkoutModeScreen` conditional block. The section currently starts with:

```tsx
return (
    <div>
        {workoutModeOpen && session && (
            <WorkoutModeScreen ... />
        )}
```

Add immediately after the `WorkoutModeScreen` block:

```tsx
        {shareSession && (
            <ShareCard
                session={shareSession.session}
                completedAt={shareSession.completedAt}
                exercises={workoutExercises}
                logs={logs}
                prMap={prMap}
                week={activeWeek}
                unit={unit}
                onDismiss={() => setShareSession(null)}
            />
        )}
```

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```
Expected: all tests PASS (no regressions in LogView or other tests).

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/pulse/views/LogView.tsx
git commit -m "feat(share): wire ShareCard into LogView on workout completion"
```

---

## Acceptance Criteria

- [ ] Finishing a workout in WorkoutModeScreen shows the ShareCard full-screen overlay
- [ ] ShareCard shows workout label, date, duration, total sets, week
- [ ] ShareCard shows up to 3 top lifts with weight × reps
- [ ] PR badge appears on lifts that are personal records
- [ ] PR count line appears only when at least one PR was hit
- [ ] "Screenshot to share" hint visible
- [ ] "Done" button dismisses the card and returns to LogView
- [ ] WorkoutModeScreen and ShareCard never render simultaneously
- [ ] All tests pass, typecheck clean
