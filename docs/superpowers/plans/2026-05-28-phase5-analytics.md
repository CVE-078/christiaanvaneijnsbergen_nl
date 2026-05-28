# Phase 5 — Progress & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend HistoryView with visual progress analytics — fix exercise name placeholder, add streak calendar, volume bar chart, e1RM progression chart, and best lifts list.

**Architecture:** Pure utility functions in `src/lib/pulse/utils.ts` (with Vitest unit tests). Chart components in `src/components/pulse/` as standalone SVG functions receiving pre-computed data as props. `HistoryView` is the orchestrator: reads `usePulse()`, derives data via `useMemo`, renders sections top-to-bottom.

**Tech Stack:** React, TypeScript, Tailwind v4 `pulse-*` tokens, inline SVG (no chart library), Vitest (`npm run test:run`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/pulse/types.ts` | Modify | Add `BestSet` interface |
| `src/lib/pulse/utils.ts` | Modify | Add `computeVolumeByTypeAndWeek`, `computeE1RMHistory`, `computeBestSets` |
| `src/lib/pulse/__tests__/utils.test.ts` | Modify | Tests for the 3 new utilities |
| `src/components/pulse/VolumeChart.tsx` | Create | Stacked bar chart SVG (sets per week, colored by workout type) |
| `src/components/pulse/StreakCalendar.tsx` | Create | 12-dot row, filled = week with logged data |
| `src/components/pulse/E1RMChart.tsx` | Create | Line chart SVG with exercise picker and PR marker |
| `src/components/pulse/BestLifts.tsx` | Create | Best set list, grouped by workout type |
| `src/components/pulse/views/HistoryView.tsx` | Modify | Wire all components, fix exercise name placeholder |

---

## Task 1: Fix exercise name placeholder in HistoryView

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`

The current file shows `"Exercise"` (hardcoded string) for every set in history. `usePulse()` exposes `routines: RoutineWithExercises[]`, which contains all exercises for all routines. Build a `Map<routineExerciseId, exerciseName>` and resolve each set's name from it.

- [ ] **Step 1: Update HistoryView.tsx**

Replace the entire file content with:

```tsx
'use client';
import { useMemo } from 'react';
import { buildHistory, calcE1RM, toDisplay } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';

export default function HistoryView() {
    const { logs, profile, prMap, routines } = usePulse();
    const unit = profile.unit;
    const sessions = useMemo(() => buildHistory(logs), [logs]);

    const nameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const r of routines) {
            for (const re of r.exercises) {
                m.set(re.id, re.exercise.name);
            }
        }
        return m;
    }, [routines]);

    if (sessions.length === 0) {
        return (
            <div className="py-16 px-4 text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-dim mb-3">
                    No sessions yet
                </div>
                <div className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                    Head to Log to get started.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-[600px] mx-auto flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:max-w-[1100px] lg:items-start">
            {sessions.map((session) => (
                <div
                    key={session.week}
                    className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
                    <div className="py-3 px-4 border-b border-pulse-border flex items-center gap-3">
                        <span className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase font-bold text-pulse-accent">
                            Week {session.week}
                        </span>
                        <span className="font-pulse text-[0.6875rem] text-pulse-dim ml-auto">
                            {session.sets.length} sets
                        </span>
                    </div>
                    <div className="py-2 px-4 pb-3">
                        {session.sets.map((set, i) => {
                            const bestE1RM = prMap[set.routineExerciseId] ?? 0;
                            const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 py-1 ${i < session.sets.length - 1 ? 'border-b border-pulse-border' : ''}`}>
                                    <span className="font-pulse text-[0.6875rem] text-pulse-dim w-5 shrink-0">
                                        {String(set.setIdx + 1).padStart(2, '0')}
                                    </span>
                                    <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {nameMap.get(set.routineExerciseId) ?? '—'}
                                    </span>
                                    <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                        {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                    </span>
                                    {isPR && (
                                        <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                            PR
                                        </span>
                                    )}
                                    <span className="font-pulse text-pulse-dim text-[0.75rem] shrink-0">
                                        {set.rir} RIR
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/views/HistoryView.tsx
git commit -m "fix(pulse): resolve exercise names in HistoryView from routines"
```

---

## Task 2: BestSet type + computeVolumeByTypeAndWeek

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/utils.ts`
- Modify: `src/lib/pulse/__tests__/utils.test.ts`

`computeVolumeByTypeAndWeek` counts saved sets per week per workout type. It needs `RoutineExercise[]` alongside `Logs` because workout type is NOT encoded in log keys (format: `{week}-{uuid}-{setIdx}`).

- [ ] **Step 1: Add BestSet to types.ts**

In `src/lib/pulse/types.ts`, add after line 89 (`export type PRMap = Record<string, number>;`):

```ts
export interface BestSet {
    routineExerciseId: string;
    week: number;
    kg: number;
    reps: number;
    e1rm: number;
}
```

- [ ] **Step 2: Write failing tests**

Add to the end of `src/lib/pulse/__tests__/utils.test.ts`.

First, update the type import at the top of the file from:
```ts
import type { Logs } from '../types';
```
to:
```ts
import type { Logs, RoutineExercise, WorkoutType } from '../types';
```

Then update the named import to include `computeVolumeByTypeAndWeek`:
```ts
import {
    getPhase,
    getRIR,
    logKey,
    parseMaxSets,
    buildHistory,
    weekHasData,
    calcE1RM,
    computePRMap,
    computeStreak,
    computeSuggestion,
    computeVolumeByTypeAndWeek,
} from '../utils';
```

Append these tests:

```ts
describe('computeVolumeByTypeAndWeek', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    function re(id: string, workout_type: WorkoutType): RoutineExercise {
        return {
            id,
            routine_id: 'r1',
            exercise_id: 'e1',
            workout_type,
            order: 0,
            sets: '3',
            reps: '8',
            starting_weight_kg: null,
            exercise: {
                id: 'e1',
                name: 'Bench Press',
                category: 'chest',
                default_sets: '3',
                default_reps: '8',
                user_id: null,
            },
        };
    }

    it('returns empty record for empty logs', () => {
        expect(computeVolumeByTypeAndWeek({}, [])).toEqual({});
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: false },
        };
        expect(computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push')])).toEqual({});
    });

    it('counts one set per saved entry, grouped by workout type', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_A}-1`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const result = computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push'), re(UUID_B, 'pull')]);
        expect(result[1]).toEqual({ push: 2, pull: 1 });
    });

    it('separates weeks correctly', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 62, reps: 8, rir: 3, saved: true },
        };
        const result = computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push')]);
        expect(result[1]).toEqual({ push: 1 });
        expect(result[2]).toEqual({ push: 1 });
    });

    it('skips entries whose routineExerciseId is not in the supplied list', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
        };
        expect(computeVolumeByTypeAndWeek(logs, [])).toEqual({});
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:run 2>&1 | tail -20
```

Expected: test suite fails with "computeVolumeByTypeAndWeek is not a function".

- [ ] **Step 4: Implement computeVolumeByTypeAndWeek in utils.ts**

Update the type import at the top of `src/lib/pulse/utils.ts` from:
```ts
import type { Phase, Logs, HistorySession, LogEntry, Unit } from './types';
```
to:
```ts
import type { Phase, Logs, HistorySession, LogEntry, Unit, RoutineExercise, WorkoutType } from './types';
```

Add after the `buildHistory` function:

```ts
export function computeVolumeByTypeAndWeek(
    logs: Logs,
    routineExercises: RoutineExercise[],
): Record<number, Partial<Record<WorkoutType, number>>> {
    const typeMap = new Map<string, WorkoutType>(
        routineExercises.map((re) => [re.id, re.workout_type]),
    );
    const result: Record<number, Partial<Record<WorkoutType, number>>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const routineExerciseId = key.slice(firstDash + 1, lastDash);
        if (!UUID_RE.test(routineExerciseId)) continue;
        const week = Number(key.slice(0, firstDash));
        const wt = typeMap.get(routineExerciseId);
        if (!wt) continue;
        if (!result[week]) result[week] = {};
        result[week][wt] = (result[week][wt] ?? 0) + 1;
    }
    return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add BestSet type and computeVolumeByTypeAndWeek"
```

---

## Task 3: computeE1RMHistory

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Modify: `src/lib/pulse/__tests__/utils.test.ts`

For a given `routineExerciseId`, returns one data point per week: the best e1RM achieved that week. Sorted ascending by week for chart rendering.

- [ ] **Step 1: Write failing tests**

Update the named import in `src/lib/pulse/__tests__/utils.test.ts` to include `computeE1RMHistory`:

```ts
import {
    // ... existing imports ...
    computeVolumeByTypeAndWeek,
    computeE1RMHistory,
} from '../utils';
```

Append:

```ts
describe('computeE1RMHistory', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty array for empty logs', () => {
        expect(computeE1RMHistory({}, UUID_A)).toEqual([]);
    });

    it('only includes entries for the requested routineExerciseId', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 80, reps: 5, rir: 2, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result).toHaveLength(1);
        expect(result[0].week).toBe(1);
        expect(result[0].e1rm).toBeCloseTo(calcE1RM(60, 8));
    });

    it('picks best e1RM per week when multiple sets exist', () => {
        const logs: Logs = {
            [`2-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-1`]: { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result).toHaveLength(1);
        expect(result[0].e1rm).toBeCloseTo(calcE1RM(65, 6));
    });

    it('returns entries sorted ascending by week', () => {
        const logs: Logs = {
            [`3-${UUID_A}-0`]: { kg: 70, reps: 6, rir: 2, saved: true },
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 65, reps: 7, rir: 3, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result.map((p) => p.week)).toEqual([1, 2, 3]);
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: false },
        };
        expect(computeE1RMHistory(logs, UUID_A)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: fails with "computeE1RMHistory is not a function".

- [ ] **Step 3: Implement computeE1RMHistory in utils.ts**

Add after `computeVolumeByTypeAndWeek`:

```ts
export function computeE1RMHistory(
    logs: Logs,
    routineExerciseId: string,
): Array<{ week: number; e1rm: number }> {
    const weekBest: Record<number, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const id = key.slice(firstDash + 1, lastDash);
        if (id !== routineExerciseId) continue;
        const week = Number(key.slice(0, firstDash));
        const e1rm = calcE1RM(val.kg, val.reps);
        if (e1rm > (weekBest[week] ?? 0)) weekBest[week] = e1rm;
    }
    return Object.entries(weekBest)
        .map(([w, e1rm]) => ({ week: Number(w), e1rm }))
        .sort((a, b) => a.week - b.week);
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add computeE1RMHistory utility"
```

---

## Task 4: computeBestSets

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Modify: `src/lib/pulse/__tests__/utils.test.ts`

Returns the single best set (highest e1RM) per `routineExerciseId` across all weeks.

- [ ] **Step 1: Write failing tests**

Update the named import to include `computeBestSets`:

```ts
import {
    // ... existing imports ...
    computeE1RMHistory,
    computeBestSets,
} from '../utils';
```

Append:

```ts
describe('computeBestSets', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty record for empty logs', () => {
        expect(computeBestSets({})).toEqual({});
    });

    it('returns the set with the highest e1RM per exercise', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const result = computeBestSets(logs);
        expect(result[UUID_A]).toBeDefined();
        expect(result[UUID_A].kg).toBe(65);
        expect(result[UUID_A].week).toBe(2);
        expect(result[UUID_A].e1rm).toBeCloseTo(calcE1RM(65, 6));
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 200, reps: 20, rir: 0, saved: false },
        };
        expect(computeBestSets(logs)).toEqual({});
    });

    it('tracks separate best sets per exercise', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const result = computeBestSets(logs);
        expect(result[UUID_A].kg).toBe(60);
        expect(result[UUID_B].kg).toBe(40);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: fails with "computeBestSets is not a function".

- [ ] **Step 3: Implement computeBestSets in utils.ts**

Update the type import in utils.ts to include `BestSet`:

```ts
import type { Phase, Logs, HistorySession, LogEntry, Unit, RoutineExercise, WorkoutType, BestSet } from './types';
```

Add after `computeE1RMHistory`:

```ts
export function computeBestSets(logs: Logs): Record<string, BestSet> {
    const best: Record<string, BestSet> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const routineExerciseId = key.slice(firstDash + 1, lastDash);
        if (!UUID_RE.test(routineExerciseId)) continue;
        const week = Number(key.slice(0, firstDash));
        const e1rm = calcE1RM(val.kg, val.reps);
        if (!best[routineExerciseId] || e1rm > best[routineExerciseId].e1rm) {
            best[routineExerciseId] = {
                routineExerciseId,
                week,
                kg: val.kg,
                reps: val.reps,
                e1rm,
            };
        }
    }
    return best;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add computeBestSets utility"
```

---

## Task 5: VolumeChart component

**Files:**
- Create: `src/components/pulse/VolumeChart.tsx`

Stacked bar chart: 12 bars (weeks 1–12), each bar height = total sets that week, stacked by workout type with distinct colours. Uses CSS variables for design tokens, matches BodyweightChart conventions.

Workout type colours:
- push / chest / shoulders / arms → `#3ecf8e` (accent green)
- pull / back → `#38bdf8` (sky blue)
- legs / lower → `#a78bfa` (purple)
- upper / full_body → `#fb923c` (orange)

SVG geometry: `viewBox="0 0 300 68"`, PL=28, PR=6, PT=8, PB=20, chart area W=266 H=40, slot width = 266/12 ≈ 22.17, bar width = 14.

- [ ] **Step 1: Create VolumeChart.tsx**

```tsx
'use client';
import { WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
import type { WorkoutType } from '@/lib/pulse/types';

const TYPE_COLOR: Partial<Record<WorkoutType, string>> = {
    push: '#3ecf8e', chest: '#3ecf8e', shoulders: '#3ecf8e', arms: '#3ecf8e',
    pull: '#38bdf8', back: '#38bdf8',
    legs: '#a78bfa', lower: '#a78bfa',
    upper: '#fb923c', full_body: '#fb923c',
};
const DEFAULT_COLOR = '#5e6a80';

interface VolumeChartProps {
    volByWeek: Record<number, Partial<Record<WorkoutType, number>>>;
}

export default function VolumeChart({ volByWeek }: VolumeChartProps) {
    const PL = 28, PR = 6, PT = 8, PB = 20;
    const VW = 300, VH = 68;
    const W = VW - PL - PR;   // 266
    const H = VH - PT - PB;   // 40
    const slotW = W / 12;
    const barW = 14;

    const weekTotals = Array.from({ length: 12 }, (_, i) =>
        Object.values(volByWeek[i + 1] ?? {}).reduce((a, b) => a + b, 0),
    );
    const maxSets = Math.max(1, ...weekTotals);

    function getSegments(weekData: Partial<Record<WorkoutType, number>>) {
        let bottom = PT + H;
        const segs: { type: WorkoutType; color: string; y: number; h: number }[] = [];
        for (const type of WORKOUT_TYPE_ORDER) {
            const count = weekData[type] ?? 0;
            if (count === 0) continue;
            const h = (count / maxSets) * H;
            bottom -= h;
            segs.push({ type, color: TYPE_COLOR[type] ?? DEFAULT_COLOR, y: bottom, h });
        }
        return segs;
    }

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" aria-hidden="true">
            {/* Baseline */}
            <line
                x1={PL} y1={PT + H}
                x2={PL + W} y2={PT + H}
                stroke="var(--color-pulse-border)"
                strokeWidth={1}
            />

            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const barX = PL + i * slotW + (slotW - barW) / 2;
                const segs = getSegments(volByWeek[week] ?? {});
                return (
                    <g key={week}>
                        {segs.map((s) => (
                            <rect
                                key={s.type}
                                x={barX}
                                y={s.y}
                                width={barW}
                                height={s.h}
                                fill={s.color}
                                rx={1}
                                opacity={0.85}
                            />
                        ))}
                    </g>
                );
            })}

            {/* X-axis labels — every 2 weeks */}
            {[1, 3, 5, 7, 9, 11].map((w) => (
                <text
                    key={w}
                    x={PL + (w - 1) * slotW + slotW / 2}
                    y={VH - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-dim)"
                >
                    {w}
                </text>
            ))}
        </svg>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/VolumeChart.tsx
git commit -m "feat(pulse): add VolumeChart stacked bar SVG component"
```

---

## Task 6: StreakCalendar component

**Files:**
- Create: `src/components/pulse/StreakCalendar.tsx`

12 circles in a row (weeks 1–12). Filled with accent colour when `weekHasData(week, logs)` is true. Week number rendered inside each circle.

SVG geometry: `viewBox="0 0 300 28"`, r=9, cy=14, cx(i) = 16 + i×22 (week 12 centre at x=258, right edge 267 < 300).

- [ ] **Step 1: Create StreakCalendar.tsx**

```tsx
'use client';
import { weekHasData } from '@/lib/pulse/utils';
import type { Logs } from '@/lib/pulse/types';

interface StreakCalendarProps {
    logs: Logs;
}

export default function StreakCalendar({ logs }: StreakCalendarProps) {
    return (
        <svg viewBox="0 0 300 28" className="w-full h-7" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const filled = weekHasData(week, logs);
                const cx = 16 + i * 22;
                return (
                    <g key={week}>
                        <circle
                            cx={cx}
                            cy={14}
                            r={9}
                            fill={filled ? 'var(--color-pulse-accent)' : 'var(--color-pulse-surface)'}
                            stroke={filled ? 'var(--color-pulse-accent)' : 'var(--color-pulse-border)'}
                            strokeWidth={1}
                        />
                        <text
                            x={cx}
                            y={18}
                            textAnchor="middle"
                            fontSize="7"
                            fontFamily="var(--font-pulse)"
                            fill={filled ? 'var(--color-pulse-bg)' : 'var(--color-pulse-dim)'}
                        >
                            {week}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/StreakCalendar.tsx
git commit -m "feat(pulse): add StreakCalendar SVG component"
```

---

## Task 7: E1RMChart component

**Files:**
- Create: `src/components/pulse/E1RMChart.tsx`

SVG line chart modelled after BodyweightChart in ProfileView. Receives pre-computed history. PR marker (larger ring) at the highest e1RM point. Gradient area fill. Empty state for < 2 data points. Y-axis shows 3 ticks converted to display unit.

SVG geometry: `viewBox="0 0 300 80"`, PL=34, PR=8, PT=10, PB=16, chart area W=258 H=54. x-scale maps from `history[0].week` to `history[last].week`. y-scale maps minE→bottom, maxE→top.

- [ ] **Step 1: Create E1RMChart.tsx**

```tsx
'use client';
import { toDisplay } from '@/lib/pulse/utils';
import type { Unit } from '@/lib/pulse/types';

interface E1RMChartProps {
    history: Array<{ week: number; e1rm: number }>;
    unit: Unit;
}

export default function E1RMChart({ history, unit }: E1RMChartProps) {
    if (history.length < 2) {
        return (
            <div className="h-20 flex items-center justify-center">
                <span className="font-pulse text-[0.75rem] text-pulse-dim">
                    Log at least two sessions to see progression.
                </span>
            </div>
        );
    }

    const PL = 34, PR = 8, PT = 10, PB = 16;
    const VW = 300, VH = 80;
    const W = VW - PL - PR;  // 258
    const H = VH - PT - PB;  // 54

    const e1rms = history.map((p) => p.e1rm);
    const minE = Math.min(...e1rms);
    const maxE = Math.max(...e1rms);
    const eRange = maxE - minE || 1;

    const minWeek = history[0].week;
    const maxWeek = history[history.length - 1].week;
    const weekRange = maxWeek - minWeek || 1;

    const px = (week: number) => PL + ((week - minWeek) / weekRange) * W;
    const py = (e1rm: number) => PT + H - ((e1rm - minE) / eRange) * H;

    const pathD = history
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.week).toFixed(1)} ${py(p.e1rm).toFixed(1)}`)
        .join(' ');

    const prPoint = history.reduce((a, b) => (a.e1rm >= b.e1rm ? a : b));
    const yTicks = [minE, (minE + maxE) / 2, maxE];

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-20" aria-hidden="true">
            <defs>
                <linearGradient id="e1rm-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pulse-accent)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--color-pulse-accent)" stopOpacity={0} />
                </linearGradient>
            </defs>

            {/* Y-axis ticks */}
            {yTicks.map((v, i) => (
                <text
                    key={i}
                    x={PL - 3}
                    y={py(v) + 3}
                    textAnchor="end"
                    fontSize="8"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-dim)"
                >
                    {Math.round(toDisplay(v, unit))}
                </text>
            ))}

            {/* Area fill */}
            <path
                d={`${pathD} L ${px(maxWeek).toFixed(1)} ${(PT + H).toFixed(1)} L ${px(minWeek).toFixed(1)} ${(PT + H).toFixed(1)} Z`}
                fill="url(#e1rm-grad)"
            />

            {/* Line */}
            <path
                d={pathD}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Data dots */}
            {history.map((p) => (
                <circle
                    key={p.week}
                    cx={px(p.week)}
                    cy={py(p.e1rm)}
                    r={2.5}
                    fill="var(--color-pulse-accent)"
                />
            ))}

            {/* PR ring */}
            <circle
                cx={px(prPoint.week)}
                cy={py(prPoint.e1rm)}
                r={5}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
            />
        </svg>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/E1RMChart.tsx
git commit -m "feat(pulse): add E1RMChart SVG line chart component"
```

---

## Task 8: BestLifts component

**Files:**
- Create: `src/components/pulse/BestLifts.tsx`

Lists the best set per exercise, grouped by `workout_type` in `WORKOUT_TYPE_ORDER` order, sorted by e1RM descending within each group. Rank-1 item in each group gets a PR badge. Empty state when no data.

- [ ] **Step 1: Create BestLifts.tsx**

```tsx
'use client';
import { WORKOUT_TYPE_ORDER, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { toDisplay } from '@/lib/pulse/utils';
import type { RoutineExercise, BestSet, Unit } from '@/lib/pulse/types';

interface BestLiftsProps {
    allRoutineExercises: RoutineExercise[];
    bestSets: Record<string, BestSet>;
    unit: Unit;
}

export default function BestLifts({ allRoutineExercises, bestSets, unit }: BestLiftsProps) {
    const entries = allRoutineExercises
        .filter((re) => bestSets[re.id])
        .map((re) => ({ re, best: bestSets[re.id] }))
        .sort((a, b) => b.best.e1rm - a.best.e1rm);

    if (entries.length === 0) {
        return (
            <p className="font-pulse text-[0.75rem] text-pulse-dim py-2">
                No sets logged yet.
            </p>
        );
    }

    const grouped = WORKOUT_TYPE_ORDER
        .map((type) => ({
            type,
            items: entries.filter((e) => e.re.workout_type === type),
        }))
        .filter((g) => g.items.length > 0);

    return (
        <div className="flex flex-col gap-4">
            {grouped.map(({ type, items }) => (
                <div key={type}>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-dim mb-1">
                        {WORKOUT_TYPE_LABELS[type]}
                    </div>
                    <div className="flex flex-col">
                        {items.map(({ re, best }, idx) => (
                            <div
                                key={re.id}
                                className="flex items-center gap-3 py-[6px] border-b border-pulse-border last:border-0">
                                <span className="font-pulse text-[0.6875rem] text-pulse-dim w-4 shrink-0 text-right">
                                    {idx + 1}
                                </span>
                                <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {re.exercise.name}
                                </span>
                                <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                    {toDisplay(best.kg, unit)} {unit} × {best.reps}
                                </span>
                                <span className="font-pulse text-[0.6875rem] text-pulse-dim shrink-0">
                                    {Math.round(toDisplay(best.e1rm, unit))} e1RM
                                </span>
                                {idx === 0 && (
                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                        PR
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/BestLifts.tsx
git commit -m "feat(pulse): add BestLifts component grouped by workout type"
```

---

## Task 9: Wire all analytics into HistoryView

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`

Replaces the current session-cards-only layout with five sections top-to-bottom: Streak, Weekly Volume, e1RM Progression (with exercise picker), Best Lifts, Session History. Session History cards now use `nameMap` for exercise names (resolves the Task 1 fix permanently).

The exercise picker defaults to the most-logged exercise (computed from `logs`). Changing the picker updates `selectedExerciseId` state, which recomputes `e1rmHistory`.

- [ ] **Step 1: Rewrite HistoryView.tsx**

Replace the entire file with:

```tsx
'use client';
import { useMemo, useState } from 'react';
import {
    buildHistory,
    calcE1RM,
    toDisplay,
    computeVolumeByTypeAndWeek,
    computeE1RMHistory,
    computeBestSets,
} from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import VolumeChart from '@/components/pulse/VolumeChart';
import StreakCalendar from '@/components/pulse/StreakCalendar';
import E1RMChart from '@/components/pulse/E1RMChart';
import BestLifts from '@/components/pulse/BestLifts';

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-dim mb-2">
            {children}
        </div>
    );
}

export default function HistoryView() {
    const { logs, profile, prMap, routines, streak } = usePulse();
    const unit = profile.unit;

    const allRoutineExercises = useMemo(
        () => routines.flatMap((r) => r.exercises),
        [routines],
    );

    const nameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const re of allRoutineExercises) m.set(re.id, re.exercise.name);
        return m;
    }, [allRoutineExercises]);

    const sessions = useMemo(() => buildHistory(logs), [logs]);

    const volByWeek = useMemo(
        () => computeVolumeByTypeAndWeek(logs, allRoutineExercises),
        [logs, allRoutineExercises],
    );

    const bestSets = useMemo(() => computeBestSets(logs), [logs]);

    const defaultExerciseId = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const [key, val] of Object.entries(logs)) {
            if (!val?.saved) continue;
            const firstDash = key.indexOf('-');
            const lastDash = key.lastIndexOf('-');
            if (firstDash === -1 || lastDash === firstDash) continue;
            const id = key.slice(firstDash + 1, lastDash);
            counts[id] = (counts[id] ?? 0) + 1;
        }
        return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    }, [logs]);

    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const exerciseId = selectedExerciseId ?? defaultExerciseId;

    const e1rmHistory = useMemo(
        () => (exerciseId ? computeE1RMHistory(logs, exerciseId) : []),
        [logs, exerciseId],
    );

    const hasData = sessions.length > 0;

    return (
        <div className="p-4 max-w-[820px] mx-auto flex flex-col gap-4">
            {/* Streak */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <div className="flex items-baseline gap-2 mb-3">
                    <SectionHeader>Streak</SectionHeader>
                    <span className="font-pulse text-[0.75rem] text-pulse-accent font-semibold ml-auto">
                        {streak} {streak === 1 ? 'week' : 'weeks'}
                    </span>
                </div>
                <StreakCalendar logs={logs} />
                <p className="sr-only">
                    {streak === 0
                        ? 'No streak yet.'
                        : `Current streak: ${streak} consecutive week${streak !== 1 ? 's' : ''}.`}
                </p>
            </div>

            {/* Weekly Volume */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <SectionHeader>Weekly Volume</SectionHeader>
                {hasData ? (
                    <VolumeChart volByWeek={volByWeek} />
                ) : (
                    <p className="font-pulse text-[0.75rem] text-pulse-dim py-4 text-center">
                        Log a session to see volume trends.
                    </p>
                )}
            </div>

            {/* e1RM Progression */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                    <SectionHeader>e1RM Progression</SectionHeader>
                    {allRoutineExercises.length > 0 && (
                        <select
                            value={exerciseId ?? ''}
                            onChange={(e) => setSelectedExerciseId(e.target.value || null)}
                            className="font-pulse text-[0.6875rem] bg-pulse-surface-2 border border-pulse-border rounded px-2 py-[3px] text-pulse-text ml-auto"
                        >
                            {allRoutineExercises.map((re) => (
                                <option key={re.id} value={re.id}>
                                    {re.exercise.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <E1RMChart history={e1rmHistory} unit={unit} />
            </div>

            {/* Best Lifts */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <SectionHeader>Best Lifts</SectionHeader>
                <BestLifts
                    allRoutineExercises={allRoutineExercises}
                    bestSets={bestSets}
                    unit={unit}
                />
            </div>

            {/* Session History */}
            {hasData && (
                <div>
                    <SectionHeader>Session History</SectionHeader>
                    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
                        {sessions.map((session) => (
                            <div
                                key={session.week}
                                className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
                                <div className="py-3 px-4 border-b border-pulse-border flex items-center gap-3">
                                    <span className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase font-bold text-pulse-accent">
                                        Week {session.week}
                                    </span>
                                    <span className="font-pulse text-[0.6875rem] text-pulse-dim ml-auto">
                                        {session.sets.length} sets
                                    </span>
                                </div>
                                <div className="py-2 px-4 pb-3">
                                    {session.sets.map((set, i) => {
                                        const bestE1RM = prMap[set.routineExerciseId] ?? 0;
                                        const isPR =
                                            bestE1RM > 0 &&
                                            calcE1RM(set.kg, set.reps) >= bestE1RM;
                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-3 py-1 ${
                                                    i < session.sets.length - 1
                                                        ? 'border-b border-pulse-border'
                                                        : ''
                                                }`}>
                                                <span className="font-pulse text-[0.6875rem] text-pulse-dim w-5 shrink-0">
                                                    {String(set.setIdx + 1).padStart(2, '0')}
                                                </span>
                                                <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {nameMap.get(set.routineExerciseId) ?? '—'}
                                                </span>
                                                <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                                    {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                                </span>
                                                {isPR && (
                                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                                        PR
                                                    </span>
                                                )}
                                                <span className="font-pulse text-pulse-dim text-[0.75rem] shrink-0">
                                                    {set.rir} RIR
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!hasData && (
                <div className="py-16 px-4 text-center">
                    <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-dim mb-3">
                        No sessions yet
                    </div>
                    <div className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                        Head to Log to get started.
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/views/HistoryView.tsx
git commit -m "feat(pulse): phase 5 — analytics dashboard in HistoryView"
```

---

## After all tasks

Run the full check:

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run
```

Then open `/pulse/progress` in the browser and verify:
- Streak section shows correct dot fill for logged weeks
- Volume chart shows bars for weeks with data, stacked by workout type colour
- e1RM exercise picker defaults to most-logged exercise, chart shows line with PR ring
- Best Lifts shows exercises grouped by type with e1RM values and PR badges
- Session History shows real exercise names (not "Exercise" placeholder)
- All sections show graceful empty states when no data logged
