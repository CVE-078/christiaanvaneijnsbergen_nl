# Movement restrictions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user flag a joint area (knee / lower back / shoulder / wrist) so routine generation drops the lifts that stress it and fills the slot with a safe alternative, set in an optional setup step and a standing Profile editor.

**Architecture:** A per-exercise `contraindications` tag plus one hard pool filter beside `hasEquipment` in `generateRoutine`. The slot-fill engine is untouched; it just sees a smaller pool. Persisted on `profiles.movement_restrictions`, threaded through the generate action with a safety-aware write-back (an absent param never clears a stored flag). Reduces and substitutes only; never diagnoses.

**Tech Stack:** TypeScript (strict), Next.js server actions, Supabase (Postgres + RLS), SWR, Vitest. Package manager: bun.

**Spec:** `docs/superpowers/specs/2026-06-08-13-57-10-movement-restrictions-design.md`

**Branch:** `feature/movement-restrictions` (already cut, spec + roadmap-start already committed).

**Always set `GIT_CONFIG_GLOBAL=/dev/null`** when running git in this repo (an empty `gpg.format` in the global config otherwise breaks commits).

---

## File structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/pulse/types.ts` | modify | Add `RestrictionFlag` / `RESTRICTION_FLAGS`; add `movement_restrictions` to `Profile`. |
| `src/lib/pulse/generation.ts` | modify | Add `contraindications` to `ExerciseMeta`; add `restrictions` to `GenerationInput`; add `isContraindicated`; apply the filter in `generateRoutine`. |
| `src/lib/pulse/__tests__/generation.test.ts` | modify | Default `contraindications: []` in fixtures; add identity + exclusion + pool-not-emptied tests. |
| `docs/migrations/<ts>-movement-restrictions-profile.sql` | create | `profiles.movement_restrictions text[]`. |
| `docs/migrations/<ts>-exercise-contraindications.sql` | create | `exercises.contraindications text[]` + per-exercise tags. |
| `src/app/pulse/actions/routines.ts` | modify | New param, pool-select column, `ExercisePoolRow`, pool map, resolve, safety-aware write-back. |
| `src/app/pulse/actions/profile.ts` | modify | New `updateMovementRestrictions` server action. |
| `src/hooks/pulse/useProfile.ts` | modify | New `updateMovementRestrictions` optimistic setter. |
| `src/context/PulseContext.ts` | modify | Add `updateMovementRestrictions` to the context interface. |
| `src/components/pulse/PulseProvider.tsx` | modify | Wire `updateMovementRestrictions` into the context value. |
| `src/components/pulse/RoutineSetupFlow.tsx` | modify | `RestrictionFlag` options, `collectRestrictions` prop, state, `restrictions` step, payload field. |
| `src/components/pulse/GenerateRoutineButton.tsx` | modify | Pass `movementRestrictions` to the generate action. |
| `src/components/pulse/OnboardingModal.tsx` | modify | Pass `movementRestrictions` to the generate action. |
| `src/components/pulse/views/TemplatesTab.tsx` | modify | `collectRestrictions={false}`. |
| `src/components/pulse/views/ProfileView.tsx` | modify | Standing "Movement restrictions" editor section. |
| `docs/roadmap.md`, `CLAUDE.md` | modify | Finish ritual (move #5 to Shipped, sync status + test count). |

---

## Task 1: Domain types and test fixtures

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/generation.ts:502-519` (the `ExerciseMeta` interface) and `:848-867` (`GenerationInput`)
- Modify: `src/lib/pulse/__tests__/generation.test.ts:172-189` (the `meta` fixture) and `:883-900` (the `metaFatigue` fixture)

This task is type-only (no behavior). It compiles green and keeps every existing test passing by defaulting the new field.

- [ ] **Step 1: Add the `RestrictionFlag` union to `types.ts`**

Place it next to the other generation-preference unions (near `LoadingPreference`):

```ts
/** Joint areas a user can flag so generation avoids the movements that commonly
 *  stress them. A pure pool filter (like equipment); reduces and substitutes,
 *  never diagnoses or rehabs. Extensible: add a flag here + tag exercises. */
export const RESTRICTION_FLAGS = ['knee', 'lower_back', 'shoulder', 'wrist'] as const;
export type RestrictionFlag = (typeof RESTRICTION_FLAGS)[number];
```

- [ ] **Step 2: Add `movement_restrictions` to the `Profile` interface**

In `types.ts`, in `interface Profile`, directly after the `loading_lean` line:

```ts
    // Joint areas to avoid in generation; null/[] = no restrictions (identity).
    movement_restrictions: RestrictionFlag[] | null;
```

- [ ] **Step 3: Add `contraindications` to `ExerciseMeta`**

In `generation.ts`, inside `interface ExerciseMeta`, after the `unilateral: boolean;` field:

```ts
    /** Joint areas this exercise commonly stresses. A user who flags one of these
     *  has the exercise filtered out of generation. Empty for the vast majority
     *  of exercises (DB default '{}'). */
    contraindications: RestrictionFlag[];
```

Add `RestrictionFlag` to the existing import from `./types` at the top of `generation.ts` (it already imports `LoadingPreference`, `TrainingStyle`, etc. from there).

- [ ] **Step 4: Add `restrictions` to `GenerationInput`**

In `generation.ts`, inside `interface GenerationInput`, after the `loadingLean?` field:

```ts
    /** Joint areas to avoid. Absent / empty is the no-op identity path (no
     *  exercise filtered, output byte-identical to the base generator). */
    restrictions?: RestrictionFlag[];
```

- [ ] **Step 5: Default the new field in both test fixtures**

In `generation.test.ts`, the `meta` fixture (line ~179) return object: add `contraindications: [],` after `unilateral: false,`. Widen its `role` param Pick to allow overrides:

```ts
    role: Partial<Pick<ExerciseMeta, 'substitution_class' | 'unilateral' | 'fatigue' | 'contraindications'>> = {},
```

In the `metaFatigue` fixture (line ~889) return object: add `contraindications: [],` after `unilateral: false,`.

- [ ] **Step 6: Verify typecheck and the existing suite stay green**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: typecheck clean; all existing generation tests PASS (no behavior changed).

- [ ] **Step 7: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/types.ts src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): add movement-restriction domain types"
```

---

## Task 2: The pool filter (engine core, TDD)

**Files:**
- Test: `src/lib/pulse/__tests__/generation.test.ts` (new `describe` blocks)
- Modify: `src/lib/pulse/generation.ts:521-526` (beside `hasEquipment`) and `:895` (the `usable` line)

The identity guarantee and the name-specific exclusion are the two tests that matter most. Write them first.

- [ ] **Step 1: Write the failing tests**

Append to `generation.test.ts`. The first locks the no-op identity; the second asserts a tagged lift is actually gone (closes the silent-seeding-gap failure mode); the third asserts a restriction never empties leg work.

```ts
describe('movement restrictions: golden identity -- empty/undefined is byte-identical to base', () => {
    it('undefined and [] restrictions produce byte-identical output', () => {
        for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[config.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: config.days }));
            const undef = generateRoutine(input({ style, trainingDays: config.days, restrictions: undefined }));
            const empty = generateRoutine(input({ style, trainingDays: config.days, restrictions: [] }));
            expect(undef).toEqual(base);
            expect(empty).toEqual(base);
        }
    });
});

describe('movement restrictions: a contraindicated exercise is excluded by name', () => {
    it('drops a knee-contraindicated squat and keeps a safe one', () => {
        const pool: ExerciseMeta[] = [
            meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
            meta('box-squat', 'squat', ['dumbbells'], true, { contraindications: [] }),
            ...deepPool().filter((e) => e.movement_pattern !== 'squat'),
        ];
        const bp = generateRoutine(input({ pool, restrictions: ['knee'] }));
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('barbell-back-squat')).toBe(false);
        // The safe squat survives and can still be programmed.
        const baseIds = new Set(generateRoutine(input({ pool })).exercises.map((e) => e.exercise_id));
        expect(baseIds.has('barbell-back-squat') || baseIds.has('box-squat')).toBe(true);
    });
});

describe('movement restrictions: a single flag never empties leg work', () => {
    // Assert across both a 6-day split and a 3-day full-body config. The 3-day
    // case is where pool thinning bites hardest (fewer slots, more patterns per
    // session), so it is the more important guard.
    const kneePool = (): ExerciseMeta[] => [
        meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
        meta('leg-press', 'squat', ['dumbbells'], true, { contraindications: [] }),
        meta('romanian-deadlift', 'hinge', ['dumbbells'], true, { contraindications: [] }),
        ...deepPool().filter((e) => e.movement_pattern !== 'squat' && e.movement_pattern !== 'hinge'),
    ];
    it.each([
        { label: '6-day split', days: [1, 2, 3, 4, 5, 6] },
        { label: '3-day full body', days: [1, 3, 5] },
    ])('a knee restriction still leaves squat-or-hinge leg work available ($label)', ({ days }) => {
        const bp = generateRoutine(input({ pool: kneePool(), restrictions: ['knee'], trainingDays: days }));
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('leg-press') || ids.has('romanian-deadlift')).toBe(true);
    });
});

describe('movement restrictions: two flags at once filter the union', () => {
    it('a knee + shoulder restriction drops both flagged lifts and still produces a routine', () => {
        const pool: ExerciseMeta[] = [
            meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
            meta('leg-press', 'squat', ['dumbbells'], true, { contraindications: [] }),
            meta('overhead-press', 'vertical_push', ['dumbbells'], true, { contraindications: ['shoulder'] }),
            meta('machine-shoulder-press', 'vertical_push', ['dumbbells'], true, { contraindications: [] }),
            ...deepPool().filter((e) => e.movement_pattern !== 'squat' && e.movement_pattern !== 'vertical_push'),
        ];
        const bp = generateRoutine(input({ pool, restrictions: ['knee', 'shoulder'], trainingDays: [1, 2, 3, 4, 5, 6] }));
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('barbell-back-squat')).toBe(false);
        expect(ids.has('overhead-press')).toBe(false);
        expect(bp.exercises.length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/lib/pulse/__tests__/generation.test.ts -t "movement restrictions"`
Expected: the identity test FAILS (or is a no-op pass since `restrictions` is currently ignored), the exclusion test FAILS (`barbell-back-squat` is still selected because nothing filters it). The point is the exclusion test must be red before the filter exists.

- [ ] **Step 3: Add the `isContraindicated` predicate**

In `generation.ts`, immediately after `hasEquipment` (line ~526):

```ts
function isContraindicated(ex: ExerciseMeta, restrictions: Set<RestrictionFlag>): boolean {
    // Safety filter: hard, never relaxed (unlike the equipment thin-pool / heavy-
    // dedup / unilateral relax fallbacks). A flagged lift is never re-added to
    // fill a slot; if a pattern empties, the existing backfill covers it from
    // safe patterns. Empty restriction set = no-op (identity).
    if (restrictions.size === 0) return false;
    return ex.contraindications.some((c) => restrictions.has(c));
}
```

- [ ] **Step 4: Apply the filter in `generateRoutine`**

In `generation.ts`, replace the `usable` line (line ~895):

```ts
    const restrictions = new Set(input.restrictions ?? []);
    const usable = pool
        .filter((ex) => hasEquipment(ex, answers.equipment))
        .filter((ex) => !isContraindicated(ex, restrictions));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: all PASS, including the three new blocks and every pre-existing test (the empty-set path leaves output byte-identical).

- [ ] **Step 6: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): hard contraindication pool filter in generation"
```

---

## Task 3: Migrations and the contraindication seed

**Files:**
- Create: `docs/migrations/<ts>-movement-restrictions-profile.sql`
- Create: `docs/migrations/<ts>-exercise-contraindications.sql`

Migrations are hand-written and applied manually in the Supabase SQL editor (no runner in this repo). Use a full timestamp prefix `YYYY-MM-DD-HH-MM-SS` (run `date "+%Y-%m-%d-%H-%M-%S"` for each).

- [ ] **Step 1: Write the profile-column migration**

`docs/migrations/<ts>-movement-restrictions-profile.sql`:

```sql
-- Movement restrictions (Tier 2 #5): joint areas to avoid in generation.
-- Nullable text[]; null/empty means no restrictions (identity path).
-- Inherits the existing owner-scoped RLS on profiles (column add, no policy change).
alter table profiles
    add column if not exists movement_restrictions text[];
```

- [ ] **Step 2: Write the exercise-contraindications migration (column + tags)**

First add the column, then tag against the CURRENT corrected seed. Read the live exercise names/ids before writing the `UPDATE`s (open the Supabase table or grep the seed files). Map per the clinical table in the spec. Template:

```sql
-- Per-exercise contraindication tags (Tier 2 #5). Read-only catalog data;
-- inherits the existing exercises read policy (column add, no policy change).
alter table exercises
    add column if not exists contraindications text[] not null default '{}';

-- knee: heavy axial squat, deep/walking lunge, leg extension. Keep box squat,
-- leg press, hinge, leg curl, hip thrust, step-ups.
update exercises set contraindications = array_append(contraindications, 'knee')
    where user_id is null and name in ('Barbell Back Squat', 'Front Squat', 'Walking Lunge', 'Leg Extension');

-- lower_back: heavy deadlift/RDL, good morning, bent-over barbell row, carries.
update exercises set contraindications = array_append(contraindications, 'lower_back')
    where user_id is null and name in ('Deadlift', 'Romanian Deadlift', 'Good Morning', 'Bent-Over Barbell Row');

-- shoulder: overhead barbell press, upright row, dips.
update exercises set contraindications = array_append(contraindications, 'shoulder')
    where user_id is null and name in ('Overhead Press', 'Upright Row', 'Dips');

-- wrist: straight-bar heavy press, push-up, barbell curl.
update exercises set contraindications = array_append(contraindications, 'wrist')
    where user_id is null and name in ('Push-Up', 'Barbell Curl');
```

The exercise names above are placeholders to be reconciled against the real seed. Verify each name exists; adjust to actual names/ids. The seeding invariant must hold: after each single flag, at least one safe squat-or-hinge leg option and one safe push option remain for a normal equipment set.

- [ ] **Step 3: Apply both migrations in the Supabase SQL editor**

This is a manual step. Apply the profile migration, then the exercise migration. Then run the verification query and confirm the invariant:

```sql
-- Sanity: how many exercises carry each flag, and confirm safe options remain.
select unnest(contraindications) as flag, count(*) from exercises where user_id is null group by 1 order by 1;
-- Confirm safe squat/hinge survive a knee flag:
select name, movement_pattern from exercises
  where user_id is null and movement_pattern in ('squat','hinge') and not ('knee' = any(contraindications));
```

Expected: each flag tags a small set; the second query returns at least one safe leg lift.

- [ ] **Step 4: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add docs/migrations/
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): movement-restriction migrations + contraindication seed"
```

---

## Task 4: Thread restrictions through the generate action

**Files:**
- Modify: `src/app/pulse/actions/routines.ts` (signature ~401, validation ~411, pool select ~442, `ExercisePoolRow` ~390, pool map ~470, profile read ~452, resolve ~456, blueprint call ~482, write-back upsert ~535)

- [ ] **Step 1: Add the param to the signature**

`generateAndSaveRoutine` signature (line ~401), add after `loadingLean?: LoadingPreference,`:

```ts
    movementRestrictions?: RestrictionFlag[],
```

Import `RestrictionFlag` (and `RESTRICTION_FLAGS`) from `@/lib/pulse/types` in this file.

- [ ] **Step 2: Validate the param**

After the loading-lean validation (line ~426):

```ts
    if (
        movementRestrictions !== undefined &&
        (!Array.isArray(movementRestrictions) || !movementRestrictions.every((r) => RESTRICTION_FLAGS.includes(r)))
    )
        throw new Error('Invalid data');
```

- [ ] **Step 3: Select the column and extend `ExercisePoolRow`**

Pool select (line ~442) add `contraindications`:

```ts
        .select('id, category, equipment, movement_pattern, is_compound, fatigue, substitution_class, unilateral, contraindications')
```

`ExercisePoolRow` interface (line ~390) add:

```ts
    contraindications: RestrictionFlag[] | null;
```

Pool map (line ~470) add inside the mapped object:

```ts
            contraindications: row.contraindications ?? [],
```

- [ ] **Step 4: Read and resolve the stored value**

Profile read select (line ~452) add `movement_restrictions`:

```ts
        .select('priority_muscle, gender, training_style, variety_preference, loading_lean, movement_restrictions')
```

After the loading-lean resolve (line ~462):

```ts
    // Param wins over the stored value; absent param falls back to stored, then [].
    const resolvedRestrictions: RestrictionFlag[] =
        movementRestrictions ?? (profileRow?.movement_restrictions as RestrictionFlag[]) ?? [];
```

- [ ] **Step 5: Pass into the blueprint**

In the `generateRoutine({...})` call (line ~482), add:

```ts
        restrictions: resolvedRestrictions,
```

- [ ] **Step 6: Safety-aware write-back**

Replace the final profile upsert (line ~535) so the restriction column is written ONLY when the param was explicitly passed. Build the upsert payload conditionally:

```ts
    const profileUpsert: Record<string, unknown> = {
        id: user.id,
        active_routine_id: routine.id,
        training_style: resolvedTrainingStyle,
        variety_preference: resolvedVariety,
    };
    // Persist restrictions only when explicitly provided. An absent param must
    // never clear a stored safety flag (a re-generate that omits the step).
    if (movementRestrictions !== undefined) profileUpsert.movement_restrictions = movementRestrictions;
    const { error: profileErr } = await supabase.from('profiles').upsert(profileUpsert, { onConflict: 'id' });
    if (profileErr) throw new Error('Failed to set active routine');
```

- [ ] **Step 7: Verify typecheck**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck`
Expected: clean. (Server actions are not unit-tested in this repo; the filter logic is covered by Task 2, the write-back is a small conditional verified by review + typecheck.)

- [ ] **Step 8: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/app/pulse/actions/routines.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): thread restrictions through generate action (safety-aware write-back)"
```

---

## Task 5: Profile setter action, hook, and context wiring

**Files:**
- Modify: `src/app/pulse/actions/profile.ts`
- Modify: `src/hooks/pulse/useProfile.ts` (mirror `updateTrainingStyle` at :127-137; export list ~:194)
- Modify: `src/context/PulseContext.ts` (~:63)
- Modify: `src/components/pulse/PulseProvider.tsx` (~:80 destructure, ~:441 + ~:455 wiring)

- [ ] **Step 1: Add the server action**

In `profile.ts`, mirroring `updateLengthUnit`. Import `RestrictionFlag` / `RESTRICTION_FLAGS` from `@/lib/pulse/types`:

```ts
export async function updateMovementRestrictions(restrictions: RestrictionFlag[]): Promise<void> {
    if (!Array.isArray(restrictions) || !restrictions.every((r) => RESTRICTION_FLAGS.includes(r)))
        throw new Error('Invalid data');
    // De-dupe so the stored array is canonical.
    const unique = [...new Set(restrictions)];

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, movement_restrictions: unique, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update movement restrictions');
    revalidatePath('/pulse');
}
```

- [ ] **Step 2: Add the optimistic setter in `useProfile`**

Import at the top (mirroring the other `serverUpdate*` imports):

```ts
    updateMovementRestrictions as serverUpdateMovementRestrictions,
```

Add the callback after `updateTrainingStyle` (line ~137):

```ts
    const updateMovementRestrictions = useCallback(
        async (restrictions: RestrictionFlag[]): Promise<void> => {
            mutateProfile({ ...profile, movement_restrictions: restrictions }, false);
            try {
                await serverUpdateMovementRestrictions(restrictions);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );
```

Add `updateMovementRestrictions,` to the hook's return object (near line ~194). Import `RestrictionFlag` from `@/lib/pulse/types` in this file.

- [ ] **Step 3: Add it to the context interface**

In `PulseContext.ts`, after the `updateAccentColor` line (~:66):

```ts
    updateMovementRestrictions: (restrictions: RestrictionFlag[]) => Promise<void>;
```

Import `RestrictionFlag` from `@/lib/pulse/types` if not already imported.

- [ ] **Step 4: Wire it through the provider**

In `PulseProvider.tsx`, add `updateMovementRestrictions` to the `useProfile()` destructure (near :80) and to both the context-value object and its dependency array (near :441 and :455), exactly mirroring `updateAccentColor`.

- [ ] **Step 5: Verify typecheck**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/app/pulse/actions/profile.ts src/hooks/pulse/useProfile.ts src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): updateMovementRestrictions profile action + context wiring"
```

---

## Task 6: The setup-flow step and the three consumers

**Files:**
- Modify: `src/components/pulse/RoutineSetupFlow.tsx` (Step union :19, `RoutineSetupResult` :134, options const near :118, `Props` :161, state :201, `total` :236, `handleComplete` :272, the `loading` step :630, the `length` step back-link :668)
- Modify: `src/components/pulse/GenerateRoutineButton.tsx:27`
- Modify: `src/components/pulse/OnboardingModal.tsx:28`
- Modify: `src/components/pulse/views/TemplatesTab.tsx:174`

The `restrictions` step is appended after `loading` and before `length`. It is multi-select (mirror the equipment step's checkbox chips), not single-select.

- [ ] **Step 1: Extend the `Step` union and `RoutineSetupResult`**

`Step` (line 19): add `'restrictions'` before `'length'`:

```ts
type Step = 'gender' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'train_style' | 'variety' | 'loading' | 'restrictions' | 'length' | 'start';
```

`RoutineSetupResult` (line 134): add a field (mirror the `loadingLean` doc-comment style):

```ts
    /** Joint areas to avoid in generation; [] when none chosen / step skipped. */
    movementRestrictions: RestrictionFlag[];
```

Import `RestrictionFlag` / `RESTRICTION_FLAGS` from `@/lib/pulse/types`.

- [ ] **Step 2: Add the options constant**

Near `LOADING_LEAN_OPTIONS` (line ~118):

```ts
const RESTRICTION_OPTIONS: { key: RestrictionFlag; label: string; desc: string }[] = [
    { key: 'knee', label: 'Knees', desc: 'Avoid deep squats, lunges, and leg extensions.' },
    { key: 'lower_back', label: 'Lower back', desc: 'Avoid heavy deadlifts, good mornings, and bent-over rows.' },
    { key: 'shoulder', label: 'Shoulders', desc: 'Avoid overhead barbell presses, upright rows, and dips.' },
    { key: 'wrist', label: 'Wrists', desc: 'Avoid straight-bar presses, push-ups, and barbell curls.' },
];
```

- [ ] **Step 3: Add the `collectRestrictions` prop**

In `Props` (after `collectLoadingLean?`):

```ts
    /** Show the "Anything we should work around?" step. Default true; template
     *  cloning sets this false because a fixed template isn't pool-filtered. */
    collectRestrictions?: boolean;
```

Destructure it with the other `collect*` props in the component signature, defaulting to `true` (match how `collectLoadingLean` is defaulted).

- [ ] **Step 4: Add state**

After the `loadingLean` state (line ~219):

```ts
    const [restrictions, setRestrictions] = useState<Set<RestrictionFlag>>(new Set());
```

Add a toggle helper near the other toggles (e.g. `toggleEquipment`):

```ts
    const toggleRestriction = (key: RestrictionFlag) =>
        setRestrictions((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
```

- [ ] **Step 5: Update the `total` count**

In the `total` expression (line ~242), add the restrictions step:

```ts
    const total =
        8 +
        genderOffset +
        (showStyleStep ? 1 : 0) +
        (collectTrainingStyle ? 1 : 0) +
        (collectVariety ? 1 : 0) +
        (collectLoadingLean ? 1 : 0) +
        (collectRestrictions ? 1 : 0);
```

- [ ] **Step 6: Re-point the `loading` step's Next and stepNum**

In the `loading` step (line ~630): change its `stepNum` and its Next target so it flows into `restrictions` when shown.

`stepNum`:
```ts
                        stepNum={total - 2 - (collectRestrictions ? 1 : 0)}
```

Next button target:
```ts
                <button onClick={() => setStep(collectRestrictions ? 'restrictions' : 'length')} className={BTN_PRIMARY_BLOCK}>
                    {loadingLean ? 'Next' : 'Skip'}
                </button>
```

- [ ] **Step 7: Add the `restrictions` step JSX**

Insert immediately before the `if (step === 'length')` block (line ~661). Back target walks the optional chain that precedes it:

```tsx
    if (step === 'restrictions')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 2}
                        total={total}
                        onBack={() =>
                            setStep(
                                collectLoadingLean
                                    ? 'loading'
                                    : collectVariety
                                      ? 'variety'
                                      : collectTrainingStyle
                                        ? 'train_style'
                                        : 7,
                            )
                        }
                    />
                    <p className={Q}>Anything we should work around?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Pick any joints that bother you and Pulse will avoid the movements that commonly stress them, choosing safer alternatives. This is not medical advice. Skip if none apply.
                    </p>
                    <div className="flex flex-col gap-2">
                        {RESTRICTION_OPTIONS.map(({ key, label, desc }) => (
                            <label
                                key={key}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                    restrictions.has(key)
                                        ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                        : 'bg-pulse-surface-2 ring-0'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={restrictions.has(key)}
                                    onChange={() => toggleRestriction(key)}
                                    className="sr-only"
                                />
                                <div
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${restrictions.has(key) ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                                    {restrictions.has(key) && (
                                        <span className="text-pulse-bg text-[10px] font-bold leading-none">✓</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                    <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                    <p className="font-pulse text-[0.75rem] text-pulse-dim">
                        Takes effect the next time you generate a plan. To swap exercises in your current routine, use the Swap option on any exercise.
                    </p>
                    <button onClick={() => setStep('length')} className={BTN_PRIMARY_BLOCK}>
                        {restrictions.size > 0 ? 'Next' : 'Skip'}
                    </button>
                </div>
            </div>
        );
```

- [ ] **Step 8: Re-point the `length` step's Back**

In the `length` step `onBack` (line ~668), prepend `restrictions` to the chain:

```ts
                        onBack={() =>
                            setStep(
                                collectRestrictions
                                    ? 'restrictions'
                                    : collectLoadingLean
                                      ? 'loading'
                                      : collectVariety
                                        ? 'variety'
                                        : collectTrainingStyle
                                          ? 'train_style'
                                          : 7,
                            )
                        }
```

- [ ] **Step 9: Add the field to the `onComplete` payload**

In `handleComplete` (line ~272), add to the `onComplete({...})` object:

```ts
                movementRestrictions: [...restrictions],
```

- [ ] **Step 10: Update the three consumers**

`GenerateRoutineButton.tsx` (line ~27): add `movementRestrictions` to the destructure and pass it as the 9th arg:

```ts
onComplete={async ({ answers, trainingDays, sessionTime, styleKey, startAnchor, programWeeks, trainingStyle, varietyPreference, loadingLean, movementRestrictions }) => {
    const routine = await generateRoutine(
        answers,
        trainingDays,
        sessionTime,
        styleKey ?? recommendStyle(trainingDays.length),
        undefined,
        trainingStyle,
        varietyPreference,
        loadingLean ?? undefined,
        movementRestrictions,
    );
    if (startAnchor) await setProgramAnchor(routine.id, startAnchor);
    if (programWeeks !== 12) await updateRoutineProgramWeeks(routine.id, programWeeks);
    navigate('train');
}}
```

`OnboardingModal.tsx` (line ~28): same, add `movementRestrictions` to the destructure and as the 9th arg to `generateRoutine(...)` (keep the existing `if (gender) await updateGender(gender);` and the rest).

`TemplatesTab.tsx` (line ~174): add `collectRestrictions={false}` alongside the existing `collectLoadingLean={false}`. Its `onComplete` destructure does not need the field (it clones a template, no generation filter).

- [ ] **Step 11: Verify typecheck and the existing suite**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run`
Expected: clean; all tests PASS.

Also manually verify the step-number arithmetic: `bun run dev`, open the generate flow, and walk to the new step. The "Step N of total" on the restrictions step should read one higher than loading and one lower than length, with no skipped or duplicated number across the whole tail (train_style → variety → loading → restrictions → length → start).

- [ ] **Step 12: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/components/pulse/RoutineSetupFlow.tsx src/components/pulse/GenerateRoutineButton.tsx src/components/pulse/OnboardingModal.tsx src/components/pulse/views/TemplatesTab.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): movement-restrictions setup step + consumer threading"
```

---

## Task 7: The Profile editor section

**Files:**
- Modify: `src/components/pulse/views/ProfileView.tsx` (the `usePulse()` destructure ~:96, a new section near the accent-colour block ~:303)

- [ ] **Step 1: Pull the setter from context**

Add `updateMovementRestrictions` to the `usePulse()` destructure (line ~96).

- [ ] **Step 2: Add the editor section**

Mirror the accent-colour section markup. Place it near the other preference sections. Derive `RESTRICTION_OPTIONS` either by importing the same labels or re-declaring a local const (re-declare locally to avoid a cross-component import; keep the four labels identical to the setup step):

```tsx
{/* Movement restrictions */}
<div>
    <SectionLabel className="mb-2">Movement restrictions</SectionLabel>
    <p className="mb-3 font-pulse text-[0.8125rem] text-pulse-dim">
        Joints to work around. Applies to routines you generate from now on. To change your current plan, use the Swap option on any exercise.
    </p>
    <div className="flex flex-col gap-2">
        {([
            { key: 'knee', label: 'Knees' },
            { key: 'lower_back', label: 'Lower back' },
            { key: 'shoulder', label: 'Shoulders' },
            { key: 'wrist', label: 'Wrists' },
        ] as { key: RestrictionFlag; label: string }[]).map(({ key, label }) => {
            const active = (profile.movement_restrictions ?? []).includes(key);
            return (
                <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                        const current = profile.movement_restrictions ?? [];
                        const next = active ? current.filter((r) => r !== key) : [...current, key];
                        void updateMovementRestrictions(next);
                    }}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
                    }`}>
                    <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                        {active && <span className="text-[10px] font-bold leading-none text-pulse-bg">✓</span>}
                    </div>
                    <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                </button>
            );
        })}
    </div>
</div>
```

Import `RestrictionFlag` from `@/lib/pulse/types` in `ProfileView.tsx`.

- [ ] **Step 3: Verify typecheck**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add src/components/pulse/views/ProfileView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): standing movement-restrictions editor on Profile"
```

---

## Task 8: Full verification and docs sync (Finish ritual)

**Files:**
- Modify: `docs/roadmap.md`, `CLAUDE.md`

- [ ] **Step 1: Run the full suite and typecheck**

Run: `GIT_CONFIG_GLOBAL=/dev/null bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests PASS (record the new total), lint clean. Fix any stragglers inline before proceeding.

- [ ] **Step 2: Manual smoke (optional but recommended)**

Run: `bun run dev`, then in the app: generate a routine choosing a knee restriction and confirm no deep-squat lift appears; open Profile and toggle a restriction; regenerate without surfacing the step (e.g. via a path that omits it) and confirm the stored flag is NOT cleared.

- [ ] **Step 3: Move #5 to Shipped in `docs/roadmap.md`**

In the Tier 2 table, strike/relocate the #5 row to a dated Shipped bullet under "Reference & archive". Update the Status block: clear `In progress:` back to `(none)`, update "Where things stand" with a movement-restrictions sentence and the new test count, and update "Next up" (next is #6 Equipment profiles).

- [ ] **Step 4: Sync `CLAUDE.md`**

Update the "Routine generation" section to mention movement restrictions as a shipped pool filter (`RestrictionFlag`, `contraindications` metadata, `isContraindicated`, persisted on `profiles.movement_restrictions`, optional setup step + Profile editor), and bump the test count if the architecture paragraph cites it.

- [ ] **Step 5: Commit the docs sync**

```bash
GIT_CONFIG_GLOBAL=/dev/null git add docs/roadmap.md CLAUDE.md
GIT_CONFIG_GLOBAL=/dev/null git commit -m "docs(roadmap): ship movement restrictions (#5)"
```

- [ ] **Step 6: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to push and open the PR (the user pushes / merges themselves).

---

## Notes for the implementer

- **The identity guarantee is sacred.** Empty/undefined restrictions must leave generation byte-identical. The Task 2 golden test enforces it; never weaken it.
- **The restriction filter is hard.** Do not add a thin-pool relax for it the way equipment / heavy-dedup / unilateral caps relax. A contraindicated lift is never re-added. If a pattern empties, the existing backfill handles it.
- **Write-back is safety-significant.** Persist `movement_restrictions` only when the param is explicitly passed (`!== undefined`). An absent param must never clear a stored flag.
- **v1 is a pure subtractive filter.** No front-loading of preferred substitutes (documented boundary in the spec; future hook is `substitution_class`). Safe lifts surface because they are what remains.
- **Reconcile the seed against real exercise names.** The migration `UPDATE` names in Task 3 are placeholders; verify each against the live `exercises` seed before applying, and re-confirm the seeding invariant.
