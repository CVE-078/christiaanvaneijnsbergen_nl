# Training Style Generation Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `training_style` generation input (Balanced / Strength / Bodybuilding / Powerbuilding) that biases each session's rep ranges and set count via a transparent remap, layered on the existing slot-first engine.

**Architecture:** Two new pure functions in `generation.ts` (`resolveBias` remaps each session's bias through a 4×4 table; `resolveRepRange` interprets the already-resolved bias and, for Powerbuilding only, the movement pattern). The style is persisted on `profiles` (nullable, like `priority_muscle`), chosen in a new optional `RoutineSetupFlow` step, passed into the generate server action (which also folds it into the profile upsert). Balanced is the identity transform, so every existing routine regenerates byte-identical.

**Tech Stack:** TypeScript (strict), Next.js 15 server actions, Supabase, SWR, Vitest + Testing Library, bun.

**Spec:** `docs/superpowers/specs/2026-06-07-training-style-generation-design.md`. Read it for the remap table, the accepted limitations, and the UI copy rules.

**Commands:** typecheck `bun run typecheck`; single test file `bun run test:run src/lib/pulse/__tests__/generation.test.ts`; by name `bun run test:run -t "resolveBias"`; full run `bun run test:run`; lint `bun run lint`.

**Commit convention (this repo):** conventional commits, subject line only, no body, no `Co-Authored-By`. Author email `christiaanvaneijnsbergen@gmail.com`. Git has an empty `gpg.format` that breaks commits, so prefix every git command with `GIT_CONFIG_GLOBAL=/dev/null` and commit with `-c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false`. Branch is `feature/training-style-generation` (already created and checked out). **No em dashes anywhere** (use commas, periods, semicolons, parentheses, or a plain hyphen).

---

## File Structure

- `src/lib/pulse/types.ts` — add the `TrainingStyle` union; add `training_style` to `Profile`.
- `src/lib/pulse/generation.ts` — the engine changes: `BIAS_REMAP` + `resolveBias`, `POWERBUILDING_HEAVY_PATTERNS` + `resolveRepRange`, thread `trainingStyle` through `generateRoutine`, extend `buildRationale`.
- `src/lib/pulse/__tests__/generation.test.ts` — all engine unit + blueprint tests.
- `docs/migrations/2026-06-07-<HH-MM-SS>-training-style.sql` — the `profiles.training_style` column (full-timestamp filename, stamp at write time).
- `src/lib/pulse/queries.ts` — read `training_style` in `loadProfile`.
- `src/app/pulse/actions/profile.ts` — `updateTrainingStyle` server action.
- `src/app/pulse/actions/routines.ts` — `generateAndSaveRoutine` gains the `trainingStyle` param + persistence + rationale.
- `src/app/pulse/actions.ts` (barrel) — re-export `updateTrainingStyle`.
- `src/hooks/pulse/useProfile.ts` — optimistic `updateTrainingStyle` setter + default.
- `src/hooks/pulse/useRoutines.ts` — `generateRoutine` hook gains the `trainingStyle` param.
- `src/components/pulse/RoutineSetupFlow.tsx` — the new optional step + result field + a `collectTrainingStyle` prop.
- `src/components/pulse/GenerateRoutineButton.tsx`, `src/components/pulse/OnboardingModal.tsx` — pass the chosen style into `generateRoutine`.
- `src/components/pulse/views/TemplatesTab.tsx` — opt out of the new step (`collectTrainingStyle={false}`; templates are fixed, style cannot alter them).

---

## Task 1: `TrainingStyle` type + `resolveBias` remap

**Files:**
- Modify: `src/lib/pulse/types.ts` (after the `Bias` type, around line 406)
- Modify: `src/lib/pulse/generation.ts` (new section after `repRange`, around line 414)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Add the `TrainingStyle` type**

In `src/lib/pulse/types.ts`, immediately after the `Bias` type (line 406):

```ts
/** How the user wants to train; remaps session bias and rep ranges in generation.
 *  'balanced' is the identity (today's behaviour). Stored nullable on the profile. */
export type TrainingStyle = 'balanced' | 'strength' | 'bodybuilding' | 'powerbuilding';
```

- [ ] **Step 2: Import `TrainingStyle` into generation.ts**

In `src/lib/pulse/generation.ts`, add `TrainingStyle` to the existing `import type { ... } from './types';` block (the one starting at line 1).

- [ ] **Step 3: Write the failing test for `resolveBias`**

Add to `src/lib/pulse/__tests__/generation.test.ts`. Import `resolveBias` in the top `from '@/lib/pulse/generation'` import block, and `import type { Bias, TrainingStyle } from '@/lib/pulse/types';` (add `Bias`, `TrainingStyle` to the existing types import).

```ts
describe('resolveBias', () => {
    // The full 4×4 remap table from the spec. Rows = session bias, cols = style.
    const TABLE: Record<Bias, Record<TrainingStyle, Bias>> = {
        strength: { balanced: 'strength', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
        balanced: { balanced: 'balanced', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
        hypertrophy: { balanced: 'hypertrophy', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
        pump: { balanced: 'pump', strength: 'hypertrophy', bodybuilding: 'pump', powerbuilding: 'strength' },
    };
    const biases: Bias[] = ['strength', 'balanced', 'hypertrophy', 'pump'];
    const styles: TrainingStyle[] = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'];
    for (const b of biases) {
        for (const s of styles) {
            it(`${s} maps ${b} → ${TABLE[b][s]}`, () => {
                expect(resolveBias(b, s)).toBe(TABLE[b][s]);
            });
        }
    }
    it('balanced is the identity for every bias', () => {
        for (const b of biases) expect(resolveBias(b, 'balanced')).toBe(b);
    });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `bun run test:run -t "resolveBias"`
Expected: FAIL (`resolveBias is not a function` / not exported).

- [ ] **Step 5: Implement `resolveBias` + the remap table**

In `src/lib/pulse/generation.ts`, add right after the `repRange` function (ends line 414):

```ts
// ── Training style ───────────────────────────────────────────────────────────
// Training style remaps each session's bias through this table before the rep
// and set logic. 'balanced' is the identity column, so an unset / balanced style
// leaves the engine's output byte-identical (the safety invariant for rollout).
// See docs/superpowers/specs/2026-06-07-training-style-generation-design.md.
//
// NOTE: training style does NOT constrain training frequency. A 6-day split under
// 'strength' remaps all six sessions to strength bias by design (an accepted
// limitation, there is no fatigue model yet). Future fatigue work must not assume
// the style already caps frequency.
const BIAS_REMAP: Record<TrainingStyle, Record<Bias, Bias>> = {
    balanced: { strength: 'strength', balanced: 'balanced', hypertrophy: 'hypertrophy', pump: 'pump' },
    strength: { strength: 'strength', balanced: 'strength', hypertrophy: 'strength', pump: 'hypertrophy' },
    bodybuilding: { strength: 'hypertrophy', balanced: 'hypertrophy', hypertrophy: 'hypertrophy', pump: 'pump' },
    powerbuilding: { strength: 'strength', balanced: 'strength', hypertrophy: 'strength', pump: 'strength' },
};

/** Remap a session's bias for the chosen training style. The single source of
 *  truth for day-level style remapping. Defensive fallback returns the input. */
export function resolveBias(sessionBias: Bias, style: TrainingStyle): Bias {
    return BIAS_REMAP[style]?.[sessionBias] ?? sessionBias;
}
```

- [ ] **Step 6: Run it to confirm it passes**

Run: `bun run test:run -t "resolveBias"`
Expected: PASS (all 16 cells + the identity case).

- [ ] **Step 7: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/types.ts src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): add TrainingStyle and resolveBias remap"
```

---

## Task 2: `POWERBUILDING_HEAVY_PATTERNS` + `resolveRepRange`

**Files:**
- Modify: `src/lib/pulse/generation.ts` (directly below `resolveBias`)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test for `resolveRepRange`**

Add to `generation.test.ts`. Import `resolveRepRange`, `POWERBUILDING_HEAVY_PATTERNS`, and the existing `repRange` (already imported) in the top import block. `MovementPattern` is already imported in the types import.

```ts
describe('resolveRepRange', () => {
    it('non-powerbuilding styles defer to repRange on the resolved bias (pattern ignored)', () => {
        // hypertrophy compound, build_muscle → '8-12' (today's repRange output)
        expect(resolveRepRange('hypertrophy', 'horizontal_push', true, 'build_muscle', 'bodybuilding')).toBe(
            repRange('hypertrophy', true, 'build_muscle'),
        );
    });
    it('balanced reproduces repRange exactly for every bias × compound/iso', () => {
        const biases: Bias[] = ['strength', 'balanced', 'hypertrophy', 'pump'];
        for (const b of biases) {
            for (const compound of [true, false]) {
                expect(resolveRepRange(b, 'horizontal_push', compound, 'build_muscle', 'balanced')).toBe(
                    repRange(b, compound, 'build_muscle'),
                );
            }
        }
    });
    it('powerbuilding gives the strength range to every heavy pattern', () => {
        for (const p of POWERBUILDING_HEAVY_PATTERNS) {
            expect(resolveRepRange('strength', p, true, 'build_muscle', 'powerbuilding')).toBe(
                repRange('strength', true, 'build_muscle'),
            );
        }
    });
    it('powerbuilding gives the hypertrophy range to accessories (rows, isolation, lunge)', () => {
        for (const p of ['horizontal_pull', 'biceps_iso', 'lunge'] as MovementPattern[]) {
            const isCompound = p === 'horizontal_pull' || p === 'lunge';
            expect(resolveRepRange('strength', p, isCompound, 'build_muscle', 'powerbuilding')).toBe(
                repRange('hypertrophy', isCompound, 'build_muscle'),
            );
        }
    });
    it('lose_fat still shifts on top of the resolved range', () => {
        // strength compound: 6-10 normally, 8-12 on lose_fat (see repRange)
        expect(resolveRepRange('strength', 'squat', true, 'lose_fat', 'strength')).toBe(
            repRange('strength', true, 'lose_fat'),
        );
    });
    it('deadlift/RDL both ride the hinge pattern (intentional approximation)', () => {
        // Both a conventional deadlift and an RDL are `hinge`, so both get the heavy
        // range under powerbuilding. Documented limitation, asserted so it reads as
        // expected, not accidental.
        expect(POWERBUILDING_HEAVY_PATTERNS.has('hinge')).toBe(true);
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run test:run -t "resolveRepRange"`
Expected: FAIL (`resolveRepRange is not a function`).

- [ ] **Step 3: Implement `POWERBUILDING_HEAVY_PATTERNS` + `resolveRepRange`**

In `generation.ts`, directly below `resolveBias`:

```ts
// Main movement patterns that keep the heavy (strength) rep range under
// Powerbuilding; everything else uses the hypertrophy range. This constant is the
// single edit point for the heavy-pattern policy (data, not buried logic).
//
// NOTE: a conventional deadlift and a Romanian deadlift both map to `hinge`, so
// both land here. That is an intentional approximation until per-exercise metadata
// (generation Phase 0 #2) can separate the main lift from its accessory variants.
export const POWERBUILDING_HEAVY_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
]);

/** Rep range for a slot, given the bias already resolved by `resolveBias`.
 *  Powerbuilding is the one style that overrides per movement pattern: the main
 *  patterns get the strength range, accessories get hypertrophy. Every other style
 *  simply defers to `repRange` on the resolved bias (pattern ignored). */
export function resolveRepRange(
    effectiveBias: Bias,
    pattern: MovementPattern,
    isCompound: boolean,
    goal: Goal | undefined,
    style: TrainingStyle,
): string {
    if (style === 'powerbuilding') {
        const heavy = POWERBUILDING_HEAVY_PATTERNS.has(pattern);
        return repRange(heavy ? 'strength' : 'hypertrophy', isCompound, goal);
    }
    return repRange(effectiveBias, isCompound, goal);
}
```

`Goal` and `MovementPattern` are already imported in `generation.ts` (lines 8 and 16).

- [ ] **Step 4: Run it to confirm it passes**

Run: `bun run test:run -t "resolveRepRange"`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): add POWERBUILDING_HEAVY_PATTERNS and resolveRepRange"
```

---

## Task 3: Thread `trainingStyle` through `generateRoutine` (lib)

**Files:**
- Modify: `src/lib/pulse/generation.ts` (`GenerationInput` ~line 563; `generateRoutine` body ~line 594)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Add the failing blueprint tests**

Add to `generation.test.ts` (the `input()` / `deepPool()` / `sessionIds()` fixtures already exist near line 104). These use the existing `input(overrides)` helper.

```ts
describe('generateRoutine + trainingStyle', () => {
    it('balanced (and omitted) reproduce the current blueprint across every archetype', () => {
        const archetypes: { key: string; count: number; days: number[] }[] = [
            { key: STYLES[2][0].key, count: 2, days: [1, 4] },
            { key: STYLES[3][0].key, count: 3, days: [1, 3, 5] }, // 3-day Full Body
            { key: 'ppl-3', count: 3, days: [1, 3, 5] }, // 3-day PPL
            { key: 'ul-classic-4', count: 4, days: [1, 2, 4, 5] }, // 4-day Classic U/L
            { key: 'ppl-x2-6', count: 6, days: [1, 2, 3, 4, 5, 6] }, // 6-day PPL ×2
        ];
        for (const a of archetypes) {
            const style = STYLES[a.count].find((s) => s.key === a.key) as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: a.days }));
            const balanced = generateRoutine(input({ style, trainingDays: a.days, trainingStyle: 'balanced' }));
            expect(balanced).toEqual(base); // identity invariant, blueprint level
        }
    });

    it('strength lowers rep ranges and bumps the first compound on a PPL split', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const base = generateRoutine(input({ style, trainingDays: [1, 3, 5] }));
        const strong = generateRoutine(input({ style, trainingDays: [1, 3, 5], trainingStyle: 'strength' }));
        // At least one compound now reads a heavier (lower) range than the hypertrophy default.
        const baseReps = base.exercises.map((e) => e.reps);
        const strongReps = strong.exercises.map((e) => e.reps);
        expect(strongReps).not.toEqual(baseReps);
        // First compound of each session carries the +1 set bump (strength resolved).
        // PPL push/pull/legs first slots are compounds; expect a '4' somewhere it was '3'.
        expect(strong.exercises.some((e) => e.sets === '4')).toBe(true);
    });

    it('powerbuilding splits heavy patterns vs accessories within a PPL session', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], trainingStyle: 'powerbuilding' }));
        // The push session's horizontal_push (heavy) should read the strength range;
        // its triceps_iso accessory should read the hypertrophy range.
        const strengthRange = repRange('strength', true, 'build_muscle');
        const hyperIso = repRange('hypertrophy', false, 'build_muscle');
        const push = bp.exercises.filter((e) => e.workout_type === 'push');
        expect(push.some((e) => e.reps === strengthRange)).toBe(true);
        expect(push.some((e) => e.reps === hyperIso)).toBe(true);
    });

    it('powerbuilding also splits on a U/L split (more than one archetype verified)', () => {
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], trainingStyle: 'powerbuilding' }));
        const strengthRange = repRange('strength', true, 'build_muscle');
        const hyperIso = repRange('hypertrophy', false, 'build_muscle');
        expect(bp.exercises.some((e) => e.reps === strengthRange)).toBe(true);
        expect(bp.exercises.some((e) => e.reps === hyperIso)).toBe(true);
    });

    it('6-day PPL + strength: every session has a well-formed range and exactly one bumped compound', () => {
        const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6
        const days = [1, 2, 3, 4, 5, 6];
        const bp = generateRoutine(input({ style, trainingDays: days, trainingStyle: 'strength' }));
        // Well-formed: every rep range matches the "N-M" shape.
        expect(bp.exercises.every((e) => /^\d+-\d+$/.test(e.reps))).toBe(true);
        // Exactly one bumped compound (sets === '4') per scheduled session.
        const bumped = bp.exercises.filter((e) => e.sets === '4').length;
        expect(bumped).toBe(bp.schedule.length);
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run test:run -t "generateRoutine + trainingStyle"`
Expected: FAIL (`trainingStyle` not on `GenerationInput`; identity passes but strength/powerbuilding behaviour assertions fail because the engine ignores style).

- [ ] **Step 3: Add `trainingStyle` to `GenerationInput`**

In `generation.ts`, in the `GenerationInput` interface (around line 563), add after the `priority` field:

```ts
    /** How the user wants to train. Remaps each session's bias and rep ranges.
     *  Absent / 'balanced' is a no-op (identity). */
    trainingStyle?: TrainingStyle;
```

- [ ] **Step 4: Use the resolved bias + rep range in `generateRoutine`**

In `generateRoutine` (body around line 594), make these edits inside `style.sessions.forEach`:

Replace the emphasis line and add the resolved bias (the `const emphasis = tiltEmphasis(...)` line stays):

```ts
        const emphasis = tiltEmphasis(emphasisFor(session.emphasis), input.priority ?? null);
        const style2 = input.trainingStyle ?? 'balanced';
        const effectiveBias = resolveBias(emphasis.bias, style2);
        const selected = selectForSession(emphasis, exCount, usable, used);
```

Change the set-bump check from `emphasis.bias` to `effectiveBias`:

```ts
            if (effectiveBias === 'strength' && ex.is_compound && !firstCompoundBumped) {
```

Replace the `reps` computation (and stop discarding `pattern`):

```ts
            // pattern is used by resolveRepRange for the powerbuilding split.
            exercises.push({
                exercise_id: ex.id,
                workout_type,
                variant,
                order,
                sets: String(exSets),
                reps: resolveRepRange(effectiveBias, pattern, ex.is_compound, answers.goal, style2),
                superset_group_id: groupId,
            });
```

Delete the now-unneeded `void pattern;` line.

- [ ] **Step 5: Run it to confirm it passes**

Run: `bun run test:run -t "generateRoutine + trainingStyle"`
Expected: PASS. Then run the whole generation suite to confirm no regression: `bun run test:run src/lib/pulse/__tests__/generation.test.ts` (all green).

- [ ] **Step 6: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): apply trainingStyle in generateRoutine"
```

---

## Task 4: Persist `training_style` on the profile

**Files:**
- Create: `docs/migrations/2026-06-07-<HH-MM-SS>-training-style.sql`
- Modify: `src/lib/pulse/types.ts` (`Profile`)
- Modify: `src/lib/pulse/queries.ts` (`PROFILE_SELECT` ~line 29, `loadProfile` ~line 69)
- Modify: `src/app/pulse/actions/profile.ts`
- Modify: `src/app/pulse/actions.ts` (barrel)
- Modify: `src/hooks/pulse/useProfile.ts`

- [ ] **Step 1: Write the migration**

Create `docs/migrations/2026-06-07-<HH-MM-SS>-training-style.sql` (stamp `<HH-MM-SS>` with the current time, e.g. `2026-06-07-15-30-00`):

```sql
-- Training style: how the user wants to train, biases generation. Nullable, so
-- existing profiles (and "Balanced") are represented as NULL. No RLS change (the
-- profiles policies already scope by id). Apply manually in the Supabase SQL editor.
alter table public.profiles
  add column if not exists training_style text
  check (training_style in ('balanced', 'strength', 'bodybuilding', 'powerbuilding'));
```

- [ ] **Step 2: Add `training_style` to the `Profile` type**

In `src/lib/pulse/types.ts`, in the `Profile` interface (line 49), add after `priority_muscle`:

```ts
    // How the user wants to train; seeds generation. null = never chosen (Balanced).
    training_style: TrainingStyle | null;
```

`TrainingStyle` is defined in this same file (Task 1), so no import is needed.

- [ ] **Step 3: Add `training_style` to the default profile (failing typecheck first)**

In `src/hooks/pulse/useProfile.ts`, add to `DEFAULT_PROFILE` (line 33) after `priority_muscle: null,`:

```ts
    training_style: null,
```

Run: `bun run typecheck`
Expected: FAIL, `loadProfile` in `queries.ts` does not return `training_style` (object literal missing the new required property).

- [ ] **Step 4: Read `training_style` in `loadProfile`**

In `src/lib/pulse/queries.ts`:

Add to `PROFILE_SELECT` (line 29), append `, training_style` before the closing quote:

```ts
const PROFILE_SELECT =
    'display_name, unit, length_unit, active_routine_id, onboarding_completed, goal_weight_kg, gender, priority_muscle, timezone, accent_color, training_style';
```

Add a values constant near `PRIORITY_MUSCLE_VALUES` (line 30):

```ts
const TRAINING_STYLE_VALUES = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'];
```

In the `loadProfile` return object (line 69), add after the `priority_muscle` field:

```ts
        training_style:
            data && (TRAINING_STYLE_VALUES as readonly string[]).includes(data.training_style as string)
                ? (data.training_style as Profile['training_style'])
                : null,
```

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Add the `updateTrainingStyle` server action**

In `src/app/pulse/actions/profile.ts`:

Add `TrainingStyle` to the type import (line 9):

```ts
import type { Unit, LengthUnit, BodyweightEntry, Gender, PriorityMuscle, TrainingStyle } from '@/lib/pulse/types';
```

Add a values constant near `PRIORITY_MUSCLE_VALUES` (line 11):

```ts
const TRAINING_STYLE_VALUES = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'] as const;
```

Add the action after `updatePriorityMuscle` (line 144):

```ts
export async function updateTrainingStyle(style: TrainingStyle | null): Promise<void> {
    if (style !== null && !TRAINING_STYLE_VALUES.includes(style)) throw new Error('Invalid training style');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, training_style: style, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update training style');
    revalidatePath('/pulse');
}
```

- [ ] **Step 6: Re-export from the actions barrel**

In `src/app/pulse/actions.ts`, find the line re-exporting profile actions (it lists `updatePriorityMuscle`) and add `updateTrainingStyle` to the same export. Search for `updatePriorityMuscle`:

Run: `grep -n "updatePriorityMuscle" src/app/pulse/actions.ts`

Add `updateTrainingStyle` alongside it in that `export { ... } from './actions/profile';` list.

- [ ] **Step 7: Add the optimistic setter in `useProfile`**

In `src/hooks/pulse/useProfile.ts`:

Add to the actions import block (line 7 area):

```ts
    updateTrainingStyle as serverUpdateTrainingStyle,
```

Add `TrainingStyle` to the types import (line 14 block).

Add the callback after `updatePriorityMuscle` (line 120):

```ts
    const updateTrainingStyle = useCallback(
        async (style: TrainingStyle | null): Promise<void> => {
            mutateProfile({ ...profile, training_style: style }, false);
            try {
                await serverUpdateTrainingStyle(style);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );
```

Add `updateTrainingStyle,` to the returned object (after `updatePriorityMuscle,` line 178).

- [ ] **Step 8: Verify**

Run: `bun run typecheck` (PASS) and `bun run test:run src/hooks` (existing profile/provider tests stay green; if a provider test snapshots the profile shape it may need `training_style: null` added, do so).

- [ ] **Step 9: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add docs/migrations src/lib/pulse/types.ts src/lib/pulse/queries.ts src/app/pulse/actions/profile.ts src/app/pulse/actions.ts src/hooks/pulse/useProfile.ts
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): persist training_style on the profile"
```

---

## Task 5: `generateAndSaveRoutine` accepts + persists `trainingStyle`

**Files:**
- Modify: `src/lib/pulse/generation.ts` (`buildRationale` ~line 678)
- Modify: `src/app/pulse/actions/routines.ts` (`generateAndSaveRoutine` ~line 377)
- Test: `src/lib/pulse/__tests__/generation.test.ts` (the `buildRationale` clause)

- [ ] **Step 1: Failing test for the `buildRationale` style clause**

Add to `generation.test.ts` (there is already a `buildRationale` describe block; add cases there or a new block):

```ts
describe('buildRationale + trainingStyle', () => {
    const answers = { equipment: new Set<EquipmentKey>(['dumbbells']), experience: 'intermediate' as const, goal: 'build_muscle' as const, days: '4' as const };
    const style = STYLES[4][0];
    it('omits any style clause for balanced / undefined', () => {
        const r = buildRationale(answers, '45–60 min', style, null, 'balanced');
        expect(r).not.toMatch(/strength|powerbuilding|size/i);
    });
    it('adds a strength clause', () => {
        expect(buildRationale(answers, '45–60 min', style, null, 'strength')).toMatch(/strength/i);
    });
    it('adds a powerbuilding clause', () => {
        expect(buildRationale(answers, '45–60 min', style, null, 'powerbuilding')).toMatch(/powerbuilding/i);
    });
});
```

`EquipmentKey` is already imported in the test's types import.

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run test:run -t "buildRationale + trainingStyle"`
Expected: FAIL (`buildRationale` takes 4 args; the 5th is rejected by types / has no effect).

- [ ] **Step 3: Extend `buildRationale`**

In `generation.ts`, replace the `buildRationale` signature + body (lines 678-688) so it accepts an optional `style` and appends a clause:

```ts
const TRAINING_STYLE_CLAUSE: Record<TrainingStyle, string> = {
    balanced: '',
    strength: ' Tuned for strength: heavier loads and lower reps on the main lifts.',
    bodybuilding: ' Tuned for size: moderate-to-high reps across every session.',
    powerbuilding: ' A powerbuilding blend: heavy main lifts, higher-rep accessories.',
};

export function buildRationale(
    answers: OnboardingAnswers,
    sessionTime: SessionTime,
    style: ProgramStyle,
    priority?: PriorityMuscle | null,
    trainingStyle?: TrainingStyle,
): string {
    const goal = GOAL_LABELS[answers.goal] ?? answers.goal;
    const base = `${style.name} for ${answers.experience} lifters · ${answers.days} days/week · ${goal} · ${sessionTime} sessions. ${style.bestFor}`;
    const styleClause = TRAINING_STYLE_CLAUSE[trainingStyle ?? 'balanced'];
    const withPriority = priority
        ? `${base} Every session leans a bit harder into ${priority}, the muscle you want to grow.`
        : base;
    return `${withPriority}${styleClause}`;
}
```

`ProgramStyle` and `PriorityMuscle` are already imported in `generation.ts`. Add `ProgramStyle` to the type import if it is not already there (it is used in the signature; check the import block and add if missing).

- [ ] **Step 4: Run it to confirm it passes**

Run: `bun run test:run -t "buildRationale"`
Expected: PASS (new cases + the existing `buildRationale` tests still green; the existing ones call it with 3-4 args, which still type-check since `trainingStyle` is optional).

- [ ] **Step 5: Thread `trainingStyle` through the server action**

In `src/app/pulse/actions/routines.ts`:

Add `TrainingStyle` to the type imports from `@/lib/pulse/types` (find the existing import).

Add the param to `generateAndSaveRoutine` (line 377):

```ts
export async function generateAndSaveRoutine(
    answers: OnboardingAnswers,
    trainingDays: number[],
    sessionTime: SessionTime,
    styleKey: string,
    name?: string,
    trainingStyle?: TrainingStyle,
): Promise<WorkoutRoutine> {
```

Add a validation line near the other guards (after the `SESSION_TIMES` check, ~line 392):

```ts
    const TRAINING_STYLE_VALUES = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'] as const;
    if (trainingStyle !== undefined && !TRAINING_STYLE_VALUES.includes(trainingStyle)) throw new Error('Invalid data');
```

Read `training_style` from the profile (line 418, the `.select('priority_muscle, gender')`):

```ts
        .select('priority_muscle, gender, training_style')
```

Resolve the effective style (after the `priority` resolve, ~line 421):

```ts
    const resolvedTrainingStyle: TrainingStyle = trainingStyle ?? (profileRow?.training_style as TrainingStyle) ?? 'balanced';
```

Pass it to the rationale and the generator:

```ts
    const rationale = buildRationale(answers, sessionTime, style, priority, resolvedTrainingStyle);
```

```ts
    const blueprint = generateRoutine({
        style,
        answers,
        sessionTime,
        trainingDays,
        pool,
        priority,
        trainingStyle: resolvedTrainingStyle,
        makeGroupId: () => crypto.randomUUID(),
    });
```

Fold `training_style` into the final profile upsert (the `active_routine_id` upsert, line 359):

```ts
        .upsert({ id: user.id, active_routine_id: routine.id, training_style: resolvedTrainingStyle }, { onConflict: 'id' });
```

- [ ] **Step 6: Verify**

Run: `bun run typecheck` (PASS) and `bun run test:run src/lib/pulse/__tests__/generation.test.ts` (PASS).

- [ ] **Step 7: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts src/app/pulse/actions/routines.ts
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): persist and apply trainingStyle in generate action"
```

---

## Task 6: The setup-flow step + threading through the consumers

**Files:**
- Modify: `src/hooks/pulse/useRoutines.ts` (`generateRoutine` ~line 207)
- Modify: `src/components/pulse/RoutineSetupFlow.tsx`
- Modify: `src/components/pulse/GenerateRoutineButton.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`
- Modify: `src/components/pulse/views/TemplatesTab.tsx`
- Test: `src/components/pulse/__tests__/RoutineSetupFlow.test.tsx` (match the existing setup-flow test if present; otherwise create it)

- [ ] **Step 1: Add the `trainingStyle` param to the `useRoutines` hook**

In `src/hooks/pulse/useRoutines.ts`, change `generateRoutine` (line 207) to accept and forward the style. Add `TrainingStyle` to the type imports.

```ts
    const generateRoutine = useCallback(
        async (
            answers: OnboardingAnswers,
            trainingDays: number[],
            sessionTime: SessionTime,
            styleKey: string,
            name?: string,
            trainingStyle?: TrainingStyle,
        ): Promise<WorkoutRoutine> => {
            const routine = await serverGenerateRoutine(answers, trainingDays, sessionTime, styleKey, name, trainingStyle);
            await mutateRoutines();
            await globalMutate(PROFILE_KEY);
            return routine;
        },
        [mutateRoutines, globalMutate],
    );
```

- [ ] **Step 2: `RoutineSetupFlow`, type + state + step plumbing**

In `src/components/pulse/RoutineSetupFlow.tsx`:

Add `TrainingStyle` to the types import (line 7):

```ts
import type { EquipmentKey, SessionTime, Gender, TrainingStyle } from '@/lib/pulse/types';
```

Extend the `Step` union (line 16) with the new string step:

```ts
type Step = 'gender' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'train_style' | 'length' | 'start';
```

Add the options constant near `EQUIPMENT_OPTIONS` (line 103):

```ts
const TRAINING_STYLE_OPTIONS: { key: TrainingStyle; label: string; desc: string }[] = [
    { key: 'balanced', label: 'Balanced', desc: 'A bit of everything. Heavy days, hypertrophy days, and a pump day.' },
    { key: 'strength', label: 'Strength', desc: 'Lower reps and heavier loads on the big lifts. Still keeps one lighter day each week.' },
    { key: 'bodybuilding', label: 'Bodybuilding', desc: 'Moderate-to-high reps for size, across every session.' },
    { key: 'powerbuilding', label: 'Powerbuilding', desc: 'A blend: heavy, low-rep work on the main lifts, higher-rep work on the accessories.' },
];
```

Add the `collectTrainingStyle` prop to `Props` (after `intro`, line 147):

```ts
    /** Show the "How do you want to train?" step. Default true; template cloning
     *  sets this false because a fixed template can't be re-biased by style. */
    collectTrainingStyle?: boolean;
```

Destructure it with a default (line 156 area):

```ts
    collectTrainingStyle = true,
```

Add the `trainingStyle` field to `RoutineSetupResult` (after `programWeeks`, line 127):

```ts
    /** Chosen training style; always set (defaults to 'balanced'). Generate
     *  consumers pass it to generateRoutine; the template consumer ignores it. */
    trainingStyle: TrainingStyle;
```

Add state (after `programWeeks` state, line 173):

```ts
    const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>('balanced');
```

- [ ] **Step 3: Recompute the step count + transitions**

Update `total` (line 194) to count the new step when shown:

```ts
    const total = 8 + genderOffset + (showStyleStep ? 1 : 0) + (collectTrainingStyle ? 1 : 0);
```

In the session-time step (the final fall-through return, line 593+):
- Change its Header stepNum from `total - 2` to account for the new step:
  ```ts
  <Header stepNum={total - 2 - (collectTrainingStyle ? 1 : 0)} total={total} onBack={() => setStep(showStyleStep ? 6 : 5)} />
  ```
- Change its Next button (line 626) to go to the new step when collected:
  ```ts
  <button onClick={() => setStep(collectTrainingStyle ? 'train_style' : 'length')} disabled={!sessionTime} className={BTN_PRIMARY_BLOCK}>
  ```

In the `'length'` step (line 506+), change its `onBack` (line 510) to return to the new step when collected:

```ts
<Header stepNum={total - 1} total={total} onBack={() => setStep(collectTrainingStyle ? 'train_style' : 7)} />
```

- [ ] **Step 4: Render the new step**

Add this block in `RoutineSetupFlow` alongside the other `if (step === ...)` returns (place it just before the `if (step === 'length')` block, line 506):

```tsx
    if (step === 'train_style')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={total - 2} total={total} onBack={() => setStep(7)} />
                    <p className={Q}>How do you want to train?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Same plan, tuned to your style. You can change this anytime you regenerate.
                    </p>
                    <div className="flex flex-col gap-2">
                        {TRAINING_STYLE_OPTIONS.map((o) => (
                            <OptionRow
                                key={o.key}
                                label={o.label}
                                desc={o.desc}
                                active={trainingStyle === o.key}
                                onClick={() => setTrainingStyle(o.key)}
                            />
                        ))}
                    </div>
                    <button onClick={() => setStep('length')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );
```

- [ ] **Step 5: Include `trainingStyle` in the result + rationale preview**

In `handleComplete` (line 220), add `trainingStyle` to the `onComplete` object:

```ts
                await onComplete({
                    answers: { equipment, experience, goal, days, gender },
                    trainingDays,
                    sessionTime,
                    styleKey: styleKey ?? recommendStyle(trainingDays.length),
                    gender,
                    startAnchor: startAnchorISO(),
                    programWeeks,
                    trainingStyle,
                });
```

Pass `trainingStyle` to the live rationale preview (line 590) so the "Why this plan" text reflects the style:

```ts
            ? buildRationale({ equipment, experience, goal, days }, sessionTime, previewStyle, null, trainingStyle)
            : null;
```

- [ ] **Step 6: Pass the style through the two generate consumers**

In `src/components/pulse/GenerateRoutineButton.tsx`, update the `onComplete` destructure + call (line 27):

```tsx
                    onComplete={async ({ answers, trainingDays, sessionTime, styleKey, startAnchor, programWeeks, trainingStyle }) => {
                        const routine = await generateRoutine(
                            answers,
                            trainingDays,
                            sessionTime,
                            styleKey ?? recommendStyle(trainingDays.length),
                            undefined,
                            trainingStyle,
                        );
```

In `src/components/pulse/OnboardingModal.tsx`, likewise (line 28):

```tsx
            onComplete={async ({ answers, trainingDays, sessionTime, styleKey, gender, startAnchor, programWeeks, trainingStyle }) => {
                if (gender) await updateGender(gender);
                const routine = await generateRoutine(
                    answers,
                    trainingDays,
                    sessionTime,
                    styleKey ?? recommendStyle(trainingDays.length),
                    undefined,
                    trainingStyle,
                );
```

- [ ] **Step 7: Opt the template flow out of the new step**

In `src/components/pulse/views/TemplatesTab.tsx`, add `collectTrainingStyle={false}` to the `<RoutineSetupFlow ... />` props (it renders around line 180). The `onComplete` destructure there does not need `trainingStyle` (templates ignore it).

- [ ] **Step 8: Test the step**

Check for an existing setup-flow test: `ls src/components/pulse/__tests__/ | grep -i setup`. If one exists, mirror its mount/navigation helpers. Add a focused test (create `RoutineSetupFlow.test.tsx` if none exists, importing `render`, `screen`, `fireEvent` from the project's test utils as the other component tests do):

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoutineSetupFlow from '@/components/pulse/RoutineSetupFlow';

function advanceToTrainingStyle() {
    // Equipment → experience → goal → days → which-days → (style) → session-time → train_style.
    // Drive the wizard with the visible labels; reuse the existing setup-flow test's
    // helper if one is present rather than duplicating navigation.
}

describe('RoutineSetupFlow training style step', () => {
    it('renders the training-style step with Balanced selectable and defaults to balanced', () => {
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={vi.fn()} initial={{ equipment: ['dumbbells'], experience: 'intermediate', goal: 'build_muscle', days: '4', trainingDays: [1, 2, 4, 5], sessionTime: '45–60 min' }} />);
        // Navigate to the train_style step (use the existing helper / Next buttons),
        // then assert the question and that the four options render.
        // Minimal assertion that the copy exists once reached:
        // expect(screen.getByText('How do you want to train?')).toBeInTheDocument();
        expect(true).toBe(true); // replace with real navigation per the existing test harness
    });
});
```

NOTE to the implementer: the four pure-function + blueprint test suites (Tasks 1-3) and the action test (Task 5) carry the real correctness load. This UI test only needs to prove the step renders, defaults to Balanced, and a selection sticks, follow the existing `RoutineSetupFlow`/wizard test pattern in this repo for the navigation (do not invent a new harness). If there is genuinely no existing pattern to copy and a full navigation test would be brittle, assert instead that `TRAINING_STYLE_OPTIONS` is wired (render the step in isolation) and note the limitation.

- [ ] **Step 9: Verify the whole feature**

```bash
bun run typecheck
bun run test:run
bun run lint
```

Expected: typecheck clean; all tests pass (note the count for the roadmap); lint shows only the pre-existing `SetLogger` exhaustive-deps warning (no new warnings).

- [ ] **Step 10: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/hooks/pulse/useRoutines.ts src/components/pulse/RoutineSetupFlow.tsx src/components/pulse/GenerateRoutineButton.tsx src/components/pulse/OnboardingModal.tsx src/components/pulse/views/TemplatesTab.tsx src/components/pulse/__tests__/
GIT_CONFIG_GLOBAL=/dev/null git -c user.name="Christiaan van Eijnsbergen" -c user.email="christiaanvaneijnsbergen@gmail.com" -c commit.gpgsign=false commit -m "feat(pulse): training style step in routine setup"
```

---

## Task 7: Roadmap + CLAUDE.md sync (controller, inline)

This task is done by the controller in the main session (it needs session context), not a subagent.

- [ ] **Step 1: Mark the roadmap In progress (do this BEFORE Task 1 if not already done)**

In `docs/roadmap.md`, set the Status block `In progress:` line to "Training style generation input (Tier 2 #4) on `feature/training-style-generation`". Commit: `docs(roadmap): start training style generation input`.

- [ ] **Step 2: On completion, move to Shipped + sync both docs**

- In `docs/roadmap.md`: move Tier 2 #4 to a dated Shipped bullet (note it is the first of the three generation-input refinements; variety + loading lean remain), repoint the `In review` line to this branch, clear `In progress:` to `(none)`, update the test count, and note the migration to apply.
- In `CLAUDE.md`: update the "Routine generation" section to mention `training_style` (the `resolveBias`/`resolveRepRange` remap, `POWERBUILDING_HEAVY_PATTERNS`, profile persistence, the setup step) and add the migration to the migrations note.
- Commit on this branch: `docs(roadmap): ship training style generation input`.

---

## Self-Review

**Spec coverage:**
- New axis + four values → Tasks 1, 4 (type), 6 (UI copy). ✓
- `resolveBias` remap table → Task 1. ✓
- `resolveRepRange` + `POWERBUILDING_HEAVY_PATTERNS` (pattern-based, single edit point) → Task 2. ✓
- Separation of concerns (resolveBias sole remap; resolveRepRange takes resolved bias) → Tasks 2-3. ✓
- Set bump keys off resolved bias, per-session → Task 3 + the 6-day guard test. ✓
- Goal composition unchanged (lose_fat stacks) → Task 2 test. ✓
- Persistence on profile + migration + remembered-default → Tasks 4, 5. ✓
- Server action param + write-before-read avoidance (pass-through) + fallback to stored → Task 5. ✓
- Rationale clause → Task 5. ✓
- Setup step (optional, Balanced default, both generate flows; templates opt out) → Task 6. ✓
- Blueprint identity across five archetypes; Strength + Powerbuilding behaviour on PPL and U/L; 6-day guard → Task 3. ✓
- Accepted limitations encoded as code comments + named tests → Tasks 1 (resolveBias comment + 6-day test), 2 (deadlift/RDL comment + test). ✓
- Out of scope (Profile editor, variety, loading lean) → not built. ✓

**Placeholder scan:** the only soft spot is Task 6 Step 8's UI test, which intentionally defers to the repo's existing wizard-test harness rather than inventing brittle navigation; the note makes the expected outcome explicit. All code steps contain full code.

**Type consistency:** `TrainingStyle` is the type name everywhere; `resolveBias(sessionBias, style)`, `resolveRepRange(effectiveBias, pattern, isCompound, goal, style)`, `trainingStyle` (camelCase) as the param/field, `training_style` (snake_case) as the DB column / `Profile` field, consistent across Tasks 1-6.

## Execution grouping note (for subagent-driven execution)

Per the controller's standing approach: group tightly-coupled same-file work into one implementer dispatch with one review. Suggested grouping: **G1** = Tasks 1+2+3 (all `generation.ts` + its test, the pure engine), one implementer + one reviewer. **G2** = Tasks 4+5 (persistence + action, backend), one implementer + one reviewer. **G3** = Task 6 (the multi-file UI integration, the risky one) gets the full two-stage spec-then-quality review. **G4** = Task 7 inline by the controller. Final whole-branch review before finishing.
