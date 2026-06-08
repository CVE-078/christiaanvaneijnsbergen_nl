# Profile training-preference editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standing Profile editors for training style, variety, and loading lean (alongside the existing restrictions editor), so these generation preferences are settable outside the routine-creation flow.

**Architecture:** Mirror the shipped `updateMovementRestrictions` plumbing (server action → optimistic `useProfile` setter → `PulseContext` → `ProfileView` section). Two new server actions + two new optimistic setters; wire the dormant `updateTrainingStyle` through context for the first time. Extract the four option-constant arrays into one shared module so the flow and Profile share a single source. Persist-only (no regeneration), no migration (all columns exist).

**Tech Stack:** Next.js server actions, Supabase, SWR, React `useTransition`, Vitest + Testing Library. Package manager: bun.

**Spec:** `docs/superpowers/specs/2026-06-08-15-40-31-profile-training-preference-editors-design.md`
**Branch:** `feature/quick-start-generation` (already cut; roadmap-start already committed). This is **Branch 1 of roadmap #15**; the flow trim and post-gen panel are separate follow-ons.

**Always prefix git with `GIT_CONFIG_GLOBAL=/dev/null`** (empty `gpg.format` otherwise breaks commits). Conventional-commit subject only, no body, no Co-Authored-By. **No em dashes** anywhere (repo rule); use commas/colons/periods.

**Note on tests:** there is no server-action unit-test harness in this repo (the shipped `updateMovementRestrictions` action has none; server actions hit Supabase). Do NOT add action-validation unit tests. Real coverage lives in `useProfile.test.tsx` and `ProfileView.test.tsx`, which already exist and mock their dependencies.

---

## File structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/pulse/generationPreferences.ts` | create | Single source for `TRAINING_STYLE_OPTIONS`, `VARIETY_OPTIONS`, `LOADING_LEAN_OPTIONS`, `RESTRICTION_OPTIONS`. |
| `src/components/pulse/RoutineSetupFlow.tsx` | modify | Import the four consts from the new module; delete the inline declarations. |
| `src/app/pulse/actions/profile.ts` | modify | New `updateVarietyPreference`, `updateLoadingLean` actions + value consts. |
| `src/hooks/pulse/useProfile.ts` | modify | New optimistic `updateVarietyPreference`, `updateLoadingLean` setters. |
| `src/hooks/pulse/__tests__/useProfile.test.ts` | modify | Tests for the two new setters. |
| `src/context/PulseContext.ts` | modify | Add `updateTrainingStyle`, `updateVarietyPreference`, `updateLoadingLean` to the interface. |
| `src/components/pulse/PulseProvider.tsx` | modify | Wire all three into the context value. |
| `src/components/pulse/views/ProfileView.tsx` | modify | "Training preferences" group: 3 new editors + swap restrictions to the shared const. |
| `src/components/pulse/__tests__/ProfileView.test.tsx` (or its real path) | modify | Render/interaction tests incl. null loading-lean + active-row no-op. |
| Various `usePulse` mock fixtures | modify | Add the three new fns where a full context value is constructed (interface ripple). |
| `docs/roadmap.md`, `CLAUDE.md` | modify | Status note (Branch 1 shipped, Branch 2 next). |

---

## Task 1: Shared option-constants module + RoutineSetupFlow import swap

**Files:**
- Create: `src/lib/pulse/generationPreferences.ts`
- Modify: `src/components/pulse/RoutineSetupFlow.tsx:107-131` (delete inline consts) and its import block (line 7-8)

This is a pure move (byte-identical labels/desc), so `RoutineSetupFlow` behavior is unchanged and its tests stay green.

- [ ] **Step 1: Create the shared module**

Create `src/lib/pulse/generationPreferences.ts` with the four arrays moved verbatim from `RoutineSetupFlow.tsx`:

```ts
import type { TrainingStyle, VarietyPreference, LoadingPreference, RestrictionFlag } from '@/lib/pulse/types';

export const TRAINING_STYLE_OPTIONS: { key: TrainingStyle; label: string; desc: string }[] = [
    { key: 'balanced', label: 'Balanced', desc: 'A bit of everything. Heavy days, hypertrophy days, and a pump day.' },
    { key: 'strength', label: 'Strength', desc: 'Lower reps and heavier loads on the big lifts. Still keeps one lighter day each week.' },
    { key: 'bodybuilding', label: 'Bodybuilding', desc: 'Moderate-to-high reps for size, across every session.' },
    { key: 'powerbuilding', label: 'Powerbuilding', desc: 'A blend: heavy, low-rep work on the main lifts, higher-rep work on the accessories.' },
];

export const VARIETY_OPTIONS: { key: VarietyPreference; label: string; desc: string }[] = [
    { key: 'varied', label: 'Varied', desc: 'Rotate exercises across sessions for fresh stimulus.' },
    { key: 'consistent', label: 'Consistent', desc: 'Keep your main lifts the same each week, rotate the accessories.' },
];

export const LOADING_LEAN_OPTIONS: { key: LoadingPreference; label: string; desc: string }[] = [
    { key: 'barbell', label: 'Barbell', desc: 'Prioritise barbell work: squats, bench, rows, deadlifts.' },
    { key: 'dumbbell', label: 'Dumbbells', desc: 'Prioritise dumbbell exercises across all movement patterns.' },
    { key: 'machine', label: 'Machines', desc: 'Prioritise machine exercises for each slot.' },
    { key: 'cable', label: 'Cables', desc: 'Prioritise cable exercises where available.' },
];

export const RESTRICTION_OPTIONS: { key: RestrictionFlag; label: string; desc: string }[] = [
    { key: 'knee', label: 'Knees', desc: 'Avoid deep squats, lunges, and leg extensions.' },
    { key: 'lower_back', label: 'Lower back', desc: 'Avoid heavy deadlifts, good mornings, and bent-over rows.' },
    { key: 'shoulder', label: 'Shoulders', desc: 'Avoid overhead barbell presses, upright rows, and dips.' },
    { key: 'wrist', label: 'Wrists', desc: 'Avoid straight-bar presses, push-ups, and barbell curls.' },
];
```

- [ ] **Step 2: Swap RoutineSetupFlow to import them**

In `RoutineSetupFlow.tsx`, delete the four inline `const ...OPTIONS = [...]` declarations (lines ~107-131) and add an import near the top (after the existing `@/lib/pulse/...` imports):

```ts
import { TRAINING_STYLE_OPTIONS, VARIETY_OPTIONS, LOADING_LEAN_OPTIONS, RESTRICTION_OPTIONS } from '@/lib/pulse/generationPreferences';
```

Leave all usages (`TRAINING_STYLE_OPTIONS.map(...)`, etc.) unchanged.

- [ ] **Step 3: Verify**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run src/components/pulse/__tests__/RoutineSetupFlow.test.tsx`
Expected: typecheck clean; all RoutineSetupFlow tests PASS (no behavior changed).

- [ ] **Step 4: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/generationPreferences.ts src/components/pulse/RoutineSetupFlow.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "refactor(pulse): extract generation-preference option constants to shared module"
```

---

## Task 2: Server actions for variety + loading lean

**Files:**
- Modify: `src/app/pulse/actions/profile.ts` (value consts near line 13; type import line 9; new actions after `updateMovementRestrictions`)

Mirror `updateTrainingStyle` / `updateMovementRestrictions` exactly. No unit test (no harness; verified by typecheck and the hook tests in Task 3).

- [ ] **Step 1: Add the value consts and type imports**

In `profile.ts`, extend the type import (line 9) to include `VarietyPreference, LoadingPreference`:

```ts
import type { Unit, LengthUnit, BodyweightEntry, Gender, PriorityMuscle, TrainingStyle, VarietyPreference, LoadingPreference, RestrictionFlag } from '@/lib/pulse/types';
```

Add value consts next to `TRAINING_STYLE_VALUES` (line ~13):

```ts
const VARIETY_PREFERENCE_VALUES = ['varied', 'consistent'] as const;
const LOADING_LEAN_VALUES = ['barbell', 'dumbbell', 'machine', 'cable'] as const;
```

- [ ] **Step 2: Add the two actions**

After the `updateMovementRestrictions` function, add:

```ts
export async function updateVarietyPreference(pref: VarietyPreference): Promise<void> {
    if (!VARIETY_PREFERENCE_VALUES.includes(pref)) throw new Error('Invalid variety preference');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, variety_preference: pref, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update variety preference');
    revalidatePath('/pulse');
}

export async function updateLoadingLean(pref: LoadingPreference | null): Promise<void> {
    // null is a valid stored value: it clears the preference (generator treats it as no preference / identity).
    if (pref !== null && !LOADING_LEAN_VALUES.includes(pref)) throw new Error('Invalid loading preference');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, loading_lean: pref, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update loading preference');
    revalidatePath('/pulse');
}
```

- [ ] **Step 3: Verify**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/app/pulse/actions/profile.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): updateVarietyPreference + updateLoadingLean profile actions"
```

---

## Task 3: Optimistic `useProfile` setters (TDD)

**Files:**
- Test: `src/hooks/pulse/__tests__/useProfile.test.ts`
- Modify: `src/hooks/pulse/useProfile.ts` (action imports ~line 8-11; type imports ~line 25; new callbacks after `updateMovementRestrictions` ~line 142; return object ~line 211)

- [ ] **Step 1: Write the failing tests**

Open `useProfile.test.ts` and read the existing `updateProfile calls mutate optimistically and calls the server action` test (line 65) to match its mock setup (it mocks `@/app/pulse/actions/profile`). Add two tests mirroring it:

```ts
it('updateVarietyPreference optimistically mutates and calls the server action', async () => {
    const { result } = renderHook(() => useProfile(baseProfile));
    await act(async () => {
        await result.current.updateVarietyPreference('consistent');
    });
    expect(serverActions.updateVarietyPreference).toHaveBeenCalledWith('consistent');
});

it('updateLoadingLean accepts an equipment value and null', async () => {
    const { result } = renderHook(() => useProfile(baseProfile));
    await act(async () => {
        await result.current.updateLoadingLean('barbell');
    });
    expect(serverActions.updateLoadingLean).toHaveBeenCalledWith('barbell');
    await act(async () => {
        await result.current.updateLoadingLean(null);
    });
    expect(serverActions.updateLoadingLean).toHaveBeenCalledWith(null);
});
```

Match the existing file's actual identifiers: use the same render helper, the same `baseProfile`/mock-profile fixture name, and the same way it references the mocked actions module (e.g. a `vi.mock('@/app/pulse/actions/profile', ...)` with named exports). Add `updateVarietyPreference` and `updateLoadingLean` to that `vi.mock` factory so they are spies.

- [ ] **Step 2: Run to verify they fail**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/hooks/pulse/__tests__/useProfile.test.ts`
Expected: the two new tests FAIL (`result.current.updateVarietyPreference` is undefined).

- [ ] **Step 3: Add the action imports**

In `useProfile.ts`, extend the `@/app/pulse/actions/profile` import block (lines ~4-11):

```ts
    updateVarietyPreference as serverUpdateVarietyPreference,
    updateLoadingLean as serverUpdateLoadingLean,
```

Extend the type import (line ~25) to include `VarietyPreference, LoadingPreference` from `@/lib/pulse/types` (alongside `RestrictionFlag`).

- [ ] **Step 4: Add the two callbacks**

After the `updateMovementRestrictions` callback (~line 142-150), add:

```ts
    const updateVarietyPreference = useCallback(
        async (pref: VarietyPreference): Promise<void> => {
            mutateProfile({ ...profile, variety_preference: pref }, false);
            try {
                await serverUpdateVarietyPreference(pref);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateLoadingLean = useCallback(
        async (pref: LoadingPreference | null): Promise<void> => {
            mutateProfile({ ...profile, loading_lean: pref }, false);
            try {
                await serverUpdateLoadingLean(pref);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );
```

Add `updateVarietyPreference,` and `updateLoadingLean,` to the hook's returned object (~line 211, next to `updateMovementRestrictions`).

- [ ] **Step 5: Run to verify they pass**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/hooks/pulse/__tests__/useProfile.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/hooks/pulse/useProfile.ts src/hooks/pulse/__tests__/useProfile.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): optimistic variety + loading-lean setters in useProfile"
```

---

## Task 4: Context interface + provider wiring

**Files:**
- Modify: `src/context/PulseContext.ts:67-68` (interface)
- Modify: `src/components/pulse/PulseProvider.tsx` (destructure ~82-83; value object ~444-445; deps array ~459-460)
- Modify: any `usePulse` mock that builds a full context value (the interface ripple): `src/components/pulse/__tests__/DesktopLayout.test.tsx`, `src/components/pulse/__tests__/PulseProvider.test.tsx`, and any other that typechecks against `PulseContextValue`.

`updateTrainingStyle` is currently defined in `useProfile` and returned, but never exposed through context. This task wires it through for the first time, alongside the two new setters.

- [ ] **Step 1: Extend the context interface**

In `PulseContext.ts`, after the `updateMovementRestrictions` line (~68) add:

```ts
    updateTrainingStyle: (style: TrainingStyle | null) => Promise<void>;
    updateVarietyPreference: (pref: VarietyPreference) => Promise<void>;
    updateLoadingLean: (pref: LoadingPreference | null) => Promise<void>;
```

(`TrainingStyle`, `VarietyPreference`, `LoadingPreference` are already imported at lines 31-33.)

- [ ] **Step 2: Wire the provider**

In `PulseProvider.tsx`: add `updateTrainingStyle, updateVarietyPreference, updateLoadingLean` to the `useProfile()` destructure (near `updateMovementRestrictions`, ~82-83), and to both the context value object (~444-445) and its dependency array (~459-460).

- [ ] **Step 3: Run the full suite, fix mock fixtures**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run`
Expected: typecheck may fail in test mocks that construct a typed `PulseContextValue` (e.g. `DesktopLayout.test.tsx`, `PulseProvider.test.tsx`) because they now miss three fields. Add `updateTrainingStyle: vi.fn(), updateVarietyPreference: vi.fn(), updateLoadingLean: vi.fn()` to each such mock (mirror how `updateMovementRestrictions: vi.fn()` was added). Re-run until typecheck clean and all tests PASS.

- [ ] **Step 4: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx src/components/pulse/__tests__/
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): expose training-style/variety/loading setters via context"
```

---

## Task 5: ProfileView "Training preferences" group (TDD)

**Files:**
- Modify: `src/components/pulse/views/ProfileView.tsx` (usePulse destructure ~110-111; import the shared consts; the restrictions section ~331-380; add the three new editors)
- Test: `src/components/pulse/__tests__/ProfileView.test.tsx` (real path: confirm with `find src -name ProfileView.test.tsx`)

Single-select editors mirror the restrictions button pattern (`startTransition` / `isPending` / `disabled` / accent-ring active state) but with one active value instead of a set. Loading lean adds an explicit "No preference" row.

- [ ] **Step 1: Write the failing tests**

In `ProfileView.test.tsx`, extend the existing `usePulse` mock to include `updateTrainingStyle: vi.fn()`, `updateVarietyPreference: vi.fn()`, `updateLoadingLean: vi.fn()`, and ensure the mocked `profile` object includes `training_style`, `variety_preference`, `loading_lean`, `movement_restrictions`. Add:

```ts
it('renders training preference editors and reflects current values', () => {
    renderProfile({ training_style: 'strength', variety_preference: 'consistent', loading_lean: 'barbell' });
    expect(screen.getByRole('button', { name: /Strength/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Consistent/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Barbell/ })).toHaveAttribute('aria-pressed', 'true');
});

it('renders null loading_lean as "No preference" active with no equipment row highlighted', () => {
    renderProfile({ loading_lean: null });
    expect(screen.getByRole('button', { name: /No preference/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Barbell/ })).toHaveAttribute('aria-pressed', 'false');
});

it('clicking the already-active loading row is a no-op (setter not called)', async () => {
    const user = userEvent.setup();
    renderProfile({ loading_lean: 'barbell' });
    await user.click(screen.getByRole('button', { name: /^Barbell/ }));
    expect(mockCtx.updateLoadingLean).not.toHaveBeenCalled();
});

it('clicking "No preference" calls updateLoadingLean(null)', async () => {
    const user = userEvent.setup();
    renderProfile({ loading_lean: 'barbell' });
    await user.click(screen.getByRole('button', { name: /No preference/ }));
    expect(mockCtx.updateLoadingLean).toHaveBeenCalledWith(null);
});
```

Match the file's real helpers: use however it currently renders ProfileView and sets the mocked context (introduce a small `renderProfile(profileOverrides)` helper if one does not exist, building on the existing mock). Use the existing mocked-context variable name for `mockCtx`.

- [ ] **Step 2: Run to verify they fail**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/components/pulse/__tests__/ProfileView.test.tsx`
Expected: the new tests FAIL (editors not rendered yet).

- [ ] **Step 3: Import shared consts + pull setters from context**

In `ProfileView.tsx`: add `updateTrainingStyle, updateVarietyPreference, updateLoadingLean` to the `usePulse()` destructure (~110-111). Add:

```ts
import { TRAINING_STYLE_OPTIONS, VARIETY_OPTIONS, LOADING_LEAN_OPTIONS, RESTRICTION_OPTIONS } from '@/lib/pulse/generationPreferences';
```

Import `TrainingStyle, VarietyPreference, LoadingPreference` types from `@/lib/pulse/types` (alongside the existing `RestrictionFlag`).

- [ ] **Step 4: Swap the restrictions editor to the shared const**

In the existing restrictions section (~339-345), replace the inline `[{ key: 'knee', label: 'Knees' }, ...]` array with `RESTRICTION_OPTIONS` (it carries `desc` too; the markup only reads `key` and `label`, so destructure `{ key, label }` from it). Behavior unchanged.

- [ ] **Step 5: Add the three new editors**

Add a "Training preferences" group above the restrictions editor (move the restrictions `<div>` under the same heading group, or place the three new editors immediately before it). Each single-select editor follows this shape (training style shown; variety is identical with `VARIETY_OPTIONS` / `profile.variety_preference ?? 'varied'` / `updateVarietyPreference`):

```tsx
{/* Training style */}
<div>
    <SectionLabel className="mb-2">Training style</SectionLabel>
    <div className="flex flex-col gap-2">
        {TRAINING_STYLE_OPTIONS.map(({ key, label, desc }) => {
            const active = (profile.training_style ?? 'balanced') === key;
            return (
                <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    disabled={isPending}
                    onClick={() => {
                        if (isPending || active) return;
                        startTransition(async () => {
                            await updateTrainingStyle(key);
                        });
                    }}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
                    } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                    <div className="flex flex-col">
                        <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                        <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>
                    </div>
                </button>
            );
        })}
    </div>
</div>
```

The **loading lean** editor renders a "No preference" row first, then the equipment rows; active equipment rows are a no-op, clearing is via "No preference":

```tsx
{/* Loading lean */}
<div>
    <SectionLabel className="mb-2">Equipment preference</SectionLabel>
    <div className="flex flex-col gap-2">
        <button
            type="button"
            aria-pressed={profile.loading_lean == null}
            disabled={isPending}
            onClick={() => {
                if (isPending || profile.loading_lean == null) return;
                startTransition(async () => {
                    await updateLoadingLean(null);
                });
            }}
            className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                profile.loading_lean == null ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
            } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
            <div className="flex flex-col">
                <span className="font-pulse-body text-sm text-pulse-text">No preference</span>
                <span className="font-pulse text-[0.75rem] text-pulse-dim">Pulse chooses freely from what you own.</span>
            </div>
        </button>
        {LOADING_LEAN_OPTIONS.map(({ key, label, desc }) => {
            const active = profile.loading_lean === key;
            return (
                <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    disabled={isPending}
                    onClick={() => {
                        if (isPending || active) return; // active equipment row = no-op; clear via "No preference"
                        startTransition(async () => {
                            await updateLoadingLean(key);
                        });
                    }}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
                    } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                    <div className="flex flex-col">
                        <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                        <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>
                    </div>
                </button>
            );
        })}
    </div>
</div>
```

Add a one-line group intro under the first SectionLabel of the group: "Shape how Pulse builds your routines. Applies to plans you generate from now on." (Place it once at the top of the grouped editors.) Keep the existing restrictions copy as-is.

- [ ] **Step 6: Run the new tests + full suite**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/components/pulse/__tests__/ProfileView.test.tsx && bun run typecheck`
Expected: new tests PASS, typecheck clean. Then `GIT_CONFIG_GLOBAL=/dev/null bun run test:run` for the full suite.

- [ ] **Step 7: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/components/pulse/views/ProfileView.tsx src/components/pulse/__tests__/ProfileView.test.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): training-style/variety/loading editors on Profile"
```

---

## Task 6: Full verification and docs sync

**Files:** `docs/roadmap.md`, `CLAUDE.md`

- [ ] **Step 1: Full gate**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests PASS (record the new total), lint clean (the pre-existing `SetLogger.tsx` exhaustive-deps warning is acceptable). Fix any straggler inline.

- [ ] **Step 2: Manual smoke (recommended)**

`bun run dev`, open Profile: set a training style, variety, and an equipment preference, then clear the equipment preference via "No preference". Generate a routine and confirm the chosen style is applied (the rationale chip / generated content reflects it).

- [ ] **Step 3: Update `docs/roadmap.md` Status block**

Set the `In progress:` line to note Branch 1 (Profile editors) shipped and Branch 2 (flow trim) is next, e.g.: "Quick-start generation (Tier 1 #15), on `feature/quick-start-generation`. Branch 1 (Profile training-preference editors) done; next, the `mode:'quick'` flow trim." Update the test count.

- [ ] **Step 4: Update `CLAUDE.md`**

In the generation section, update the "Still deferred: standalone Profile-screen style/variety/loading editors" note: those editors now exist (training style / variety / loading lean live on Profile via `updateTrainingStyle` / `updateVarietyPreference` / `updateLoadingLean`); the option constants are centralized in `src/lib/pulse/generationPreferences.ts`.

- [ ] **Step 5: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add docs/roadmap.md CLAUDE.md
GIT_CONFIG_GLOBAL=/dev/null git commit -m "docs(roadmap): profile training-preference editors shipped (#15 branch 1)"
```

---

## Notes for the implementer

- **Persist-only.** These editors store preferences; they do NOT regenerate the current routine. They apply to the next generation via the existing `param ?? profile ?? default` resolution in `generateAndSaveRoutine`. Do not add a regenerate button (that is the separate post-gen panel follow-on).
- **Loading lean null is intentional, not a default.** Never render it via `?? 'something'`. Null means "No preference" and must show that row active with no equipment highlighted.
- **Equipment rows do not deselect.** Clicking an already-active equipment row is a no-op; clearing is only via the "No preference" row. (Training style and variety always have one active value and cannot be cleared.)
- **Constant extraction is byte-identical.** If any `RoutineSetupFlow` test breaks after Task 1, you changed a label, revert to verbatim.
- **Run the full suite after Task 4 and Task 5**, not just the scoped file, interface changes ripple into `usePulse` mock fixtures.
- **No em dashes** in any copy or comment you add.
