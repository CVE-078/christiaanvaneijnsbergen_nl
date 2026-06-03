# Instant Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Pulse app shell instantly with skeleton feedback by moving the six-query data load off the blocking server layout to client-side SWR, backed by a user-scoped localStorage cache so warm visits are instant.

**Architecture:** The `(protected)` layout stops awaiting Supabase and renders the shell immediately. The four data hooks fetch client-side and report `loading`/`error`, which the provider aggregates onto context. Views render Slate skeletons while their slice loads. A `localStorage`-backed SWR cache provider, keyed per user and cleared on logout, makes repeat loads instant (stale-while-revalidate). Phase 1 of offline-first.

**Tech Stack:** Next.js 15 App Router, React 19, SWR, TypeScript, Vitest + Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-03-instant-loading-design.md`

---

## Task 1: User-scoped SWR cache provider

**Files:**
- Create: `src/lib/pulse/swrCache.ts`
- Test: `src/lib/pulse/__tests__/swrCache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pulse/__tests__/swrCache.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSWRCacheProvider, clearAllSWRCache } from '../swrCache';

describe('makeSWRCacheProvider', () => {
    beforeEach(() => localStorage.clear());

    it('starts empty when nothing is stored', () => {
        const map = makeSWRCacheProvider('user-1')();
        expect(map.get('/api/pulse/logs')).toBeUndefined();
    });

    it('seeds the map from the user-scoped localStorage key', () => {
        localStorage.setItem('pulse-swr-cache:user-1', JSON.stringify([['k', { data: 42 }]]));
        const map = makeSWRCacheProvider('user-1')();
        expect(map.get('k')).toEqual({ data: 42 });
    });

    it('does not read another user\'s cache', () => {
        localStorage.setItem('pulse-swr-cache:user-1', JSON.stringify([['k', { data: 1 }]]));
        const map = makeSWRCacheProvider('user-2')();
        expect(map.get('k')).toBeUndefined();
    });

    it('clearAllSWRCache removes every pulse cache key', () => {
        localStorage.setItem('pulse-swr-cache:user-1', '[]');
        localStorage.setItem('pulse-swr-cache:user-2', '[]');
        localStorage.setItem('unrelated', 'keep');
        clearAllSWRCache();
        expect(localStorage.getItem('pulse-swr-cache:user-1')).toBeNull();
        expect(localStorage.getItem('pulse-swr-cache:user-2')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('keep');
    });

    it('survives malformed stored JSON', () => {
        localStorage.setItem('pulse-swr-cache:user-1', 'not json');
        expect(() => makeSWRCacheProvider('user-1')()).not.toThrow();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/swrCache.test.ts`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/pulse/swrCache.ts
// User-scoped, localStorage-backed SWR cache. Seeding the SWR Map from storage
// makes a returning user render last-known data instantly (stale), then SWR
// revalidates in the background. Keyed per user id so a shared device never
// leaks another account's cached data; cleared on logout.
const PREFIX = 'pulse-swr-cache:';

type SWRCacheMap = Map<string, unknown>;

export function makeSWRCacheProvider(userId: string): () => SWRCacheMap {
    return () => {
        const storageKey = `${PREFIX}${userId}`;
        let map: SWRCacheMap;
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
            map = new Map(raw ? (JSON.parse(raw) as [string, unknown][]) : []);
        } catch {
            map = new Map();
        }

        const persist = () => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(map.entries())));
            } catch {
                // storage full / unavailable (private mode) — cache is best-effort
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', persist);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') persist();
            });
        }

        return map;
    };
}

export function clearAllSWRCache(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PREFIX)) localStorage.removeItem(key);
        }
    } catch {
        // ignore — nothing to clear if storage is unavailable
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/swrCache.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/swrCache.ts src/lib/pulse/__tests__/swrCache.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): user-scoped localStorage SWR cache provider"
```

---

## Task 2: Client-fetch hooks (optional initial data + loading/error)

**Files:**
- Modify: `src/hooks/pulse/useWorkoutLogs.ts`
- Modify: `src/hooks/pulse/useProfile.ts`
- Modify: `src/hooks/pulse/useRoutines.ts`
- Modify: `src/hooks/pulse/useNotes.ts`
- Test: `src/hooks/pulse/__tests__/useProfile.test.ts` (new — representative hook test)

The pattern for every hook: make `initial*` optional, drop the hard dependence on it, set `revalidateIfStale: true` (keep `revalidateOnFocus: false`, add `dedupingInterval: 5000`), default the value safely, and return `loading` (SWR `isLoading`) and `error`.

- [ ] **Step 1: `useWorkoutLogs`**

Replace the `useSWR` call and return in `src/hooks/pulse/useWorkoutLogs.ts`:

```ts
export function useWorkoutLogs(initialLogs?: Logs, onError?: (msg: string) => void) {
    const { data, mutate, isLoading, error } = useSWR<Logs>(LOGS_KEY, fetcher, {
        fallbackData: initialLogs,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const logs = data ?? {};
```

And at the hook's `return { ... }`, add `loading: isLoading, error`.

- [ ] **Step 2: `useProfile`**

In `src/hooks/pulse/useProfile.ts`, add a default profile constant and update both SWR calls + return:

```ts
const DEFAULT_PROFILE: Profile = {
    display_name: null,
    unit: 'kg',
    active_routine_id: null,
    onboarding_completed: false,
    goal_weight_kg: null,
};

export function useProfile(initialProfile?: Profile, initialBodyweightLogs?: BodyweightEntry[]) {
    const {
        data: profileData,
        mutate: mutateProfile,
        isLoading: loadingProfile,
        error: profileError,
    } = useSWR<Profile>(PROFILE_KEY, fetcher, {
        fallbackData: initialProfile,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const profile = profileData ?? DEFAULT_PROFILE;

    const {
        data: bwData,
        mutate: mutateBW,
        isLoading: loadingBodyweight,
        error: bodyweightError,
    } = useSWR<BodyweightEntry[]>(BODYWEIGHT_KEY, fetcher, {
        fallbackData: initialBodyweightLogs,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const bodyweightLogs = bwData ?? [];
```

Update the return to:

```ts
    return {
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    };
```

(The mutation helpers above use `profile` / `prev = []`, which still work with the defaults.)

- [ ] **Step 3: `useRoutines`**

In `src/hooks/pulse/useRoutines.ts`, make params optional, default to `[]`, fetch on mount, and surface loading:

```ts
export function useRoutines(
    initialExercises?: DbExercise[],
    initialRoutines?: RoutineWithExercises[],
    activeRoutineId: string | null = null,
) {
    const { mutate: globalMutate } = useSWRConfig();

    const {
        data: exercises,
        mutate: mutateExercises,
        isLoading: loadingExercises,
        error: exercisesError,
    } = useSWR<DbExercise[]>(EXERCISES_KEY, fetcher, {
        fallbackData: initialExercises,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });

    const {
        data: routines,
        mutate: mutateRoutines,
        isLoading: loadingRoutines,
        error: routinesError,
    } = useSWR<RoutineWithExercises[]>(ROUTINES_KEY, fetcher, {
        fallbackData: initialRoutines,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });

    const activeRoutine = (routines ?? []).find((r) => r.id === activeRoutineId) ?? null;
```

Anywhere below that reads `routines ?? initialRoutines` or `exercises ?? initialExercises`, change the fallback to `?? []`. In the final `return { ... }`, change `exercises: exercises ?? initialExercises` to `exercises: exercises ?? []`, `routines: routines ?? initialRoutines` to `routines: routines ?? []`, and add `loadingExercises, loadingRoutines, exercisesError, routinesError`.

- [ ] **Step 4: `useNotes`**

In `src/hooks/pulse/useNotes.ts`:

```ts
export function useNotes(initialNotes?: Notes) {
    const { data, mutate, isLoading, error } = useSWR<Notes>(NOTES_KEY, fetcher, {
        fallbackData: initialNotes,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const notes = data ?? {};
```

Add `loading: isLoading, error` to the hook's return object.

- [ ] **Step 5: Write a representative hook test**

```ts
// src/hooks/pulse/__tests__/useProfile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { useProfile } from '../useProfile';

vi.mock('@/lib/pulse/fetcher', () => ({
    fetcher: vi.fn(async (key: string) => {
        if (key === '/api/pulse/profile')
            return { display_name: 'Sam', unit: 'kg', active_routine_id: null, onboarding_completed: true, goal_weight_kg: null };
        return [];
    }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('useProfile (client fetch)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reports loading then resolves the fetched profile with no initial data', async () => {
        const { result } = renderHook(() => useProfile(), { wrapper });
        // Default profile while loading
        expect(result.current.profile.display_name).toBeNull();
        await waitFor(() => expect(result.current.profile.display_name).toBe('Sam'));
        expect(result.current.loadingProfile).toBe(false);
    });
});
```

- [ ] **Step 6: Run the hook test + typecheck**

Run: `bun run test:run src/hooks/pulse/__tests__/useProfile.test.ts`
Expected: PASS.

Run: `bun run typecheck`
Expected: errors only at the provider call site (fixed in Task 3) — note them and proceed.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/pulse/useWorkoutLogs.ts src/hooks/pulse/useProfile.ts src/hooks/pulse/useRoutines.ts src/hooks/pulse/useNotes.ts src/hooks/pulse/__tests__/useProfile.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): hooks fetch client-side and expose loading/error"
```

---

## Task 3: Provider aggregates loading/error; gate onboarding; context type

**Files:**
- Modify: `src/components/pulse/PulseProvider.tsx`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/__tests__/DesktopLayout.test.tsx` (strictly-typed mock)

- [ ] **Step 1: Add the loading/error types to the context**

In `src/context/PulseContext.ts`, add to the `PulseContextValue` interface (near the routine state block):

```ts
    // Per-domain client-fetch state (phase-1 instant loading)
    loading: {
        profile: boolean;
        bodyweight: boolean;
        logs: boolean;
        routines: boolean;
        exercises: boolean;
        notes: boolean;
    };
    errors: {
        profile: boolean;
        bodyweight: boolean;
        logs: boolean;
        routines: boolean;
        exercises: boolean;
        notes: boolean;
    };
    retry: () => void;
```

- [ ] **Step 2: Make provider props optional and wire aggregation**

In `src/components/pulse/PulseProvider.tsx`:

(a) Make every `initial*` field optional in `Props`:

```ts
interface Props {
    initialLogs?: Logs;
    initialProfile?: Profile;
    initialBodyweightLogs?: BodyweightEntry[];
    initialExercises?: DbExercise[];
    initialRoutines?: RoutineWithExercises[];
    initialNotes?: Notes;
    email: string;
    navigate: (view: View) => void;
    children: React.ReactNode;
}
```

(b) Capture the new hook returns:

```ts
    const { logs, updateLog, deleteLog, handleExport, loading: loadingLogs, error: logsError } =
        useWorkoutLogs(initialLogs, onSaveError);
    const {
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    } = useProfile(initialProfile, initialBodyweightLogs);
```

Add to the `useRoutines(...)` destructure: `loadingExercises, loadingRoutines, exercisesError, routinesError`. Add to the `useNotes(...)` destructure: `loading: loadingNotes, error: notesError`.

(c) Use `useSWRConfig().mutate` for retry, and build the loading/errors objects (after the hook calls):

```ts
    const { mutate: globalMutate } = useSWRConfig();
    const retry = useCallback(() => {
        // Revalidate every SWR key.
        globalMutate(() => true);
    }, [globalMutate]);

    const loading = useMemo(
        () => ({
            profile: loadingProfile,
            bodyweight: loadingBodyweight,
            logs: loadingLogs,
            routines: loadingRoutines,
            exercises: loadingExercises,
            notes: loadingNotes,
        }),
        [loadingProfile, loadingBodyweight, loadingLogs, loadingRoutines, loadingExercises, loadingNotes],
    );

    const errors = useMemo(
        () => ({
            profile: !!profileError,
            bodyweight: !!bodyweightError,
            logs: !!logsError,
            routines: !!routinesError,
            exercises: !!exercisesError,
            notes: !!notesError,
        }),
        [profileError, bodyweightError, logsError, routinesError, exercisesError, notesError],
    );
```

(Add the `useSWRConfig` import: `import useSWR... ` is in hooks; in the provider add `import { useSWRConfig } from 'swr';`.)

(d) Gate the onboarding flash on loaded routines. Find `const showOnboarding = onboardingOverride ?? routines.length === 0;` and change to:

```ts
    const showOnboarding = onboardingOverride ?? (!loadingRoutines && routines.length === 0);
```

(e) Expose the three new values. Build a `loadingValue` memo and include it in the merged context value alongside the existing `routinesValue`, `uiStateValue`, etc.:

```ts
    const loadingValue = useMemo(() => ({ loading, errors, retry }), [loading, errors, retry]);
```

Then add `...loadingValue` to the object passed to `PulseContext.Provider value={{ ... }}` (the same place `...routinesValue` etc. are spread).

- [ ] **Step 3: Update the strictly-typed DesktopLayout mock**

In `src/components/pulse/__tests__/DesktopLayout.test.tsx`, add to `mockContext` (after `deleteNote`):

```ts
    loading: { profile: false, bodyweight: false, logs: false, routines: false, exercises: false, notes: false },
    errors: { profile: false, bodyweight: false, logs: false, routines: false, exercises: false, notes: false },
    retry: vi.fn(),
```

- [ ] **Step 4: Verify**

Run: `bun run typecheck`
Expected: no errors (PulseLayout still passes initial props — fixed next task; those props are now optional so this typechecks).

Run: `bun run test:run src/components/pulse/__tests__/DesktopLayout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/PulseProvider.tsx src/context/PulseContext.ts src/components/pulse/__tests__/DesktopLayout.test.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): provider exposes per-domain loading/errors/retry, gates onboarding"
```

---

## Task 4: Shell-first layout + SWR cache wiring

**Files:**
- Modify: `src/app/pulse/(protected)/layout.tsx`
- Modify: `src/components/pulse/PulseLayout.tsx`

- [ ] **Step 1: Layout stops prefetching**

Replace the body of `src/app/pulse/(protected)/layout.tsx` with a cheap auth-only version:

```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PulseLayout from '@/components/pulse/PulseLayout';

export const revalidate = 0;

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    // Data is fetched client-side via SWR (see PulseProvider hooks); the shell
    // renders immediately and each view shows skeletons until its slice arrives.
    return (
        <PulseLayout userId={user.id} email={user.email ?? ''}>
            {children}
        </PulseLayout>
    );
}
```

- [ ] **Step 2: PulseLayout drops initial props, threads userId, wraps SWRConfig**

Rewrite `src/components/pulse/PulseLayout.tsx`'s `Props`, signature, and tree:

```tsx
'use client';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Hanken_Grotesk, Sora } from 'next/font/google';
import { SWRConfig } from 'swr';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from './ToastContainer';
import { makeSWRCacheProvider } from '@/lib/pulse/swrCache';
import type { View } from '@/lib/pulse/types';
```

Keep the `hanken`/`sora` font consts and `PATH_TO_VIEW` unchanged. Replace `Props` and the component:

```tsx
interface Props {
    userId: string;
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ userId, email, children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = (pathname ? PATH_TO_VIEW[pathname] : undefined) ?? 'train';

    const navigate = useCallback((v: View) => router.push(`/pulse/${v}`), [router]);

    return (
        <div className={`${hanken.variable} ${sora.variable}`}>
            <SWRConfig value={{ provider: makeSWRCacheProvider(userId) }}>
                <ToastProvider>
                    <PulseProvider email={email} navigate={navigate}>
                        <AppShell view={view} navigate={navigate}>
                            {children}
                        </AppShell>
                        <ToastContainer />
                    </PulseProvider>
                </ToastProvider>
            </SWRConfig>
        </div>
    );
}
```

- [ ] **Step 3: Verify**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run build`
Expected: build succeeds (the protected layout is now a thin server component; pages render the shell).

- [ ] **Step 4: Commit**

```bash
git add "src/app/pulse/(protected)/layout.tsx" src/components/pulse/PulseLayout.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): shell-first layout, client data via SWR with persisted cache"
```

---

## Task 5: Skeleton primitive + per-view skeletons & error states

**Files:**
- Create: `src/components/pulse/PageSkeleton.tsx`
- Create: `src/components/pulse/__tests__/PageSkeleton.test.tsx`
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/views/ProgramView.tsx`
- Modify: `src/components/pulse/views/HistoryView.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`
- Modify: `src/components/pulse/views/LibraryView.tsx`

- [ ] **Step 1: Build the skeleton primitive**

```tsx
// src/components/pulse/PageSkeleton.tsx
// Slate shimmer skeleton reused by every view while its data slice loads.
// `rows` controls how many card placeholders render.
const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #161a1d 25%, #1c2125 50%, #161a1d 75%)',
    backgroundSize: '200% 100%',
    animation: 'pulse-shimmer 1.4s ease infinite',
};

export function SkeletonBar({ w = '100%', h = 12 }: { w?: number | string; h?: number }) {
    return <div aria-hidden style={{ width: w, height: h, borderRadius: 6, ...shimmer }} />;
}

export default function PageSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="px-4 pt-6 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-3" aria-busy="true">
            <SkeletonBar w={140} h={14} />
            <div className="flex flex-col gap-2 mt-2">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="bg-pulse-surface rounded-xl py-3.5 px-4 flex items-center gap-4">
                        <div style={{ width: 36, height: 28, borderRadius: 6, ...shimmer }} />
                        <div className="flex-1 flex flex-col gap-2">
                            <SkeletonBar w={`${55 + i * 7}%`} />
                            <SkeletonBar w="40%" h={8} />
                        </div>
                    </div>
                ))}
            </div>
            <style>{`@keyframes pulse-shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
    );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="px-4 py-16 flex flex-col items-center gap-3 text-center" role="alert">
            <div className="font-pulse text-sm text-pulse-dim">Couldn’t load your data.</div>
            <button
                onClick={onRetry}
                className="font-pulse text-sm font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-4 py-2 cursor-pointer border-none">
                Retry
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Test the primitive**

```tsx
// src/components/pulse/__tests__/PageSkeleton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageSkeleton, { ErrorState } from '../PageSkeleton';

describe('PageSkeleton', () => {
    it('renders an aria-busy container', () => {
        const { container } = render(<PageSkeleton rows={3} />);
        expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    });

    it('ErrorState calls onRetry', async () => {
        const onRetry = vi.fn();
        render(<ErrorState onRetry={onRetry} />);
        await userEvent.click(screen.getByRole('button', { name: /retry/i }));
        expect(onRetry).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 3: Gate each view on its loading/error slice**

For each view, pull `loading`, `errors`, `retry` from `usePulse()` (optional-chained so existing test mocks that omit them behave as "loaded"), and early-return the skeleton/error before the normal render. Insert at the top of each component body, after the `usePulse()` destructure.

`LogView.tsx` and `ProgramView.tsx` and `HistoryView.tsx` (train/plan/progress depend on routines + logs):

```tsx
    const { loading, errors, retry } = usePulse();
    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;
```

`ProfileView.tsx` (profile + bodyweight):

```tsx
    if (errors?.profile || errors?.bodyweight) return <ErrorState onRetry={retry} />;
    if (loading?.profile || loading?.bodyweight) return <PageSkeleton rows={3} />;
```

`LibraryView.tsx` (exercises + routines):

```tsx
    if (errors?.exercises || errors?.routines) return <ErrorState onRetry={retry} />;
    if (loading?.exercises || loading?.routines) return <PageSkeleton />;
```

Add `import PageSkeleton, { ErrorState } from '../PageSkeleton';` to each view (adjust relative path: views are in `src/components/pulse/views/`, so `'../PageSkeleton'`). Add `loading, errors, retry` to each view's existing `usePulse()` destructure (do not add a second `usePulse()` call).

Note: existing view tests mock `usePulse` without `loading`/`errors`, so `loading?.x` is `undefined` -> falsy -> the view renders content exactly as before. No existing view test needs changes.

- [ ] **Step 4: Verify**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run`
Expected: all suites PASS (existing view tests unaffected; new PageSkeleton tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/PageSkeleton.tsx src/components/pulse/__tests__/PageSkeleton.test.tsx src/components/pulse/views/LogView.tsx src/components/pulse/views/ProgramView.tsx src/components/pulse/views/HistoryView.tsx src/components/pulse/views/ProfileView.tsx src/components/pulse/views/LibraryView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): per-view Slate skeletons and retry error states"
```

---

## Task 6: Clear the cache on logout

**Files:**
- Modify: `src/components/pulse/DesktopLayout.tsx` (sign-out form)
- Modify: `src/components/pulse/BottomNav.tsx` (if it renders a sign-out control)
- Modify: `src/components/pulse/views/ProfileView.tsx` (if it renders a sign-out control)

- [ ] **Step 1: Find every logout trigger**

Run: `grep -rn "action={logout}\|logout(" src/components/ src/app/pulse`
Expected: at least the DesktopLayout sign-out form. Note each `<form action={logout}>` / sign-out button.

- [ ] **Step 2: Clear local cache as the form submits**

For each sign-out `<form action={logout}>`, add an `onClick` to its submit button that wipes the local cache before the server action runs (so the next account on this device starts clean):

```tsx
import { clearAllSWRCache } from '@/lib/pulse/swrCache';
// ...
<button
    type="submit"
    onClick={() => clearAllSWRCache()}
    aria-label="Sign out of Pulse"
    /* keep existing classes */
>
```

Apply the same `onClick={() => clearAllSWRCache()}` to any other sign-out button found in Step 1. (`clearAllSWRCache` is safe to call client-side; the components are already `'use client'`.)

- [ ] **Step 3: Verify**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run src/components/pulse/__tests__/DesktopLayout.test.tsx`
Expected: PASS (the sign-out button still renders; `clearAllSWRCache` is a no-op in jsdom with empty storage).

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/DesktopLayout.tsx src/components/pulse/BottomNav.tsx src/components/pulse/views/ProfileView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(loading): clear the persisted SWR cache on sign out"
```

(Only stage the files that actually contained a sign-out control.)

---

## Task 7: Final verification + roadmap

- [ ] **Step 1:** `bun run typecheck` — no errors.
- [ ] **Step 2:** `bun run test:run` — all suites green.
- [ ] **Step 3:** `bun run build` — production build succeeds (confirms the layout is no longer statically blocked and the client tree compiles).
- [ ] **Step 4:** `bun run lint` — no new warnings beyond the known pre-existing `exhaustive-deps` ones (SetLogger, RoutinesTab). If a new `exhaustive-deps` warning appears on the provider's new `useMemo`/`useCallback`, satisfy it by listing the dependencies shown above (they are all stable hook returns).
- [ ] **Step 5:** Format the touched files:

```bash
bunx prettier --write src/lib/pulse/swrCache.ts src/lib/pulse/__tests__/swrCache.test.ts src/hooks/pulse/useWorkoutLogs.ts src/hooks/pulse/useProfile.ts src/hooks/pulse/useRoutines.ts src/hooks/pulse/useNotes.ts src/hooks/pulse/__tests__/useProfile.test.ts src/components/pulse/PulseProvider.tsx src/context/PulseContext.ts "src/app/pulse/(protected)/layout.tsx" src/components/pulse/PulseLayout.tsx src/components/pulse/PageSkeleton.tsx src/components/pulse/__tests__/PageSkeleton.test.tsx src/components/pulse/views/LogView.tsx src/components/pulse/views/ProgramView.tsx src/components/pulse/views/HistoryView.tsx src/components/pulse/views/ProfileView.tsx src/components/pulse/views/LibraryView.tsx src/components/pulse/DesktopLayout.tsx src/components/pulse/__tests__/DesktopLayout.test.tsx
```

- [ ] **Step 6:** Add a "Shipped" line to `docs/roadmap.md` (note: if `docs/roadmap-sync` is still unmerged, add it there instead to avoid a conflict):

```
- Instant loading (phase 1 of offline-first) — shell-first render; data fetched client-side via SWR with per-view Slate skeletons; user-scoped localStorage SWR cache (cleared on logout) makes warm visits instant via stale-while-revalidate
```

Commit:

```bash
git add docs/roadmap.md
GIT_CONFIG_GLOBAL=/dev/null git commit -m "docs(roadmap): mark instant loading (phase 1) shipped"
```

---

## Self-review notes

- **Spec coverage:** shell-first layout (Task 4), client SWR + loading/error (Task 2), provider aggregation + onboarding gate (Task 3), per-view skeletons + error/retry (Task 5), user-scoped persisted cache + logout clear (Tasks 1, 6). Out-of-scope items (service worker, offline mutations) are not in any task — correct.
- **Onboarding flash:** explicitly handled by gating `showOnboarding` on `!loadingRoutines` (Task 3 Step 2d), so the onboarding modal does not flash before routines load.
- **Test-mock safety:** views read `loading?.x` / `errors?.x` so existing `usePulse` mocks (which omit these) render content unchanged; only the strictly-typed DesktopLayout mock is updated (Task 3 Step 3).
- **Type consistency:** `loading`/`errors` use the same six keys (`profile, bodyweight, logs, routines, exercises, notes`) in the context type, the provider memos, and the DesktopLayout mock. `makeSWRCacheProvider(userId)` and `clearAllSWRCache()` names match across Tasks 1, 4, 6.
- **No persistence of secrets:** the cache holds the user's own training data, scoped by id and cleared on logout — matches the spec's privacy requirement.
