# Routine Generation Flow + Editor Implementation Plan (2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Spec 1 generation engine to the app: a reusable onboarding-style setup flow (no native dialogs), a persistence action, prominent entry points, the routine-editor session grouping, and a `cloneTemplate` refactor that retires `applyVolume`.

**Architecture:** A pure `generateRoutine` (already in `lib/pulse/generation.ts`) is called by a new `generateAndSaveRoutine` server action that persists routine + exercises + schedule. A reusable `RoutineSetupFlow` (extracted from `OnboardingModal`) collects inputs and is opened from several entry points. `cloneTemplate` switches to the Spec 1 `volumeFor` model. `RoutinesTab` groups the active routine's exercises by session.

**Tech Stack:** Next.js 15 App Router, React 19, TS strict, Supabase, SWR, Vitest. bun.

**Conventions:** 4-space indent, no em dashes in code/comments. Local git identity is gmail; commit with `git -c commit.gpgsign=false commit`. No git push. Verify each task with `bun run typecheck && bun run test:run`.

---

## Task 1: Refactor `cloneTemplate` to the volume model (retire `applyVolume`)

This alone fixes the reported "30-min Full Body Tone = 1 exercise" bug.

**Files:**
- Modify: `src/app/pulse/actions.ts` (`applyVolume` removal + `cloneTemplate` volume logic, ~lines 498-560)
- Test: `src/app/pulse/__tests__/clone-template-volume.test.ts` (create) OR a pure helper test (see Step 1)

- [ ] **Step 1: Extract the trim helper as a pure, testable function**

Add to `src/lib/pulse/generation.ts` a pure helper that trims a template's exercise list to the volume target, grouping by `(workout_type, variant)` and keeping the highest-priority N per session, never below the floor:

```ts
export function applyTemplateVolume<T extends { workout_type: string; variant: string | null; order: number; sets: string }>(
    exercises: T[],
    sessionTime: SessionTime,
    experience: ExperienceLevel,
): T[] {
    const { exercises: perSession, sets } = volumeFor(sessionTime, experience);
    const groups = new Map<string, T[]>();
    for (const ex of exercises) {
        const key = `${ex.workout_type}:${ex.variant ?? ''}`;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(ex);
    }
    const out: T[] = [];
    for (const group of groups.values()) {
        const sorted = [...group].sort((a, b) => a.order - b.order);
        // Keep up to perSession exercises per session (never fewer than the group
        // has, never below the floor of 3 when the group is large enough).
        const keep = Math.min(sorted.length, Math.max(perSession, 3));
        for (const ex of sorted.slice(0, keep)) out.push({ ...ex, sets: String(sets) });
    }
    return out;
}
```

- [ ] **Step 2: Write the failing test**

`src/lib/pulse/__tests__/generation.test.ts` (append):

```ts
import { applyTemplateVolume } from '@/lib/pulse/generation';

describe('applyTemplateVolume', () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ workout_type: 'full_body', variant: null, order: i, sets: '4' }));
    it('30-min keeps at least 3 exercises per session (regression: never 1)', () => {
        const out = applyTemplateVolume(full, '~30 min', 'beginner');
        expect(out.length).toBeGreaterThanOrEqual(3);
    });
    it('90-min keeps more than 30-min', () => {
        expect(applyTemplateVolume(full, '90+ min', 'advanced').length)
            .toBeGreaterThan(applyTemplateVolume(full, '~30 min', 'beginner').length);
    });
    it('does not invent exercises beyond what the template has', () => {
        const two = full.slice(0, 2);
        expect(applyTemplateVolume(two, '90+ min', 'advanced').length).toBe(2);
    });
});
```

- [ ] **Step 3: Run to verify it fails** (`bun run test:run src/lib/pulse/__tests__/generation.test.ts`).

- [ ] **Step 4: Implement** (the helper from Step 1) and run to verify pass.

- [ ] **Step 5: Use it in `cloneTemplate`, delete `applyVolume`**

In `actions.ts`, `cloneTemplate` needs the user's `experience` to size volume. Add an `experience` parameter:

```ts
export async function cloneTemplate(
    slug: string,
    trainingDays?: number[],
    sessionTime?: string,
    experience?: ExperienceLevel,
): Promise<WorkoutRoutine> {
```

Replace the `applyVolume` call with:

```ts
const exercises =
    sessionTime && experience
        ? applyTemplateVolume(rawExercises, sessionTime as SessionTime, experience)
        : rawExercises;
```

Delete the `applyVolume` function and its `adjustSets` helper if now unused. Import `applyTemplateVolume` and the `SessionTime`/`ExperienceLevel` types.

- [ ] **Step 6: Update the `cloneTemplate` callers' signature**

`useRoutines.ts` `cloneTemplate` wrapper and `PulseContext.ts` add the optional `experience` param (pass-through). `OnboardingModal`/`TemplatesTab` callers updated in later tasks.

- [ ] **Step 7: Verify + commit**

Run: `bun run typecheck && bun run test:run`.

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts
git -c commit.gpgsign=false commit -m "feat(generation): cloneTemplate uses volume model, retire applyVolume"
```

---

## Task 2: `generateAndSaveRoutine` server action + context wiring

**Files:**
- Modify: `src/app/pulse/actions.ts` (new action), `src/hooks/pulse/useRoutines.ts`, `src/context/PulseContext.ts`

- [ ] **Step 1: Add the action**

In `actions.ts`:

```ts
import { generateRoutine, type ExerciseMeta } from '@/lib/pulse/generation';
import type { OnboardingAnswers } from '@/lib/pulse/recommendation';
import type { SessionTime } from '@/lib/pulse/types';

export async function generateAndSaveRoutine(
    answers: OnboardingAnswers,
    trainingDays: number[],
    sessionTime: SessionTime,
    name?: string,
): Promise<WorkoutRoutine> {
    const { supabase, user } = await getUserOrThrow();
    if (!trainingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('Invalid training days');

    const { data: pool } = await supabase
        .from('exercises')
        .select('id, category, equipment, movement_pattern, is_compound')
        .is('user_id', null);

    const blueprint = generateRoutine({
        answers,
        sessionTime,
        trainingDays,
        pool: (pool ?? []) as unknown as ExerciseMeta[],
    });

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: name ?? 'Generated routine' })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    if (blueprint.exercises.length > 0) {
        const { error: exErr } = await supabase.from('routine_exercises').insert(
            blueprint.exercises.map((e) => ({
                routine_id: routine.id,
                exercise_id: e.exercise_id,
                workout_type: e.workout_type,
                variant: e.variant,
                order: e.order,
                sets: e.sets,
                reps: e.reps,
                starting_weight_kg: null,
            })),
        );
        if (exErr) throw new Error('Failed to save generated exercises');
    }

    if (blueprint.schedule.length > 0) {
        const { error: schedErr } = await supabase
            .from('routine_schedule')
            .insert(blueprint.schedule.map((s) => ({ routine_id: routine.id, day_of_week: s.day_of_week, workout_type: s.workout_type, variant: s.variant })));
        if (schedErr) throw new Error('Failed to create schedule');
    }

    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, active_routine_id: routine.id }, { onConflict: 'id' });
    if (profileErr) throw new Error('Failed to set active routine');

    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}
```

Note: confirm `routine_schedule` has a `variant` column (the supersets/AB work added it; if not, drop `variant` from the schedule insert). Check the migration before implementing.

- [ ] **Step 2: Expose via context**

`useRoutines.ts`: add a `generateRoutine` wrapper (import the action aliased as `serverGenerateRoutine` to avoid clashing with the pure `generateRoutine`):

```ts
const generateRoutine = useCallback(
    async (answers, trainingDays, sessionTime, name) => {
        const r = await serverGenerateRoutine(answers, trainingDays, sessionTime, name);
        await mutateRoutines();
        await globalMutate(PROFILE_KEY);
        return r;
    },
    [mutateRoutines, globalMutate],
);
```

Add `generateRoutine` to the hook's return and to `PulseContextValue` in `PulseContext.ts` with the signature `(answers: OnboardingAnswers, trainingDays: number[], sessionTime: SessionTime, name?: string) => Promise<WorkoutRoutine>`.

- [ ] **Step 3: Test**

`src/app/pulse/__tests__/` is sparse; if a server-action test harness is impractical (no chainable mock pattern exists), cover `generateRoutine` (the pure engine) which is already tested in Task-1 file, and note the action is exercised end-to-end via the flow. Add the action to the integration smoke list. Do not write a brittle mock.

- [ ] **Step 4: Verify + commit**

```bash
git add src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts
git -c commit.gpgsign=false commit -m "feat(generation): generateAndSaveRoutine action + context wiring"
```

---

## Task 3: Extract `RoutineSetupFlow` from `OnboardingModal`

**Files:**
- Create: `src/components/pulse/RoutineSetupFlow.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`
- Test: `src/components/pulse/__tests__/RoutineSetupFlow.test.tsx`

- [ ] **Step 1: Move the stepped UI into `RoutineSetupFlow`**

Create `RoutineSetupFlow` with the props from the spec:

```ts
interface RoutineSetupFlowProps {
    initial?: Partial<{ equipment: EquipmentKey[]; experience: ExperienceLevel; goal: Goal; days: DaysPerWeek; trainingDays: number[]; sessionTime: SessionTime }>;
    onComplete: (result: { answers: OnboardingAnswers; trainingDays: number[]; sessionTime: SessionTime }) => Promise<void>;
    onClose: () => void;
}
```

Move steps 1-6 (equipment, experience, goal, days, specific days, session time) and their state out of `OnboardingModal` into `RoutineSetupFlow`. Seed each state value from `initial` when provided. Remove the `recommendTemplate`/`result`/`pickedSlug` logic from the flow itself; the flow's job ends at calling `onComplete({ answers, trainingDays, sessionTime })`. Keep the existing Slate styling, `Header`/`ProgressBar`/`OptionRow` (move them too, or keep them in OnboardingModal and import). The final step's primary button calls `onComplete` then `onClose`.

- [ ] **Step 2: Refactor `OnboardingModal` to use it**

`OnboardingModal` becomes a thin wrapper: render `RoutineSetupFlow` with `onComplete` = call `generateAndSaveRoutine` via context, then `completeOnboarding()`, then `navigate('train')`, then `dismissOnboarding()`. (First-run onboarding now GENERATES rather than recommend+clone, which also fixes `general_fitness` producing nothing.)

- [ ] **Step 3: Write tests**

`RoutineSetupFlow.test.tsx`: steps advance; `initial` prefills (e.g. passing `sessionTime` lets you reach the end and `onComplete` receives it); completing calls `onComplete` with `{ answers, trainingDays, sessionTime }`; assert no `window.prompt`/`window.confirm` is referenced (grep-style: the component does not call them).

- [ ] **Step 4: Verify + commit**

```bash
git add src/components/pulse/RoutineSetupFlow.tsx src/components/pulse/OnboardingModal.tsx src/components/pulse/__tests__/RoutineSetupFlow.test.tsx src/components/pulse/__tests__/OnboardingModal.test.tsx
git -c commit.gpgsign=false commit -m "feat(generation): extract reusable RoutineSetupFlow, onboarding generates"
```

---

## Task 4: Prominent entry points

**Files:**
- Modify: `src/components/pulse/views/library/RoutinesTab.tsx` (top CTA), `src/components/pulse/views/ProgramView.tsx` (Plan header CTA), `src/components/pulse/views/LogView.tsx` (empty-state CTA)

- [ ] **Step 1: Add a shared "open the setup flow" affordance**

Each entry renders a primary "Generate routine" button that sets local `showSetup` state and renders `<RoutineSetupFlow onComplete={...generateRoutine...} onClose={...} />`. The `onComplete` calls the context `generateRoutine(answers, trainingDays, sessionTime)`.

- [ ] **Step 2: Place them**

- `RoutinesTab`: a `BTN_PRIMARY` "Generate routine" at the very top of the tab (above the create-routine card).
- `ProgramView` (Plan): a "Generate routine" button in the view header.
- `LogView` empty state (no active routine): the existing "Go to Library" CTA gains a primary "Generate a routine" button that opens the flow directly.

- [ ] **Step 3: Tests** — assert each renders a "Generate routine" control. Keep existing view tests green.

- [ ] **Step 4: Verify + commit**

```bash
git add src/components/pulse/views/library/RoutinesTab.tsx src/components/pulse/views/ProgramView.tsx src/components/pulse/views/LogView.tsx src/components/pulse/__tests__
git -c commit.gpgsign=false commit -m "feat(generation): prominent Generate-routine entry points"
```

---

## Task 5: Template "Use this" opens the flow (no dialogs)

**Files:**
- Modify: `src/components/pulse/views/TemplatesTab.tsx`
- Test: `src/components/pulse/__tests__/TemplatesTab.test.tsx`

- [ ] **Step 1: Replace `window.confirm`/`window.prompt`**

`handleUse` currently uses `window.confirm` (replace warning) and `window.prompt` (session length). Replace with: clicking "Use this" sets `setupFor = template` (local state) and renders `<RoutineSetupFlow initial={{ equipment: template.required_equipment, experience: template.experience_level, days: <map days_per_week>, sessionTime: <map session_time> }} onComplete={...} onClose={...} />`. `onComplete` calls `cloneTemplate(template.slug, trainingDays, sessionTime, answers.experience)` then navigates to train.

- [ ] **Step 2: Update the existing test**

`TemplatesTab.test.tsx`: the test that relied on `window.prompt` is updated to assert the flow opens on "Use this" and `cloneTemplate` is called on completion. Remove any `window.prompt` mock.

- [ ] **Step 3: Verify + commit**

```bash
git add src/components/pulse/views/TemplatesTab.tsx src/components/pulse/__tests__/TemplatesTab.test.tsx
git -c commit.gpgsign=false commit -m "feat(generation): template Use-this opens the setup flow, no native dialogs"
```

---

## Task 6: Routine-editor session grouping

**Files:**
- Modify: `src/components/pulse/views/library/RoutinesTab.tsx`
- Test: `src/components/pulse/__tests__/LibraryView.test.tsx`

- [ ] **Step 1: Group `sortedActiveExercises` by session**

Compute groups by `(workout_type, variant)` preserving order. If there is exactly one group, render the current flat list (single-session routine). Otherwise render each group under a header: the workout-type label (reuse `WORKOUT_TYPE_LABELS` from `constants.ts`) plus the variant when set (e.g. `Upper · A`). The existing `RoutineExerciseRow` rows (edit/move/remove/pair) render inside each group; `handleMove` indices remain global into `sortedActiveExercises` (compute each row's global index when mapping within a group).

- [ ] **Step 2: Write a test**

`LibraryView.test.tsx`: a routine with exercises across `(upper, A)`, `(lower, A)`, `(upper, B)`, `(lower, B)` renders four section headers (`Upper · A`, `Lower · A`, `Upper · B`, `Lower · B`); a single-`full_body`-no-variant routine renders no section header (flat list).

- [ ] **Step 3: Verify + commit**

```bash
git add src/components/pulse/views/library/RoutinesTab.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git -c commit.gpgsign=false commit -m "feat(generation): group routine editor by session (workout_type + variant)"
```

---

## Task 7: Template audit

**Files:**
- Possibly create: `docs/migrations/2026-06-03-template-fixes.sql` (only if data is wrong)

- [x] **Step 1: Audit**

For each of the 17 templates, confirm `cloneTemplate` now yields a sane routine at `~30 / 45–60 / 90+` and 2-3 / 4 / 5-6 days using the volume model (no empty/one-exercise days). The volume floor in Task 1 already prevents the reported failure. Read the template seed migrations and spot-check the female "Full Body Tone" templates for too-few exercises per session.

**Audit result (2026-06-03):** Counted exercises per `(template, workout_type, variant)` group across all three seed migrations (`2026-05-27-routine-templates.sql`, `2026-05-29-female-templates.sql`, `2026-05-29-template-ab-data.sql`). Every group has **≥2** exercises. The smallest groups (2 each) are the full-body templates (001–003), where push/pull/legs subdivide a single session; PPL/upper-lower templates run 3–6 per group; "Full Body Tone — Dumbbells" (017) has 6 in one `full_body` session. `applyTemplateVolume` keeps `Math.min(len, Math.max(perSession, 3))`, so a clone preserves every available exercise and can never collapse a session to one row. The reported "Full Body Tone → 1 exercise/day at 3×30 min" bug was caused by the retired slice-based `applyVolume`, not by template data.

- [x] **Step 2: Fix data if needed**

No template has too few exercises to fill the floor — the floor + volume model is sufficient. **No migration needed.**

- [x] **Step 3: Commit (only if a migration was needed).** Skipped — no data change.

---

## Task 8: Final verification

- [ ] **Step 1:** `bun run typecheck && bun run test:run && bun run lint` — all green (2 pre-existing exhaustive-deps warnings acceptable).
- [ ] **Step 2:** `bun run format`, then re-run typecheck + tests.
- [ ] **Step 3 (manual, requires login + applied migrations):** run onboarding end to end; "Use this" a template with no dialogs; "Generate routine" from the Library/Plan CTAs; confirm a 3x full-body routine has varied days and the editor shows grouped sessions.

---

## Self-review

- **Spec coverage:** RoutineSetupFlow (T3), persistence action + wiring (T2), entry points incl. prominence (T4), Use-this no-dialogs (T5), session grouping (T6), template audit + applyVolume retire (T1, T7), tests across tasks, verify (T8). All spec sections + the "make it accessible" addition (T4) mapped.
- **Placeholder scan:** Task 7 is conditional by nature (audit then maybe fix), which is correct, not a placeholder; every code step has real code.
- **Type consistency:** `generateAndSaveRoutine(answers, trainingDays, sessionTime, name?)`, `applyTemplateVolume(exercises, sessionTime, experience)`, `RoutineSetupFlow` props, and the context `generateRoutine` signature are referenced identically across tasks. Real onboarding types reused from `recommendation.ts`.
- **Pre-implementation checks flagged:** confirm `routine_schedule.variant` exists before inserting it (T2); confirm `applyVolume`/`adjustSets` have no other callers before deleting (T1).
