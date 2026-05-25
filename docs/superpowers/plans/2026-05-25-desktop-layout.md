# Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-column mobile-stretched layout with a proper desktop shell (≥1024px) featuring a persistent sidebar, two-pane Log view, History grid, and Profile split — while leaving the mobile experience completely unchanged.

**Architecture:** A `useMediaQuery` hook gates rendering: mobile renders the existing `TrackerClient` JSX unchanged; desktop renders a new `DesktopLayout` component that receives all state as props and renders a sidebar + content area. The two-pane Log view is a new `LogViewDesktop` component; `ExerciseListItem` and `ExerciseDetailPane` are extracted sub-components used only on desktop. History and Profile gain responsive CSS classes in `globals.css`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, inline styles throughout, JetBrains Mono (`MONO`), `#ff6c2f` (`ACCENT`), `#0a0a0a` (`BG`), `#141414` (`SURFACE`), `#1f1f1f` (`BORDER`), `#555` (`DIM`), Vitest + Testing Library.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/weight-tracker/types.ts` | Modify | Export `View` type (moved from TrackerClient) |
| `src/lib/weight-tracker/useMediaQuery.ts` | **Create** | SSR-safe media query hook |
| `src/app/globals.css` | Modify | Desktop CSS classes for History grid and Profile split |
| `src/components/weight-tracker/ExerciseListItem.tsx` | **Create** | Compact exercise row for desktop left pane |
| `src/components/weight-tracker/ExerciseDetailPane.tsx` | **Create** | Full exercise detail + SetLoggers for desktop right pane |
| `src/components/weight-tracker/views/LogViewDesktop.tsx` | **Create** | Two-pane desktop Log view |
| `src/components/weight-tracker/DesktopLayout.tsx` | **Create** | Desktop shell: sidebar + content routing |
| `src/components/weight-tracker/TrackerClient.tsx` | Modify | Add `useMediaQuery`, conditionally render `DesktopLayout` |
| `src/components/weight-tracker/views/HistoryView.tsx` | Modify | Add `pulse-history-grid` CSS class |
| `src/components/weight-tracker/views/ProfileView.tsx` | Modify | Restructure into two named sections for CSS split |
| `src/components/weight-tracker/__tests__/useMediaQuery.test.ts` | **Create** | Hook tests |
| `src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx` | **Create** | List item tests |
| `src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx` | **Create** | Detail pane tests |
| `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx` | **Create** | Desktop log view tests |
| `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx` | **Create** | Sidebar navigation tests |

---

## Task 1: Export `View` type + `useMediaQuery` hook

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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    it('returns false on initial render before useEffect fires', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        // Initial render before effect: false
        expect(result.current).toBe(false);
    });

    it('returns true after mount when media matches', async () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        // After useEffect fires
        expect(result.current).toBe(true);
    });

    it('returns false after mount when media does not match', () => {
        mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
    });

    it('updates when media query changes', () => {
        const mql = mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
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

- [ ] **Step 5: Run test to confirm it passes**

```powershell
bun run test:run -- useMediaQuery
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/weight-tracker/types.ts src/lib/weight-tracker/useMediaQuery.ts src/lib/weight-tracker/__tests__/useMediaQuery.test.ts
git commit -m "feat(pulse): add View type to types.ts, add useMediaQuery hook"
```

---

## Task 2: `ExerciseListItem` — desktop exercise list row

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
                padding: '0.75rem 1rem',
                background: isActive ? '#161616' : 'none',
                border: 'none',
                borderLeft: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left',
            }}>
            <span
                style={{
                    fontFamily: MONO,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#222',
                    width: '2rem',
                    flexShrink: 0,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    userSelect: 'none',
                }}>
                {String(exIdx + 1).padStart(2, '0')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        color: isActive ? '#fff' : '#888',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'color 0.1s',
                    }}>
                    {exercise.name}
                </div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: '0.75rem', flexShrink: 0 }}>
                {Array.from({ length: maxSets }, (_, i) => (
                    <span key={i} style={{ color: i < savedCount ? ACCENT : MUTED }}>
                        {i < savedCount ? '█' : '░'}
                    </span>
                ))}
            </span>
            {complete && (
                <span
                    style={{ fontFamily: MONO, fontSize: '0.5625rem', color: ACCENT, flexShrink: 0 }}>
                    ✓
                </span>
            )}
        </button>
    );
}
```

- [ ] **Step 4: Run to confirm tests pass**

```powershell
bun run test:run -- ExerciseListItem
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/ExerciseListItem.tsx src/components/weight-tracker/__tests__/ExerciseListItem.test.tsx
git commit -m "feat(pulse): add ExerciseListItem for desktop log view left pane"
```

---

## Task 3: `ExerciseDetailPane` — desktop exercise detail panel

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
            <div
                style={{
                    padding: '1.25rem 1.5rem 0.875rem',
                    borderBottom: `1px solid ${BORDER}`,
                    flexShrink: 0,
                }}>
                <div
                    style={{
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '1.0625rem',
                        marginBottom: '0.25rem',
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
                        textTransform: 'uppercase',
                    }}>
                    {exercise.sets} sets · {exercise.reps} reps
                </div>
            </div>

            {/* Set list — scrollable */}
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

- [ ] **Step 4: Run to confirm tests pass**

```powershell
bun run test:run -- ExerciseDetailPane
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/weight-tracker/ExerciseDetailPane.tsx src/components/weight-tracker/__tests__/ExerciseDetailPane.test.tsx
git commit -m "feat(pulse): add ExerciseDetailPane for desktop log view right pane"
```

---

## Task 4: `LogViewDesktop` — two-pane log view

**Files:**
- Create: `src/components/weight-tracker/views/LogViewDesktop.tsx`
- Create: `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        // The first push exercise name should appear in both the list and the detail pane header
        const headings = screen.getAllByText(/dumbbell bench press/i);
        expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('switches the detail pane when a different exercise is clicked', async () => {
        render(<LogViewDesktop {...defaultProps} />);
        // Click the second exercise in the list (index 1)
        const listButtons = screen.getAllByRole('button');
        // Find a button that contains the second exercise name — need to find it in the left pane list
        // The second push exercise is 'Incline DB Press'
        const inclineBtn = screen.getByRole('button', { name: /incline/i });
        await userEvent.click(inclineBtn);
        // Detail pane header should now show the second exercise
        expect(screen.getByText(/incline/i)).toBeInTheDocument();
    });

    it('persists selected exercise index to localStorage', async () => {
        render(<LogViewDesktop {...defaultProps} />);
        const inclineBtn = screen.getByRole('button', { name: /incline/i });
        await userEvent.click(inclineBtn);
        expect(localStorage.getItem('wt_last_ex')).toBe('1');
    });

    it('restores selected exercise from localStorage on mount', () => {
        localStorage.setItem('wt_last_ex', '2');
        render(<LogViewDesktop {...defaultProps} />);
        // Third exercise should be active in detail pane
        // Check that the third push exercise name appears
        const { WORKOUTS } = require('@/lib/weight-tracker/data');
        const thirdExName = WORKOUTS.push.exercises[2].name;
        expect(screen.getByText(thirdExName)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- LogViewDesktop
```

Expected: FAIL.

- [ ] **Step 3: Read the WORKOUTS data to verify exercise names match test expectations**

Read `src/lib/weight-tracker/data.ts` and confirm:
- `WORKOUTS.push.exercises[0].name` — used as first exercise in tests
- `WORKOUTS.push.exercises[1].name` — should contain "Incline"
- `WORKOUTS.push.exercises[2].name` — used in restore-from-localStorage test

If the names differ from the test expectations above, update the test strings to match the actual data before proceeding.

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

    // Clamp index when tab changes (different tabs may have different exercise counts)
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
            {/* Left pane: exercise list */}
            <div
                style={{
                    width: 300,
                    flexShrink: 0,
                    borderRight: `1px solid ${BORDER}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />

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
                                    fontSize: '0.75rem',
                                    fontWeight: active ? 700 : 400,
                                    minWidth: '2.25rem',
                                    padding: '0.5rem 0 0.375rem',
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
                                        width: 4,
                                        height: 4,
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
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        padding: '0.625rem 1rem 0.5rem',
                        borderBottom: `1px solid ${BORDER}`,
                        flexShrink: 0,
                    }}>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.5625rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: DIM,
                        }}>
                        {phase.label}
                    </span>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: ACCENT,
                            letterSpacing: '0.04em',
                        }}>
                        {rir} RIR
                    </span>
                    <span style={{ fontSize: '0.75rem', color: DIM, marginLeft: 'auto' }}>
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

            {/* Right pane: active exercise detail */}
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

If the "Incline" button test fails because the test can't find a button by that partial name, check the second push exercise name in `data.ts` and update the test `getByRole` query to match exactly.

- [ ] **Step 6: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```powershell
git add src/components/weight-tracker/views/LogViewDesktop.tsx src/components/weight-tracker/__tests__/LogViewDesktop.test.tsx
git commit -m "feat(pulse): add LogViewDesktop two-pane layout for desktop log view"
```

---

## Task 5: `DesktopLayout` shell + wire into `TrackerClient`

**Files:**
- Create: `src/components/weight-tracker/DesktopLayout.tsx`
- Create: `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx`
- Modify: `src/components/weight-tracker/TrackerClient.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/weight-tracker/__tests__/DesktopLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';

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

// Mock server actions used by ProfileView and logout
vi.mock('@/app/pulse/actions', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn().mockResolvedValue({ id: '1', logged_at: '2026-05-25', weight_kg: 80 }),
    deleteBodyWeight: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
}));

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('Pulse')).toBeInTheDocument();
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

    it('shows a streak in the sidebar when streak > 0', () => {
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

Expected: FAIL.

- [ ] **Step 3: Implement `DesktopLayout`**

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
    { id: 'log', label: 'Log' },
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
    logs,
    unit,
    displayName,
    bodyweightLogs,
    email,
    activeWeek,
    activeTab,
    view,
    streak,
    saveError,
    timerTrigger,
    onSelectWeek,
    setActiveTab,
    onNavigate,
    updateLog,
    deleteLog,
    onUnitChange,
    onDisplayNameChange,
    onBodyweightLogsChange,
    onExport,
}: Props) {
    const navBtnStyle = (active: boolean) => ({
        fontFamily: MONO,
        fontSize: '0.8125rem',
        fontWeight: active ? 700 : 400,
        color: active ? '#fff' : DIM,
        background: active ? '#1a1a1a' : 'none',
        border: 'none',
        borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
        textAlign: 'left' as const,
        padding: '0.5rem 0.875rem',
        borderRadius: '0 3px 3px 0',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        width: '100%',
        display: 'block',
    });

    const utilBtnStyle = {
        fontFamily: MONO,
        fontSize: '0.75rem',
        fontWeight: 400,
        color: '#444',
        background: 'none',
        border: 'none',
        borderLeft: '2px solid transparent',
        textAlign: 'left' as const,
        padding: '0.5rem 0.875rem',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        width: '100%',
        display: 'block',
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG, color: '#d4d4d4' }}>
            {/* Sidebar */}
            <div
                style={{
                    width: 180,
                    flexShrink: 0,
                    borderRight: `1px solid ${BORDER}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                {/* Brand + week */}
                <div style={{ padding: '1.25rem 1rem 1.5rem' }}>
                    <div
                        style={{
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            letterSpacing: '0.08em',
                            color: '#fff',
                            textTransform: 'uppercase',
                        }}>
                        Pulse<span style={{ color: ACCENT }}>.</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '0.75rem', color: DIM, marginTop: '0.625rem' }}>
                        WK{' '}
                        <strong style={{ color: ACCENT, fontWeight: 700 }}>
                            {String(activeWeek).padStart(2, '0')}
                        </strong>{' '}
                        / 12
                    </div>
                    {streak > 0 && (
                        <div
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.625rem',
                                color: '#444',
                                marginTop: '0.25rem',
                                letterSpacing: '0.04em',
                            }}>
                            {streak}WK streak
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav
                    aria-label="Main navigation"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0 0.5rem' }}>
                    {NAV.map(({ id, label }) => (
                        <button key={id} onClick={() => onNavigate(id)} style={navBtnStyle(view === id)}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Utilities */}
                <div
                    style={{
                        padding: '0.75rem 0.5rem',
                        borderTop: `1px solid ${BORDER}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.125rem',
                    }}>
                    <button onClick={onExport} style={utilBtnStyle}>
                        Export
                    </button>
                    <form action={logout} style={{ display: 'block' }}>
                        <button type="submit" style={utilBtnStyle}>
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                            flexShrink: 0,
                        }}>
                        {saveError}
                    </div>
                )}

                {/* Views */}
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
                            onSelectWeek={(w) => {
                                onSelectWeek(w);
                                onNavigate('log');
                            }}
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
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
bun run test:run -- DesktopLayout
```

- [ ] **Step 5: Modify `TrackerClient` to use `DesktopLayout` on desktop**

Read `src/components/weight-tracker/TrackerClient.tsx`. Make these changes:

**a) Update the `View` import** — remove the local type definition and import from types instead:

```tsx
// Remove this line:
type View = 'log' | 'program' | 'history' | 'profile';

// Add to the existing imports from '@/lib/weight-tracker/types':
import type { Logs, LogEntry, WorkoutType, Unit, Profile, BodyweightEntry, View } from '@/lib/weight-tracker/types';
```

**b) Add imports** after the existing import block:

```tsx
import { useMediaQuery } from '@/lib/weight-tracker/useMediaQuery';
import DesktopLayout from './DesktopLayout';
```

**c) Add the media query hook** inside `TrackerClient`, after the existing `useState`/`useMemo` lines:

```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');
```

**d) Replace the return statement** with a conditional:

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
        // ... existing mobile JSX unchanged ...
    );
```

The existing mobile JSX (`<div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>...`) stays exactly as-is, just moved into the second `return` statement.

- [ ] **Step 6: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 7: Run typecheck**

```powershell
bun run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```powershell
git add src/components/weight-tracker/DesktopLayout.tsx src/components/weight-tracker/__tests__/DesktopLayout.test.tsx src/components/weight-tracker/TrackerClient.tsx
git commit -m "feat(pulse): add DesktopLayout sidebar shell, wire into TrackerClient"
```

---

## Task 6: Desktop History grid

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/weight-tracker/views/HistoryView.tsx`

No new tests needed — this is a CSS layout change. Verify visually.

- [ ] **Step 1: Add CSS class to `globals.css`**

Open `src/app/globals.css` and append after the existing media query block:

```css
@media (min-width: 1024px) {
    .pulse-history-grid {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr);
        max-width: 1100px !important;
        align-items: start;
    }
}
```

- [ ] **Step 2: Add the class to `HistoryView`**

Open `src/components/weight-tracker/views/HistoryView.tsx`. Find the outermost `<div>` in the non-empty return (the one with `style={{ padding: '1rem', maxWidth: 600, ... }}`). Add `className="pulse-history-grid"`:

```tsx
<div
    className="pulse-history-grid"
    style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
```

- [ ] **Step 3: Run full suite to confirm no regressions**

```powershell
bun run test:run
```

- [ ] **Step 4: Commit**

```powershell
git add src/app/globals.css src/components/weight-tracker/views/HistoryView.tsx
git commit -m "feat(pulse): 2-column history grid on desktop"
```

---

## Task 7: Desktop Profile split layout

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/weight-tracker/views/ProfileView.tsx`

- [ ] **Step 1: Add CSS classes to `globals.css`**

Append after the existing `pulse-history-grid` block:

```css
@media (min-width: 1024px) {
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

- [ ] **Step 2: Restructure `ProfileView` into two named sections**

Open `src/components/weight-tracker/views/ProfileView.tsx`.

Replace the outermost wrapper `<div style={{ padding: '1.25rem 1rem 3rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>` with:

```tsx
<div
    className="pulse-profile-layout"
    style={{
        padding: '1.25rem 1rem 3rem',
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
    }}>
```

Then wrap the **Identity** and **Unit toggle** sections together in a `<div className="pulse-profile-main">`:

```tsx
<div className="pulse-profile-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
    {/* Identity */}
    ...existing identity JSX...

    {/* Unit toggle */}
    ...existing unit toggle JSX...
</div>
```

And wrap the **Body weight** section in a `<div className="pulse-profile-side">`:

```tsx
<div className="pulse-profile-side">
    {/* Body weight */}
    ...existing body weight JSX...
</div>
```

The `nameSaved` indicator that appears inside the identity section stays where it is.

- [ ] **Step 3: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing (ProfileView tests still pass since the content is unchanged, only wrapped differently).

- [ ] **Step 4: Commit**

```powershell
git add src/app/globals.css src/components/weight-tracker/views/ProfileView.tsx
git commit -m "feat(pulse): side-by-side profile layout on desktop"
```

---

## Task 8: Final polish — typecheck, lint, format

- [ ] **Step 1: Run typecheck**

```powershell
bun run typecheck
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Run lint**

```powershell
bun run lint
```

Fix any ESLint warnings or errors.

- [ ] **Step 3: Run formatter**

```powershell
bun run format
```

- [ ] **Step 4: Run full test suite one final time**

```powershell
bun run test:run
```

Expected: all tests passing.

- [ ] **Step 5: Commit**

```powershell
git add -u
git commit -m "chore(pulse): typecheck, lint, format desktop layout branch"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task | Covered? |
|-------------|------|----------|
| Sidebar ≥1024px with brand, week, streak, nav, export, sign out | T5 | ✅ |
| Sidebar always visible (no collapse) | T5 | ✅ |
| Two-pane Log view: exercise list left, detail right | T4 | ✅ |
| Auto-open last-used exercise (persisted to localStorage) | T4 | ✅ |
| RestTimer pinned in right pane, never scrolls off | T3 | ✅ |
| Mobile layout completely unchanged | T5 (conditional render) | ✅ |
| History 2-column grid on desktop | T6 | ✅ |
| Profile side-by-side on desktop | T7 | ✅ |
| `View` type exported from types.ts | T1 | ✅ |
| `useMediaQuery` hook with tests | T1 | ✅ |

**No placeholders found.**

**Type consistency:** `View` defined once in `types.ts`, used in `TrackerClient`, `DesktopLayout`, and `LogViewDesktop` — consistent throughout. `ExerciseDetailPane.onSave` signature `(key: string, entry: LogEntry) => void` matches `updateLog` in `TrackerClient` — consistent.
