# Pulse Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Design C2 redesign to Pulse — bottom-tab mobile nav, dot progress indicators, styled set rows, and a responsive desktop shell (sidebar + two-pane log view) at ≥ 768 px — while leaving all server logic and data untouched.

**Architecture:** A `useMediaQuery('(min-width: 768px)')` hook gates rendering in `TrackerClient`: mobile renders a simplified topbar + view content + `BottomNav`; desktop renders a new `DesktopLayout` (sidebar + content area). The two-pane desktop log view is `LogViewDesktop` with `ExerciseListItem` (left pane rows) and `ExerciseDetailPane` (right pane). Visual updates to `ExerciseCard`, `SetLogger`, and `WorkoutTabs` apply on both breakpoints.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, inline styles throughout, JetBrains Mono (`MONO`), `#ff6c2f` (`ACCENT`), `#0a0a0a` (`BG`), `#141414` (`SURFACE`), `#1f1f1f` (`BORDER`), `#555` (`DIM`), `#3a3a3a` (`MUTED`), `#22c55e` (green), Vitest + Testing Library.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/weight-tracker/types.ts` | Modify | Export `View` type |
| `src/lib/weight-tracker/useMediaQuery.ts` | **Create** | SSR-safe media query hook |
| `src/lib/weight-tracker/__tests__/useMediaQuery.test.ts` | **Create** | Hook tests |
| `src/components/weight-tracker/ExerciseListItem.tsx` | **Create** | Compact desktop list-pane row |
| `src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx` | **Create** | List item tests |
| `src/components/weight-tracker/ExerciseDetailPane.tsx` | **Create** | Desktop right-pane with sets + rest timer |
| `src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx` | **Create** | Detail pane tests |
| `src/components/weight-tracker/views/LogViewDesktop.tsx` | **Create** | Two-pane desktop log view |
| `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx` | **Create** | Desktop log view tests |
| `src/components/weight-tracker/BottomNav.tsx` | **Create** | Mobile bottom tab bar |
| `src/components/weight-tracker/__tests__/BottomNav.test.tsx` | **Create** | Bottom nav tests |
| `src/components/weight-tracker/WorkoutTabs.tsx` | Modify | Add per-tab exercise-completion summary |
| `src/components/weight-tracker/__tests__/WorkoutTabs.test.tsx` | Modify | Add `logs` + `week` to all renders; add summary tests |
| `src/components/weight-tracker/views/LogView.tsx` | Modify | Pass `logs` + `week` to `WorkoutTabs` |
| `src/components/weight-tracker/ExerciseCard.tsx` | Modify | Dot progress indicators + 2 px progress bar under open header |
| `src/components/weight-tracker/__tests__/ExerciseCard.test.tsx` | Modify | Update snapshot-free assertions that relied on `█░` chars |
| `src/components/weight-tracker/SetLogger.tsx` | Modify | 40 px inputs, solid-orange Save button, green saved-row tint |
| `src/components/weight-tracker/DesktopLayout.tsx` | **Create** | Sidebar + content routing shell |
| `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx` | **Create** | Sidebar nav + error bar tests |
| `src/components/weight-tracker/TrackerClient.tsx` | Modify | Remove hamburger/dropdown; add `useMediaQuery` + `DesktopLayout` gate; add `BottomNav` |
| `src/app/globals.css` | Modify | Remove old hamburger rules; add `.pulse-history-grid` + `.pulse-profile-layout` |
| `src/components/weight-tracker/views/HistoryView.tsx` | Modify | Add `pulse-history-grid` className |
| `src/components/weight-tracker/views/ProfileView.tsx` | Modify | Wrap sections in `pulse-profile-main` / `pulse-profile-side` divs |

---

## Task 1: `View` type + `useMediaQuery` hook

**Files:**
- Modify: `src/lib/weight-tracker/types.ts`
- Create: `src/lib/weight-tracker/useMediaQuery.ts`
- Create: `src/lib/weight-tracker/__tests__/useMediaQuery.test.ts`

- [ ] **Step 1: Add `View` type to `types.ts`**

Open `src/lib/weight-tracker/types.ts` and append at the end:

```ts
export type View = 'log' | 'program' | 'history' | 'profile';
```

- [ ] **Step 2: Write the failing test for `useMediaQuery`**

Create `src/lib/weight-tracker/__tests__/useMediaQuery.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

function mockMatchMedia(matches: boolean) {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
        matches,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
        removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
            const i = listeners.indexOf(fn);
            if (i !== -1) listeners.splice(i, 1);
        },
        dispatch: (m: boolean) => listeners.forEach((fn) => fn({ matches: m })),
    };
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockReturnValue(mql),
    });
    return mql;
}

describe('useMediaQuery', () => {
    it('returns false on initial render (SSR-safe)', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(false);
    });

    it('returns true after mount when media matches', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(true);
    });

    it('returns false after mount when media does not match', () => {
        mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(false);
    });

    it('updates when the media query changes', () => {
        const mql = mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(false);
        act(() => mql.dispatch(true));
        expect(result.current).toBe(true);
    });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```powershell
bun run test:run -- useMediaQuery
```

Expected: FAIL — `useMediaQuery` not found.

- [ ] **Step 4: Implement `useMediaQuery`**

Create `src/lib/weight-tracker/useMediaQuery.ts`:

```ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(query);
        setMatches(mql.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```powershell
bun run test:run -- useMediaQuery
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/weight-tracker/types.ts src/lib/weight-tracker/useMediaQuery.ts src/lib/weight-tracker/__tests__/useMediaQuery.test.ts
git commit -m "feat(pulse): add View type and useMediaQuery hook (768px)"
```

---

## Task 2: `ExerciseListItem` — desktop left-pane row

**Files:**
- Create: `src/components/weight-tracker/ExerciseListItem.tsx`
- Create: `src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseListItem from '../ExerciseListItem';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3-4',
    reps: '8-12',
    load: 'Moderate',
    note: 'Full range',
};

const defaultProps = {
    exercise,
    exIdx: 0,
    week: 1,
    type: 'push' as const,
    logs: {},
    isActive: false,
    onClick: vi.fn(),
};

describe('ExerciseListItem', () => {
    it('renders the exercise name', () => {
        render(<ExerciseListItem {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('renders the exercise number padded to 2 digits', () => {
        render(<ExerciseListItem {...defaultProps} exIdx={2} />);
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        render(<ExerciseListItem {...defaultProps} onClick={onClick} />);
        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows the complete indicator when all sets are saved', () => {
        const logs = {
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-1': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-2': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-3': { kg: 60, reps: 10, rir: 3, saved: true },
        };
        render(<ExerciseListItem {...defaultProps} logs={logs} />);
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('does not show the complete indicator when sets are not done', () => {
        render(<ExerciseListItem {...defaultProps} />);
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- ExerciseListItem
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ExerciseListItem`**

Create `src/components/weight-tracker/ExerciseListItem.tsx`:

```tsx
import { logKey, parseMaxSets } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, MUTED } from '@/lib/weight-tracker/theme';
import type { Exercise, Logs, WorkoutType } from '@/lib/weight-tracker/types';

const GREEN = '#22c55e';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    isActive: boolean;
    onClick: () => void;
}

export default function ExerciseListItem({ exercise, exIdx, week, type, logs, isActive, onClick }: Props) {
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;

    return (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                padding: '0.75rem 0.875rem',
                background: isActive ? '#161616' : 'none',
                border: 'none',
                borderLeft: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                borderBottom: '1px solid #222',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                textAlign: 'left',
            }}>
            <span
                style={{
                    fontFamily: MONO,
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: complete ? 'rgba(34,197,94,0.4)' : isActive ? ACCENT : '#333',
                    width: '1.75rem',
                    flexShrink: 0,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                }}>
                {String(exIdx + 1).padStart(2, '0')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        color: isActive ? '#fff' : '#888',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'color 0.1s',
                    }}>
                    {exercise.name}
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span
                            key={i}
                            style={{
                                display: 'block',
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: i < savedCount ? (complete ? GREEN : ACCENT) : MUTED,
                            }}
                        />
                    ))}
                </div>
            </div>
            {complete && (
                <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: GREEN, flexShrink: 0 }}>✓</span>
            )}
        </button>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
bun run test:run -- ExerciseListItem
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/ExerciseListItem.tsx src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx
git commit -m "feat(pulse): add ExerciseListItem for desktop left pane"
```

---

## Task 3: `ExerciseDetailPane` — desktop right-pane

**Files:**
- Create: `src/components/weight-tracker/ExerciseDetailPane.tsx`
- Create: `src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseDetailPane from '../ExerciseDetailPane';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3-4',
    reps: '8-12',
    load: 'Moderate load',
    note: 'Full ROM',
};

const defaultProps = {
    exercise,
    exIdx: 0,
    week: 1,
    type: 'push' as const,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    timerTrigger: 0,
};

describe('ExerciseDetailPane', () => {
    it('renders the exercise name in the header', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('renders the set/rep info', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        expect(screen.getByText(/3-4 sets · 8-12 reps/i)).toBeInTheDocument();
    });

    it('renders the correct number of Save buttons (one per max set)', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        // sets: '3-4' → parseMaxSets → 4 sets
        const saveBtns = screen.getAllByRole('button', { name: /save/i });
        expect(saveBtns).toHaveLength(4);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const onSave = vi.fn();
        render(<ExerciseDetailPane {...defaultProps} onSave={onSave} />);
        const kgInput = screen.getAllByRole('spinbutton', { name: /weight in kg/i })[0];
        const repsInput = screen.getAllByRole('spinbutton', { name: /repetitions/i })[0];
        await userEvent.type(kgInput, '60');
        await userEvent.type(repsInput, '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith(
            '1-push-0-0',
            expect.objectContaining({ kg: 60, reps: 10, saved: true }),
        );
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- ExerciseDetailPane
```

Expected: FAIL.

- [ ] **Step 3: Implement `ExerciseDetailPane`**

Create `src/components/weight-tracker/ExerciseDetailPane.tsx`:

```tsx
import { useMemo } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER, DIM } from '@/lib/weight-tracker/theme';
import SetLogger from './SetLogger';
import RestTimer from './RestTimer';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    timerTrigger: number;
}

export default function ExerciseDetailPane({
    exercise,
    exIdx,
    week,
    type,
    logs,
    prMap,
    unit,
    onSave,
    onDelete,
    timerTrigger,
}: Props) {
    const maxSets = parseMaxSets(exercise.sets);
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem 0.875rem', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <div
                    style={{
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '1.125rem',
                        marginBottom: '0.25rem',
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                    {exercise.name}
                </div>
                <div
                    style={{
                        fontFamily: MONO,
                        fontSize: '0.5625rem',
                        letterSpacing: '0.06em',
                        color: DIM,
                        textTransform: 'uppercase',
                    }}>
                    {exercise.sets} sets · {exercise.reps} reps
                </div>
            </div>

            {/* Scrollable set list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1rem' }}>
                <p
                    style={{
                        fontFamily: MONO,
                        fontSize: '0.6875rem',
                        color: DIM,
                        padding: '0.75rem 0 0.375rem',
                        lineHeight: 1.6,
                    }}>
                    {exercise.load} · {exercise.note}
                </p>
                {Array.from({ length: maxSets }, (_, i) => {
                    const key = logKey(week, type, exIdx, i);
                    const entry = logs[key];
                    const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                    const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                    return (
                        <SetLogger
                            key={`${week}-${i}`}
                            setIdx={i}
                            week={week}
                            type={type}
                            entry={entry}
                            previousEntry={prevEntry?.saved ? prevEntry : undefined}
                            isPR={isPR}
                            unit={unit}
                            onSave={(e) => onSave(key, e)}
                            onDelete={() => onDelete(key)}
                        />
                    );
                })}
            </div>

            {/* Rest timer — pinned at bottom */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0.75rem 1.5rem', flexShrink: 0 }}>
                <RestTimer trigger={timerTrigger} />
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
bun run test:run -- ExerciseDetailPane
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/ExerciseDetailPane.tsx src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx
git commit -m "feat(pulse): add ExerciseDetailPane for desktop right pane"
```

---

## Task 4: `LogViewDesktop` — two-pane log view

**Files:**
- Create: `src/components/weight-tracker/views/LogViewDesktop.tsx`
- Create: `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx`

- [ ] **Step 1: Read `src/lib/weight-tracker/data.ts` and note the first three push exercise names**

Run:
```powershell
bun run -e "const {WORKOUTS}=require('./src/lib/weight-tracker/data'); WORKOUTS.push.exercises.slice(0,3).forEach((e,i)=>console.log(i,e.name))"
```

Record the names — you'll need them in the tests below. The tests use `WORKOUTS.push.exercises[N].name` directly so this step is just for your awareness.

- [ ] **Step 2: Write the failing tests**

Create `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import LogViewDesktop from '../views/LogViewDesktop';

beforeEach(() => localStorage.clear());

const defaultProps = {
    activeWeek: 1,
    onSelectWeek: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    logs: {},
    unit: 'kg' as const,
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
};

describe('LogViewDesktop', () => {
    it('auto-opens the first exercise detail on mount', () => {
        render(<LogViewDesktop {...defaultProps} />);
        const firstName = WORKOUTS.push.exercises[0].name;
        // name appears in both list pane and detail header
        expect(screen.getAllByText(firstName).length).toBeGreaterThanOrEqual(1);
    });

    it('switches the detail pane when a different exercise is clicked', async () => {
        render(<LogViewDesktop {...defaultProps} />);
        const secondName = WORKOUTS.push.exercises[1].name;
        const btn = screen.getByRole('button', { name: new RegExp(secondName, 'i') });
        await userEvent.click(btn);
        expect(screen.getByText(secondName)).toBeInTheDocument();
    });

    it('persists selected exercise index to localStorage', async () => {
        render(<LogViewDesktop {...defaultProps} />);
        const secondName = WORKOUTS.push.exercises[1].name;
        await userEvent.click(screen.getByRole('button', { name: new RegExp(secondName, 'i') }));
        expect(localStorage.getItem('wt_last_ex')).toBe('1');
    });

    it('restores selected exercise from localStorage on mount', () => {
        localStorage.setItem('wt_last_ex', '2');
        render(<LogViewDesktop {...defaultProps} />);
        const thirdName = WORKOUTS.push.exercises[2].name;
        expect(screen.getByText(thirdName)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Run to confirm failure**

```powershell
bun run test:run -- LogViewDesktop
```

Expected: FAIL.

- [ ] **Step 4: Implement `LogViewDesktop`**

Create `src/components/weight-tracker/views/LogViewDesktop.tsx`:

```tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import { getPhase, getRIR, weekHasData, computePRMap } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER, DIM } from '@/lib/weight-tracker/theme';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseListItem from '../ExerciseListItem';
import ExerciseDetailPane from '../ExerciseDetailPane';
import type { Logs, LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

const LAST_EX_KEY = 'wt_last_ex';

interface Props {
    activeWeek: number;
    onSelectWeek: (w: number) => void;
    activeTab: WorkoutType;
    setActiveTab: (t: WorkoutType) => void;
    logs: Logs;
    unit: Unit;
    updateLog: (key: string, entry: LogEntry) => void;
    deleteLog: (key: string) => void;
    timerTrigger: number;
}

export default function LogViewDesktop({
    activeWeek,
    onSelectWeek,
    activeTab,
    setActiveTab,
    logs,
    unit,
    updateLog,
    deleteLog,
    timerTrigger,
}: Props) {
    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    const [activeExIdx, setActiveExIdx] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(localStorage.getItem(LAST_EX_KEY));
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        return stored >= 0 && stored <= maxIdx ? stored : 0;
    });

    // Clamp when tab changes (tabs have different exercise counts)
    useEffect(() => {
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        setActiveExIdx((prev) => Math.min(prev, maxIdx));
    }, [activeTab]);

    function handleSelectExercise(idx: number) {
        setActiveExIdx(idx);
        localStorage.setItem(LAST_EX_KEY, String(idx));
    }

    const activeExercise = workout.exercises[activeExIdx];

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left pane */}
            <div
                style={{
                    width: 300,
                    flexShrink: 0,
                    borderRight: `1px solid ${BORDER}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} logs={logs} week={activeWeek} />

                {/* Week strip */}
                <div
                    style={{
                        display: 'flex',
                        padding: '0 0.5rem',
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        borderBottom: `1px solid ${BORDER}`,
                    }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                        const active = w === activeWeek;
                        return (
                            <button
                                key={w}
                                onClick={() => onSelectWeek(w)}
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.6875rem',
                                    fontWeight: active ? 700 : 400,
                                    minWidth: '2rem',
                                    padding: '0.4rem 0 0.3rem',
                                    textAlign: 'center',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
                                    color: active ? ACCENT : DIM,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    marginBottom: '-1px',
                                }}>
                                {w}
                                <span
                                    style={{
                                        display: 'block',
                                        width: 3,
                                        height: 3,
                                        borderRadius: '50%',
                                        background: weekHasData(w, logs) ? ACCENT : 'transparent',
                                        margin: '2px auto 0',
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* Context bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.875rem',
                        borderBottom: `1px solid ${BORDER}`,
                        flexShrink: 0,
                    }}>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.5rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: DIM,
                        }}>
                        {phase.label}
                    </span>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            color: ACCENT,
                            background: 'rgba(255,108,47,0.08)',
                            border: '1px solid rgba(255,108,47,0.15)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: 3,
                        }}>
                        {rir} RIR
                    </span>
                    <span style={{ fontSize: '0.625rem', color: DIM, marginLeft: 'auto' }}>
                        {workout.description}
                    </span>
                </div>

                {/* Exercise list */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {workout.exercises.map((exercise, i) => (
                        <ExerciseListItem
                            key={`${activeTab}-${i}`}
                            exercise={exercise}
                            exIdx={i}
                            week={activeWeek}
                            type={activeTab}
                            logs={logs}
                            isActive={activeExIdx === i}
                            onClick={() => handleSelectExercise(i)}
                        />
                    ))}
                </div>
            </div>

            {/* Right pane */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeExercise && (
                    <ExerciseDetailPane
                        exercise={activeExercise}
                        exIdx={activeExIdx}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={updateLog}
                        onDelete={deleteLog}
                        timerTrigger={timerTrigger}
                    />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```powershell
bun run test:run -- LogViewDesktop
```

Expected: 4 passing.

- [ ] **Step 6: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```powershell
git add src/components/weight-tracker/views/LogViewDesktop.tsx src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx
git commit -m "feat(pulse): add LogViewDesktop two-pane layout"
```

---

## Task 5: `BottomNav` — mobile bottom tab bar

**Files:**
- Create: `src/components/weight-tracker/BottomNav.tsx`
- Create: `src/components/weight-tracker/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/weight-tracker/__tests__/BottomNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from '../BottomNav';

describe('BottomNav', () => {
    it('renders all four nav labels', () => {
        render(<BottomNav view="log" onNavigate={vi.fn()} />);
        expect(screen.getByText('Log')).toBeInTheDocument();
        expect(screen.getByText('Program')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('calls onNavigate with the correct view when a tab is clicked', async () => {
        const onNavigate = vi.fn();
        render(<BottomNav view="log" onNavigate={onNavigate} />);
        await userEvent.click(screen.getByText('History'));
        expect(onNavigate).toHaveBeenCalledWith('history');
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<BottomNav view="profile" onNavigate={vi.fn()} />);
        expect(screen.getByRole('button', { name: /profile/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /log/i })).not.toHaveAttribute('aria-current', 'page');
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- BottomNav
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `BottomNav`**

Create `src/components/weight-tracker/BottomNav.tsx`:

```tsx
import { MONO, ACCENT } from '@/lib/weight-tracker/theme';
import type { View } from '@/lib/weight-tracker/types';

const ITEMS: { id: View; label: string; icon: string }[] = [
    { id: 'log',     label: 'Log',     icon: '⊞' },
    { id: 'program', label: 'Program', icon: '◈' },
    { id: 'history', label: 'History', icon: '◷' },
    { id: 'profile', label: 'Profile', icon: '◉' },
];

interface Props {
    view: View;
    onNavigate: (v: View) => void;
}

export default function BottomNav({ view, onNavigate }: Props) {
    return (
        <nav
            aria-label="Main navigation"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(10,10,10,0.96)',
                backdropFilter: 'blur(12px)',
                borderTop: '1px solid #222',
                display: 'flex',
                height: 64,
                zIndex: 30,
                paddingBottom: 'env(safe-area-inset-bottom, 0)',
            }}>
            {ITEMS.map(({ id, label, icon }) => {
                const active = view === id;
                return (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem 0',
                        }}>
                        <span style={{ fontSize: '1rem', lineHeight: 1, color: active ? ACCENT : '#555' }}>
                            {icon}
                        </span>
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.5625rem',
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: active ? ACCENT : '#3a3a3a',
                            }}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
bun run test:run -- BottomNav
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/BottomNav.tsx src/components/weight-tracker/__tests__/BottomNav.test.tsx
git commit -m "feat(pulse): add BottomNav mobile bottom tab bar"
```

---

## Task 6: `WorkoutTabs` — per-tab exercise-completion summary

**Files:**
- Modify: `src/components/weight-tracker/WorkoutTabs.tsx`
- Modify: `src/components/weight-tracker/__tests__/WorkoutTabs.test.tsx`
- Modify: `src/components/weight-tracker/views/LogView.tsx`

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/components/weight-tracker/__tests__/WorkoutTabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutTabs from '../WorkoutTabs';

const base = { activeTab: 'push' as const, onSelect: vi.fn(), logs: {}, week: 1 };

describe('WorkoutTabs', () => {
    it('renders Push, Pull and Legs tabs', () => {
        render(<WorkoutTabs {...base} />);
        expect(screen.getByRole('tab', { name: /push/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /pull/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /legs/i })).toBeInTheDocument();
    });

    it('marks the active tab with aria-selected="true" and others with false', () => {
        render(<WorkoutTabs {...base} activeTab="pull" />);
        expect(screen.getByRole('tab', { name: /pull/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /push/i })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: /legs/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onSelect when an inactive tab is clicked', async () => {
        const onSelect = vi.fn();
        render(<WorkoutTabs {...base} onSelect={onSelect} />);
        await userEvent.click(screen.getByRole('tab', { name: /legs/i }));
        expect(onSelect).toHaveBeenCalledWith('legs');
    });

    it('calls onSelect with active tab type when active tab is clicked', async () => {
        const onSelect = vi.fn();
        render(<WorkoutTabs {...base} onSelect={onSelect} />);
        await userEvent.click(screen.getByRole('tab', { name: /push/i }));
        expect(onSelect).toHaveBeenCalledWith('push');
    });

    it('navigates to the next tab on ArrowRight', async () => {
        const onSelect = vi.fn();
        render(<WorkoutTabs {...base} onSelect={onSelect} />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(onSelect).toHaveBeenCalledWith('pull');
    });

    it('wraps around to the last tab on ArrowLeft from the first', async () => {
        const onSelect = vi.fn();
        render(<WorkoutTabs {...base} onSelect={onSelect} />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(onSelect).toHaveBeenCalledWith('legs');
    });

    it('shows "0 / N" summary when no sets are logged', () => {
        render(<WorkoutTabs {...base} />);
        // Push tab should show "0 / <total push exercises>"
        const { WORKOUTS } = require('@/lib/weight-tracker/data');
        const total = WORKOUTS.push.exercises.length;
        expect(screen.getByText(`0 / ${total}`)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm the new summary test fails**

```powershell
bun run test:run -- WorkoutTabs
```

Expected: 6 pass (existing), 1 fail (summary test).

- [ ] **Step 3: Update `WorkoutTabs.tsx`**

Replace the full contents of `src/components/weight-tracker/WorkoutTabs.tsx`:

```tsx
'use client';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import { logKey, parseMaxSets } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER } from '@/lib/weight-tracker/theme';
import type { WorkoutType, Logs } from '@/lib/weight-tracker/types';

interface Props {
    activeTab: WorkoutType;
    onSelect: (t: WorkoutType) => void;
    logs: Logs;
    week: number;
}

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

function countDone(type: WorkoutType, week: number, logs: Logs): number {
    return WORKOUTS[type].exercises.filter((ex, exIdx) => {
        const maxSets = parseMaxSets(ex.sets);
        return Array.from({ length: maxSets }, (_, s) => logKey(week, type, exIdx, s)).every(
            (k) => logs[k]?.saved,
        );
    }).length;
}

export default function WorkoutTabs({ activeTab, onSelect, logs, week }: Props) {
    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSelect(TABS[(idx + 1) % TABS.length].type);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSelect(TABS[(idx - 1 + TABS.length) % TABS.length].type);
        }
    }

    return (
        <div role="tablist" style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            {TABS.map(({ type, label }, idx) => {
                const active = activeTab === type;
                const done = countDone(type, week, logs);
                const total = WORKOUTS[type].exercises.length;
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '0.625rem 0 0.5rem',
                            gap: '0.2rem',
                            background: 'none',
                            border: 'none',
                            borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
                            marginBottom: '-1px',
                            cursor: 'pointer',
                        }}>
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.6875rem',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: active ? '#fff' : '#555',
                            }}>
                            {label}
                        </span>
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.5625rem',
                                letterSpacing: '0.04em',
                                color: active ? '#555' : '#3a3a3a',
                            }}>
                            {done} / {total}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Update `LogView.tsx` to pass `logs` and `week` to `WorkoutTabs`**

Open `src/components/weight-tracker/views/LogView.tsx`. Find the `<WorkoutTabs>` usage (line 48) and update it:

```tsx
<WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} logs={logs} week={activeWeek} />
```

- [ ] **Step 5: Run all tests**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/weight-tracker/WorkoutTabs.tsx src/components/weight-tracker/__tests__/WorkoutTabs.test.tsx src/components/weight-tracker/views/LogView.tsx
git commit -m "feat(pulse): add per-tab exercise-completion summary to WorkoutTabs"
```

---

## Task 7: `ExerciseCard` — dot indicators + progress bar

**Files:**
- Modify: `src/components/weight-tracker/ExerciseCard.tsx`
- Modify: `src/components/weight-tracker/__tests__/ExerciseCard.test.tsx`

- [ ] **Step 1: Update the existing test to remove the `█░` char assertion and add a dot-count check**

Open `src/components/weight-tracker/__tests__/ExerciseCard.test.tsx`. The existing tests check `aria-label="All sets done"` which remains unchanged. No test currently asserts `█` or `░` chars. Confirm this with:

```powershell
bun run test:run -- ExerciseCard
```

Expected: all 5 pass. If any fail, investigate before proceeding.

- [ ] **Step 2: Replace `ExerciseCard.tsx`**

Replace the full contents of `src/components/weight-tracker/ExerciseCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM } from '@/lib/weight-tracker/theme';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

const GREEN = '#22c55e';
const MUTED = '#3a3a3a';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}

export default function ExerciseCard({ exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete }: Props) {
    const [open, setOpen] = useState(false);
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div
            style={{
                background: SURFACE,
                border: `1px solid ${complete ? 'rgba(34,197,94,0.2)' : BORDER}`,
                borderRadius: '8px',
                overflow: 'hidden',
            }}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textAlign: 'left',
                }}>
                {/* Exercise number */}
                <span
                    style={{
                        fontFamily: MONO,
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: complete ? 'rgba(34,197,94,0.4)' : MUTED,
                        width: '1.75rem',
                        flexShrink: 0,
                        letterSpacing: '-0.04em',
                        lineHeight: 1,
                    }}>
                    {String(exIdx + 1).padStart(2, '0')}
                </span>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                        {exercise.name}
                    </div>
                    <div
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            letterSpacing: '0.06em',
                            color: DIM,
                            marginTop: '0.25rem',
                            textTransform: 'uppercase',
                        }}>
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>

                {/* Progress: dot indicators */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: DIM }}>
                        <span style={{ color: '#fff' }}>{savedCount}</span>/{maxSets}
                    </span>
                    <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: maxSets }, (_, i) => (
                            <span
                                key={i}
                                style={{
                                    display: 'block',
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: i < savedCount ? (complete ? GREEN : ACCENT) : MUTED,
                                    transition: 'background 0.2s',
                                }}
                            />
                        ))}
                    </div>
                </div>

                {complete && (
                    <span
                        aria-label="All sets done"
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            color: GREEN,
                            marginLeft: '0.25rem',
                            flexShrink: 0,
                        }}>
                        ✓
                    </span>
                )}
            </button>

            {/* 2 px progress bar — shown when open */}
            {open && (
                <div style={{ height: 2, background: MUTED, overflow: 'hidden' }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${(savedCount / maxSets) * 100}%`,
                            background: ACCENT,
                            transition: 'width 0.3s',
                        }}
                    />
                </div>
            )}

            {open && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0.25rem 1rem 0.875rem' }}>
                    <p
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.6875rem',
                            color: DIM,
                            padding: '0.625rem 0 0.375rem',
                            lineHeight: 1.6,
                        }}>
                        {exercise.load} · {exercise.note}
                    </p>
                    {Array.from({ length: maxSets }, (_, i) => {
                        const entry = logs[logKey(week, type, exIdx, i)];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                        return (
                            <SetLogger
                                key={`${week}-${i}`}
                                setIdx={i}
                                week={week}
                                type={type}
                                entry={entry}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                isPR={isPR}
                                unit={unit}
                                onSave={(e) => onSave(logKey(week, type, exIdx, i), e)}
                                onDelete={() => onDelete(logKey(week, type, exIdx, i))}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Run tests to confirm they all still pass**

```powershell
bun run test:run -- ExerciseCard
```

Expected: 5 passing.

- [ ] **Step 4: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/ExerciseCard.tsx
git commit -m "feat(pulse): dot progress indicators and progress bar in ExerciseCard"
```

---

## Task 8: `SetLogger` — taller inputs, styled Save, green saved-row

**Files:**
- Modify: `src/components/weight-tracker/SetLogger.tsx`

No new tests — this is a visual-only change. Existing tests check behaviour, not styles.

- [ ] **Step 1: Run existing SetLogger tests to confirm baseline**

```powershell
bun run test:run -- SetLogger
```

Expected: all passing.

- [ ] **Step 2: Update `SetLogger.tsx`**

Make three targeted changes to `src/components/weight-tracker/SetLogger.tsx`:

**a) Replace `inputStyle` constant** (lines 19–30):

```tsx
const inputStyle = {
    width: '3.75rem',
    height: '40px',
    padding: '0 0.5rem',
    background: '#1a1a1a',
    border: '1px solid #222',
    borderRadius: '6px',
    color: '#fff',
    fontFamily: MONO,
    fontSize: '0.9375rem',
    fontWeight: 700,
    textAlign: 'center' as const,
    outline: 'none',
};
```

**b) Replace the Save/Update button style** — find the `<button onClick={handleSave}` block and update its `style` prop:

```tsx
style={{
    height: '40px',
    padding: '0 1rem',
    background: ACCENT,
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontFamily: MONO,
    fontSize: '0.625rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.1s',
}}
```

**c) Update the outer `<div>` of the saved state** — change the `opacity` line so saved rows show at full opacity and add a green tint background. Find the outermost `<div style={{ display: 'flex', alignItems: 'center', ...` and replace its `style` prop:

```tsx
style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4375rem 0',
    borderBottom: '1px solid #111',
    background: saved && !editing ? '#0e1510' : 'transparent',
}}
```

(Remove the `opacity: saved && !editing ? 0.55 : 1` line entirely.)

- [ ] **Step 3: Run SetLogger tests to confirm they still pass**

```powershell
bun run test:run -- SetLogger
```

Expected: all passing.

- [ ] **Step 4: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/SetLogger.tsx
git commit -m "feat(pulse): taller inputs, solid Save button, green saved-row tint in SetLogger"
```

---

## Task 9: `DesktopLayout` + wire `TrackerClient`

**Files:**
- Create: `src/components/weight-tracker/DesktopLayout.tsx`
- Create: `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx`
- Modify: `src/components/weight-tracker/TrackerClient.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing `DesktopLayout` tests**

Create `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';

vi.mock('@/app/pulse/actions', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn().mockResolvedValue({ id: '1', logged_at: '2026-05-25', weight_kg: 80 }),
    deleteBodyWeight: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
    logs: {},
    unit: 'kg' as const,
    displayName: 'Test User',
    bodyweightLogs: [],
    email: 'test@example.com',
    activeWeek: 3,
    activeTab: 'push' as const,
    view: 'log' as const,
    streak: 2,
    saveError: null,
    timerTrigger: 0,
    onSelectWeek: vi.fn(),
    setActiveTab: vi.fn(),
    onNavigate: vi.fn(),
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    onUnitChange: vi.fn(),
    onDisplayNameChange: vi.fn(),
    onBodyweightLogsChange: vi.fn(),
    onExport: vi.fn(),
};

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('PULSE')).toBeInTheDocument();
    });

    it('renders all nav items in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^program$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^history$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
    });

    it('calls onNavigate when a nav item is clicked', async () => {
        const onNavigate = vi.fn();
        render(<DesktopLayout {...defaultProps} onNavigate={onNavigate} />);
        await userEvent.click(screen.getByRole('button', { name: /^history$/i }));
        expect(onNavigate).toHaveBeenCalledWith('history');
    });

    it('shows the active week in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} activeWeek={3} />);
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('shows streak when streak > 0', () => {
        render(<DesktopLayout {...defaultProps} streak={4} />);
        expect(screen.getByText(/4wk streak/i)).toBeInTheDocument();
    });

    it('renders the save error bar when saveError is set', () => {
        render(<DesktopLayout {...defaultProps} saveError="Failed to save. Retrying…" />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls onExport when Export is clicked', async () => {
        const onExport = vi.fn();
        render(<DesktopLayout {...defaultProps} onExport={onExport} />);
        await userEvent.click(screen.getByRole('button', { name: /export/i }));
        expect(onExport).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- DesktopLayout
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `DesktopLayout.tsx`**

Create `src/components/weight-tracker/DesktopLayout.tsx`:

```tsx
import { logout } from '@/app/pulse/actions';
import { MONO, ACCENT, BG, BORDER, DIM } from '@/lib/weight-tracker/theme';
import LogViewDesktop from './views/LogViewDesktop';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import type { Logs, LogEntry, WorkoutType, Unit, BodyweightEntry, View } from '@/lib/weight-tracker/types';

const NAV: { id: View; label: string }[] = [
    { id: 'log',     label: 'Log'     },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

interface Props {
    logs: Logs;
    unit: Unit;
    displayName: string | null;
    bodyweightLogs: BodyweightEntry[];
    email: string;
    activeWeek: number;
    activeTab: WorkoutType;
    view: View;
    streak: number;
    saveError: string | null;
    timerTrigger: number;
    onSelectWeek: (w: number) => void;
    setActiveTab: (t: WorkoutType) => void;
    onNavigate: (v: View) => void;
    updateLog: (key: string, entry: LogEntry) => void;
    deleteLog: (key: string) => void;
    onUnitChange: (u: Unit) => void;
    onDisplayNameChange: (name: string | null) => void;
    onBodyweightLogsChange: (logs: BodyweightEntry[]) => void;
    onExport: () => void;
}

export default function DesktopLayout({
    logs, unit, displayName, bodyweightLogs, email,
    activeWeek, activeTab, view, streak, saveError, timerTrigger,
    onSelectWeek, setActiveTab, onNavigate,
    updateLog, deleteLog,
    onUnitChange, onDisplayNameChange, onBodyweightLogsChange, onExport,
}: Props) {
    const navBtnStyle = (active: boolean): React.CSSProperties => ({
        fontFamily: MONO,
        fontSize: '0.8125rem',
        fontWeight: active ? 700 : 400,
        color: active ? '#fff' : DIM,
        background: active ? '#1a1a1a' : 'none',
        border: 'none',
        borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
        textAlign: 'left',
        padding: '0.5rem 0.75rem',
        borderRadius: '0 4px 4px 0',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        width: '100%',
        display: 'block',
    });

    const utilBtnStyle: React.CSSProperties = {
        fontFamily: MONO,
        fontSize: '0.75rem',
        color: '#444',
        background: 'none',
        border: 'none',
        borderLeft: '2px solid transparent',
        textAlign: 'left',
        padding: '0.4375rem 0.75rem',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        width: '100%',
        display: 'block',
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG, color: '#d4d4d4' }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: 192,
                    flexShrink: 0,
                    borderRight: `1px solid ${BORDER}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                {/* Brand */}
                <div style={{ padding: '1.375rem 1.125rem 1.25rem', borderBottom: `1px solid ${BORDER}` }}>
                    <div
                        style={{
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            letterSpacing: '0.1em',
                            color: '#fff',
                            textTransform: 'uppercase',
                        }}>
                        PULSE<span style={{ color: ACCENT }}>.</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '0.75rem', color: DIM, marginTop: '0.75rem' }}>
                        WK <strong style={{ color: ACCENT, fontWeight: 700 }}>{String(activeWeek).padStart(2, '0')}</strong> / 12
                    </div>
                    {streak > 0 && (
                        <div style={{ fontFamily: MONO, fontSize: '0.5625rem', color: '#444', marginTop: '0.25rem', letterSpacing: '0.04em' }}>
                            {streak}WK streak
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav
                    aria-label="Main navigation"
                    style={{ flex: 1, padding: '0.75rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    {NAV.map(({ id, label }) => (
                        <button key={id} onClick={() => onNavigate(id)} style={navBtnStyle(view === id)}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Utilities */}
                <div style={{ padding: '0.625rem 0.625rem', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <button onClick={onExport} style={utilBtnStyle}>Export</button>
                    <form action={logout} style={{ display: 'block' }}>
                        <button type="submit" style={utilBtnStyle}>Sign out</button>
                    </form>
                </div>
            </aside>

            {/* Content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {saveError && (
                    <div
                        role="alert"
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#f43f5e18',
                            borderBottom: '1px solid #f43f5e33',
                            color: '#f43f5e',
                            fontFamily: MONO,
                            fontSize: '0.6875rem',
                            letterSpacing: '0.04em',
                            textAlign: 'center',
                            flexShrink: 0,
                        }}>
                        {saveError}
                    </div>
                )}

                <div
                    style={{
                        flex: 1,
                        overflow: view === 'log' ? 'hidden' : 'auto',
                        display: view === 'log' ? 'flex' : 'block',
                        flexDirection: 'column',
                    }}>
                    {view === 'log' && (
                        <LogViewDesktop
                            activeWeek={activeWeek}
                            onSelectWeek={onSelectWeek}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            logs={logs}
                            unit={unit}
                            updateLog={updateLog}
                            deleteLog={deleteLog}
                            timerTrigger={timerTrigger}
                        />
                    )}
                    {view === 'program' && (
                        <ProgramView
                            activeWeek={activeWeek}
                            onSelectWeek={(w) => { onSelectWeek(w); onNavigate('log'); }}
                            logs={logs}
                        />
                    )}
                    {view === 'history' && <HistoryView logs={logs} unit={unit} />}
                    {view === 'profile' && (
                        <ProfileView
                            email={email}
                            displayName={displayName}
                            unit={unit}
                            bodyweightLogs={bodyweightLogs}
                            onUnitChange={onUnitChange}
                            onDisplayNameChange={onDisplayNameChange}
                            onBodyweightLogsChange={onBodyweightLogsChange}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
```

- [ ] **Step 4: Run `DesktopLayout` tests**

```powershell
bun run test:run -- DesktopLayout
```

Expected: 7 passing.

- [ ] **Step 5: Update `TrackerClient.tsx`**

Read `src/components/weight-tracker/TrackerClient.tsx` in full, then apply these changes:

**a) Remove the local `View` type definition** (line 12) — it is now imported from types.

**b) Replace the import line** for types:

```tsx
import type { Logs, LogEntry, WorkoutType, Unit, Profile, BodyweightEntry, View } from '@/lib/weight-tracker/types';
```

**c) Add two new imports** after the existing import block:

```tsx
import { useMediaQuery } from '@/lib/weight-tracker/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import BottomNav from './BottomNav';
```

**d) Remove these state variables** (no longer needed without hamburger):
- `const [menuOpen, setMenuOpen] = useState(false);`
- `const menuRef = useRef<HTMLDivElement>(null);`

Remove the `useRef` import if `menuRef` was the only ref (check: `retryTimeoutRef` still needs it, so keep the import).

**e) Remove the `useEffect` that closes the mobile menu on outside tap** (the effect that depends on `menuOpen`).

**f) Simplify the `navigate` function**:

```tsx
function navigate(v: View) {
    setView(v);
}
```

**g) Remove `hamburgerLineStyle`.**

**h) Add the media query hook** after `const streak = ...`:

```tsx
const isDesktop = useMediaQuery('(min-width: 768px)');
```

**i) Replace the full `return` statement** with:

```tsx
    if (isDesktop) {
        return (
            <DesktopLayout
                logs={logs}
                unit={unit}
                displayName={displayName}
                bodyweightLogs={bodyweightLogs}
                email={email}
                activeWeek={activeWeek}
                activeTab={activeTab}
                view={view}
                streak={streak}
                saveError={saveError}
                timerTrigger={timerTrigger}
                onSelectWeek={setActiveWeek}
                setActiveTab={setActiveTab}
                onNavigate={navigate}
                updateLog={updateLog}
                deleteLog={deleteLog}
                onUnitChange={setUnit}
                onDisplayNameChange={setDisplayName}
                onBodyweightLogsChange={setBodyweightLogs}
                onExport={handleExport}
            />
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4', paddingBottom: 68 }}>
            {/* Topbar */}
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: BG,
                    borderBottom: `1px solid ${BORDER}`,
                    padding: '0 1rem',
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}>
                <span
                    style={{
                        fontFamily: MONO,
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        letterSpacing: '0.1em',
                        color: '#fff',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                    }}>
                    PULSE<span style={{ color: ACCENT }}>.</span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, color: ACCENT, background: 'rgba(255,108,47,0.1)', border: '1px solid rgba(255,108,47,0.2)', padding: '0.25rem 0.625rem', borderRadius: 100, letterSpacing: '0.04em' }}>
                    WK {String(activeWeek).padStart(2, '0')}
                </span>
                {streak > 0 && (
                    <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: DIM, letterSpacing: '0.04em' }}>
                        {streak}WK
                    </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={handleExport}
                        aria-label="Export workout logs as JSON"
                        style={{ fontFamily: MONO, fontSize: '0.75rem', color: '#444', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}>
                        Export
                    </button>
                    <form action={logout} style={{ display: 'inline' }}>
                        <button
                            type="submit"
                            aria-label="Sign out of Pulse"
                            style={{ fontFamily: MONO, fontSize: '0.75rem', color: '#444', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}>
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {/* Save error */}
            {saveError && (
                <div
                    role="alert"
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#f43f5e18',
                        borderBottom: '1px solid #f43f5e33',
                        color: '#f43f5e',
                        fontFamily: MONO,
                        fontSize: '0.6875rem',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                    }}>
                    {saveError}
                </div>
            )}

            {/* Views */}
            {view === 'log' && (
                <LogView
                    activeWeek={activeWeek}
                    onSelectWeek={setActiveWeek}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    logs={logs}
                    unit={unit}
                    updateLog={updateLog}
                    deleteLog={deleteLog}
                    timerTrigger={timerTrigger}
                />
            )}
            {view === 'program' && (
                <ProgramView
                    activeWeek={activeWeek}
                    onSelectWeek={(w) => { setActiveWeek(w); setView('log'); }}
                    logs={logs}
                />
            )}
            {view === 'history' && <HistoryView logs={logs} unit={unit} />}
            {view === 'profile' && (
                <ProfileView
                    email={email}
                    displayName={displayName}
                    unit={unit}
                    bodyweightLogs={bodyweightLogs}
                    onUnitChange={setUnit}
                    onDisplayNameChange={setDisplayName}
                    onBodyweightLogsChange={setBodyweightLogs}
                />
            )}

            <BottomNav view={view} onNavigate={navigate} />
        </div>
    );
```

**j) Update `globals.css`** — open `src/app/globals.css` and remove the `.pulse-desktop-nav` and `.pulse-hamburger` rules entirely (they are replaced by `BottomNav` + the `isDesktop` conditional in `TrackerClient`). The file should end up as:

```css
@import 'tailwindcss';

@theme {
    --color-primary: #222831;
    --color-secondary: #00adb5;
    --color-gray-dark: #010101;
    --color-gray: #eeeeee;

    --container-15: 15;

    --text-xxs: 10px;
}

:focus-visible {
    outline: 2px solid #00adb5;
    outline-offset: 2px;
}
```

- [ ] **Step 6: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 7: Run typecheck**

```powershell
bun run typecheck
```

Fix any TypeScript errors before committing.

- [ ] **Step 8: Commit**

```powershell
git add src/components/weight-tracker/DesktopLayout.tsx src/components/weight-tracker/__tests__/DesktopLayout.test.tsx src/components/weight-tracker/TrackerClient.tsx src/app/globals.css
git commit -m "feat(pulse): add DesktopLayout sidebar, wire useMediaQuery gate into TrackerClient, remove hamburger"
```

---

## Task 10: Desktop History grid + Profile split

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/weight-tracker/views/HistoryView.tsx`
- Modify: `src/components/weight-tracker/views/ProfileView.tsx`

- [ ] **Step 1: Add CSS classes to `globals.css`**

Append to `src/app/globals.css`:

```css
@media (min-width: 768px) {
    .pulse-history-grid {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr);
        max-width: 1100px !important;
        align-items: start;
    }

    .pulse-profile-layout {
        flex-direction: row !important;
        align-items: flex-start !important;
        max-width: 860px !important;
        padding: 1.5rem 1.5rem 3rem !important;
        gap: 2.5rem !important;
    }

    .pulse-profile-main {
        width: 280px;
        flex-shrink: 0;
    }

    .pulse-profile-side {
        flex: 1;
        min-width: 0;
    }
}
```

- [ ] **Step 2: Add `pulse-history-grid` class to `HistoryView.tsx`**

Open `src/components/weight-tracker/views/HistoryView.tsx`. Find the outermost `<div>` in the non-empty return — the one with `style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}`. Add `className="pulse-history-grid"` to it:

```tsx
<div
    className="pulse-history-grid"
    style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
```

- [ ] **Step 3: Restructure `ProfileView.tsx` for side-by-side layout**

Open `src/components/weight-tracker/views/ProfileView.tsx`. Find the outermost wrapper `<div>` in the return statement — the one with `style={{ padding: '1.25rem 1rem 3rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}`. Add `className="pulse-profile-layout"` to it:

```tsx
<div
    className="pulse-profile-layout"
    style={{ padding: '1.25rem 1rem 3rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
```

Then wrap the **Identity section** and **Unit toggle section** together in a `<div className="pulse-profile-main">` (with `style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}`), and wrap the **Body weight section** in a `<div className="pulse-profile-side">`. The existing content inside each section is unchanged — only the wrapping divs are added.

The resulting structure:

```tsx
<div className="pulse-profile-layout" style={...}>
    <div className="pulse-profile-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Identity section — unchanged */}
        {/* Unit toggle section — unchanged */}
    </div>
    <div className="pulse-profile-side">
        {/* Body weight section — unchanged */}
    </div>
</div>
```

- [ ] **Step 4: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing (ProfileView tests pass since content is unchanged, only wrapped differently).

- [ ] **Step 5: Commit**

```powershell
git add src/app/globals.css src/components/weight-tracker/views/HistoryView.tsx src/components/weight-tracker/views/ProfileView.tsx
git commit -m "feat(pulse): 2-column history grid and side-by-side profile layout on desktop"
```

---

## Task 11: Final polish — typecheck, lint, format

- [ ] **Step 1: Run typecheck**

```powershell
bun run typecheck
```

Fix any TypeScript errors.

- [ ] **Step 2: Run lint**

```powershell
bun run lint
```

Fix any ESLint warnings or errors.

- [ ] **Step 3: Run formatter**

```powershell
bun run format
```

- [ ] **Step 4: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 5: Commit any formatting changes**

```powershell
git add -u
git commit -m "chore(pulse): typecheck, lint, format redesign branch"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task | Covered? |
|---|---|---|
| Bottom tab bar (mobile) | T5, T9 | ✅ |
| Topbar simplified (logo, week, streak) | T9 | ✅ |
| Export + sign-out accessible on mobile | T9 (topbar util links) | ✅ |
| Dot progress indicators in `ExerciseCard` | T7 | ✅ |
| 2 px progress bar under open card header | T7 | ✅ |
| 40 px inputs in `SetLogger` | T8 | ✅ |
| Solid orange Save button | T8 | ✅ |
| Green tint on saved set rows | T8 | ✅ |
| Per-tab exercise-completion summary in `WorkoutTabs` | T6 | ✅ |
| `useMediaQuery(768px)` breakpoint | T1, T9 | ✅ |
| Desktop sidebar (192 px) with brand, week, streak, nav, export, sign-out | T9 | ✅ |
| Two-pane Log view: list left (300 px), detail right | T4 | ✅ |
| Auto-open last-used exercise (localStorage) | T4 | ✅ |
| Rest timer pinned in right pane | T3 | ✅ |
| Mobile layout completely unchanged below 768 px | T9 (conditional render) | ✅ |
| History 2-column grid on desktop | T10 | ✅ |
| Profile side-by-side on desktop | T10 | ✅ |
| `View` type exported from `types.ts` | T1 | ✅ |

**Type consistency check:**
- `View` defined in `types.ts` (T1) → imported in `BottomNav` (T5), `DesktopLayout` (T9), `TrackerClient` (T9) — consistent.
- `WorkoutTabs` new props `logs: Logs, week: number` added (T6) → callers `LogView` (T6) and `LogViewDesktop` (T4) both pass them — consistent.
- `ExerciseDetailPane.onSave: (key: string, entry: LogEntry) => void` (T3) matches `updateLog` signature in `TrackerClient` and `DesktopLayout` — consistent.
- `BottomNav.onNavigate: (v: View) => void` (T5) matches `navigate` function in `TrackerClient` — consistent.

**No placeholders found.**
