# Bug Fixes Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four confirmed bugs: Profile PRs showing UUIDs, Plan view showing wrong workout type sections, Start Workout button delay, and Onboarding not re-triggering for users with no routines.

**Architecture:** Each bug is an isolated fix in a single file (or two). No new abstractions, no schema changes. All fixes are testable with the existing Vitest + @testing-library/react setup.

**Tech Stack:** React, Next.js App Router, TypeScript, Vitest, @testing-library/react.

---

## File Map

| Action | File | Bug |
|--------|------|-----|
| Modify | `src/components/pulse/views/ProfileView.tsx` | B1 |
| Modify | `src/components/pulse/__tests__/ProfileView.test.tsx` | B1 |
| Modify | `src/components/pulse/views/ProgramView.tsx` | B2 |
| Create | `src/components/pulse/__tests__/ProgramView.test.tsx` | B2 |
| Modify | `src/components/pulse/views/LogView.tsx` | B3 |
| Modify | `src/components/pulse/__tests__/LogView.test.tsx` | B3 |
| Modify | `src/components/pulse/WorkoutModeScreen.tsx` | B3 |
| Modify | `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx` | B3 |
| Modify | `src/components/pulse/PulseProvider.tsx` | B4 |

---

## Task 1 (B1): Fix Profile PRs showing UUIDs

**Root cause:** `prMap` is keyed by `routineExerciseId`. `ProfileView` resolves names via `exercises.find(e => e.id === exId)` where `exercises` is `DbExercise[]` — a different table with different IDs. The lookup always fails, falling back to the raw UUID.

**Fix:** Resolve names via `routines.flatMap(r => r.exercises)` which contains `RoutineExercise[]`, keyed correctly by `re.id`.

**Files:**
- Modify: `src/components/pulse/views/ProfileView.tsx`
- Modify: `src/components/pulse/__tests__/ProfileView.test.tsx`

- [ ] **Step 1: Add failing test to `src/components/pulse/__tests__/ProfileView.test.tsx`**

Add `routines` to `defaultContext` (the mock currently omits it, causing the fix to silently fall through):

```ts
// Add this to the import at the top of the test file:
import type { RoutineWithExercises } from '@/lib/pulse/types';
```

In `defaultContext`, add:
```ts
routines: [] as RoutineWithExercises[],
```

Then add this test inside `describe('ProfileView', ...)`:

```ts
it('shows exercise name instead of UUID in Personal Records', () => {
    const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
    const routine: RoutineWithExercises = {
        id: 'r1', user_id: 'u1', name: 'PPL', created_at: '',
        schedule: [],
        exercises: [{
            id: RE_ID, routine_id: 'r1', exercise_id: 'ex-1',
            workout_type: 'push', variant: null, order: 0, sets: '3', reps: '8',
            starting_weight_kg: null,
            exercise: { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
        }],
    };
    vi.mocked(usePulse).mockReturnValue({
        ...defaultContext,
        prMap: { [RE_ID]: 126.67 },
        routines: [routine],
    } as unknown as ReturnType<typeof usePulse>);
    renderWithToast(<ProfileView />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText(RE_ID)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test:run -- ProfileView
```
Expected: FAIL — "Bench Press" not found, UUID is rendered instead.

- [ ] **Step 3: Fix `src/components/pulse/views/ProfileView.tsx`**

In the `usePulse()` destructure (line 96), replace `exercises` with `routines`:
```ts
const { email, profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight, triggerOnboarding, streak, prMap, routines } = usePulse();
```

Replace the `topPRs` computation (lines 114–121):
```ts
// prMap is keyed by routineExerciseId; resolve names via routines
const reNameMap = new Map(
    routines.flatMap((r) => r.exercises).map((re) => [re.id, re.exercise.name])
);
const topPRs = Object.entries(prMap)
    .map(([reId, e1rm]) => ({
        name: reNameMap.get(reId) ?? reId,
        e1rm,
    }))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 5);
```

Also update the display in the JSX — find the PR display block (around line 265–270) and change `pr.kg` to `pr.e1rm` (the variable was renamed):
```tsx
{topPRs.map((pr) => (
    <div key={pr.name} className="flex justify-between items-center">
        <span className="font-pulse text-sm text-white">{pr.name}</span>
        <span className="font-pulse text-xs text-pulse-accent font-semibold">
            {unit === 'lbs' ? `${(pr.e1rm * 2.20462).toFixed(1)} lbs` : `${pr.e1rm} kg`}
        </span>
    </div>
))}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm run test:run -- ProfileView
```
Expected: all ProfileView tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/views/ProfileView.tsx src/components/pulse/__tests__/ProfileView.test.tsx
git commit -m "fix(profile): resolve PR exercise names via routineExerciseId instead of DbExercise id"
```

---

## Task 2 (B2): Fix Plan view showing all workout type sections for full body routine

**Root cause:** `ProgramView` renders every key in `routineExercisesByType`. A Full Body template seeds exercises with `workout_type = push/pull/legs` (muscle classification) even though the schedule only has `full_body` days. All types appear.

**Fix:** When `activeSchedule` has exactly one unique type, show all exercises under that one section. When multiple types are scheduled, filter to only those types. When no schedule, keep existing behaviour.

**Files:**
- Modify: `src/components/pulse/views/ProgramView.tsx`
- Create: `src/components/pulse/__tests__/ProgramView.test.tsx`

- [ ] **Step 1: Create failing tests in `src/components/pulse/__tests__/ProgramView.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgramView from '../views/ProgramView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import type { RoutineWithExercises, RoutineExercise } from '@/lib/pulse/types';

const makeRE = (id: string, name: string, type: 'push' | 'pull' | 'legs' | 'full_body'): RoutineExercise => ({
    id, routine_id: 'r1', exercise_id: id,
    workout_type: type, variant: null, order: 0, sets: '3', reps: '8',
    starting_weight_kg: null,
    exercise: { id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
});

const pushRE = makeRE('re1', 'Bench Press', 'push');
const pullRE = makeRE('re2', 'Row', 'pull');
const legsRE = makeRE('re3', 'Squat', 'legs');

const baseContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    logs: {},
    activeSchedule: [],
    activeRoutine: null,
    routineExercisesByType: {},
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(baseContext as unknown as ReturnType<typeof usePulse>);
});

describe('ProgramView', () => {
    it('shows all type sections when no schedule is set', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            routineExercisesByType: { push: [pushRE], pull: [pullRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
    });

    it('shows only one section when schedule has a single workout type', () => {
        const routine: RoutineWithExercises = {
            id: 'r1', user_id: 'u1', name: 'Full Body', created_at: '', schedule: [],
            exercises: [pushRE, pullRE, legsRE],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeRoutine: routine,
            activeSchedule: [
                { day_of_week: 1, workout_type: 'full_body' },
                { day_of_week: 3, workout_type: 'full_body' },
                { day_of_week: 5, workout_type: 'full_body' },
            ],
            routineExercisesByType: { push: [pushRE], pull: [pullRE], legs: [legsRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Full Body')).toBeInTheDocument();
        expect(screen.queryByText('Push')).not.toBeInTheDocument();
        expect(screen.queryByText('Pull')).not.toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
        // All exercises appear under the single section
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Row')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
    });

    it('shows only scheduled types when schedule has multiple distinct types', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeSchedule: [
                { day_of_week: 1, workout_type: 'push' },
                { day_of_week: 3, workout_type: 'pull' },
            ],
            routineExercisesByType: { push: [pushRE], pull: [pullRE], legs: [legsRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- ProgramView
```
Expected: 2–3 failures — sections appear or disappear incorrectly.

- [ ] **Step 3: Fix `src/components/pulse/views/ProgramView.tsx`**

Add `activeRoutine` to the destructure at line 13:
```ts
const { activeWeek, setActiveWeek, logs, activeSchedule, activeRoutine, routineExercisesByType } = usePulse();
```

Replace the exercise sections render block (the `{Object.keys(routineExercisesByType)...}` block at lines 77–101) with:

```tsx
{(() => {
    type Section = { type: WorkoutType; exercises: typeof routineExercisesByType[WorkoutType] };

    if (activeSchedule.length === 0) {
        // No schedule: render all non-empty types
        return Object.keys(routineExercisesByType)
            .filter((t) => (routineExercisesByType[t as WorkoutType] ?? []).length > 0)
            .map((type) => ({ type: type as WorkoutType, exercises: routineExercisesByType[type as WorkoutType]! }));
    }

    const uniqueTypes = [...new Set(activeSchedule.map((e) => e.workout_type))];

    if (uniqueTypes.length === 1) {
        // Single scheduled type: all exercises under that one section
        const allExercises = activeRoutine
            ? [...activeRoutine.exercises].sort((a, b) => a.order - b.order)
            : Object.values(routineExercisesByType).flat();
        return [{ type: uniqueTypes[0], exercises: allExercises }] as Section[];
    }

    // Multiple types: only show scheduled types that have exercises
    return uniqueTypes
        .map((type) => ({ type, exercises: routineExercisesByType[type] ?? [] }))
        .filter((s) => s.exercises.length > 0) as Section[];
})().map(({ type, exercises }) => (
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
))}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- ProgramView
```
Expected: all 3 ProgramView tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/views/ProgramView.tsx src/components/pulse/__tests__/ProgramView.test.tsx
git commit -m "fix(plan): show sections based on scheduled workout types, not all exercise types"
```

---

## Task 3 (B3): Fix Start Workout button delay — show screen immediately

**Root cause:** `WorkoutModeScreen` only renders when `workoutModeOpen && session`. Since `session` is null until the POST to `/api/pulse/sessions` resolves, there's a visible delay.

**Fix:** Show WorkoutModeScreen immediately on button click (`workoutModeOpen` only). Start the session in the background. Make `sessionId` nullable in WorkoutModeScreen and disable the finish buttons until a session exists.

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/__tests__/LogView.test.tsx`
- Modify: `src/components/pulse/WorkoutModeScreen.tsx`
- Modify: `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`

- [ ] **Step 1: Add failing tests**

In `src/components/pulse/__tests__/LogView.test.tsx`, add a mock for `useWorkoutSession` at the top of the file (after the existing `vi.mock` calls):

```ts
vi.mock('@/hooks/pulse/useWorkoutSession', () => ({
    useWorkoutSession: vi.fn(),
}));

import { useWorkoutSession } from '@/hooks/pulse/useWorkoutSession';
```

In the existing `beforeEach` block, add a default mock return for `useWorkoutSession` so the existing tests continue to pass:

```ts
beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    vi.mocked(useWorkoutSession).mockReturnValue({
        session: null,
        startSession: vi.fn().mockResolvedValue(undefined),
        completeSession: vi.fn().mockResolvedValue(undefined),
        clearSession: vi.fn(),
    } as unknown as ReturnType<typeof useWorkoutSession>);
});
```

Then add these tests inside `describe('LogView', ...)`:

```ts
it('shows WorkoutModeScreen immediately when Start workout is clicked, before session resolves', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    // startSession never resolves — simulates slow network
    vi.mocked(useWorkoutSession).mockReturnValue({
        session: null,
        startSession: vi.fn(() => new Promise(() => {})),
        completeSession: vi.fn(),
        clearSession: vi.fn(),
    } as unknown as ReturnType<typeof useWorkoutSession>);
    render(<LogView />);
    await userEvent.click(screen.getByRole('button', { name: /start workout/i }));
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
});
```

Add this test to `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx` inside `describe('WorkoutModeScreen', ...)`:

```ts
it('disables finish and early-finish buttons when sessionId is null', () => {
    render(<WorkoutModeScreen
        {...defaultProps}
        exercises={[mockExercise('re1', 'Bench Press')]}
        sessionId={null}
    />);
    expect(screen.getByRole('button', { name: /finish workout/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- LogView WorkoutModeScreen
```
Expected: the new LogView test fails (WorkoutModeScreen doesn't appear); the WorkoutModeScreen test fails (TypeScript or button not disabled).

- [ ] **Step 3: Update `WorkoutModeScreen` to accept `sessionId: string | null`**

In `src/components/pulse/WorkoutModeScreen.tsx`, change the Props interface:
```ts
interface Props {
    exercises: RoutineExercise[];
    sessionId: string | null;   // null while session is being created
    variant: WorkoutVariant | null;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    onComplete: () => Promise<void>;
    onClose: () => void;
}
```

In `handleFinish`, guard against null:
```ts
async function handleFinish() {
    if (!sessionId) return;
    setCompleting(true);
    await onComplete();
    setCompleting(false);
}
```

On the "Finish workout" button, add `sessionId === null` to the disabled condition:
```tsx
<button
    aria-label="finish workout"
    onClick={handleFinish}
    disabled={completing || sessionId === null}
    className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none disabled:opacity-60">
    {completing ? 'Finishing…' : 'Finish workout ✓'}
</button>
```

On the "Finish workout early" button, same change:
```tsx
<button
    aria-label="finish workout early"
    onClick={handleFinish}
    disabled={completing || sessionId === null}
    className="font-pulse w-full py-2 rounded-xl text-pulse-muted text-sm cursor-pointer border-none bg-transparent disabled:opacity-40">
    Finish workout early
</button>
```

- [ ] **Step 4: Update `LogView.tsx` — show screen immediately**

In `handleStartWorkout` (around line 66–75), replace the existing function:
```ts
async function handleStartWorkout() {
    if (!activeRoutine) return;
    const baseType = (activeTab as string).includes(':') ? (activeTab as string).split(':')[0] : activeTab;
    setWorkoutModeOpen(true);
    try {
        await startSession(activeRoutine.id, baseType);
    } catch {
        // session creation failed — close the screen
        setWorkoutModeOpen(false);
    }
}
```

Change the WorkoutModeScreen render condition from `{workoutModeOpen && session && (` to `{workoutModeOpen && (`. The full block becomes:

```tsx
{workoutModeOpen && (
    <WorkoutModeScreen
        exercises={workoutExercises}
        sessionId={session?.id ?? null}
        variant={session?.variant ?? null}
        week={activeWeek}
        logs={logs}
        unit={unit}
        onSave={handleSave}
        onDelete={deleteLog}
        onComplete={handleCompleteWorkout}
        onClose={handleCloseWorkoutMode}
    />
)}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:run -- LogView WorkoutModeScreen
```
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/pulse/views/LogView.tsx src/components/pulse/__tests__/LogView.test.tsx src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
git commit -m "fix(train): show WorkoutModeScreen immediately on start, session creates in background"
```

---

## Task 4 (B4): Fix Onboarding not re-triggering for users with no routines

**Root cause:** `showOnboarding = !profile.onboarding_completed && routines.length === 0`. If a user previously completed onboarding (flag = true) but has since deleted all routines, the condition is `false` and onboarding never shows.

**Fix:** Remove the `onboarding_completed` guard — show onboarding whenever `routines.length === 0`, regardless of the flag.

**Files:**
- Modify: `src/components/pulse/PulseProvider.tsx`

There is no direct unit test for the `showOnboarding` derived value in `PulseProvider`. The existing `OnboardingModal` test and the LogView `no-routine` state together cover the visible behaviour. Run the full suite after the change to confirm no regressions.

- [ ] **Step 1: Edit `src/components/pulse/PulseProvider.tsx`**

Find line 60–61:
```ts
const showOnboarding = onboardingOverride ??
    (!profile.onboarding_completed && routines.length === 0);
```

Replace with:
```ts
const showOnboarding = onboardingOverride ?? routines.length === 0;
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```
Expected: all tests PASS. The `OnboardingModal` tests (which mock `showOnboarding` via context) are unaffected. The LogView `no-routine` test is also unaffected.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/PulseProvider.tsx
git commit -m "fix(onboarding): show onboarding whenever routines are empty, regardless of completed flag"
```

---

## Acceptance Criteria

- [ ] Profile Personal Records show exercise names (e.g. "Bench Press 126.7 kg"), not UUIDs
- [ ] A 3× Full Body routine's Plan view shows a single "FULL BODY" section with all exercises
- [ ] A PPL routine's Plan view shows Push / Pull / Legs sections (no regression)
- [ ] Clicking "Start workout" opens WorkoutModeScreen instantly; Finish button is disabled until session resolves
- [ ] A user who completed onboarding and then deleted all routines sees onboarding on next login
- [ ] All tests pass, typecheck clean
