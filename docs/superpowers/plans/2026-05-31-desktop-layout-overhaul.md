# Desktop Layout Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal top-nav bar in the desktop layout with a proper two-column sidebar layout — fixed left sidebar with nav + context card, scrollable content column, rest timer pinned to the bottom of the content column.

**Architecture:** `DesktopLayout.tsx` is fully rewritten as a `flex h-screen` two-column layout. The sidebar (180px) holds logo, nav links, streak, a context card (active routine name + week), and sign out. The content column (`flex-1 flex-col`) holds `<main>` (scrollable) and `<RestTimer>` (sticky bottom strip). `AppShell.tsx` is unchanged — the RestTimer it renders is already mobile-only (after the `if (isDesktop) return` early exit). No view components change.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Vitest + Testing Library

---

## Files

| Action | Path |
|---|---|
| Modify | `src/components/pulse/DesktopLayout.tsx` |
| Modify | `src/components/pulse/__tests__/DesktopLayout.test.tsx` |

---

## Task 1: Update the tests (TDD first)

**Files:**
- Modify: `src/components/pulse/__tests__/DesktopLayout.test.tsx`

- [ ] **Step 1: Add a mock routine and replace the test file**

Replace the entire contents of `src/components/pulse/__tests__/DesktopLayout.test.tsx` with:

```tsx
import { vi } from 'vitest';

const mockRoutine = {
    id: 'r1',
    user_id: 'u1',
    name: 'PPL',
    created_at: '2026-01-01',
    exercises: [],
    schedule: [],
};

const mockContext = {
    navigate: vi.fn(),
    activeWeek: 3,
    streak: 2,
    handleExport: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    activeDay: null as number | null,
    setActiveDay: vi.fn(),
    activeSchedule: [],
    setActiveWeek: vi.fn(),
    logs: {},
    profile: { unit: 'kg' as const, display_name: null, active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
    prMap: {},
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    timerDuration: null,
    fireTrigger: vi.fn(),
    bodyweightLogs: [],
    email: 'test@example.com',
    updateProfile: vi.fn(),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn(),
    isLoading: false,
    exercises: [],
    routines: [],
    activeRoutine: null,
    routineExercisesByType: { push: [], pull: [], legs: [], chest: [], back: [], shoulders: [], arms: [] },
    routineExercisesByTabKey: {},
    createRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
    setActiveRoutine: vi.fn(),
    addExerciseToRoutine: vi.fn(),
    removeExerciseFromRoutine: vi.fn(),
    updateRoutineExercise: vi.fn(),
    reorderRoutineExercises: vi.fn(),
    cloneTemplate: vi.fn(),
    completeOnboarding: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
    showOnboarding: false,
    triggerOnboarding: vi.fn(),
    dismissOnboarding: vi.fn(),
    notes: {},
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({ ...mockContext })),
}));

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';
import type { View } from '@/lib/pulse/types';

const defaultProps = {
    view: 'train' as View,
    navigate: vi.fn(),
    children: <div />,
};

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/pulse/i)).toBeInTheDocument();
    });

    it('renders all five nav items', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByRole('button', { name: /^train$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^plan$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^progress$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^explore$/i })).toBeInTheDocument();
    });

    it('calls navigate when a nav item is clicked', async () => {
        const navigate = vi.fn();
        render(<DesktopLayout {...defaultProps} navigate={navigate} />);
        await userEvent.click(screen.getByRole('button', { name: /^progress$/i }));
        expect(navigate).toHaveBeenCalledWith('progress');
    });

    it('shows the active week padded to 2 digits', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('WK 03')).toBeInTheDocument();
    });

    it('shows streak when streak > 0', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/2WK/)).toBeInTheDocument();
    });

    it('does not render a save error banner (errors shown via toast)', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not render an Export button', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    it('shows active routine name in context card', async () => {
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...mockContext, activeRoutine: mockRoutine });
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('PPL')).toBeInTheDocument();
    });

    it('shows "No routine" in context card when no active routine', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/no routine/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests — verify which pass/fail**

```bash
npx vitest run --reporter=verbose src/components/pulse/__tests__/DesktopLayout.test.tsx
```

Expected: the two new tests (`shows active routine name`, `shows "No routine"`) **FAIL** and the Export test is gone. The five original tests should still pass (they test things that still exist).

---

## Task 2: Rewrite DesktopLayout

**Files:**
- Modify: `src/components/pulse/DesktopLayout.tsx`

- [ ] **Step 1: Replace the entire file**

Replace the entire contents of `src/components/pulse/DesktopLayout.tsx` with:

```tsx
'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import OnboardingModal from './OnboardingModal';
import RestTimer from './RestTimer';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'train', label: 'Train' },
    { id: 'plan', label: 'Plan' },
    { id: 'progress', label: 'Progress' },
    { id: 'profile', label: 'Profile' },
    { id: 'explore', label: 'Explore' },
];

interface Props {
    view: View;
    navigate: (v: View) => void;
    children: React.ReactNode;
}

export default function DesktopLayout({ view, navigate, children }: Props) {
    const { activeWeek, streak, activeRoutine, timerTrigger, timerDuration, showOnboarding } = usePulse();

    return (
        <div className="flex h-screen bg-pulse-bg text-pulse-text overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[180px] border-r border-pulse-border bg-pulse-bg flex flex-col shrink-0 py-5 px-3">
                {/* Logo + week badge */}
                <div className="flex items-center gap-2 px-2 mb-6">
                    <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <span className="font-pulse text-[0.625rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 py-[3px] px-2 rounded-full tracking-[0.05em]">
                        WK {String(activeWeek).padStart(2, '0')}
                    </span>
                </div>

                {/* Nav links */}
                <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
                    {NAV.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`font-pulse text-[0.875rem] font-semibold text-left px-3 py-2 rounded-lg border-none cursor-pointer transition-all duration-150 ${
                                view === id
                                    ? 'bg-pulse-accent/10 text-pulse-accent'
                                    : 'bg-transparent text-pulse-dim hover:text-pulse-text hover:bg-white/5'
                            }`}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Streak */}
                {streak > 0 && (
                    <div className="px-3 mb-2">
                        <span className="font-pulse text-xs text-pulse-dim">{streak}WK</span>
                    </div>
                )}

                {/* Context card */}
                <div className="bg-pulse-surface border border-pulse-border rounded-xl p-3 mb-3">
                    {activeRoutine ? (
                        <>
                            <div className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted mb-1">
                                Active Routine
                            </div>
                            <div className="font-pulse text-[0.8125rem] text-pulse-text font-medium leading-snug">
                                {activeRoutine.name}
                            </div>
                        </>
                    ) : (
                        <div className="font-pulse text-[0.75rem] text-pulse-muted">No routine</div>
                    )}
                </div>

                {/* Sign out */}
                <form action={logout} className="px-1">
                    <button
                        type="submit"
                        aria-label="Sign out of Pulse"
                        className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-text transition-colors w-full text-left px-2 py-1">
                        Sign out
                    </button>
                </form>
            </aside>

            {/* Content column */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
                <div className="border-t border-pulse-border">
                    <RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
                </div>
            </div>

            {showOnboarding && <OnboardingModal />}
        </div>
    );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run --reporter=verbose src/components/pulse/__tests__/DesktopLayout.test.tsx
```

Expected: all 9 tests **PASS**.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/DesktopLayout.tsx src/components/pulse/__tests__/DesktopLayout.test.tsx
git commit -m "feat(desktop): replace top-nav bar with sidebar layout"
```
