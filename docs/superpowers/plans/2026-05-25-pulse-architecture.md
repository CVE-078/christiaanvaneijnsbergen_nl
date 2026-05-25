# Pulse Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `weight-tracker` → `pulse` everywhere, introduce SWR-backed data hooks, React Context, and custom hooks to replace the monolithic `TrackerClient` state blob.

**Architecture:** All data now flows from a `PulseProvider` that composes five purpose-built hooks and exposes everything via `PulseContext`. Server component fetches seed SWR with `fallbackData` for zero-flash mounts; mutations call existing server actions then update the SWR cache optimistically. `TrackerClient` shrinks to a thin shell (~30 lines) wrapping `PulseProvider` and rendering `AppShell`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, SWR v2, Supabase, Vitest + Testing Library

---

## File Map

| Action | Path |
|--------|------|
| **Rename** | `src/lib/weight-tracker/` → `src/lib/pulse/` |
| **Rename** | `src/components/weight-tracker/` → `src/components/pulse/` |
| **Modify** | `src/lib/pulse/types.ts` — add `View` + `PRMap` types |
| **Modify** | `src/app/pulse/actions.ts` — update import paths |
| **Modify** | `src/app/pulse/page.tsx` — update import paths |
| **Create** | `src/context/PulseContext.ts` |
| **Create** | `src/hooks/pulse/useLocalStorage.ts` |
| **Create** | `src/hooks/pulse/useUIState.ts` |
| **Create** | `src/hooks/pulse/useRestTimer.ts` |
| **Create** | `src/hooks/pulse/useWorkoutLogs.ts` |
| **Create** | `src/hooks/pulse/useProfile.ts` |
| **Create** | `src/hooks/pulse/__tests__/useLocalStorage.test.ts` |
| **Create** | `src/hooks/pulse/__tests__/useUIState.test.ts` |
| **Create** | `src/hooks/pulse/__tests__/useRestTimer.test.ts` |
| **Create** | `src/hooks/pulse/__tests__/useWorkoutLogs.test.ts` |
| **Create** | `src/hooks/pulse/__tests__/useProfile.test.ts` |
| **Create** | `src/app/api/pulse/logs/route.ts` |
| **Create** | `src/app/api/pulse/profile/route.ts` |
| **Create** | `src/app/api/pulse/bodyweight/route.ts` |
| **Create** | `src/components/pulse/PulseProvider.tsx` |
| **Create** | `src/components/pulse/AppShell.tsx` |
| **Create** | `src/components/pulse/__tests__/test-utils.tsx` |
| **Modify** | `src/components/pulse/TrackerClient.tsx` — slim to ~30 lines |
| **Modify** | `src/components/pulse/RestTimer.tsx` — rename localStorage key |
| **Modify** | `src/components/pulse/views/LogView.tsx` — use `usePulse()` |
| **Modify** | `src/components/pulse/views/HistoryView.tsx` — use `usePulse()` |
| **Modify** | `src/components/pulse/views/ProfileView.tsx` — use `usePulse()` |
| **Modify** | `src/components/pulse/views/ProgramView.tsx` — use `usePulse()` |
| **Modify** | `src/components/pulse/__tests__/LogView.test.tsx` — use mock context |
| **Modify** | `src/components/pulse/__tests__/ProfileView.test.tsx` — use mock context |

---

## Task 1: Install SWR + rename lib/pulse

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/app/pulse/actions.ts`
- Modify: `src/app/pulse/page.tsx`
- Delete: `src/lib/weight-tracker/` (entire directory)

- [ ] **Step 1: Install SWR**

```bash
npm install swr
```

Expected output: `added 1 package` (SWR has no sub-dependencies)

- [ ] **Step 2: Copy the lib directory**

```powershell
Copy-Item -Recurse src\lib\weight-tracker src\lib\pulse
```

- [ ] **Step 3: Add `View` and `PRMap` types to `src/lib/pulse/types.ts`**

Open `src/lib/pulse/types.ts` and append these two types at the end of the file:

```typescript
export type View = 'log' | 'program' | 'history' | 'profile';

// Maps exercise key (workoutType-exIdx) to best E1RM value
export type PRMap = Record<string, number>;
```

Final `src/lib/pulse/types.ts`:

```typescript
export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
}

export type Logs = Record<string, LogEntry>;

export type WorkoutType = 'push' | 'pull' | 'legs';

export type Unit = 'kg' | 'lbs';

export interface Profile {
    display_name: string | null;
    unit: Unit;
}

export interface BodyweightEntry {
    id: string;
    logged_at: string; // YYYY-MM-DD
    weight_kg: number;
}

export interface Phase {
    weeks: number[];
    label: string;
    subtitle: string;
    rir: number[];
    color: string;
}

export interface Exercise {
    name: string;
    sets: string;
    reps: string;
    load: string;
    note: string;
}

export interface Workout {
    label: string;
    icon: string;
    color: string;
    description: string;
    exercises: Exercise[];
}

export interface VolumeEntry {
    week: number;
    sets: number;
}

export interface ScheduleDay {
    day: string;
    type: WorkoutType | 'rest';
}

export interface HistorySession {
    week: number;
    type: WorkoutType;
    sets: Array<LogEntry & { exIdx: number; setIdx: number }>;
}

export type View = 'log' | 'program' | 'history' | 'profile';

// Maps exercise key (workoutType-exIdx) to best E1RM value
export type PRMap = Record<string, number>;
```

- [ ] **Step 4: Update `src/app/pulse/actions.ts` imports**

Change the two import lines at the top:

```typescript
// Before
import { validateLogs } from '@/lib/weight-tracker/validation';
import type { Logs, Unit, BodyweightEntry } from '@/lib/weight-tracker/types';

// After
import { validateLogs } from '@/lib/pulse/validation';
import type { Logs, Unit, BodyweightEntry } from '@/lib/pulse/types';
```

- [ ] **Step 5: Update `src/app/pulse/page.tsx` imports**

```typescript
// Before
import { validateLogs } from '@/lib/weight-tracker/validation';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs, Profile, BodyweightEntry } from '@/lib/weight-tracker/types';

// After
import { validateLogs } from '@/lib/pulse/validation';
import TrackerClient from '@/components/pulse/TrackerClient';
import type { Logs, Profile, BodyweightEntry } from '@/lib/pulse/types';
```

Note: The `TrackerClient` import path changes here but Task 2 handles creating the `components/pulse/` directory. Update this import now so that after Task 2 completes, both work together.

- [ ] **Step 6: Run existing tests to confirm lib works**

```bash
npm test -- --run src/lib
```

Expected: all `src/lib/pulse/__tests__/utils.test.ts` tests PASS (the file was copied from weight-tracker, but imports inside it use `../utils` which resolves correctly within the new directory).

- [ ] **Step 7: Delete old lib directory**

```powershell
Remove-Item -Recurse -Force src\lib\weight-tracker
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(pulse): install SWR, rename lib/weight-tracker to lib/pulse, add View + PRMap types"
```

---

## Task 2: Rename components/pulse

**Files:**
- Create: `src/components/pulse/` (from `src/components/weight-tracker/`)
- Delete: `src/components/weight-tracker/`

All component files import from `@/lib/weight-tracker/...`. These imports must change to `@/lib/pulse/...`. Internal relative imports (`../WorkoutTabs`, `./views/LogView`) are unchanged.

- [ ] **Step 1: Copy the components directory**

```powershell
Copy-Item -Recurse src\components\weight-tracker src\components\pulse
```

- [ ] **Step 2: Update all `@/lib/weight-tracker` references in the copied files**

Run this PowerShell command to do the bulk replace across all files in `src/components/pulse/`:

```powershell
Get-ChildItem -Recurse -Path src\components\pulse -Include *.tsx,*.ts |
  ForEach-Object {
    (Get-Content $_.FullName) -replace '@/lib/weight-tracker/', '@/lib/pulse/' |
    Set-Content $_.FullName
  }
```

- [ ] **Step 3: Run all tests to verify the rename**

```bash
npm test -- --run
```

Expected: ALL tests PASS. If any fail, check the import paths in the failing file — the bulk replace may have missed an edge case.

- [ ] **Step 4: Delete old components directory**

```powershell
Remove-Item -Recurse -Force src\components\weight-tracker
```

- [ ] **Step 5: Run tests once more to confirm clean state**

```bash
npm test -- --run
```

Expected: ALL tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(pulse): rename components/weight-tracker to components/pulse"
```

---

## Task 3: PulseContext + useLocalStorage

**Files:**
- Create: `src/context/PulseContext.ts`
- Create: `src/hooks/pulse/useLocalStorage.ts`
- Create: `src/hooks/pulse/__tests__/useLocalStorage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useLocalStorage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

beforeEach(() => {
    localStorage.clear();
});

describe('useLocalStorage', () => {
    it('returns the default value when localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 42));
        expect(result.current[0]).toBe(42);
    });

    it('persists the updated value to localStorage', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 0));
        act(() => result.current[1](99));
        expect(localStorage.getItem('test-key')).toBe('99');
    });

    it('reads an existing value from localStorage', () => {
        localStorage.setItem('test-key', '123');
        const { result } = renderHook(() => useLocalStorage('test-key', 0));
        expect(result.current[0]).toBe(123);
    });

    it('returns the default when localStorage contains invalid JSON', () => {
        localStorage.setItem('test-key', 'not-json{{{');
        const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --run src/hooks/pulse/__tests__/useLocalStorage.test.ts
```

Expected: FAIL — `Cannot find module '../useLocalStorage'`

- [ ] **Step 3: Create `src/hooks/pulse/useLocalStorage.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const stored = localStorage.getItem(key);
            return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // localStorage unavailable (private browsing quota exceeded, etc.)
        }
    }, [key, value]);

    return [value, setValue];
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --run src/hooks/pulse/__tests__/useLocalStorage.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Create `src/context/PulseContext.ts`**

This file defines the context shape and the `usePulse()` consumer hook. No test needed — it's a typed context with a guard; the guard is exercised by all component tests in Task 10.

```typescript
import { createContext, useContext } from 'react';
import type { Logs, Profile, BodyweightEntry, WorkoutType, Unit, LogEntry, View, PRMap } from '@/lib/pulse/types';

export interface PulseContextValue {
    // Data
    logs: Logs;
    profile: Profile;
    bodyweightLogs: BodyweightEntry[];
    isLoading: boolean;
    saveError: string | null;

    // Computed (memoized in PulseProvider)
    streak: number;
    prMap: PRMap;

    // Auth
    email: string;

    // Log mutations
    updateLog: (key: string, entry: LogEntry) => void;
    deleteLog: (key: string) => void;
    handleExport: () => void;

    // Profile mutations
    updateProfile: (displayName: string | null, unit: Unit) => Promise<void>;
    logBodyWeight: (weightKg: number) => Promise<BodyweightEntry>;
    deleteBodyWeight: (id: string) => Promise<void>;

    // UI state
    view: View;
    navigate: (view: View) => void;
    activeWeek: number;
    setActiveWeek: (week: number) => void;
    activeTab: WorkoutType;
    setActiveTab: (tab: WorkoutType) => void;

    // Rest timer
    timerTrigger: number;
    fireTrigger: () => void;
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/context/PulseContext.ts src/hooks/pulse/useLocalStorage.ts src/hooks/pulse/__tests__/useLocalStorage.test.ts
git commit -m "feat(pulse): add PulseContext and useLocalStorage hook"
```

---

## Task 4: useUIState

**Files:**
- Create: `src/hooks/pulse/useUIState.ts`
- Create: `src/hooks/pulse/__tests__/useUIState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useUIState.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIState } from '../useUIState';

beforeEach(() => {
    localStorage.clear();
});

describe('useUIState', () => {
    it('starts on the log view', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.view).toBe('log');
    });

    it('navigate changes the view', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.navigate('profile'));
        expect(result.current.view).toBe('profile');
    });

    it('activeWeek defaults to 1', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(1);
    });

    it('setActiveWeek updates activeWeek and persists to localStorage', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.setActiveWeek(7));
        expect(result.current.activeWeek).toBe(7);
        expect(localStorage.getItem('pulse_week')).toBe('7');
    });

    it('restores activeWeek from localStorage on mount', () => {
        localStorage.setItem('pulse_week', '5');
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(5);
    });

    it('activeWeek from localStorage is clamped to 1–12 range', () => {
        localStorage.setItem('pulse_week', '99');
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(1);
    });

    it('activeTab defaults to push', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeTab).toBe('push');
    });

    it('setActiveTab updates the active tab', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.setActiveTab('legs'));
        expect(result.current.activeTab).toBe('legs');
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --run src/hooks/pulse/__tests__/useUIState.test.ts
```

Expected: FAIL — `Cannot find module '../useUIState'`

- [ ] **Step 3: Create `src/hooks/pulse/useUIState.ts`**

```typescript
import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { View, WorkoutType } from '@/lib/pulse/types';

function clampWeek(raw: number): number {
    return raw >= 1 && raw <= 12 ? raw : 1;
}

export function useUIState() {
    const [view, setView] = useState<View>('log');
    const [rawWeek, setRawWeek] = useLocalStorage<number>('pulse_week', 1);
    const activeWeek = clampWeek(rawWeek);
    const [activeTab, setActiveTab] = useState<WorkoutType>('push');

    function navigate(v: View) {
        setView(v);
    }

    function setActiveWeek(week: number) {
        setRawWeek(week);
    }

    return { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --run src/hooks/pulse/__tests__/useUIState.test.ts
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useUIState.ts src/hooks/pulse/__tests__/useUIState.test.ts
git commit -m "feat(pulse): add useUIState hook"
```

---

## Task 5: useRestTimer

**Files:**
- Create: `src/hooks/pulse/useRestTimer.ts`
- Create: `src/hooks/pulse/__tests__/useRestTimer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useRestTimer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from '../useRestTimer';

describe('useRestTimer', () => {
    it('timerTrigger starts at 0', () => {
        const { result } = renderHook(() => useRestTimer());
        expect(result.current.timerTrigger).toBe(0);
    });

    it('fireTrigger increments timerTrigger by 1', () => {
        const { result } = renderHook(() => useRestTimer());
        act(() => result.current.fireTrigger());
        expect(result.current.timerTrigger).toBe(1);
    });

    it('fireTrigger increments on repeated calls', () => {
        const { result } = renderHook(() => useRestTimer());
        act(() => result.current.fireTrigger());
        act(() => result.current.fireTrigger());
        act(() => result.current.fireTrigger());
        expect(result.current.timerTrigger).toBe(3);
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --run src/hooks/pulse/__tests__/useRestTimer.test.ts
```

Expected: FAIL — `Cannot find module '../useRestTimer'`

- [ ] **Step 3: Create `src/hooks/pulse/useRestTimer.ts`**

```typescript
import { useState } from 'react';

export function useRestTimer() {
    const [timerTrigger, setTimerTrigger] = useState(0);

    function fireTrigger() {
        setTimerTrigger((t) => t + 1);
    }

    return { timerTrigger, fireTrigger };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --run src/hooks/pulse/__tests__/useRestTimer.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useRestTimer.ts src/hooks/pulse/__tests__/useRestTimer.test.ts
git commit -m "feat(pulse): add useRestTimer hook"
```

---

## Task 6: API Routes

**Files:**
- Create: `src/app/api/pulse/logs/route.ts`
- Create: `src/app/api/pulse/profile/route.ts`
- Create: `src/app/api/pulse/bodyweight/route.ts`

These routes are read-only GET endpoints that mirror the queries in `src/app/pulse/page.tsx`. They exist so SWR can revalidate client-side data without a full page reload. All routes are auth-gated via the Supabase session cookie.

Unit testing Next.js route handlers requires a full server mock (not worth the complexity here). Instead, after implementing each route, manually verify: deploy to preview, log in, and hit the route in the browser — it should return JSON.

- [ ] **Step 1: Create `src/app/api/pulse/logs/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import type { Logs } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data, error } = await supabase
        .from('set_logs')
        .select('week, workout_type, ex_idx, set_idx, kg, reps, rir, saved')
        .eq('user_id', user.id);

    if (error) return NextResponse.json(null, { status: 500 });

    const raw: Record<string, unknown> = {};
    for (const row of data ?? []) {
        raw[`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`] = {
            kg: Number(row.kg),
            reps: row.reps,
            rir: row.rir,
            saved: row.saved,
        };
    }

    const logs: Logs = validateLogs(raw) ? (raw as Logs) : {};
    return NextResponse.json(logs);
}
```

- [ ] **Step 2: Create `src/app/api/pulse/profile/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('profiles')
        .select('display_name, unit')
        .eq('id', user.id)
        .single();

    const profile: Profile = {
        display_name: data?.display_name ?? null,
        unit: data?.unit === 'lbs' ? 'lbs' : 'kg',
    };

    return NextResponse.json(profile);
}
```

- [ ] **Step 3: Create `src/app/api/pulse/bodyweight/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BodyweightEntry } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('bodyweight_logs')
        .select('id, logged_at, weight_kg')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(90);

    const entries: BodyweightEntry[] = (data ?? []).map(
        (r: { id: string; logged_at: string; weight_kg: number }) => ({
            id: r.id,
            logged_at: r.logged_at,
            weight_kg: Number(r.weight_kg),
        }),
    );

    return NextResponse.json(entries);
}
```

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
npm test -- --run
```

Expected: ALL existing tests PASS (routes are not unit tested here).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pulse/
git commit -m "feat(pulse): add read-only API routes for SWR data fetching"
```

---

## Task 7: useWorkoutLogs

**Files:**
- Create: `src/hooks/pulse/useWorkoutLogs.ts`
- Create: `src/hooks/pulse/__tests__/useWorkoutLogs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useWorkoutLogs.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    saveLogs: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { saveLogs } from '@/app/pulse/actions';
import { useWorkoutLogs } from '../useWorkoutLogs';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const mockMutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: {}, mutate: mockMutate } as ReturnType<typeof useSWR>);
    mockMutate.mockClear();
    vi.mocked(saveLogs).mockClear();
});

describe('useWorkoutLogs', () => {
    it('returns logs from SWR data', () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs({}));
        expect(result.current.logs).toEqual(logs);
    });

    it('falls back to initialLogs when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const initialLogs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        const { result } = renderHook(() => useWorkoutLogs(initialLogs));
        expect(result.current.logs).toEqual(initialLogs);
    });

    it('updateLog calls mutate optimistically then calls saveLogs', async () => {
        const { result } = renderHook(() => useWorkoutLogs({}));
        const entry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };

        await act(async () => {
            result.current.updateLog('1-push-0-0', entry);
        });

        expect(mockMutate).toHaveBeenCalledWith({ '1-push-0-0': entry }, false);
        expect(saveLogs).toHaveBeenCalledWith({ '1-push-0-0': entry });
    });

    it('deleteLog removes the key, calls mutate optimistically then saveLogs', async () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs(logs));

        await act(async () => {
            result.current.deleteLog('1-push-0-0');
        });

        expect(mockMutate).toHaveBeenCalledWith({}, false);
        expect(saveLogs).toHaveBeenCalledWith({});
    });

    it('sets saveError to retry message when saveLogs throws', async () => {
        vi.mocked(saveLogs).mockRejectedValueOnce(new Error('Network error'));
        const { result } = renderHook(() => useWorkoutLogs({}));

        await act(async () => {
            result.current.updateLog('1-push-0-0', { kg: 80, reps: 8, rir: 2, saved: true });
        });

        expect(result.current.saveError).toBe('Failed to save. Retrying…');
    });

    it('saveError starts as null', () => {
        const { result } = renderHook(() => useWorkoutLogs({}));
        expect(result.current.saveError).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --run src/hooks/pulse/__tests__/useWorkoutLogs.test.ts
```

Expected: FAIL — `Cannot find module '../useWorkoutLogs'`

- [ ] **Step 3: Create `src/hooks/pulse/useWorkoutLogs.ts`**

```typescript
import useSWR from 'swr';
import { useCallback, useRef, useState, useEffect } from 'react';
import { saveLogs } from '@/app/pulse/actions';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const LOGS_KEY = '/api/pulse/logs';

async function fetchLogs(url: string): Promise<Logs> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json() as Promise<Logs>;
}

export function useWorkoutLogs(initialLogs: Logs) {
    const { data, mutate } = useSWR<Logs>(LOGS_KEY, fetchLogs, {
        fallbackData: initialLogs,
        revalidateOnFocus: false,
    });
    const logs = data ?? initialLogs;

    const [saveError, setSaveError] = useState<string | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const persist = useCallback(
        (newLogs: Logs) => {
            mutate(newLogs, false);
            setSaveError(null);
            if (retryRef.current) clearTimeout(retryRef.current);

            saveLogs(newLogs).catch(() => {
                setSaveError('Failed to save. Retrying…');
                retryRef.current = setTimeout(
                    () =>
                        saveLogs(newLogs).catch(() =>
                            setSaveError('Save failed. Check your connection.'),
                        ),
                    3000,
                );
            });
        },
        [mutate],
    );

    const updateLog = useCallback(
        (key: string, entry: LogEntry) => {
            persist({ ...logs, [key]: entry });
        },
        [logs, persist],
    );

    const deleteLog = useCallback(
        (key: string) => {
            const newLogs = { ...logs };
            delete newLogs[key];
            persist(newLogs);
        },
        [logs, persist],
    );

    function handleExport() {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulse-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { logs, saveError, updateLog, deleteLog, handleExport };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --run src/hooks/pulse/__tests__/useWorkoutLogs.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useWorkoutLogs.ts src/hooks/pulse/__tests__/useWorkoutLogs.test.ts
git commit -m "feat(pulse): add useWorkoutLogs hook with SWR + optimistic mutations"
```

---

## Task 8: useProfile

**Files:**
- Create: `src/hooks/pulse/useProfile.ts`
- Create: `src/hooks/pulse/__tests__/useProfile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useProfile.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { updateProfile, logBodyWeight, deleteBodyWeight } from '@/app/pulse/actions';
import { useProfile } from '../useProfile';
import type { Profile, BodyweightEntry } from '@/lib/pulse/types';

const defaultProfile: Profile = { display_name: 'Test User', unit: 'kg' };
const defaultBWLogs: BodyweightEntry[] = [];

const profileMutate = vi.fn();
const bwMutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR)
        .mockReturnValueOnce({ data: defaultProfile, mutate: profileMutate } as ReturnType<typeof useSWR>)
        .mockReturnValueOnce({ data: defaultBWLogs, mutate: bwMutate } as ReturnType<typeof useSWR>);
    profileMutate.mockClear();
    bwMutate.mockClear();
    vi.mocked(updateProfile).mockClear();
    vi.mocked(deleteBodyWeight).mockClear();
});

describe('useProfile', () => {
    it('returns profile from SWR data', () => {
        const { result } = renderHook(() => useProfile(defaultProfile, defaultBWLogs));
        expect(result.current.profile).toEqual(defaultProfile);
    });

    it('falls back to initialProfile when SWR data is undefined', () => {
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: undefined, mutate: profileMutate } as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: [], mutate: bwMutate } as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useProfile(defaultProfile, defaultBWLogs));
        expect(result.current.profile).toEqual(defaultProfile);
    });

    it('updateProfile calls mutate optimistically and calls the server action', async () => {
        const { result } = renderHook(() => useProfile(defaultProfile, defaultBWLogs));

        await act(async () => {
            await result.current.updateProfile('New Name', 'lbs');
        });

        expect(profileMutate).toHaveBeenCalledWith(
            { display_name: 'New Name', unit: 'lbs' },
            false,
        );
        expect(updateProfile).toHaveBeenCalledWith('New Name', 'lbs');
    });

    it('deleteBodyWeight removes entry optimistically then calls server action', async () => {
        const bwLogs: BodyweightEntry[] = [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }];
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: defaultProfile, mutate: profileMutate } as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: bwLogs, mutate: bwMutate } as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useProfile(defaultProfile, bwLogs));

        await act(async () => {
            await result.current.deleteBodyWeight('abc');
        });

        const updaterArg = bwMutate.mock.calls[0][0] as (prev: BodyweightEntry[]) => BodyweightEntry[];
        expect(updaterArg(bwLogs)).toEqual([]);
        expect(deleteBodyWeight).toHaveBeenCalledWith('abc');
    });

    it('logBodyWeight calls server action and updates cache', async () => {
        const entry: BodyweightEntry = { id: 'xyz', logged_at: '2026-05-25', weight_kg: 75 };
        vi.mocked(logBodyWeight).mockResolvedValueOnce(entry);
        const { result } = renderHook(() => useProfile(defaultProfile, defaultBWLogs));

        await act(async () => {
            const returned = await result.current.logBodyWeight(75);
            expect(returned).toEqual(entry);
        });

        expect(bwMutate).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --run src/hooks/pulse/__tests__/useProfile.test.ts
```

Expected: FAIL — `Cannot find module '../useProfile'`

- [ ] **Step 3: Create `src/hooks/pulse/useProfile.ts`**

```typescript
import useSWR from 'swr';
import {
    updateProfile as serverUpdateProfile,
    logBodyWeight as serverLogBodyWeight,
    deleteBodyWeight as serverDeleteBodyWeight,
} from '@/app/pulse/actions';
import type { Profile, BodyweightEntry, Unit } from '@/lib/pulse/types';

const PROFILE_KEY = '/api/pulse/profile';
const BODYWEIGHT_KEY = '/api/pulse/bodyweight';

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<T>;
}

export function useProfile(initialProfile: Profile, initialBodyweightLogs: BodyweightEntry[]) {
    const { data: profileData, mutate: mutateProfile } = useSWR<Profile>(
        PROFILE_KEY,
        fetcher,
        { fallbackData: initialProfile, revalidateOnFocus: true },
    );
    const profile = profileData ?? initialProfile;

    const { data: bwData, mutate: mutateBW } = useSWR<BodyweightEntry[]>(
        BODYWEIGHT_KEY,
        fetcher,
        { fallbackData: initialBodyweightLogs, revalidateOnFocus: true },
    );
    const bodyweightLogs = bwData ?? initialBodyweightLogs;

    async function updateProfile(displayName: string | null, unit: Unit): Promise<void> {
        mutateProfile({ ...profile, display_name: displayName, unit }, false);
        await serverUpdateProfile(displayName, unit);
        mutateProfile();
    }

    async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
        const entry = await serverLogBodyWeight(weightKg);
        mutateBW((prev = []) => {
            const deduped = prev.filter((e) => e.logged_at !== entry.logged_at);
            return [entry, ...deduped].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
        }, false);
        return entry;
    }

    async function deleteBodyWeight(id: string): Promise<void> {
        mutateBW((prev = []) => prev.filter((e) => e.id !== id), false);
        await serverDeleteBodyWeight(id);
        mutateBW();
    }

    return { profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --run src/hooks/pulse/__tests__/useProfile.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useProfile.ts src/hooks/pulse/__tests__/useProfile.test.ts
git commit -m "feat(pulse): add useProfile hook with SWR + optimistic mutations"
```

---

## Task 9: PulseProvider + AppShell + slim TrackerClient

**Files:**
- Create: `src/components/pulse/PulseProvider.tsx`
- Create: `src/components/pulse/AppShell.tsx`
- Modify: `src/components/pulse/TrackerClient.tsx`
- Modify: `src/components/pulse/RestTimer.tsx`

- [ ] **Step 1: Create `src/components/pulse/PulseProvider.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { PulseContext } from '@/context/PulseContext';
import { useWorkoutLogs } from '@/hooks/pulse/useWorkoutLogs';
import { useProfile } from '@/hooks/pulse/useProfile';
import { useUIState } from '@/hooks/pulse/useUIState';
import { useRestTimer } from '@/hooks/pulse/useRestTimer';
import { computeStreak, computePRMap } from '@/lib/pulse/utils';
import type { Logs, Profile, BodyweightEntry } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    email: string;
    children: React.ReactNode;
}

export function PulseProvider({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    email,
    children,
}: Props) {
    const { logs, saveError, updateLog, deleteLog, handleExport } = useWorkoutLogs(initialLogs);
    const { profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight } = useProfile(
        initialProfile,
        initialBodyweightLogs,
    );
    const { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, fireTrigger } = useRestTimer();

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    return (
        <PulseContext.Provider
            value={{
                logs,
                profile,
                bodyweightLogs,
                isLoading: false,
                saveError,
                streak,
                prMap,
                email,
                updateLog,
                deleteLog,
                handleExport,
                updateProfile,
                logBodyWeight,
                deleteBodyWeight,
                view,
                navigate,
                activeWeek,
                setActiveWeek,
                activeTab,
                setActiveTab,
                timerTrigger,
                fireTrigger,
            }}>
            {children}
        </PulseContext.Provider>
    );
}
```

- [ ] **Step 2: Create `src/components/pulse/AppShell.tsx`**

This is the header + save error banner + view router extracted from the old `TrackerClient`. It reads all state from `usePulse()`.

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/pulse/actions';
import { MONO, ACCENT, BG, BORDER, DIM } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import LogView from './views/LogView';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

export function AppShell() {
    const { activeWeek, streak, view, navigate, handleExport, saveError } = usePulse();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        function onPointerDown(e: PointerEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [menuOpen]);

    const hamburgerLineStyle = {
        display: 'block',
        width: '18px',
        height: '1.5px',
        background: DIM,
        borderRadius: '1px',
        transition: 'transform 0.2s, opacity 0.2s',
    };

    function handleNavigate(v: View) {
        navigate(v);
        setMenuOpen(false);
    }

    return (
        <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
            {/* Header */}
            <div ref={menuRef} style={{ position: 'sticky', top: 0, zIndex: 10, background: BG }}>
                <div
                    style={{
                        borderBottom: `1px solid ${menuOpen ? 'transparent' : BORDER}`,
                        padding: '0 1rem',
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            letterSpacing: '0.08em',
                            color: '#fff',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                        }}>
                        Pulse<span style={{ color: ACCENT }}>.</span>
                    </span>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.75rem',
                            color: DIM,
                            letterSpacing: '0.05em',
                            flexShrink: 0,
                        }}>
                        WK{' '}
                        <strong style={{ color: ACCENT, fontWeight: 700 }}>
                            {String(activeWeek).padStart(2, '0')}
                        </strong>{' '}
                        / 12
                    </span>
                    {streak > 0 && (
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.6875rem',
                                color: '#555',
                                letterSpacing: '0.05em',
                                flexShrink: 0,
                            }}>
                            · {streak}WK
                        </span>
                    )}
                    <nav
                        style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem', alignItems: 'center' }}
                        aria-label="Main navigation">
                        <span className="pulse-desktop-nav">
                            {NAV.map(({ id, label }) => {
                                const active = view === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleNavigate(id)}
                                        style={{
                                            fontFamily: MONO,
                                            fontSize: '0.8125rem',
                                            fontWeight: 500,
                                            color: active ? '#fff' : DIM,
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: active ? `1px solid ${ACCENT}` : '1px solid transparent',
                                            paddingBottom: '1px',
                                            cursor: 'pointer',
                                            letterSpacing: '0.02em',
                                        }}>
                                        {label}
                                    </button>
                                );
                            })}
                            <span style={{ color: '#2a2a2a', paddingBottom: '1px' }}>|</span>
                            <button
                                onClick={handleExport}
                                aria-label="Export workout logs as JSON"
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    color: DIM,
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid transparent',
                                    paddingBottom: '1px',
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                }}>
                                Export
                            </button>
                            <form action={logout} style={{ display: 'inline' }}>
                                <button
                                    type="submit"
                                    aria-label="Sign out of Pulse"
                                    style={{
                                        fontFamily: MONO,
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        color: '#444',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        letterSpacing: '0.02em',
                                        paddingBottom: '1px',
                                    }}>
                                    Sign out
                                </button>
                            </form>
                        </span>
                        <button
                            className="pulse-hamburger"
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                flexDirection: 'column',
                                gap: '4px',
                                flexShrink: 0,
                            }}>
                            <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }} />
                            <span style={{ ...hamburgerLineStyle, opacity: menuOpen ? 0 : 1 }} />
                            <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }} />
                        </button>
                    </nav>
                </div>

                {menuOpen && (
                    <div
                        style={{
                            borderBottom: `1px solid ${BORDER}`,
                            padding: '0.5rem 0 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                        {NAV.map(({ id, label }) => {
                            const active = view === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleNavigate(id)}
                                    style={{
                                        fontFamily: MONO,
                                        fontSize: '0.9375rem',
                                        fontWeight: active ? 700 : 400,
                                        color: active ? '#fff' : DIM,
                                        background: 'none',
                                        border: 'none',
                                        borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                                        textAlign: 'left',
                                        padding: '0.75rem 1.25rem',
                                        cursor: 'pointer',
                                        letterSpacing: '0.02em',
                                    }}>
                                    {label}
                                </button>
                            );
                        })}
                        <div style={{ height: '1px', background: '#1a1a1a', margin: '0.25rem 1rem' }} />
                        <button
                            onClick={() => { handleExport(); setMenuOpen(false); }}
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.875rem',
                                color: DIM,
                                background: 'none',
                                border: 'none',
                                borderLeft: '2px solid transparent',
                                textAlign: 'left',
                                padding: '0.75rem 1.25rem',
                                cursor: 'pointer',
                                letterSpacing: '0.02em',
                            }}>
                            Export
                        </button>
                        <form action={logout}>
                            <button
                                type="submit"
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.875rem',
                                    color: '#444',
                                    background: 'none',
                                    border: 'none',
                                    borderLeft: '2px solid transparent',
                                    textAlign: 'left',
                                    padding: '0.75rem 1.25rem',
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                    width: '100%',
                                }}>
                                Sign out
                            </button>
                        </form>
                    </div>
                )}
            </div>

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

            {view === 'log' && <LogView />}
            {view === 'program' && <ProgramView />}
            {view === 'history' && <HistoryView />}
            {view === 'profile' && <ProfileView />}
        </div>
    );
}
```

- [ ] **Step 3: Replace `src/components/pulse/TrackerClient.tsx` with the slim version**

```tsx
'use client';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import type { Logs, Profile, BodyweightEntry } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    email: string;
}

export default function TrackerClient({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    email,
}: Props) {
    return (
        <PulseProvider
            initialLogs={initialLogs}
            initialProfile={initialProfile}
            initialBodyweightLogs={initialBodyweightLogs}
            email={email}>
            <AppShell />
        </PulseProvider>
    );
}
```

- [ ] **Step 4: Update localStorage key in `src/components/pulse/RestTimer.tsx`**

Find the two occurrences of `wt_timer_idx` and change both to `pulse_timer_idx`:

```typescript
// Line ~36: initial read
const stored = Number(localStorage.getItem('pulse_timer_idx'));

// Line ~51: persist effect
localStorage.setItem('pulse_timer_idx', String(durationIdx));
```

- [ ] **Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: ALL tests PASS. The view components (LogView, ProfileView, etc.) still receive props at this point — they haven't been migrated yet. AppShell renders them with no props which will cause TS errors but not test failures since tests import components directly.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/PulseProvider.tsx src/components/pulse/AppShell.tsx src/components/pulse/TrackerClient.tsx src/components/pulse/RestTimer.tsx
git commit -m "feat(pulse): add PulseProvider, AppShell; slim TrackerClient to ~30 lines"
```

---

## Task 10: Update view components + tests

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/views/HistoryView.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`
- Modify: `src/components/pulse/views/ProgramView.tsx`
- Modify: `src/components/pulse/__tests__/LogView.test.tsx`
- Modify: `src/components/pulse/__tests__/ProfileView.test.tsx`

All four view components remove their props and call `usePulse()` instead. `WorkoutTabs`, `RestTimer`, `ExerciseCard`, and `WeekSelector` are unchanged — they're presentational and still receive props from their parent view.

- [ ] **Step 1: Replace `src/components/pulse/views/LogView.tsx`**

```tsx
import { useMemo } from 'react';
import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData, parseMaxSets, logKey } from '@/lib/pulse/utils';
import { MONO, ACCENT, BORDER, DIM } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import RestTimer from '../RestTimer';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        logs,
        profile,
        prMap,
        updateLog,
        deleteLog,
        timerTrigger,
        fireTrigger,
    } = usePulse();

    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;

    const hasData = workout.exercises.some((ex, exIdx) =>
        Array.from(
            { length: parseMaxSets(ex.sets) },
            (_, s) => logs[logKey(activeWeek, activeTab, exIdx, s)]?.saved,
        ).some(Boolean),
    );

    function handleSave(key: string, entry: Parameters<typeof updateLog>[1]) {
        updateLog(key, entry);
        fireTrigger();
    }

    return (
        <div>
            <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />
            <RestTimer trigger={timerTrigger} />

            <div
                style={{
                    display: 'flex',
                    padding: '0 1rem',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    borderBottom: `1px solid ${BORDER}`,
                }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
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

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.875rem 1rem 0.5rem' }}>
                <span
                    style={{
                        fontFamily: MONO,
                        fontSize: '0.6875rem',
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
                <span style={{ fontSize: '0.8125rem', color: DIM, marginLeft: 'auto' }}>{workout.description}</span>
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                style={{
                    padding: '0.25rem 1rem 2rem',
                    maxWidth: 600,
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                }}>
                {workout.exercises.map((exercise, i) => (
                    <ExerciseCard
                        key={`${activeTab}-${i}`}
                        exercise={exercise}
                        exIdx={i}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={(e) => handleSave(logKey(activeWeek, activeTab, i, 0), e)}
                        onDelete={deleteLog}
                    />
                ))}
                {!hasData && (
                    <div style={{ padding: '1.5rem 0 0', textAlign: 'center' }}>
                        <div
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.6875rem',
                                color: '#333',
                                letterSpacing: '0.04em',
                            }}>
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```

**Important:** The `onSave` prop of `ExerciseCard` accepts a `(key, entry) => void` signature. Look at the current `LogView` — it passes `onSave={updateLog}` directly and wraps the key inside `ExerciseCard`. Keep this consistent: pass `onSave={updateLog}` and `onDelete={deleteLog}` directly, mirroring the original, and call `fireTrigger` by wrapping `updateLog` in `handleSave`. The actual signature passed to `ExerciseCard` must match its existing prop types. Looking at `ExerciseCard.tsx`:

```
onSave: (key: string, entry: LogEntry) => void
onDelete: () => void  ← actually: () => void per SetLogger child
```

Wait — in the original `LogView`, `ExerciseCard` receives:
```tsx
onSave={updateLog}   // (key, entry) => void
onDelete={deleteLog} // (key) => void
```

Keep the same pattern. But `timerTrigger` + `fireTrigger` separation: `LogView` now calls `fireTrigger()` whenever a set is saved. Wrap `updateLog` in `handleSave`:

```tsx
function handleSave(key: string, entry: LogEntry) {
    updateLog(key, entry);
    fireTrigger();
}
```

And pass `onSave={handleSave}` to each `ExerciseCard`. Replace the `LogView` above with this corrected version:

```tsx
import { useMemo } from 'react';
import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData, parseMaxSets, logKey } from '@/lib/pulse/utils';
import { MONO, ACCENT, BORDER, DIM } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import RestTimer from '../RestTimer';
import type { LogEntry } from '@/lib/pulse/types';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        logs,
        profile,
        prMap,
        updateLog,
        deleteLog,
        timerTrigger,
        fireTrigger,
    } = usePulse();

    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;

    const hasData = workout.exercises.some((ex, exIdx) =>
        Array.from(
            { length: parseMaxSets(ex.sets) },
            (_, s) => logs[logKey(activeWeek, activeTab, exIdx, s)]?.saved,
        ).some(Boolean),
    );

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        fireTrigger();
    }

    return (
        <div>
            <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />
            <RestTimer trigger={timerTrigger} />

            <div
                style={{
                    display: 'flex',
                    padding: '0 1rem',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    borderBottom: `1px solid ${BORDER}`,
                }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
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

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.875rem 1rem 0.5rem' }}>
                <span style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM }}>
                    {phase.label}
                </span>
                <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.04em' }}>
                    {rir} RIR
                </span>
                <span style={{ fontSize: '0.8125rem', color: DIM, marginLeft: 'auto' }}>{workout.description}</span>
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                style={{ padding: '0.25rem 1rem 2rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {workout.exercises.map((exercise, i) => (
                    <ExerciseCard
                        key={`${activeTab}-${i}`}
                        exercise={exercise}
                        exIdx={i}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                    />
                ))}
                {!hasData && (
                    <div style={{ padding: '1.5rem 0 0', textAlign: 'center' }}>
                        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: '#333', letterSpacing: '0.04em' }}>
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Replace `src/components/pulse/views/HistoryView.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { buildHistory, computePRMap, calcE1RM, toDisplay } from '@/lib/pulse/utils';
import { WORKOUTS } from '@/lib/pulse/data';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';

export default function HistoryView() {
    const { logs, profile } = usePulse();
    const unit = profile.unit;
    const sessions = useMemo(() => buildHistory(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    if (sessions.length === 0) {
        return (
            <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.75rem' }}>
                    No sessions yet
                </div>
                <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#333', letterSpacing: '0.04em' }}>
                    Head to Log to get started.
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sessions.map((session) => {
                const workout = WORKOUTS[session.type];
                return (
                    <div
                        key={`${session.week}-${session.type}`}
                        style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: ACCENT }}>
                                {workout.label}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: DIM, letterSpacing: '0.04em' }}>
                                Week {session.week}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: MUTED, marginLeft: 'auto' }}>
                                {session.sets.length} sets
                            </span>
                        </div>
                        <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
                            {session.sets.map((set, i) => {
                                const exercise = workout.exercises[set.exIdx];
                                const exKey = `${session.type}-${set.exIdx}`;
                                const bestE1RM = prMap[exKey] ?? 0;
                                const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                                return (
                                    <div
                                        key={i}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0', borderBottom: i < session.sets.length - 1 ? '1px solid #111' : 'none' }}>
                                        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: MUTED, width: '1.25rem', flexShrink: 0 }}>
                                            {String(set.setIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span style={{ color: DIM, fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {exercise?.name ?? `Exercise ${set.exIdx + 1}`}
                                        </span>
                                        <span style={{ fontFamily: MONO, color: '#fff', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0 }}>
                                            {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                        </span>
                                        {isPR && (
                                            <span style={{ fontFamily: MONO, fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, borderRadius: '2px', padding: '0.1rem 0.3rem', flexShrink: 0 }}>
                                                PR
                                            </span>
                                        )}
                                        <span style={{ fontFamily: MONO, color: MUTED, fontSize: '0.625rem', flexShrink: 0 }}>
                                            {set.rir} RIR
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 3: Replace `src/components/pulse/views/ProgramView.tsx`**

```tsx
import { WORKOUTS, VOLUME, SCHEDULE, WEEK_NOTES } from '@/lib/pulse/data';
import { getPhase } from '@/lib/pulse/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import WeekSelector from '../WeekSelector';

const BAR_MAX_HEIGHT_PX = 44;

export default function ProgramView() {
    const { activeWeek, setActiveWeek, navigate, logs } = usePulse();
    const phase = getPhase(activeWeek);
    const maxSets = Math.max(...VOLUME.map((v) => v.sets));

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
        navigate('log');
    }

    return (
        <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <WeekSelector activeWeek={activeWeek} onSelect={handleSelectWeek} logs={logs} />

            <div style={{ margin: '1.25rem 0', padding: '0.875rem 1rem', background: SURFACE, borderRadius: '4px', borderLeft: `3px solid ${ACCENT}` }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT }}>
                    {phase.label} — {phase.subtitle}
                </div>
                {WEEK_NOTES[activeWeek] && (
                    <div style={{ color: DIM, fontSize: '0.8125rem', marginTop: '0.375rem', lineHeight: 1.6 }}>
                        {WEEK_NOTES[activeWeek]}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>
                    Weekly Volume
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '54px' }}>
                    {VOLUME.map(({ week, sets }) => (
                        <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <div style={{ width: '100%', background: activeWeek === week ? ACCENT : '#1f1f1f', height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px`, borderRadius: '2px 2px 0 0', transition: 'background 0.15s' }} />
                            <span style={{ fontFamily: MONO, color: '#333', fontSize: '0.5rem' }}>{week}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>
                    Weekly Schedule
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {SCHEDULE.map(({ day, type }) => {
                        const isRest = type === 'rest';
                        const label = isRest ? '—' : type.charAt(0).toUpperCase();
                        return (
                            <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontFamily: MONO, color: '#333', fontSize: '0.5rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{day}</div>
                                <div style={{ padding: '0.375rem 0', borderRadius: '3px', fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, background: isRest ? '#0f0f0f' : `${ACCENT}18`, color: isRest ? '#222' : ACCENT, border: `1px solid ${isRest ? BORDER : `${ACCENT}33`}` }}>
                                    {label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {(['push', 'pull', 'legs'] as const).map((type) => {
                const workout = WORKOUTS[type];
                return (
                    <div key={type} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: '0.75rem' }}>
                            {workout.label} — {workout.description}
                        </div>
                        {workout.exercises.map((ex, i) => (
                            <div key={i} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                                <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: MUTED, flexShrink: 0, width: '1.25rem' }}>{String(i + 1).padStart(2, '0')}</span>
                                <div>
                                    <div style={{ color: '#d4d4d4', fontSize: '0.875rem', fontWeight: 500 }}>{ex.name}</div>
                                    <div style={{ fontFamily: MONO, color: DIM, fontSize: '0.5625rem', letterSpacing: '0.04em', marginTop: '0.125rem' }}>{ex.sets} sets · {ex.reps} reps · {ex.load}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Replace `src/components/pulse/views/ProfileView.tsx`**

ProfileView keeps its own local UI state (`editingName`, `nameInput`, `bwInput`, etc.) but gets all server-backed data and mutations from context.

```tsx
'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import type { BodyweightEntry } from '@/lib/pulse/types';

function BodyweightChart({ entries, unit }: { entries: BodyweightEntry[]; unit: 'kg' | 'lbs' }) {
    const sorted = [...entries].reverse().slice(-30);
    if (sorted.length < 2) return null;

    const W = 300, H = 80, PL = 34, PR = 8, PT = 10, PB = 4;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const values = sorted.map((e) => toDisplay(e.weight_kg, unit));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    function px(i: number) { return PL + (i / (sorted.length - 1)) * cw; }
    function py(v: number) {
        if (range === 0) return PT + ch / 2;
        return PT + ch - ((v - minVal) / range) * ch;
    }

    const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const lastX = px(sorted.length - 1);
    const lastY = py(values[values.length - 1]);
    const areaPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${lastX.toFixed(1)},${(PT + ch).toFixed(1)} L ${PL},${(PT + ch).toFixed(1)} Z`;
    const fmt = (v: number) => (unit === 'lbs' ? v.toFixed(1) : String(v));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }} aria-hidden>
            <defs>
                <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#bw-fill)" />
            <polyline points={pts.join(' ')} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lastX} cy={lastY} r={3} fill={ACCENT} />
            {range > 0 && (
                <>
                    <text x={PL - 3} y={PT + ch} textAnchor="end" fontSize={8} fontFamily="monospace" fill={DIM} dy="0">{fmt(minVal)}</text>
                    <text x={PL - 3} y={PT} textAnchor="end" fontSize={8} fontFamily="monospace" fill={DIM} dy="8">{fmt(maxVal)}</text>
                </>
            )}
        </svg>
    );
}

export default function ProfileView() {
    const {
        email,
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
    } = usePulse();

    const { display_name: displayName, unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName ?? '');
    const [nameSaved, setNameSaved] = useState(false);
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);

    const initials = displayName ? getInitials(displayName, 2) : (email[0]?.toUpperCase() ?? '?');

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
        });
    }

    function handleNameSave() {
        const trimmed = nameInput.trim() || null;
        setEditingName(false);
        if (trimmed === displayName) return;
        startTransition(async () => {
            await updateProfile(trimmed, unit);
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
        });
    }

    function handleNameKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setNameInput(displayName ?? '');
            setEditingName(false);
        }
    }

    function handleLogBodyweight() {
        const val = parseFloat(bwInput);
        if (isNaN(val) || val <= 0) { setBwError('Enter a valid weight'); return; }
        const kgVal = toKg(val, unit);
        if (kgVal < MIN_KG || kgVal > MAX_KG) {
            setBwError(`Must be between ${toDisplay(MIN_KG, unit)} and ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        setBwError(null);
        startTransition(async () => {
            try {
                await logBodyWeight(kgVal);
                setBwInput('');
            } catch {
                setBwError('Failed to save. Try again.');
            }
        });
    }

    function handleDeleteBodyweight(id: string) {
        startTransition(async () => {
            await deleteBodyWeight(id);
        });
    }

    const today = new Date().toISOString().slice(0, 10);

    return (
        <div style={{ padding: '1.25rem 1rem 3rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 56, height: 56, borderRadius: 6, flexShrink: 0, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '1.25rem', fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' }}>
                    {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {editingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={handleNameKeyDown}
                            placeholder="Display name"
                            style={{ fontFamily: MONO, fontSize: '0.9375rem', fontWeight: 600, color: '#fff', background: 'transparent', border: 'none', borderBottom: `1px solid ${ACCENT}`, outline: 'none', width: '100%', padding: '0 0 2px' }}
                        />
                    ) : (
                        <button
                            onClick={() => { setNameInput(displayName ?? ''); setEditingName(true); }}
                            style={{ fontFamily: MONO, fontSize: '0.9375rem', fontWeight: 600, color: displayName ? '#fff' : DIM, background: 'none', border: 'none', padding: 0, cursor: 'text', textAlign: 'left', display: 'block', width: '100%' }}>
                            {displayName ?? 'Add display name'}
                        </button>
                    )}
                    <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                    {nameSaved && !editingName && (
                        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: '#4ade80', letterSpacing: '0.04em', marginTop: '0.125rem', display: 'block' }}>Saved ✓</span>
                    )}
                </div>
            </div>

            {/* Unit toggle */}
            <div>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>Weight Unit</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['kg', 'lbs'] as const).map((u) => (
                        <button key={u} onClick={() => handleUnitChange(u)} style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.375rem 1rem', background: unit === u ? ACCENT : 'transparent', border: `1px solid ${unit === u ? ACCENT : BORDER}`, borderRadius: 3, color: unit === u ? '#000' : DIM, cursor: 'pointer' }}>
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body weight */}
            <div>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.75rem' }}>Body Weight</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="number"
                                aria-label={`Body weight in ${unit}`}
                                placeholder={unit}
                                value={bwInput}
                                min={toDisplay(MIN_KG, unit)}
                                max={toDisplay(MAX_KG, unit)}
                                step={0.1}
                                onChange={(e) => { setBwInput(e.target.value); setBwError(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleLogBodyweight(); }}
                                style={{ width: '5.5rem', padding: '0.375rem 0.5rem', background: '#0a0a0a', border: `1px solid ${bwError ? '#f43f5e' : BORDER}`, borderRadius: 3, color: '#fff', fontFamily: MONO, fontSize: '0.8125rem', outline: 'none' }}
                            />
                            <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM }}>{today}</span>
                        </div>
                        {bwError && <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#f43f5e', marginTop: '0.25rem' }}>{bwError}</div>}
                    </div>
                    <button
                        onClick={handleLogBodyweight}
                        disabled={isPending}
                        style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.4375rem 0.75rem', background: 'transparent', border: `1px solid ${MUTED}`, borderRadius: 3, color: '#aaa', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.5 : 1, flexShrink: 0 }}>
                        Log
                    </button>
                </div>

                {bodyweightLogs.length >= 2 && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0.625rem 0.5rem 0.5rem', marginBottom: '0.75rem' }}>
                        <BodyweightChart entries={bodyweightLogs} unit={unit} />
                    </div>
                )}

                {bodyweightLogs.length > 0 ? (
                    <div>
                        {bodyweightLogs.map((entry) => (
                            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4375rem 0', borderBottom: '1px solid #111' }}>
                                <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, flex: 1 }}>{entry.logged_at}</span>
                                <span style={{ fontFamily: MONO, fontSize: '0.8125rem', color: '#d4d4d4', fontWeight: 600 }}>{toDisplay(entry.weight_kg, unit)} {unit}</span>
                                <button onClick={() => handleDeleteBodyweight(entry.id)} disabled={isPending} aria-label={`Delete entry for ${entry.logged_at}`} style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#333', letterSpacing: '0.04em' }}>No entries yet.</div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Update `src/components/pulse/__tests__/LogView.test.tsx`**

LogView no longer takes props — it reads from context. Mock `usePulse` to provide test data.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogView from '../views/LogView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const defaultContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    logs: {},
    profile: { display_name: null, unit: 'kg' as const },
    prMap: {},
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    fireTrigger: vi.fn(),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as ReturnType<typeof usePulse>);
});

describe('LogView', () => {
    it('shows an empty state hint when no sets are logged for the current week', () => {
        render(<LogView />);
        expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
    });

    it('hides the empty state hint when at least one set is logged', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: { '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true } },
        } as ReturnType<typeof usePulse>);
        render(<LogView />);
        expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 6: Update `src/components/pulse/__tests__/ProfileView.test.tsx`**

ProfileView no longer takes props — mock `usePulse`. The `updateProfile`, `logBodyWeight`, and `deleteBodyWeight` server action mocks are no longer needed since those are now handled by the hooks (tested in Task 8).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockLogBodyWeight = vi.fn();
const mockDeleteBodyWeight = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    email: 'test@example.com',
    profile: { display_name: 'Test User', unit: 'kg' as const },
    bodyweightLogs: [],
    updateProfile: mockUpdateProfile,
    logBodyWeight: mockLogBodyWeight,
    deleteBodyWeight: mockDeleteBodyWeight,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as ReturnType<typeof usePulse>);
    mockUpdateProfile.mockClear();
    mockLogBodyWeight.mockClear();
    mockDeleteBodyWeight.mockClear();
});

describe('ProfileView', () => {
    it('shows a saved confirmation after display name is updated', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByText('Test User'));
        const input = screen.getByPlaceholderText('Display name');
        await userEvent.clear(input);
        await userEvent.type(input, 'New Name');
        await userEvent.keyboard('{Enter}');
        await waitFor(() => {
            expect(screen.getByText(/saved/i)).toBeInTheDocument();
        });
    });

    it('displays today in UTC format (YYYY-MM-DD)', () => {
        const utcDate = new Date().toISOString().slice(0, 10);
        render(<ProfileView />);
        expect(screen.getByText(utcDate)).toBeInTheDocument();
    });

    it('renders initials from displayName', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: 'John Doe', unit: 'kg' },
        } as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: null, unit: 'kg' },
        } as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('calls updateProfile when unit is toggled to lbs', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(mockUpdateProfile).toHaveBeenCalledWith('Test User', 'lbs');
    });

    it('shows body weight entries in user unit', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }],
        } as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows error when non-numeric weight is submitted', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 7: Run all tests**

```bash
npm test -- --run
```

Expected: ALL tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/pulse/views/ src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/__tests__/ProfileView.test.tsx
git commit -m "feat(pulse): migrate view components to usePulse() context, remove prop drilling"
```

---

## Task 11: Typecheck + lint + format

**Files:** None created — quality gate only.

- [ ] **Step 1: Run TypeScript type checker**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If errors appear, fix them before proceeding — do not suppress with `@ts-ignore`.

Common issues to watch for:
- `LogView`'s `onSave` prop type: `ExerciseCard` expects `onSave: (key: string, entry: LogEntry) => void` — confirm `handleSave` in `LogView` matches this signature
- `ProgramView`'s `onSelect` prop on `WeekSelector`: check `WeekSelector` prop types match `handleSelectWeek: (w: number) => void`
- Any missing fields in the `PulseContextValue` mock objects in tests

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings. Fix any reported issues.

- [ ] **Step 3: Run Prettier formatter**

```bash
npm run format
```

- [ ] **Step 4: Run tests one final time**

```bash
npm test -- --run
```

Expected: ALL tests PASS.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(pulse): typecheck, lint, format after architecture refactor"
```

---

## Self-Review

| Spec requirement | Covered by |
|-----------------|-----------|
| Rename `weight-tracker` → `pulse` everywhere | Tasks 1–2 |
| Add `View` and `PRMap` types to `lib/pulse/types.ts` | Task 1 |
| `PulseContext` with typed `usePulse()` hook | Task 3 |
| `useLocalStorage` generic hook | Task 3 |
| `useUIState` with `pulse_week` localStorage persistence | Task 4 |
| `useRestTimer` with `fireTrigger` | Task 5 |
| API routes `/api/pulse/logs`, `/profile`, `/bodyweight` | Task 6 |
| `useWorkoutLogs` SWR-backed with optimistic mutations | Task 7 |
| `useProfile` SWR-backed with optimistic mutations | Task 8 |
| `PulseProvider` composing all hooks | Task 9 |
| `AppShell` extracting header/menu/router from `TrackerClient` | Task 9 |
| Slim `TrackerClient` (~30 lines) | Task 9 |
| `RestTimer` localStorage key renamed (`pulse_timer_idx`) | Task 9 |
| View components use `usePulse()`, no prop drilling | Task 10 |
| `LogView` and `ProfileView` tests updated | Task 10 |
| Inline styles untouched (Phase 2 scope) | All tasks |
| All existing tests pass | Tasks 1–11 |
