# Pulse Feature Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six parallel improvements — day/week display fixes, proper Next.js page routing with renamed views, dynamic volume scaling by session duration, female-focused templates, program view rework, and profile enhancements (historical body weight, PRs, measurements, streak, goal weight).

**Architecture:** The app currently uses a single `/pulse` server route with client-side view switching via `view` state in PulseContext. Task 2 migrates this to proper Next.js App Router pages with a shared `layout.tsx` loading initial data, each view becoming its own route. All other tasks are additive changes on top of the existing data model.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), SWR, Vitest + Testing Library, bun

---

## File Map

| File | Action | Task |
|---|---|---|
| `src/components/pulse/OnboardingModal.tsx` | Modify | 1, 3 |
| `src/components/pulse/DayTabs.tsx` | Modify | 1 |
| `src/components/pulse/__tests__/DayTabs.test.tsx` | Modify | 1 |
| `src/app/pulse/layout.tsx` | Create | 2 |
| `src/components/pulse/PulseLayout.tsx` | Create | 2 |
| `src/app/pulse/page.tsx` | Modify (redirect) | 2 |
| `src/app/pulse/train/page.tsx` | Create | 2 |
| `src/app/pulse/plan/page.tsx` | Create | 2 |
| `src/app/pulse/progress/page.tsx` | Create | 2 |
| `src/app/pulse/profile/page.tsx` | Create | 2 |
| `src/app/pulse/explore/page.tsx` | Create | 2 |
| `src/components/pulse/BottomNav.tsx` | Modify | 2 |
| `src/components/pulse/TrackerClient.tsx` | Delete | 2 |
| `src/components/pulse/AppShell.tsx` | Modify | 2 |
| `src/lib/pulse/types.ts` | Modify | 2, 6 |
| `src/context/PulseContext.ts` | Modify | 2, 3 |
| `src/components/pulse/PulseProvider.tsx` | Modify | 2 |
| `src/app/pulse/actions.ts` | Modify | 3, 6 |
| `src/hooks/pulse/useRoutines.ts` | Modify | 3 |
| `docs/migrations/2026-05-29-female-templates.sql` | Create | 4 |
| `src/components/pulse/views/ProgramView.tsx` | Modify | 5 |
| `src/components/pulse/views/ProfileView.tsx` | Modify | 6 |
| `docs/migrations/2026-05-29-profile-enhancements.sql` | Create | 6 |

---

## Task 1: Day & Week Display Fixes

**Files:** Modify `src/components/pulse/OnboardingModal.tsx`, `src/components/pulse/DayTabs.tsx`, `src/components/pulse/__tests__/DayTabs.test.tsx`

### Change 1: Week starts Monday in day picker

- [ ] In `src/components/pulse/OnboardingModal.tsx`, find the day picker `{[0,1,2,3,4,5,6].map(...)}` and change to start from Monday:

```tsx
{[1, 2, 3, 4, 5, 6, 0].map((d) => (
    <button
        key={d}
        onClick={() =>
            setTrainingDays((prev) =>
                prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
            )
        }
        className={`font-pulse text-xs font-semibold rounded-full w-12 h-12 border cursor-pointer transition-colors ${
            trainingDays.includes(d)
                ? 'bg-pulse-accent text-black border-pulse-accent'
                : 'bg-transparent text-pulse-dim border-pulse-border'
        }`}>
        {DAY_NAMES[d]}
    </button>
))}
```

### Change 2: All 7 days visible in DayTabs

- [ ] Update `src/components/pulse/DayTabs.tsx` to show all 7 days Mon–Sun, non-training days shown as "Rest" and non-interactive.

> **Note:** `DAY_NAMES` and `WORKOUT_TYPE_LABELS` come from `@/lib/pulse/constants` (already imported). `TabButton` is the shared tab primitive (already imported). Do not define local constants.

```tsx
'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import TabButton from './TabButton';
import type { WorkoutType } from '@/lib/pulse/types';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByType } = usePulse();
    const today = new Date().getDay();
    const scheduleMap = Object.fromEntries(
        activeSchedule.map((e) => [e.day_of_week, e.workout_type])
    ) as Partial<Record<number, WorkoutType>>;

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3 overflow-x-auto [scrollbar-width:none]">
            {WEEK_ORDER.map((dow) => {
                const workoutType = scheduleMap[dow];
                const isTraining = workoutType !== undefined;
                const active = activeDay === dow && isTraining;
                const isToday = dow === today;

                const exercises = isTraining ? (routineExercisesByType[workoutType!] ?? []) : [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;

                if (!isTraining) {
                    return (
                        <button
                            key={dow}
                            role="tab"
                            id={`tab-day-${dow}`}
                            aria-selected={false}
                            disabled
                            className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl border shrink-0 border-pulse-border bg-transparent text-pulse-muted opacity-40 cursor-default">
                            <span className="font-pulse text-sm font-semibold">{DAY_NAMES[dow]}</span>
                            <span className="font-pulse text-[0.625rem] tracking-[0.04em] text-pulse-muted">Rest</span>
                        </button>
                    );
                }

                return (
                    <TabButton
                        key={dow}
                        id={`tab-day-${dow}`}
                        active={active}
                        controls={`panel-${workoutType}`}
                        onClick={() => setActiveDay(dow)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl shrink-0">
                        <span className="font-pulse text-sm font-semibold">{DAY_NAMES[dow]}</span>
                        <span className={`font-pulse text-[0.625rem] tracking-[0.04em] ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                            {WORKOUT_TYPE_LABELS[workoutType!]}
                        </span>
                        {isToday && (
                            <span aria-label="today" className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulse-accent" />
                        )}
                    </TabButton>
                );
            })}
        </div>
    );
}
```

- [ ] Update `src/components/pulse/__tests__/DayTabs.test.tsx` — update the "renders a tab for each scheduled day" test to also assert that Wed (rest day) IS in the DOM but is disabled:

```ts
it('renders all 7 days, with non-training days disabled', () => {
    render(<DayTabs />);
    // Training days
    expect(screen.getByRole('tab', { name: /mon/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tue/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /thu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fri/i })).toBeInTheDocument();
    // Rest days — present but disabled
    expect(screen.getByRole('tab', { name: /wed/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /wed/i })).toBeDisabled();
});

it('shows "Rest" label for non-training days', () => {
    render(<DayTabs />);
    const wedTab = screen.getByRole('tab', { name: /wed/i });
    expect(wedTab).toHaveTextContent('Rest');
});
```

- [ ] Run: `bun run test src/components/pulse/__tests__/DayTabs.test.tsx` — all pass

- [ ] Run: `bun run test && bun run typecheck`

- [ ] Commit:
```
git add src/components/pulse/OnboardingModal.tsx src/components/pulse/DayTabs.tsx src/components/pulse/__tests__/DayTabs.test.tsx
git commit -m "fix(pulse): week starts Monday in day picker, show all 7 days in DayTabs"
```

---

## Task 2: Pages Architecture + View Renaming

**Recommendation (Option A):** Proper Next.js App Router pages — each view becomes its own route. Gives browser back/forward, bookmarkable URLs, per-page scroll state.

**Alternative (Option B):** URL-sync the existing view state — keep client-side switching but push URL on navigate. Lower-risk, less refactor. Choose this if Task 2 scope feels too large.

**This plan implements Option A.**

**View rename map:**
| Old | New route | Label |
|-----|-----------|-------|
| `log` | `/pulse/train` | Train |
| `program` | `/pulse/plan` | Plan |
| `history` | `/pulse/progress` | Progress |
| `profile` | `/pulse/profile` | Profile |
| `library` | `/pulse/explore` | Explore |

### Step 1: Update `View` type

- [ ] In `src/lib/pulse/types.ts`, update the `VIEWS` const array and the `View` type derived from it. The `View` type is currently derived from a `VIEWS` array (not a standalone type alias), so **both** the array and the type must be updated together:

```ts
export const VIEWS = ['train', 'plan', 'progress', 'profile', 'explore'] as const;
export type View = typeof VIEWS[number];
```

> **Note:** Do not write `export type View = 'train' | 'plan' | ...` as a standalone alias — the type must remain derived from the `VIEWS` array so that runtime code that iterates `VIEWS` stays in sync.

### Step 2: Create `src/app/pulse/layout.tsx`

Move all data fetching from `page.tsx` into the layout:

```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import PulseLayout from '@/components/pulse/PulseLayout';
import type { Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

export const revalidate = 0;

export default async function Layout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    const [logsResult, profileResult, bwResult, exercisesResult, routinesResult] = await Promise.all([
        supabase.from('set_logs').select('week, routine_exercise_id, set_idx, kg, reps, rir, saved').eq('user_id', user.id),
        supabase.from('profiles').select('display_name, unit, active_routine_id, onboarding_completed').eq('id', user.id).single(),
        supabase.from('bodyweight_logs').select('id, logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(90),
        supabase.from('exercises').select('id, name, category, default_sets, default_reps, user_id').or(`user_id.is.null,user_id.eq.${user.id}`).order('name', { ascending: true }),
        supabase.from('workout_routines').select(`
            id, user_id, name, created_at,
            exercises:routine_exercises ( id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, exercise:exercises ( id, name, category, default_sets, default_reps, user_id ) ),
            schedule:routine_schedule ( day_of_week, workout_type )
        `).eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);

    let logs: Logs = {};
    try {
        if (logsResult.error) throw logsResult.error;
        const raw: Record<string, unknown> = {};
        for (const row of logsResult.data ?? []) {
            raw[`${row.week}-${row.routine_exercise_id}-${row.set_idx}`] = { kg: Number(row.kg), reps: row.reps, rir: row.rir, saved: row.saved };
        }
        if (validateLogs(raw)) logs = raw;
    } catch { throw new Error('Failed to load training data.'); }

    const profileRow = profileResult.data;
    const profile: Profile = {
        display_name: profileRow?.display_name ?? null,
        unit: profileRow?.unit === 'lbs' ? 'lbs' : 'kg',
        active_routine_id: profileRow?.active_routine_id ?? null,
        onboarding_completed: profileRow?.onboarding_completed ?? false,
    };

    const bodyweightLogs: BodyweightEntry[] = (bwResult.data ?? []).map((r: { id: string; logged_at: string; weight_kg: number }) => ({ id: r.id, logged_at: r.logged_at, weight_kg: Number(r.weight_kg) }));

    const rawExercises = (exercisesResult.data ?? []) as DbExercise[];
    const exercises: DbExercise[] = rawExercises.sort((a, b) => {
        if (a.user_id === null && b.user_id !== null) return -1;
        if (a.user_id !== null && b.user_id === null) return 1;
        return a.name.localeCompare(b.name);
    });

    const routines: RoutineWithExercises[] = ((routinesResult.data ?? []) as unknown as RoutineWithExercises[]).map((r) => ({
        ...r,
        exercises: [...(r.exercises ?? [])].sort((a, b) => a.order - b.order),
        schedule: [...(r.schedule ?? [])].sort((a, b) => a.day_of_week - b.day_of_week),
    }));

    return (
        <PulseLayout
            initialLogs={logs}
            initialProfile={profile}
            initialBodyweightLogs={bodyweightLogs}
            initialExercises={exercises}
            initialRoutines={routines}
            email={user.email ?? ''}>
            {children}
        </PulseLayout>
    );
}
```

### Step 3: Create `src/components/pulse/PulseLayout.tsx`

This replaces `TrackerClient` + `AppShell`'s view-switching role:

```tsx
'use client';
import { PulseProvider } from './PulseProvider';
import BottomNav from './BottomNav';
import OnboardingModal from './OnboardingModal';
import { usePulse } from '@/context/PulseContext';
import { usePathname, useRouter } from 'next/navigation';
import type { Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';
import type { View } from '@/lib/pulse/types';

const PATH_TO_VIEW: Record<string, View> = {
    '/pulse/train': 'train',
    '/pulse/plan': 'plan',
    '/pulse/progress': 'progress',
    '/pulse/profile': 'profile',
    '/pulse/explore': 'explore',
};

function Shell({ children }: { children: React.ReactNode }) {
    const { showOnboarding } = usePulse();
    const router = useRouter();
    const pathname = usePathname();
    const view = PATH_TO_VIEW[pathname] ?? 'train';

    function navigate(v: View) {
        router.push(`/pulse/${v}`);
    }

    return (
        <div className="min-h-screen bg-pulse-bg">
            <main className="pb-20">{children}</main>
            <BottomNav view={view} onNavigate={navigate} />
            {showOnboarding && <OnboardingModal />}
        </div>
    );
}

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ children, ...props }: Props) {
    return (
        <PulseProvider {...props}>
            <Shell>{children}</Shell>
        </PulseProvider>
    );
}
```

### Step 4: Update `src/context/PulseContext.ts`

- [ ] Change `navigate` signature (no longer sets view state — navigation is handled by router):
```ts
navigate: (view: View) => void;
```
(Keep same signature; implementation changes in PulseProvider.)

- [ ] Remove `view` and `setView` from context — view is now derived from URL.

### Step 5: Update `src/components/pulse/PulseProvider.tsx`

- [ ] Remove `view` state and `navigate` function that sets it.
- [ ] `navigate` in contextValue becomes a no-op placeholder (the real navigate is injected by `Shell` via the `usePulse` call). OR: add a `navigate` ref that `Shell` can set.

The cleanest approach: pass `navigate` as a prop to PulseProvider and store it in context:

```tsx
// PulseProvider.tsx
interface ProviderProps {
    // ...existing props
    navigate?: (view: View) => void;
}

// Inside PulseProvider, add to contextValue:
navigate: props.navigate ?? (() => {}),
```

`Shell` component (in PulseLayout) provides `navigate` via re-render, or use a ref approach. The simplest: PulseProvider accepts `navigate` as a prop from PulseLayout.

### Step 6: Update `src/app/pulse/page.tsx`

- [ ] Replace entire file with redirect:

```tsx
import { redirect } from 'next/navigation';

export default function PulsePage() {
    redirect('/pulse/train');
}
```

### Step 7: Create individual page files

- [ ] `src/app/pulse/train/page.tsx`:
```tsx
import LogView from '@/components/pulse/views/LogView';
export default function TrainPage() { return <LogView />; }
```

- [ ] `src/app/pulse/plan/page.tsx`:
```tsx
import ProgramView from '@/components/pulse/views/ProgramView';
export default function PlanPage() { return <ProgramView />; }
```

- [ ] `src/app/pulse/progress/page.tsx`:
```tsx
import HistoryView from '@/components/pulse/views/HistoryView';
export default function ProgressPage() { return <HistoryView />; }
```

- [ ] `src/app/pulse/profile/page.tsx`:
```tsx
import ProfileView from '@/components/pulse/views/ProfileView';
export default function ProfilePage() { return <ProfileView />; }
```

- [ ] `src/app/pulse/explore/page.tsx`:
```tsx
import LibraryView from '@/components/pulse/views/LibraryView';
export default function ExplorePage() { return <LibraryView />; }
```

### Step 8: Update `src/components/pulse/BottomNav.tsx`

- [ ] Update `ITEMS` array with new IDs and labels:

```ts
import Link from 'next/link';

const ITEMS: { id: View; label: string; href: string; icon: React.ReactNode }[] = [
    { id: 'train',    label: 'Train',    href: '/pulse/train',    icon: /* grid icon */ },
    { id: 'plan',     label: 'Plan',     href: '/pulse/plan',     icon: /* chart icon */ },
    { id: 'progress', label: 'Progress', href: '/pulse/progress', icon: /* clock icon */ },
    { id: 'profile',  label: 'Profile',  href: '/pulse/profile',  icon: /* person icon */ },
    { id: 'explore',  label: 'Explore',  href: '/pulse/explore',  icon: /* library icon */ },
];
```

- [ ] Replace `<button onClick>` with `<Link href>` for each item. Keep `aria-current` based on `view` prop.

### Step 9: Update all `navigate('log')` call sites

- [ ] Search for `navigate('log')` and replace with `navigate('train')`. Same for `'program'` → `'plan'`, `'history'` → `'progress'`, `'library'` → `'explore'`.

```
bun run grep -r "navigate\(" src/
```

Fix each call site to use the new view names.

### Step 10: Delete `TrackerClient.tsx`

- [ ] `src/components/pulse/TrackerClient.tsx` is replaced by `PulseLayout.tsx`. Delete the file.

### Step 11: Update AppShell

- [ ] `src/components/pulse/AppShell.tsx` — remove view-switching logic. It can be simplified or deleted if PulseLayout handles the shell. Check if anything still imports AppShell.

### Step 12: Typecheck + tests

- [ ] `bun run typecheck`
- [ ] `bun run test`

- [ ] Commit:
```
git add -A
git commit -m "feat(pulse): convert to Next.js pages, rename views (train/plan/progress/explore)"
```

---

## Task 3: Dynamic Volume by Session Duration

**Files:** Modify `src/app/pulse/actions.ts`, `src/components/pulse/OnboardingModal.tsx`, `src/hooks/pulse/useRoutines.ts`, `src/context/PulseContext.ts`

**Rules:**
| Session time | Exercise cap per workout_type | Sets adjustment |
|---|---|---|
| `~30 min` | Top 4 by order | −1 set (min 2) |
| `45–60 min` | All (unchanged) | None |
| `90+ min` | All | +1 set (max 5) |

### Step 1: Add set adjustment helpers to `src/app/pulse/actions.ts`

- [ ] Add these helper functions before `cloneTemplate`:

```ts
function adjustSets(sets: string, delta: number): string {
    // Handles "3", "3-4", "3-5" formats
    const parts = sets.split('-').map(Number);
    if (parts.length === 1) {
        return String(Math.min(5, Math.max(2, parts[0] + delta)));
    }
    return `${Math.min(5, Math.max(2, parts[0] + delta))}-${Math.min(5, Math.max(2, parts[1] + delta))}`;
}

function applyVolume(
    exercises: Array<{ exercise_id: string; workout_type: string; order: number; sets: string; reps: string }>,
    sessionTime: string,
): typeof exercises {
    if (sessionTime === '~30 min') {
        // Group by workout_type, take top 4 per group, reduce sets
        const groups: Record<string, typeof exercises> = {};
        for (const ex of exercises) {
            groups[ex.workout_type] = groups[ex.workout_type] ?? [];
            groups[ex.workout_type].push(ex);
        }
        return Object.values(groups)
            .flatMap((group) => group.slice(0, 4))
            .map((ex) => ({ ...ex, sets: adjustSets(ex.sets, -1) }));
    }
    if (sessionTime === '90+ min') {
        return exercises.map((ex) => ({ ...ex, sets: adjustSets(ex.sets, 1) }));
    }
    return exercises; // '45–60 min' — standard
}
```

### Step 2: Update `cloneTemplate` signature

- [ ] Add `sessionTime?: string` parameter and apply volume:

```ts
export async function cloneTemplate(slug: string, trainingDays?: number[], sessionTime?: string): Promise<WorkoutRoutine> {
    // ... existing validation and auth ...

    // After fetching template exercises, apply volume adjustment:
    const rawExercises = (template as any).template_exercises as Array<{
        exercise_id: string; workout_type: string; order: number; sets: string; reps: string;
    }>;
    const exercises = sessionTime ? applyVolume(rawExercises, sessionTime) : rawExercises;

    // ... rest unchanged, use `exercises` instead of `rawExercises` ...
}
```

### Step 3: Update `src/hooks/pulse/useRoutines.ts`

- [ ] Update `cloneTemplate` callback:

```ts
const cloneTemplate = useCallback(async (slug: string, trainingDays?: number[], sessionTime?: string): Promise<WorkoutRoutine> => {
    const routine = await serverCloneTemplate(slug, trainingDays, sessionTime);
    await mutateRoutines();
    await globalMutate(PROFILE_KEY);
    return routine;
}, [mutateRoutines, globalMutate]);
```

### Step 4: Update `src/context/PulseContext.ts`

- [ ] Update `cloneTemplate` signature:
```ts
cloneTemplate: (slug: string, trainingDays?: number[], sessionTime?: string) => Promise<WorkoutRoutine>;
```

### Step 5: Update `src/components/pulse/OnboardingModal.tsx`

- [ ] `sessionTime` is already tracked in state. Update `handleStart` to pass it:

```ts
function handleStart(slug: string) {
    setLoading(true);
    void startTransition(() => {
        void (async () => {
            await cloneTemplate(
                slug,
                trainingDays.length > 0 ? trainingDays : undefined,
                sessionTime ?? undefined,
            );
            await completeOnboarding();
            dismissOnboarding();
            navigate('train');
            setLoading(false);
        })();
    });
}
```

### Step 6: Update `TemplatesTab.tsx` — add session time prompt

When cloning from the template library (not onboarding), ask for session duration:

- [ ] In `src/components/pulse/views/TemplatesTab.tsx` (currently in `LibraryView.tsx`), update `handleUse` to prompt for session time:

```ts
async function handleUse(slug: string) {
    if (routines.length > 0 && !window.confirm('This will set a new active routine. Continue?')) return;
    const sessionTime = window.prompt(
        'How long are your sessions?\nEnter: ~30 min | 45–60 min | 90+ min',
        '45–60 min',
    );
    await cloneTemplate(slug, undefined, sessionTime ?? undefined);
}
```

(A proper modal UI can replace the prompt in a later polish pass.)

### Step 7: Typecheck + tests

- [ ] `bun run typecheck`
- [ ] `bun run test`

- [ ] Commit:
```
git add src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts src/components/pulse/OnboardingModal.tsx
git commit -m "feat(pulse): dynamic volume — scale exercises/sets by session duration at clone time"
```

---

## Task 4: Female-Focused Templates

**Files:** Create `docs/migrations/2026-05-29-female-templates.sql`

Templates to add (IDs 015–017):

| # | Name | Slug | Days | Level | Equipment |
|---|------|------|------|-------|-----------|
| 015 | Glute Focus — Gym | `glute-focus-gym` | 4×/week | intermediate | gym |
| 016 | Lower Body — Gym | `lower-body-gym` | 3×/week | beginner | gym |
| 017 | Full Body Tone — Dumbbells | `full-body-tone-db` | 3×/week | beginner | dumbbells |

- [ ] Create `docs/migrations/2026-05-29-female-templates.sql`:

```sql
-- ============================================================
-- Migration: female-focused templates
-- 2026-05-29
-- ============================================================

-- STEP 1: Insert 3 female-focused routine templates
INSERT INTO routine_templates (id, name, slug, required_equipment, days_per_week, experience_level, session_time, description, schedule_pattern, default_days)
VALUES
  (
    'a1000000-0000-0000-0000-000000000015',
    'Glute Focus — Gym',
    'glute-focus-gym',
    ARRAY['cables','machines'],
    '4',
    'intermediate',
    '45–60 min',
    'Upper/lower split emphasising glutes and hamstrings on lower days.',
    ARRAY['lower','upper','lower','upper'],
    ARRAY[1,2,4,5]
  ),
  (
    'a1000000-0000-0000-0000-000000000016',
    'Lower Body — Gym',
    'lower-body-gym',
    ARRAY['barbell','machines'],
    '3',
    'beginner',
    '45–60 min',
    'Three full lower-body sessions per week. Great starting point for building leg and glute strength.',
    ARRAY['lower','lower','lower'],
    ARRAY[1,3,5]
  ),
  (
    'a1000000-0000-0000-0000-000000000017',
    'Full Body Tone — Dumbbells',
    'full-body-tone-db',
    ARRAY['dumbbells'],
    '3',
    'beginner',
    '30–45 min',
    'Three full-body dumbbell sessions. Higher reps, compound movements, no equipment beyond a pair of dumbbells.',
    ARRAY['full_body','full_body','full_body'],
    ARRAY[1,3,5]
  )
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Template exercises for Glute Focus — Gym (015)
-- Lower day A: glute/hamstring focus
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 1, '4', '10-12'
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 2, '3', '8-10'
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 3, '3', '10-12'
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 4, '3', '12-15'
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 5, '3', '15-20'
FROM exercises WHERE name = 'Glute Bridge' AND user_id IS NULL LIMIT 1;

-- Upper day: balanced pull + push
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 1, '3', '10-12'
FROM exercises WHERE name = 'Lat Pulldown' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 2, '3', '10-12'
FROM exercises WHERE name = 'Seated Cable Row' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 3, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Shoulder Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 4, '3', '15-20'
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 5, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Chest Press' AND user_id IS NULL LIMIT 1;

-- STEP 3: Template exercises for Lower Body — Gym (016)
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 1, '3', '8-10'
FROM exercises WHERE name = 'Squat' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 2, '3', '10-12'
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 3, '3', '10-12'
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 4, '3', '12-15'
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 5, '3', '12-15'
FROM exercises WHERE name = 'Walking Lunge' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 6, '3', '12-15'
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL LIMIT 1;

-- STEP 4: Template exercises for Full Body Tone — Dumbbells (017)
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 1, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Squat' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 2, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 3, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Row' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 4, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Chest Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 5, '3', '15-20'
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 6, '3', '15-20'
FROM exercises WHERE name = 'Dumbbell Lunge' AND user_id IS NULL LIMIT 1;

-- STEP 5: Update routine_templates CHECK to allow 17 templates
-- (no constraint change needed — id is uuid, no sequence to update)

-- Verify
SELECT slug, schedule_pattern, default_days FROM routine_templates ORDER BY slug;
SELECT t.slug, count(te.template_id) as exercise_count
FROM routine_templates t
LEFT JOIN template_exercises te ON te.template_id = t.id
GROUP BY t.slug ORDER BY t.slug;
```

- [ ] Apply in Supabase SQL Editor

- [ ] **Verify exercise name matches:** Before running, check exact names:
```sql
SELECT name FROM exercises WHERE user_id IS NULL AND name ILIKE '%hip thrust%';
SELECT name FROM exercises WHERE user_id IS NULL AND name ILIKE '%squat%';
SELECT name FROM exercises WHERE user_id IS NULL AND name ILIKE '%row%';
```
Adjust exercise names in the migration to match exact seeded names.

- [ ] Verify counts match (each template should have exercises inserted):
```sql
SELECT t.slug, count(te.id) FROM routine_templates t
LEFT JOIN template_exercises te ON te.template_id = t.id
WHERE t.slug IN ('glute-focus-gym','lower-body-gym','full-body-tone-db')
GROUP BY t.slug;
-- Expected: glute-focus-gym=10, lower-body-gym=6, full-body-tone-db=6
```

- [ ] Commit:
```
git add docs/migrations/2026-05-29-female-templates.sql
git commit -m "feat(pulse): add 3 female-focused routine templates — glute focus, lower body, full body tone"
```

---

## Task 5: Program View Rework

**Files:** Modify `src/components/pulse/views/ProgramView.tsx`

**Issues to fix:**
1. `handleSelectWeek` calls `navigate('log')` — user stays on Plan page
2. Weekly schedule display uses static `SCHEDULE` from data.ts — should use `activeSchedule`
3. Workout list hardcoded to `['push','pull','legs']` — should reflect active routine's actual workout types

- [ ] Read `src/components/pulse/views/ProgramView.tsx` in full. Then apply changes:

**Fix 1 — remove navigate redirect:**
```ts
function handleSelectWeek(w: number) {
    setActiveWeek(w);
    // removed: navigate('log')
}
```

**Fix 2 — dynamic schedule display using activeSchedule:**

Add `activeSchedule` to the `usePulse()` destructure. Replace the static SCHEDULE section.

> **Note:** `SectionLabel` is now available as a shared component — use `<SectionLabel className="mb-2">` instead of the raw `<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">` pattern. Import it from `@/components/pulse/SectionLabel`.

```tsx
// Replace the "Weekly Schedule" section that uses SCHEDULE with:
// Import at top: import SectionLabel from '@/components/pulse/SectionLabel';
<div className="mb-6">
    <SectionLabel className="mb-2">Weekly Schedule</SectionLabel>
    {activeSchedule.length > 0 ? (
        <div className="flex gap-[0.375rem]">
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const entry = activeSchedule.find((e) => e.day_of_week === dow);
                const isRest = !entry;
                const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                const label = isRest ? '—' : entry!.workout_type.charAt(0).toUpperCase();
                return (
                    <div key={dow} className="flex-1 text-center">
                        <div className="font-pulse text-pulse-muted text-[0.625rem] mb-1 uppercase">{DAY_SHORT[dow]}</div>
                        <div className={`py-[0.375rem] rounded-[3px] font-pulse text-[0.75rem] font-bold ${
                            isRest ? 'bg-pulse-bg text-pulse-muted border border-pulse-border' : 'bg-pulse-accent/10 text-pulse-accent border border-pulse-accent/20'
                        }`}>{label}</div>
                    </div>
                );
            })}
        </div>
    ) : (
        <p className="font-pulse text-xs text-pulse-muted">No schedule set — add a routine with a weekly schedule.</p>
    )}
</div>
```

**Fix 3 — dynamic workout type listing:**

Replace the hardcoded `(['push','pull','legs'] as const).map(...)` section with a dynamic version that reads from `routineExercisesByType`.

> **Note:** `WORKOUT_TYPE_LABELS` from `@/lib/pulse/constants` replaces the local `TYPE_LABEL` constant. Import it instead of defining it inline.

```tsx
// Add to usePulse() destructure: routineExercisesByType, activeRoutine
// Import at top: import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
// Replace the static WORKOUTS section:

const workoutTypes = Object.keys(routineExercisesByType).filter(
    (t) => (routineExercisesByType[t as WorkoutType] ?? []).length > 0
);

{workoutTypes.map((type) => {
    const exercises = routineExercisesByType[type as WorkoutType] ?? [];
    return (
        <div key={type} className="mb-6">
            <div className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase text-pulse-accent font-bold mb-3">
                {WORKOUT_TYPE_LABELS[type as WorkoutType] ?? type}
            </div>
            {exercises.map((re, i) => (
                <div key={re.id} className="py-2 border-b border-pulse-border flex gap-4 items-baseline">
                    <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0 w-5">
                        {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                        <div className="text-pulse-text text-[0.875rem] font-medium">{re.exercise?.name ?? ''}</div>
                        <div className="font-pulse text-pulse-dim text-[0.6875rem] tracking-[0.04em] mt-0.5">
                            {re.sets} sets · {re.reps} reps
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
})}
```

- [ ] Run: `bun run typecheck && bun run test`

- [ ] Commit:
```
git add src/components/pulse/views/ProgramView.tsx
git commit -m "fix(pulse): week click stays on plan page, schedule and exercises are now dynamic"
```

---

## Task 6: Profile Enhancements

**Files:** Modify `src/components/pulse/views/ProfileView.tsx`, `src/app/pulse/actions.ts`, `src/lib/pulse/types.ts`, create `docs/migrations/2026-05-29-profile-enhancements.sql`

### Sub-task 6a: SQL migration

- [ ] Create `docs/migrations/2026-05-29-profile-enhancements.sql`:

```sql
-- ============================================================
-- Migration: profile-enhancements
-- 2026-05-29
-- ============================================================

-- STEP 1: Add goal_weight_kg to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_weight_kg numeric(5,2);

-- STEP 2: Create body_measurements table
CREATE TABLE IF NOT EXISTS body_measurements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  waist_cm    numeric(5,1),
  hips_cm     numeric(5,1),
  chest_cm    numeric(5,1),
  arms_cm     numeric(5,1),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_select" ON body_measurements;
CREATE POLICY "body_measurements_select" ON body_measurements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "body_measurements_insert" ON body_measurements;
CREATE POLICY "body_measurements_insert" ON body_measurements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "body_measurements_delete" ON body_measurements;
CREATE POLICY "body_measurements_delete" ON body_measurements
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- STEP 3: Allow logged_at override on bodyweight_logs
-- (no schema change needed — logged_at is already a timestamptz,
--  we just pass a custom value from the client)
```

- [ ] Apply in Supabase SQL Editor

### Sub-task 6b: TypeScript types

- [ ] In `src/lib/pulse/types.ts`:

**Update `Profile`:**
```ts
export interface Profile {
    display_name: string | null;
    unit: 'kg' | 'lbs';
    active_routine_id: string | null;
    onboarding_completed: boolean;
    goal_weight_kg: number | null;  // NEW
}
```

**Add `BodyMeasurement`:**
```ts
export interface BodyMeasurement {
    id: string;
    measured_at: string; // ISO date string
    waist_cm: number | null;
    hips_cm: number | null;
    chest_cm: number | null;
    arms_cm: number | null;
}
```

### Sub-task 6c: Server actions

- [ ] In `src/app/pulse/actions.ts`:

**Update `logBodyWeight`** to accept optional `date` parameter:
```ts
export async function logBodyWeight(weightKg: number, date?: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const logged_at = date
        ? new Date(date).toISOString()
        : new Date().toISOString();

    const { error } = await supabase.from('bodyweight_logs').insert({
        user_id: user.id,
        weight_kg: weightKg,
        logged_at,
    });
    if (error) throw new Error('Failed to log body weight');
    revalidatePath('/pulse');
}
```

**Add `updateGoalWeight` action:**
```ts
export async function updateGoalWeight(goalWeightKg: number | null): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('profiles').update({ goal_weight_kg: goalWeightKg }).eq('id', user.id);
    if (error) throw new Error('Failed to update goal weight');
    revalidatePath('/pulse');
}
```

**Add `logBodyMeasurement` action:**
```ts
export async function logBodyMeasurement(data: {
    measured_at?: string;
    waist_cm?: number;
    hips_cm?: number;
    chest_cm?: number;
    arms_cm?: number;
}): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        measured_at: data.measured_at ?? new Date().toISOString().split('T')[0],
        waist_cm: data.waist_cm ?? null,
        hips_cm: data.hips_cm ?? null,
        chest_cm: data.chest_cm ?? null,
        arms_cm: data.arms_cm ?? null,
    });
    if (error) throw new Error('Failed to log measurements');
    revalidatePath('/pulse');
}
```

### Sub-task 6d: ProfileView UI additions

Read `src/components/pulse/views/ProfileView.tsx` in full, then add the following sections.

> **Note:** `SectionLabel` is now a shared component at `@/components/pulse/SectionLabel`. Import it and use `<SectionLabel className="mb-2">...</SectionLabel>` instead of any `<div className={SECTION_LABEL}>` pattern. Do **not** define a local `SECTION_LABEL` constant.

**1. Body weight — add date picker:**

Find the body weight log form. Replace the existing "log current weight" UI with one that includes a date field:

```tsx
const [bwDate, setBwDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
const today = new Date().toISOString().split('T')[0];

// In the form:
<input
    type="date"
    value={bwDate}
    max={today}
    onChange={(e) => setBwDate(e.target.value)}
    className={INPUT}
/>
<input type="number" ... />
<button onClick={() => handleLogWeight(weight, bwDate)}>Log</button>
```

Update `handleLogWeight` to pass the date to `logBodyWeight(weight, date)`.

**2. Goal weight section** (add below body weight chart):

```tsx
<section className={SECTION}>
    <SectionLabel className="mb-2">Goal Weight</SectionLabel>
    {profile.goal_weight_kg ? (
        <div className="flex items-center gap-3">
            <span className="font-pulse text-lg font-bold text-white">
                {unit === 'lbs'
                    ? `${(profile.goal_weight_kg * 2.20462).toFixed(1)} lbs`
                    : `${profile.goal_weight_kg} kg`}
            </span>
            {bodyweightLogs[0] && (
                <span className={`font-pulse text-xs ${
                    bodyweightLogs[0].weight_kg <= profile.goal_weight_kg
                        ? 'text-emerald-400'
                        : 'text-pulse-dim'
                }`}>
                    {Math.abs(bodyweightLogs[0].weight_kg - profile.goal_weight_kg).toFixed(1)} kg to go
                </span>
            )}
            <button onClick={() => updateGoalWeight(null)} className="font-pulse text-xs text-pulse-dim">Clear</button>
        </div>
    ) : (
        <div className="flex gap-2">
            <input type="number" placeholder={`Goal (${unit})`} className={INPUT} id="goal-weight-input" step="0.1" />
            <button
                onClick={() => {
                    const val = parseFloat((document.getElementById('goal-weight-input') as HTMLInputElement).value);
                    if (!isNaN(val)) updateGoalWeight(unit === 'lbs' ? val / 2.20462 : val);
                }}
                className={BTN_PRIMARY}>Set</button>
        </div>
    )}
</section>
```

**3. Personal records section** (add above body weight):

```tsx
// prMap is already in usePulse() — Map<exerciseId, { kg: number; reps: number; week: number }>
const topPRs = [...prMap.entries()]
    .map(([exId, pr]) => ({
        name: exercises.find((e) => e.id === exId)?.name ?? exId,
        ...pr,
    }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 5);

<section className={SECTION}>
    <SectionLabel className="mb-2">Personal Records</SectionLabel>
    {topPRs.length === 0 ? (
        <p className="font-pulse text-xs text-pulse-muted">No records yet — start logging sets.</p>
    ) : (
        <div className="flex flex-col gap-2">
            {topPRs.map((pr) => (
                <div key={pr.name} className="flex justify-between items-center">
                    <span className="font-pulse text-sm text-white">{pr.name}</span>
                    <span className="font-pulse text-xs text-pulse-accent font-semibold">
                        {unit === 'lbs' ? `${(pr.kg * 2.20462).toFixed(1)} lbs` : `${pr.kg} kg`} × {pr.reps}
                    </span>
                </div>
            ))}
        </div>
    )}
</section>
```

**4. Training streak** (`streak` already computed in PulseProvider):

```tsx
<section className={SECTION}>
    <SectionLabel className="mb-2">Streak</SectionLabel>
    <div className="flex items-baseline gap-1">
        <span className="font-pulse text-3xl font-bold text-white">{streak}</span>
        <span className="font-pulse text-sm text-pulse-dim">consecutive weeks trained</span>
    </div>
</section>
```

**5. Body measurements section:**

```tsx
const [showMeasurements, setShowMeasurements] = useState(false);
const [measurements, setMeasurements] = useState({ waist: '', hips: '', chest: '', arms: '' });

<section className={SECTION}>
    <div className="flex justify-between items-center">
        <SectionLabel className="mb-2">Body Measurements</SectionLabel>
        <button onClick={() => setShowMeasurements(!showMeasurements)} className="font-pulse text-xs text-pulse-accent">
            {showMeasurements ? 'Cancel' : '+ Log'}
        </button>
    </div>
    {showMeasurements && (
        <div className="flex flex-col gap-2 mt-2">
            <input type="date" max={today} defaultValue={today} id="measure-date" className={INPUT} />
            {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                <div key={field} className="flex items-center gap-2">
                    <label className="font-pulse text-xs text-pulse-dim w-12 capitalize">{field}</label>
                    <input
                        type="number"
                        step="0.1"
                        placeholder="cm"
                        value={measurements[field]}
                        onChange={(e) => setMeasurements((prev) => ({ ...prev, [field]: e.target.value }))}
                        className={INPUT + ' flex-1'}
                    />
                </div>
            ))}
            <button
                onClick={async () => {
                    const date = (document.getElementById('measure-date') as HTMLInputElement).value;
                    await logBodyMeasurement({
                        measured_at: date,
                        waist_cm: measurements.waist ? Number(measurements.waist) : undefined,
                        hips_cm: measurements.hips ? Number(measurements.hips) : undefined,
                        chest_cm: measurements.chest ? Number(measurements.chest) : undefined,
                        arms_cm: measurements.arms ? Number(measurements.arms) : undefined,
                    });
                    setShowMeasurements(false);
                    setMeasurements({ waist: '', hips: '', chest: '', arms: '' });
                }}
                className={BTN_PRIMARY}>Save</button>
        </div>
    )}
</section>
```

### Sub-task 6e: Load initial data

- [ ] In `src/app/pulse/layout.tsx`, add `goal_weight_kg` to the profiles select:
```ts
supabase.from('profiles').select('display_name, unit, active_routine_id, onboarding_completed, goal_weight_kg')
```

And include it in the `profile` object:
```ts
goal_weight_kg: profileRow?.goal_weight_kg ? Number(profileRow.goal_weight_kg) : null,
```

- [ ] Also update `src/app/pulse/page.tsx` if it still exists as a data source (Task 2 moves this to layout, but apply both places during the transition).

### Sub-task 6f: Hook up actions to context

- [ ] Add `updateGoalWeight` and `logBodyMeasurement` to `PulseContext.ts` and `PulseProvider.tsx` if they need to be in context, OR import the server actions directly in ProfileView.

Direct import in ProfileView is simpler (no context changes):
```ts
import { logBodyWeight, updateGoalWeight, logBodyMeasurement } from '@/app/pulse/actions';
```

### Sub-task 6g: Typecheck + tests

- [ ] `bun run typecheck`
- [ ] `bun run test`

- [ ] Commit:
```
git add docs/migrations/2026-05-29-profile-enhancements.sql src/lib/pulse/types.ts src/app/pulse/actions.ts src/components/pulse/views/ProfileView.tsx
git commit -m "feat(pulse): profile — historical body weight, goal weight, PRs, streak, body measurements"
```

---

## Self-Review

**Spec coverage:**
- ✅ Week starts Monday in day picker (Task 1)
- ✅ All 7 days visible in log tab, rest days grayed (Task 1)
- ✅ Next.js pages replacing tabs (Task 2)
- ✅ View renaming: Train/Plan/Progress/Explore (Task 2)
- ✅ Dynamic exercises/sets/reps by session duration (Task 3)
- ✅ Female-focused templates — Glute Focus, Lower Body, Full Body Tone (Task 4)
- ✅ Program view week click stays on page (Task 5)
- ✅ Program view shows active routine's workout types (Task 5)
- ✅ Profile date picker for historical body weight (Task 6)
- ✅ Profile goal weight (Task 6)
- ✅ Profile personal records (Task 6)
- ✅ Profile training streak (Task 6)
- ✅ Profile body measurements (Task 6)

**Type consistency:**
- `View` type updated to new names in Task 2, all `navigate()` call sites updated in same task
- `Profile.goal_weight_kg` added in Task 6 types + populated in layout server component
- `cloneTemplate(slug, trainingDays?, sessionTime?)` signature consistent across actions/hook/context/modal

**Dependencies:**
- Task 2 must complete before Tasks 3/5/6 reference `navigate('train')` instead of `navigate('log')`
- Task 6a (SQL migration) must run before Task 6c/6d (server actions + UI)
- All other tasks are independent
