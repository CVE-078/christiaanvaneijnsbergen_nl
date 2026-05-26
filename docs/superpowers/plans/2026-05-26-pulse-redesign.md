# Pulse Redesign Plan (v2)

> **Supersedes** `2026-05-25-pulse-redesign.md` and `2026-05-25-desktop-layout.md` — both reference stale paths (`weight-tracker/`), inline styles, and a prop-drilling architecture that no longer exists.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottom-tab mobile navigation + full desktop shell (sidebar + two-pane Log view) at ≥1024px. Dot progress indicators in `ExerciseCard`. Styled inputs and saved-row tint in `SetLogger`. Per-tab completion summary in `WorkoutTabs`. All new Tailwind — no new inline styles for static values.

**Tech stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4 (`@import 'tailwindcss'`), `usePulse()` context from `@/context/PulseContext` (no prop drilling), Vitest + Testing Library, bun.

**Breakpoint:** `lg` = 1024px. Desktop layout gates at `lg`.

---

## Architecture

```
TrackerClient
  └── PulseProvider                      (provides usePulse() context)
        └── AppShell                     ← useMediaQuery('(min-width: 1024px)')
              ├── [≥1024px] DesktopLayout  ← usePulse()
              │     ├── Sidebar (brand, week, streak, nav, export, sign-out)
              │     └── Content
              │           ├── [log]     LogViewDesktop  ← usePulse()
              │           │              ├── ExerciseListItem (props)
              │           │              └── ExerciseDetailPane (props)
              │           ├── [program] ProgramView  ← usePulse()
              │           ├── [history] HistoryView  ← usePulse()
              │           └── [profile] ProfileView  ← usePulse()
              └── [<1024px] mobile layout
                    ├── Topbar (brand + week chip + export/sign-out)
                    ├── [log]     LogView  ← usePulse()
                    ├── [program] ProgramView
                    ├── [history] HistoryView
                    ├── [profile] ProfileView
                    └── BottomNav (props: view, onNavigate)
```

**Container components** (`DesktopLayout`, `LogViewDesktop`, `AppShell`) call `usePulse()` directly — no props needed. **Leaf components** (`ExerciseListItem`, `ExerciseDetailPane`, `BottomNav`) take explicit props for isolated testability.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/pulse/useMediaQuery.ts` | **Create** | SSR-safe media query hook |
| `src/hooks/pulse/__tests__/useMediaQuery.test.ts` | **Create** | Hook tests |
| `src/components/pulse/BottomNav.tsx` | **Create** | Mobile fixed bottom tab bar |
| `src/components/pulse/__tests__/BottomNav.test.tsx` | **Create** | Bottom nav tests |
| `src/components/pulse/WorkoutTabs.tsx` | Modify | Add `logs: Logs` + `week: number` props, show `done/total` summary |
| `src/components/pulse/__tests__/WorkoutTabs.test.tsx` | Modify | Pass `logs={{}}` + `week={1}` to all renders; add summary test |
| `src/components/pulse/ExerciseCard.tsx` | Modify | Dot indicators + 2px progress bar; complete-state green border |
| `src/components/pulse/SetLogger.tsx` | Modify | Taller inputs (`h-10`), solid-orange Save, green tint on saved rows |
| `src/components/pulse/ExerciseListItem.tsx` | **Create** | Desktop left-pane exercise row |
| `src/components/pulse/__tests__/ExerciseListItem.test.tsx` | **Create** | List item tests |
| `src/components/pulse/ExerciseDetailPane.tsx` | **Create** | Desktop right-pane (header + set list + rest timer) |
| `src/components/pulse/__tests__/ExerciseDetailPane.test.tsx` | **Create** | Detail pane tests |
| `src/components/pulse/views/LogViewDesktop.tsx` | **Create** | Two-pane desktop log view (uses `usePulse()`) |
| `src/components/pulse/__tests__/LogViewDesktop.test.tsx` | **Create** | Desktop log view tests |
| `src/components/pulse/DesktopLayout.tsx` | **Create** | 180px sidebar + content area (uses `usePulse()`) |
| `src/components/pulse/__tests__/DesktopLayout.test.tsx` | **Create** | Sidebar navigation tests |
| `src/components/pulse/AppShell.tsx` | Modify | Replace hamburger/dropdown with `BottomNav`; add `useMediaQuery` desktop gate |

---

## Task 1: `useMediaQuery` hook

**Files:**
- Create: `src/hooks/pulse/useMediaQuery.ts`
- Create: `src/hooks/pulse/__tests__/useMediaQuery.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/pulse/__tests__/useMediaQuery.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
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
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue(mql) });
    return mql;
}

describe('useMediaQuery', () => {
    it('returns false on initial render (SSR-safe)', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
    });

    it('returns true after mount when media matches', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(true);
    });

    it('returns false after mount when media does not match', () => {
        mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
    });

    it('updates when the media query changes', () => {
        const mql = mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
        act(() => mql.dispatch(true));
        expect(result.current).toBe(true);
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- useMediaQuery
```

Expected: FAIL — `useMediaQuery` not found.

- [ ] **Step 3: Implement `useMediaQuery`**

Create `src/hooks/pulse/useMediaQuery.ts`:

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

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
bun run test:run -- useMediaQuery
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/pulse/useMediaQuery.ts src/hooks/pulse/__tests__/useMediaQuery.test.ts
git commit -m "feat(pulse): add useMediaQuery hook (1024px gate)"
```

---

## Task 2: `BottomNav` — mobile bottom tab bar

**Files:**
- Create: `src/components/pulse/BottomNav.tsx`
- Create: `src/components/pulse/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/pulse/__tests__/BottomNav.test.tsx`:

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
        await userEvent.click(screen.getByRole('button', { name: /history/i }));
        expect(onNavigate).toHaveBeenCalledWith('history');
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<BottomNav view="profile" onNavigate={vi.fn()} />);
        expect(screen.getByRole('button', { name: /profile/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /^log$/i })).not.toHaveAttribute('aria-current', 'page');
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- BottomNav
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `BottomNav`**

Create `src/components/pulse/BottomNav.tsx`:

```tsx
import type { View } from '@/lib/pulse/types';

const ITEMS: { id: View; label: string }[] = [
    { id: 'log',     label: 'Log'     },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

interface Props {
    view: View;
    onNavigate: (v: View) => void;
}

export default function BottomNav({ view, onNavigate }: Props) {
    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 flex h-16 bg-pulse-bg/95 backdrop-blur-sm border-t border-pulse-border z-30"
            /* safe-area-inset cannot be expressed in Tailwind v4 — must stay inline */
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
            {ITEMS.map(({ id, label }) => {
                const active = view === id;
                return (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer py-2 ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                        <span className="font-pulse text-[0.5625rem] font-semibold tracking-[0.06em] uppercase">
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

- [ ] **Step 5: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pulse/BottomNav.tsx src/components/pulse/__tests__/BottomNav.test.tsx
git commit -m "feat(pulse): add BottomNav mobile bottom tab bar"
```

---

## Task 3: `WorkoutTabs` — per-tab completion summary

**Files:**
- Modify: `src/components/pulse/WorkoutTabs.tsx`
- Modify: `src/components/pulse/__tests__/WorkoutTabs.test.tsx`

This adds `done / total` exercise-completion counts to each tab button. An exercise counts as done when all its sets are saved.

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/components/pulse/__tests__/WorkoutTabs.test.tsx`:

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

    it('shows "0 / N" completion summary on the active tab', () => {
        render(<WorkoutTabs {...base} />);
        const { WORKOUTS } = require('@/lib/pulse/data');
        const total = WORKOUTS.push.exercises.length;
        expect(screen.getByText(`0 / ${total}`)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm the summary test fails and existing tests pass**

```powershell
bun run test:run -- WorkoutTabs
```

Expected: 6 pass, 1 fail (the `0 / N` test).

- [ ] **Step 3: Update `WorkoutTabs.tsx`**

Replace the full contents of `src/components/pulse/WorkoutTabs.tsx`:

```tsx
'use client';
import { WORKOUTS } from '@/lib/pulse/data';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import type { WorkoutType, Logs } from '@/lib/pulse/types';

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
        <div role="tablist" className="flex border-b border-pulse-border">
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
                        className={`flex-1 flex flex-col items-center py-2.5 pb-2 gap-[0.2rem] bg-transparent border-0 border-b-2 -mb-px cursor-pointer ${
                            active ? 'border-pulse-accent' : 'border-transparent'
                        }`}>
                        <span className={`font-pulse text-[0.6875rem] tracking-[0.12em] uppercase ${active ? 'text-white' : 'text-pulse-dim'}`}>
                            {label}
                        </span>
                        <span className={`font-pulse text-[0.5625rem] tracking-[0.04em] ${active ? 'text-pulse-dim' : 'text-pulse-muted'}`}>
                            {done} / {total}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Update callers of `WorkoutTabs`**

`WorkoutTabs` is called from `LogView.tsx`. Open `src/components/pulse/views/LogView.tsx` and update the `<WorkoutTabs>` usage to pass `logs` and `week`:

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
git add src/components/pulse/WorkoutTabs.tsx src/components/pulse/__tests__/WorkoutTabs.test.tsx src/components/pulse/views/LogView.tsx
git commit -m "feat(pulse): add per-tab exercise-completion summary to WorkoutTabs"
```

---

## Task 4: `ExerciseCard` — dot indicators + progress bar

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx`

No new tests needed. Existing tests check behaviour (`aria-label`, expand, save), not `█░` characters.

- [ ] **Step 1: Run existing tests to confirm baseline**

```powershell
bun run test:run -- ExerciseCard
```

Expected: 5 passing.

- [ ] **Step 2: Replace `ExerciseCard.tsx`**

Replace the full contents of `src/components/pulse/ExerciseCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

const GREEN = '#22c55e';

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
        <div className={`bg-pulse-surface rounded overflow-hidden border ${complete ? 'border-[rgba(34,197,94,0.2)]' : 'border-pulse-border'}`}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-[0.875rem] px-4 bg-transparent border-none cursor-pointer flex items-center gap-3 text-left">
                <span className={`font-pulse text-[1.75rem] font-bold leading-none w-9 shrink-0 tracking-[-0.04em] select-none ${complete ? 'text-[rgba(34,197,94,0.4)]' : 'text-[#222]'}`}>
                    {String(exIdx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-[0.9375rem] truncate">{exercise.name}</div>
                    <div className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim mt-1 uppercase">
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                {/* Dot indicators replacing ░█ progress chars */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-pulse text-xs font-bold">
                        <span className="text-white">{savedCount}</span>
                        <span className="text-pulse-muted">/{maxSets}</span>
                    </span>
                    <div className="flex gap-[3px]">
                        {Array.from({ length: maxSets }, (_, i) => (
                            <span
                                key={i}
                                className="block w-1.5 h-1.5 rounded-full transition-colors duration-200"
                                style={{ background: i < savedCount ? (complete ? GREEN : 'var(--color-pulse-accent)') : 'var(--color-pulse-muted)' }}
                            />
                        ))}
                    </div>
                </div>
                {complete && (
                    <span aria-label="All sets done" className="font-pulse text-[0.625rem] text-[#22c55e] ml-1.5 shrink-0">
                        ✓
                    </span>
                )}
            </button>

            {/* 2px progress bar — visible when open */}
            {open && (
                <div className="h-[2px] bg-pulse-muted overflow-hidden">
                    {/* width is runtime ratio — must stay inline */}
                    <div
                        className="h-full bg-pulse-accent transition-[width] duration-300"
                        style={{ width: `${(savedCount / maxSets) * 100}%` }}
                    />
                </div>
            )}

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-3.5">
                    <p className="font-pulse text-[0.6875rem] text-pulse-dim pt-[0.625rem] pb-1.5 leading-[1.6]">
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

**Note on dot colors:** The dot background uses `style={{ background: ... }}` because it depends on a runtime boolean (`complete`). `var(--color-pulse-accent)` and `var(--color-pulse-muted)` reference the CSS custom properties directly.

- [ ] **Step 3: Run ExerciseCard tests**

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
git add src/components/pulse/ExerciseCard.tsx
git commit -m "feat(pulse): dot progress indicators and 2px progress bar in ExerciseCard"
```

---

## Task 5: `SetLogger` — taller inputs, solid Save, green saved-row tint

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx`

No new tests. Existing tests check behaviour, not CSS classes.

- [ ] **Step 1: Run existing tests to confirm baseline**

```powershell
bun run test:run -- SetLogger
```

Expected: 13 passing.

- [ ] **Step 2: Make three targeted changes to `SetLogger.tsx`**

**a) Replace the `inputClass` constant:**

```tsx
const inputClass =
    'w-[3.75rem] h-10 px-2 bg-[#1a1a1a] border border-[#222] rounded-[6px] text-white font-pulse text-[0.9375rem] font-bold text-center outline-none';
```

**b) Replace the Save/Update button `className`** — find the `<button onClick={handleSave}` block and update its class:

```tsx
className="font-pulse text-[0.625rem] tracking-[0.06em] uppercase h-10 px-4 bg-pulse-accent border-none rounded-[6px] text-white cursor-pointer shrink-0 transition-opacity duration-100"
```

**c) Replace the outermost `<div>` of the set row** — change both the `className` and remove the `style` prop entirely (the opacity is replaced by a conditional background class):

Find:
```tsx
<div
    className="flex items-center gap-2 py-[0.4375rem] border-b border-[#111]"
    style={{ opacity: saved && !editing ? 0.55 : 1 }}>
```

Replace with:
```tsx
<div className={`flex items-center gap-2 py-[0.4375rem] border-b border-[#111] ${saved && !editing ? 'bg-[#0e1510]' : ''}`}>
```

- [ ] **Step 3: Run SetLogger tests**

```powershell
bun run test:run -- SetLogger
```

Expected: 13 passing.

- [ ] **Step 4: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 5: Commit**

```powershell
git add src/components/pulse/SetLogger.tsx
git commit -m "feat(pulse): taller inputs, solid Save button, green saved-row tint in SetLogger"
```

---

## Task 6: `ExerciseListItem` — desktop left-pane exercise row

**Files:**
- Create: `src/components/pulse/ExerciseListItem.tsx`
- Create: `src/components/pulse/__tests__/ExerciseListItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/pulse/__tests__/ExerciseListItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseListItem from '../ExerciseListItem';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3–4',
    reps: '8–12',
    load: 'Start 18–20kg per DB',
    note: 'Full ROM',
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

Create `src/components/pulse/ExerciseListItem.tsx`:

```tsx
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import type { Exercise, Logs, WorkoutType } from '@/lib/pulse/types';

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
            className={`w-full py-3 px-4 flex items-center gap-3 text-left border-none border-l-2 cursor-pointer border-b border-[#222] ${isActive ? 'bg-[#161616] border-pulse-accent' : 'bg-transparent border-transparent'}`}>
            <span className="font-pulse text-[1.125rem] font-bold leading-none w-7 shrink-0 tracking-[-0.04em] select-none text-[#222]">
                {String(exIdx + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
                <div className={`font-semibold text-[0.875rem] truncate transition-colors duration-100 ${isActive ? 'text-white' : 'text-[#888]'}`}>
                    {exercise.name}
                </div>
                <div className="flex gap-[3px] mt-1">
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span
                            key={i}
                            className="block w-1 h-1 rounded-full"
                            style={{ background: i < savedCount ? (complete ? GREEN : 'var(--color-pulse-accent)') : 'var(--color-pulse-muted)' }}
                        />
                    ))}
                </div>
            </div>
            {complete && (
                <span className="font-pulse text-[0.625rem] text-[#22c55e] shrink-0">✓</span>
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
git add src/components/pulse/ExerciseListItem.tsx src/components/pulse/__tests__/ExerciseListItem.test.tsx
git commit -m "feat(pulse): add ExerciseListItem for desktop left pane"
```

---

## Task 7: `ExerciseDetailPane` — desktop right pane

**Files:**
- Create: `src/components/pulse/ExerciseDetailPane.tsx`
- Create: `src/components/pulse/__tests__/ExerciseDetailPane.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/pulse/__tests__/ExerciseDetailPane.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseDetailPane from '../ExerciseDetailPane';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3–4',
    reps: '8–12',
    load: 'Start 18–20kg per DB',
    note: 'Full ROM, slow eccentric (3s down).',
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
        expect(screen.getByText(/3–4 sets · 8–12 reps/)).toBeInTheDocument();
    });

    it('renders the correct number of Save buttons (one per max set)', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        // sets: '3–4' → parseMaxSets → 4
        const saveBtns = screen.getAllByRole('button', { name: /save/i });
        expect(saveBtns).toHaveLength(4);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const onSave = vi.fn();
        render(<ExerciseDetailPane {...defaultProps} onSave={onSave} />);
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '60');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith('1-push-0-0', expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- ExerciseDetailPane
```

Expected: FAIL.

- [ ] **Step 3: Implement `ExerciseDetailPane`**

Create `src/components/pulse/ExerciseDetailPane.tsx`:

```tsx
import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import RestTimer from './RestTimer';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

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
    exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete, timerTrigger,
}: Props) {
    const maxSets = parseMaxSets(exercise.sets);
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="py-5 px-6 pb-[0.875rem] border-b border-pulse-border shrink-0">
                <div className="text-white font-semibold text-[1.0625rem] mb-1 truncate">{exercise.name}</div>
                <div className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim uppercase">
                    {exercise.sets} sets · {exercise.reps} reps
                </div>
            </div>

            {/* Scrollable set list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
                <p className="font-pulse text-[0.6875rem] text-pulse-dim pt-3 pb-1.5 leading-[1.6]">
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

            {/* Rest timer pinned at bottom */}
            <div className="border-t border-pulse-border py-3 px-6 shrink-0">
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

- [ ] **Step 5: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pulse/ExerciseDetailPane.tsx src/components/pulse/__tests__/ExerciseDetailPane.test.tsx
git commit -m "feat(pulse): add ExerciseDetailPane for desktop right pane"
```

---

## Task 8: `LogViewDesktop` — two-pane desktop log view

**Files:**
- Create: `src/components/pulse/views/LogViewDesktop.tsx`
- Create: `src/components/pulse/__tests__/LogViewDesktop.test.tsx`

`LogViewDesktop` calls `usePulse()` directly — no props needed. Tests wrap it in a mocked context.

- [ ] **Step 1: Write the failing tests**

Create `src/components/pulse/__tests__/LogViewDesktop.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WORKOUTS } from '@/lib/pulse/data';

// Mock PulseContext — LogViewDesktop calls usePulse() internally
vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({
        activeWeek: 1,
        setActiveWeek: vi.fn(),
        activeTab: 'push' as const,
        setActiveTab: vi.fn(),
        logs: {},
        profile: { unit: 'kg', display_name: null },
        prMap: {},
        updateLog: vi.fn(),
        deleteLog: vi.fn(),
        timerTrigger: 0,
        fireTrigger: vi.fn(),
    })),
}));

beforeEach(() => localStorage.clear());

// Import after mocking
const { default: LogViewDesktop } = await import('../views/LogViewDesktop');

describe('LogViewDesktop', () => {
    it('auto-opens the first exercise detail pane on mount', () => {
        render(<LogViewDesktop />);
        const firstName = WORKOUTS.push.exercises[0].name;
        expect(screen.getAllByText(firstName).length).toBeGreaterThanOrEqual(1);
    });

    it('switches the detail pane when a different exercise is clicked', async () => {
        render(<LogViewDesktop />);
        const secondName = WORKOUTS.push.exercises[1].name;
        await userEvent.click(screen.getByRole('button', { name: new RegExp(secondName, 'i') }));
        expect(screen.getByText(secondName)).toBeInTheDocument();
    });

    it('persists selected exercise index to localStorage', async () => {
        render(<LogViewDesktop />);
        const secondName = WORKOUTS.push.exercises[1].name;
        await userEvent.click(screen.getByRole('button', { name: new RegExp(secondName, 'i') }));
        expect(localStorage.getItem('pulse_last_ex')).toBe('1');
    });

    it('restores selected exercise from localStorage on mount', () => {
        localStorage.setItem('pulse_last_ex', '2');
        render(<LogViewDesktop />);
        const thirdName = WORKOUTS.push.exercises[2].name;
        expect(screen.getByText(thirdName)).toBeInTheDocument();
    });
});
```

**Important:** The dynamic `await import(...)` pattern is needed because the module must be imported after `vi.mock()` hoisting. Alternatively, put the mock in the test file before all imports and use a regular `import`.

If the dynamic import pattern causes issues, move the mock to a separate `__mocks__/@/context/PulseContext.ts` file or use this alternative top-of-file structure:

```tsx
import { vi } from 'vitest';
vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({ /* mock values */ })),
}));
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WORKOUTS } from '@/lib/pulse/data';
import LogViewDesktop from '../views/LogViewDesktop';
```

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- LogViewDesktop
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LogViewDesktop`**

Create `src/components/pulse/views/LogViewDesktop.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseListItem from '../ExerciseListItem';
import ExerciseDetailPane from '../ExerciseDetailPane';

const LAST_EX_KEY = 'pulse_last_ex';

export default function LogViewDesktop() {
    const {
        activeWeek, setActiveWeek,
        activeTab, setActiveTab,
        logs, profile, prMap,
        updateLog, deleteLog,
        timerTrigger, fireTrigger,
    } = usePulse();

    const unit = profile.unit;
    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);

    const [activeExIdx, setActiveExIdx] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(localStorage.getItem(LAST_EX_KEY));
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        return stored >= 0 && stored <= maxIdx ? stored : 0;
    });

    // Clamp index when tab changes (tabs have different exercise counts)
    useEffect(() => {
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        setActiveExIdx((prev) => Math.min(prev, maxIdx));
    }, [activeTab]);

    function handleSelectExercise(idx: number) {
        setActiveExIdx(idx);
        localStorage.setItem(LAST_EX_KEY, String(idx));
    }

    function handleSave(key: string, entry: Parameters<typeof updateLog>[1]) {
        updateLog(key, entry);
        fireTrigger();
    }

    const activeExercise = workout.exercises[activeExIdx];

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left pane */}
            <div className="w-[300px] shrink-0 border-r border-pulse-border flex flex-col overflow-hidden">
                <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} logs={logs} week={activeWeek} />

                {/* Week strip */}
                <div className="flex px-2 overflow-x-auto [scrollbar-width:none] border-b border-pulse-border">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                        const active = w === activeWeek;
                        return (
                            <button
                                key={w}
                                onClick={() => setActiveWeek(w)}
                                className={`font-pulse text-[0.6875rem] min-w-[2rem] pt-[0.4rem] pb-[0.3rem] text-center bg-transparent border-none border-b-2 cursor-pointer shrink-0 -mb-px ${active ? 'font-bold text-pulse-accent border-pulse-accent' : 'font-normal text-pulse-dim border-transparent'}`}>
                                {w}
                                <span
                                    className={`block w-[3px] h-[3px] rounded-full mt-0.5 mx-auto ${weekHasData(w, logs) ? 'bg-pulse-accent' : 'bg-transparent'}`}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* Context bar */}
                <div className="flex items-baseline gap-2 py-2.5 px-4 border-b border-pulse-border shrink-0">
                    <span className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-dim">
                        {phase.label}
                    </span>
                    <span className="font-pulse text-[0.5625rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/15 py-[0.1rem] px-[0.35rem] rounded-[3px]">
                        {rir} RIR
                    </span>
                    <span className="font-pulse text-[0.625rem] text-pulse-dim ml-auto">{workout.description}</span>
                </div>

                {/* Exercise list */}
                <div className="flex-1 overflow-y-auto">
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
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeExercise && (
                    <ExerciseDetailPane
                        exercise={activeExercise}
                        exIdx={activeExIdx}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                        timerTrigger={timerTrigger}
                    />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run LogViewDesktop tests**

```powershell
bun run test:run -- LogViewDesktop
```

Expected: 4 passing.

- [ ] **Step 5: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pulse/views/LogViewDesktop.tsx src/components/pulse/__tests__/LogViewDesktop.test.tsx
git commit -m "feat(pulse): add LogViewDesktop two-pane layout"
```

---

## Task 9: `DesktopLayout` — sidebar + content shell

**Files:**
- Create: `src/components/pulse/DesktopLayout.tsx`
- Create: `src/components/pulse/__tests__/DesktopLayout.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/pulse/__tests__/DesktopLayout.test.tsx`:

```tsx
import { vi } from 'vitest';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({
        view: 'log' as const,
        navigate: vi.fn(),
        activeWeek: 3,
        streak: 2,
        saveError: null,
        handleExport: vi.fn(),
        // Fields consumed by child view components:
        activeTab: 'push' as const,
        setActiveTab: vi.fn(),
        setActiveWeek: vi.fn(),
        logs: {},
        profile: { unit: 'kg', display_name: null },
        prMap: {},
        updateLog: vi.fn(),
        deleteLog: vi.fn(),
        timerTrigger: 0,
        fireTrigger: vi.fn(),
        bodyweightLogs: [],
        email: 'test@example.com',
        updateProfile: vi.fn(),
        logBodyWeight: vi.fn(),
        deleteBodyWeight: vi.fn(),
        isLoading: false,
        streak: 2,
        saveError: null,
    })),
}));

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';

// Also mock LogViewDesktop so it doesn't need its own full context resolution
vi.mock('../views/LogViewDesktop', () => ({
    default: () => <div data-testid="log-view-desktop">LogViewDesktop</div>,
}));

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout />);
        expect(screen.getByText(/pulse/i)).toBeInTheDocument();
    });

    it('renders all four nav items', () => {
        render(<DesktopLayout />);
        expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^program$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^history$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
    });

    it('calls navigate when a nav item is clicked', async () => {
        const navigate = vi.fn();
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValue({ ...vi.mocked(usePulse)(), navigate });
        render(<DesktopLayout />);
        await userEvent.click(screen.getByRole('button', { name: /^history$/i }));
        expect(navigate).toHaveBeenCalledWith('history');
    });

    it('shows the active week padded to 2 digits', () => {
        render(<DesktopLayout />);
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('shows streak when streak > 0', () => {
        render(<DesktopLayout />);
        expect(screen.getByText(/2wk streak/i)).toBeInTheDocument();
    });

    it('renders the save error bar when saveError is set', async () => {
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...vi.mocked(usePulse)(), saveError: 'Failed to save.' });
        render(<DesktopLayout />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls handleExport when Export is clicked', async () => {
        const handleExport = vi.fn();
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValue({ ...vi.mocked(usePulse)(), handleExport });
        render(<DesktopLayout />);
        await userEvent.click(screen.getByRole('button', { name: /export/i }));
        expect(handleExport).toHaveBeenCalledTimes(1);
    });
});
```

**Note:** If the context mock spread pattern causes TypeScript issues, cast as `any` or define a complete mock object satisfying `PulseContextValue`. Adjust tests as needed to match what `vi.mocked(usePulse)()` returns.

- [ ] **Step 2: Run to confirm failure**

```powershell
bun run test:run -- DesktopLayout
```

Expected: FAIL.

- [ ] **Step 3: Implement `DesktopLayout`**

Create `src/components/pulse/DesktopLayout.tsx`:

```tsx
'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import LogViewDesktop from './views/LogViewDesktop';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'log',     label: 'Log'     },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

export default function DesktopLayout() {
    const { view, navigate, activeWeek, streak, saveError, handleExport } = usePulse();

    return (
        <div className="flex h-screen overflow-hidden bg-pulse-bg text-pulse-text">
            {/* Sidebar */}
            <aside className="w-44 shrink-0 border-r border-pulse-border flex flex-col overflow-hidden">
                {/* Brand + week */}
                <div className="py-5 px-4 pb-6 border-b border-pulse-border">
                    <div className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </div>
                    <div className="font-pulse text-xs text-pulse-dim mt-2.5">
                        WK{' '}
                        <strong className="text-pulse-accent font-bold">{String(activeWeek).padStart(2, '0')}</strong>
                        {' '}/ 12
                    </div>
                    {streak > 0 && (
                        <div className="font-pulse text-[0.625rem] text-[#444] mt-1 tracking-[0.04em]">
                            {streak}WK streak
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav
                    aria-label="Main navigation"
                    className="flex-1 flex flex-col gap-0.5 p-2">
                    {NAV.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`font-pulse text-[0.8125rem] text-left py-2 px-3.5 rounded-[3px] border-none border-l-2 cursor-pointer tracking-[0.02em] w-full ${
                                view === id
                                    ? 'font-bold text-white bg-[#1a1a1a] border-pulse-accent'
                                    : 'font-normal text-pulse-dim bg-transparent border-transparent'
                            }`}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Utilities */}
                <div className="py-3 px-2 border-t border-pulse-border flex flex-col gap-0.5">
                    <button
                        onClick={handleExport}
                        className="font-pulse text-xs text-[#444] bg-transparent border-none border-l-2 border-transparent text-left py-2 px-3.5 cursor-pointer tracking-[0.02em] w-full">
                        Export
                    </button>
                    <form action={logout} className="block">
                        <button
                            type="submit"
                            className="font-pulse text-xs text-[#444] bg-transparent border-none border-l-2 border-transparent text-left py-2 px-3.5 cursor-pointer tracking-[0.02em] w-full">
                            Sign out
                        </button>
                    </form>
                </div>
            </aside>

            {/* Content */}
            <main className={`flex-1 flex flex-col overflow-hidden ${view !== 'log' ? 'overflow-auto' : ''}`}>
                {saveError && (
                    <div
                        role="alert"
                        className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.6875rem] tracking-[0.04em] text-center shrink-0">
                        {saveError}
                    </div>
                )}
                <div className={`flex-1 ${view === 'log' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
                    {view === 'log'     && <LogViewDesktop />}
                    {view === 'program' && <ProgramView />}
                    {view === 'history' && <HistoryView />}
                    {view === 'profile' && <ProfileView />}
                </div>
            </main>
        </div>
    );
}
```

- [ ] **Step 4: Run tests**

```powershell
bun run test:run -- DesktopLayout
```

Expected: 7 passing. Adjust mock setup if tests fail due to context spread issues.

- [ ] **Step 5: Run full suite**

```powershell
bun run test:run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pulse/DesktopLayout.tsx src/components/pulse/__tests__/DesktopLayout.test.tsx
git commit -m "feat(pulse): add DesktopLayout sidebar shell"
```

---

## Task 10: Wire `AppShell` — replace hamburger with `BottomNav` + desktop gate

**Files:**
- Modify: `src/components/pulse/AppShell.tsx`

This is the most impactful structural change. The hamburger menu, dropdown, and desktop inline nav are all removed. `useMediaQuery` gates between `DesktopLayout` and the new simplified mobile layout.

- [ ] **Step 1: Replace `AppShell.tsx`**

Replace the full contents of `src/components/pulse/AppShell.tsx`:

```tsx
'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import LogView from './views/LogView';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import BottomNav from './BottomNav';

export function AppShell() {
    const { activeWeek, streak, view, navigate, handleExport, saveError } = usePulse();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    if (isDesktop) {
        return <DesktopLayout />;
    }

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text pb-16">
            {/* Simplified topbar — no hamburger, navigation handled by BottomNav */}
            <div className="sticky top-0 z-10 bg-pulse-bg border-b border-pulse-border h-[52px] flex items-center gap-3 px-4">
                <span className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] text-white uppercase shrink-0">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <span className="font-pulse text-[0.6875rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 py-1 px-2.5 rounded-full tracking-[0.04em] shrink-0">
                    WK {String(activeWeek).padStart(2, '0')}
                </span>
                {streak > 0 && (
                    <span className="font-pulse text-xs text-pulse-dim tracking-[0.04em] shrink-0">
                        {streak}WK
                    </span>
                )}
                <div className="ml-auto flex gap-3 items-center">
                    <button
                        onClick={handleExport}
                        aria-label="Export workout logs as JSON"
                        className="font-pulse text-xs text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em]">
                        Export
                    </button>
                    <form action={logout} className="inline">
                        <button
                            type="submit"
                            aria-label="Sign out of Pulse"
                            className="font-pulse text-xs text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em]">
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {saveError && (
                <div
                    role="alert"
                    className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.6875rem] tracking-[0.04em] text-center">
                    {saveError}
                </div>
            )}

            {view === 'log'     && <LogView />}
            {view === 'program' && <ProgramView />}
            {view === 'history' && <HistoryView />}
            {view === 'profile' && <ProfileView />}

            <BottomNav view={view} onNavigate={navigate} />
        </div>
    );
}
```

- [ ] **Step 2: Run typecheck**

```powershell
bun run typecheck
```

Fix any TypeScript errors.

- [ ] **Step 3: Run full suite**

```powershell
bun run test:run
```

Expected: all passing. Any existing AppShell tests that check for hamburger/dropdown need to be updated to reflect the new simplified topbar.

Read `src/components/pulse/__tests__/` to check if there is an `AppShell.test.tsx`. If tests exist for AppShell, update them to match the new structure.

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/AppShell.tsx
git commit -m "feat(pulse): replace hamburger with BottomNav, add useMediaQuery desktop gate in AppShell"
```

---

## Task 11: History responsive grid + Profile two-column layout

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`

Both changes use Tailwind responsive classes — no globals.css changes needed.

- [ ] **Step 1: Update `HistoryView.tsx`**

Open `src/components/pulse/views/HistoryView.tsx`. Find the outer container div in the non-empty return (currently `className="p-4 max-w-[600px] mx-auto flex flex-col gap-2"`). Add `lg:grid lg:grid-cols-2 lg:max-w-[1100px] lg:items-start`:

```tsx
<div className="p-4 max-w-[600px] mx-auto flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:max-w-[1100px] lg:items-start">
```

- [ ] **Step 2: Update `ProfileView.tsx`**

Open `src/components/pulse/views/ProfileView.tsx`. The outer wrapper currently has `className="pt-5 px-4 pb-12 max-w-[480px] mx-auto flex flex-col gap-7"`. Update it to add desktop flex-row:

```tsx
<div className="pt-5 px-4 pb-12 max-w-[480px] mx-auto flex flex-col gap-7 lg:flex-row lg:max-w-[860px] lg:pt-6 lg:px-6 lg:pb-12 lg:gap-10">
```

Then wrap the **Identity** and **Unit toggle** sections in a `<div>` for the left column:

```tsx
<div className="flex flex-col gap-7 lg:w-[280px] lg:shrink-0">
    {/* Identity */}
    ...
    {/* Unit toggle */}
    ...
</div>
```

And wrap the **Body weight** section in a `<div>` for the right column:

```tsx
<div className="lg:flex-1 lg:min-w-0">
    {/* Body weight */}
    ...
</div>
```

- [ ] **Step 3: Run full test suite**

```powershell
bun run test:run
```

Expected: all passing (content unchanged, only wrapping divs added).

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/views/HistoryView.tsx src/components/pulse/views/ProfileView.tsx
git commit -m "feat(pulse): 2-column history grid and side-by-side profile layout on desktop"
```

---

## Task 12: Final polish — typecheck, lint, format

- [ ] **Step 1: Run typecheck**

```powershell
bun run typecheck
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Run lint**

```powershell
bun run lint
```

Fix any ESLint warnings (pre-existing `react-hooks/exhaustive-deps` warning in `SetLogger.tsx` is acceptable).

- [ ] **Step 3: Run formatter**

```powershell
bun run format
```

- [ ] **Step 4: Run full test suite one final time**

```powershell
bun run test:run
```

Expected: all tests passing.

- [ ] **Step 5: Commit any formatting changes**

```powershell
git add -u
git commit -m "chore(pulse): typecheck, lint, format after redesign"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task | Covered? |
|---|---|---|
| Bottom tab bar — mobile nav replacing hamburger | T2, T10 | ✅ |
| Simplified mobile topbar (brand + week pill + export/sign-out) | T10 | ✅ |
| Desktop sidebar (180px) with brand, week, streak, nav, export, sign-out | T9 | ✅ |
| Sidebar nav active state (left border + highlight) | T9 | ✅ |
| `useMediaQuery` hook, breakpoint ≥1024px | T1, T10 | ✅ |
| Two-pane desktop Log view: exercise list (300px) + detail pane | T8 | ✅ |
| Auto-open last-used exercise (localStorage `pulse_last_ex`) | T8 | ✅ |
| Rest timer pinned at bottom of detail pane | T7 | ✅ |
| Dot progress indicators replacing `█░` in `ExerciseCard` | T4 | ✅ |
| 2px progress bar under open `ExerciseCard` header | T4 | ✅ |
| Green border on completed `ExerciseCard` | T4 | ✅ |
| Taller inputs (`h-10`) + solid-orange Save button in `SetLogger` | T5 | ✅ |
| Green tint (`bg-[#0e1510]`) on saved set rows, opacity removed | T5 | ✅ |
| Per-tab exercise-completion summary in `WorkoutTabs` | T3 | ✅ |
| Mobile layout unchanged below 1024px | T10 (conditional render) | ✅ |
| History 2-column grid on desktop (`lg:grid-cols-2`) | T11 | ✅ |
| Profile side-by-side on desktop (`lg:flex-row`) | T11 | ✅ |
| All styling in Tailwind — no new inline styles for static values | All tasks | ✅ |

**Context consistency:** All container components (`AppShell`, `DesktopLayout`, `LogViewDesktop`) call `usePulse()` directly — no prop drilling. Leaf components (`ExerciseListItem`, `ExerciseDetailPane`, `BottomNav`) take explicit props for isolated testability. `WorkoutTabs` adds `logs` and `week` props; callers (`LogView`, `LogViewDesktop`) pass them from context.

**No placeholders. No broken imports.**
