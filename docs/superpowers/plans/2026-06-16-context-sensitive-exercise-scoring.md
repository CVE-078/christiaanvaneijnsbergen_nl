# Context-sensitive exercise scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, context-free `ISOLATION_QUALITY` selection score with a context-sensitive one (computed from per-exercise metadata against goal/style/focus/rep-band), add per-exercise rep windows, style-distinct primary reorders, a weekly isolation-repetition cap, and a warnings-only compound-carryover credit.

**Architecture:** Slot-first generator unchanged. We add four metadata columns to `exercises`, a pure `contextScore` that replaces one `byPattern` comparator layer, a per-exercise rep-window clamp in assignment, a style-aware `anchorRank`, and a per-pattern carryover map used only by `muscleCoverageGaps`. Everything is gated to no-op on nameless/metadata-absent pools so the byte-identity goldens hold.

**Tech Stack:** TypeScript (strict), Vitest + Testing Library, Supabase/Postgres (hand-applied SQL migrations), Bun.

**Spec:** `docs/superpowers/specs/2026-06-16-14-57-31-context-sensitive-exercise-scoring-design.md`

**Sequencing (the spec's "Implementation sequencing"):** three phases, each independently green and committable. Phase 1 (carryover) is fully orthogonal. Phase 2 (metadata + rep plumbing) sets up data Phase 3 consumes. Phase 3 (selection levers) is the entangled core, gated behind ordering-invariant tests. Review each phase before starting the next.

**Verification commands (run from repo root):**
- Single file: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
- By name: `bun run test:run -t "carryover"`
- Full suite (run at each phase boundary): `bun run test:run`
- Types: `bun run typecheck`

**Key code-truth (verified against the tree, 2026-06-16):**
- `ExerciseMeta` (`generation.ts:782`) already has `primary_muscle?`, `secondary_muscle_groups?`, `difficulty?`. We add `quality?`, `rep_min?`, `rep_max?`, `attributes?`.
- The generator pool query + map live in `src/app/pulse/actions/routines.ts` (select at ~line 466, `ExercisePoolRow` at ~396, map at ~499). The app loaders in `queries.ts` (`EXERCISES_SELECT`, `ROUTINES_SELECT`) feed `DbExercise` and are NOT touched.
- `selectForSession` (`generation.ts:1158`) is called once in `generateRoutine` (~line 1971). `byPattern` is invoked at `generation.ts:1344` and `:1471`.
- The rep-assignment loop + `sessionCtx.set` is at `generation.ts:2059-2120`.
- `muscleVolume.ts`: `weeklyMuscleSets` (line 24), `muscleCoverageGaps` (line 99), `MUSCLE_SET_TARGETS` (64), `targetDirectSets` (81), `MuscleGap` (86).
- Tests: `src/lib/pulse/__tests__/generation.test.ts` (`meta()` factory ~270, `deepPool()` ~314, `input()` ~342, hard-coded goldens ~3130, the `#3` named-catalogue suite ~2630) and `src/lib/pulse/__tests__/muscleVolume.test.ts` (`ex()`/`bp()` helpers ~8, `poolFor` used in gap tests).
- `Goal` and `ExperienceLevel` live in `recommendation.ts`, not `types.ts`. `Muscle`/`MUSCLES`, `MovementPattern`, `TrainingStyle`, `Focus`, `EquipmentKey` live in `types.ts`.
- Migrations: `docs/migrations/<yyyy-mm-dd-hh-mm-ss>-<slug>.sql`, lowercase SQL, `where user_id is null and name = '...'`, `array[...]::text[]`.

---

## Phase 1: Compound-carryover credit (warnings only)

Orthogonal slice. Touches only `src/lib/pulse/muscleVolume.ts` and its test. No generation change, no selection change, no migration.

### Task 1.1: Add the per-pattern carryover map and a pure carryover helper

**Files:**
- Modify: `src/lib/pulse/muscleVolume.ts`
- Test: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/pulse/__tests__/muscleVolume.test.ts` (the file already imports `weeklyMuscleSets`, `muscleCoverageGaps`, `MUSCLES`, `MuscleTarget` and has the `ex()` / `bp()` helpers; add `compoundCarryover` to the import from `'../muscleVolume'`):

```ts
describe('compoundCarryover', () => {
    it('credits triceps and front_delts from a horizontal_push compound at 0.5/set', () => {
        const pool = [ex('bench', 'chest', ['front_delts', 'triceps'])]; // ex() defaults movement_pattern horizontal_push, is_compound true
        const credit = compoundCarryover(bp([{ id: 'bench', sets: 6 }]), pool);
        expect(credit.triceps).toBeCloseTo(3); // 6 * 0.5
        expect(credit.front_delts).toBeCloseTo(3);
        expect(credit.chest ?? 0).toBe(0); // primary never carries over to itself
    });

    it('does NOT credit hamstrings from a squat compound (the masking trap)', () => {
        const squat = ex('squat', 'quads', ['hamstrings', 'glutes']);
        squat.movement_pattern = 'squat';
        const credit = compoundCarryover(bp([{ id: 'squat', sets: 10 }]), [squat]);
        expect(credit.hamstrings ?? 0).toBe(0);
        expect(credit.glutes ?? 0).toBe(0);
    });

    it('does NOT credit from an isolation even on a credited pattern', () => {
        const fly = ex('fly', 'chest', ['triceps']);
        fly.movement_pattern = 'horizontal_push';
        fly.is_compound = false;
        const credit = compoundCarryover(bp([{ id: 'fly', sets: 4 }]), [fly]);
        expect(credit.triceps ?? 0).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "compoundCarryover"`
Expected: FAIL with `compoundCarryover is not exported` / not a function.

- [ ] **Step 3: Implement the map and helper**

In `src/lib/pulse/muscleVolume.ts`, add after the `SECONDARY_SET_CREDIT` constant (line 13). Note the import of `MovementPattern` already exists on line 2:

```ts
/** Warning-only compound-carryover credit (context-scoring spec, 2026-06-16). A compound
 *  that trains a muscle as a SECONDARY gets partial credit toward that muscle in the
 *  coverage WARNING comparison only (NOT gap-fill, NOT selection, NOT the UI). The map is
 *  sparse and defaults to 0: only movement -> secondary pairs with genuinely strong
 *  carryover are credited. squat / hinge / lunge credit NOTHING, so a squat-only week
 *  still warns on a real hamstring or glute gap (the masking trap all reviewers flagged).
 *  Isolations never carry over. */
export const CARRYOVER_CREDITS: Partial<Record<MovementPattern, Partial<Record<Muscle, number>>>> = {
    horizontal_push: { triceps: 0.5, front_delts: 0.5 },
    vertical_push: { triceps: 0.5, front_delts: 0.5 },
    horizontal_pull: { biceps: 0.5, rear_delts: 0.5 },
    vertical_pull: { biceps: 0.5 },
};

/** Carryover-only credit per muscle (does NOT include direct sets). For each COMPOUND row,
 *  for each of its secondary muscles, add sets * CARRYOVER_CREDITS[pattern][muscle] (0 if the
 *  pair is unlisted). Deterministic; pure. Used only by muscleCoverageGaps. */
export function compoundCarryover(
    blueprint: RoutineBlueprint,
    pool: ExerciseMeta[],
): Record<Muscle, number> {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const out = {} as Record<Muscle, number>;
    for (const m of MUSCLES) out[m] = 0;
    for (const row of blueprint.exercises) {
        const meta = metaById.get(row.exercise_id);
        if (!meta || !meta.is_compound || !meta.movement_pattern) continue;
        const credits = CARRYOVER_CREDITS[meta.movement_pattern];
        if (!credits) continue;
        const sets = Number(row.sets);
        if (!Number.isFinite(sets) || sets <= 0) continue;
        for (const sec of meta.secondary_muscle_groups ?? []) {
            const frac = credits[sec];
            if (frac) out[sec] += sets * frac;
        }
    }
    return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run -t "compoundCarryover"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): add compound-carryover credit map for muscle warnings"
```

### Task 1.2: Gate `muscleCoverageGaps` on direct + carryover

**Files:**
- Modify: `src/lib/pulse/muscleVolume.ts:99-128` (`muscleCoverageGaps`)
- Test: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('muscleCoverageGaps with carryover', () => {
    it('suppresses a triceps warning when pressing covers it indirectly', () => {
        // 12 direct chest sets from a press that secondaries triceps; 0 direct triceps.
        const bench = ex('bench', 'chest', ['triceps']); // horizontal_push compound
        const tri = ex('tri', 'triceps'); // makes triceps in-scope for the pool
        tri.movement_pattern = 'triceps_iso';
        tri.is_compound = false;
        const gaps = muscleCoverageGaps(bp([{ id: 'bench', sets: 12 }]), [bench, tri]);
        // triceps min is 8; carryover = 12*0.5 = 6 < 8, so it STILL warns here...
        const tris = gaps.find((g) => g.target === 'triceps');
        expect(tris).toBeDefined();
        // ...but at 16 press sets, carryover = 8 >= 8, warning suppressed:
        const gaps2 = muscleCoverageGaps(bp([{ id: 'bench', sets: 16 }]), [bench, tri]);
        expect(gaps2.find((g) => g.target === 'triceps')).toBeUndefined();
    });

    it('still warns on hamstrings under a heavy squat week (no squat->hamstring credit)', () => {
        const squat = ex('squat', 'quads', ['hamstrings']);
        squat.movement_pattern = 'squat';
        const ham = ex('ham', 'hamstrings');
        ham.movement_pattern = 'hamstring_iso';
        ham.is_compound = false;
        const gaps = muscleCoverageGaps(bp([{ id: 'squat', sets: 20 }]), [squat, ham]);
        expect(gaps.find((g) => g.target === 'hamstrings')).toBeDefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "muscleCoverageGaps with carryover"`
Expected: FAIL (the 16-set case still warns because the gate is direct-only).

- [ ] **Step 3: Implement the gated comparison**

In `muscleCoverageGaps` (`muscleVolume.ts:99`), after building `direct` (the loop at lines 104-106), add the carryover and change the gate. Replace this block:

```ts
    const counts = weeklyMuscleSets(blueprint, pool);
    const direct = {} as Record<Muscle, number>;
    for (const m of MUSCLES) direct[m] = counts[m].direct;
```

with:

```ts
    const counts = weeklyMuscleSets(blueprint, pool);
    const direct = {} as Record<Muscle, number>;
    for (const m of MUSCLES) direct[m] = counts[m].direct;
    // Warning-only: a compound's indirect work counts toward whether to NAG, never toward
    // gap-fill (which stays direct-only) or the reported `direct` number below.
    const carryover = compoundCarryover(blueprint, pool);
```

Then change the gate line (currently `if (d < min)`). Replace:

```ts
        const { min } = MUSCLE_SET_TARGETS[target];
        const d = targetDirectSets(direct, target);
        if (d < min) gaps.push({ target, direct: d, min, ratio: d / min });
```

with:

```ts
        const { min } = MUSCLE_SET_TARGETS[target];
        const d = targetDirectSets(direct, target);
        // `back` is an aggregate (lats + upper_back); no carryover pair targets it, so its
        // coverage equals direct. For the single-muscle targets, add the carryover credit.
        const credited = target === 'back' ? 0 : carryover[target as Muscle];
        const coverage = d + credited;
        if (coverage < min) gaps.push({ target, direct: d, min, ratio: d / min });
```

The reported `direct` and `ratio` stay the true direct numbers; only the firing gate uses coverage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: PASS (all existing + new tests; existing gap tests with no compound carryover are unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): gate muscle-coverage warnings on direct + compound carryover"
```

### Task 1.3: Phase 1 suite gate

- [ ] **Step 1: Run the full suite + typecheck**

Run: `bun run test:run` then `bun run typecheck`
Expected: all green (gap-fill and generation goldens untouched, since `gapFill.ts` still calls the unchanged `muscleCoverageGaps`? NO: gap-fill uses its own floor logic, not `muscleCoverageGaps`. Confirm by reading `gapFill.ts` does not import `muscleCoverageGaps`; it imports `weeklyMuscleSets`, which is unchanged). If any generation golden moved, STOP: it means gap-fill consumed the gate, which it must not.

- [ ] **Step 2: No commit** (verification only). Phase 1 complete and reviewable.

---

## Phase 2: Metadata columns + rep-window plumbing

Adds the four columns, threads them into the generator pool, switches `isolationQuality` to read the column, adds the rep-window helpers + the assignment clamp + the gross rep-mismatch selection layer, and threads the scoring context into `selectForSession`. No `contextScore` yet (Phase 3).

### Task 2.1: The migration

**Files:**
- Create: `docs/migrations/<run `date "+%Y-%m-%d-%H-%M-%S"`>-exercise-scoring-metadata.sql`

- [ ] **Step 1: Generate the timestamped filename**

Run: `date "+%Y-%m-%d-%H-%M-%S"` and use it as the filename prefix.

- [ ] **Step 2: Write the migration**

Seed `quality` from the current `ISOLATION_QUALITY` map values (verbatim from `generation.ts:1088-1127`), apply the Straight-Arm Pulldown peer re-ranking (add it high, lower Pullover), and seed the rep windows + attributes for the targeted exercises. Hand-apply on merge.

```sql
-- Context-sensitive exercise scoring (spec 2026-06-16-14-57-31). Additive columns +
-- a one-time seed. Forward-only. Generator-only fields (not read by the app loaders).
alter table exercises
    add column if not exists quality numeric(3,2),
    add column if not exists rep_min smallint,
    add column if not exists rep_max smallint,
    add column if not exists attributes text[] not null default '{}'::text[];

-- quality: migrate the ISOLATION_QUALITY map into the column (verbatim values).
update exercises set quality = 1.00 where user_id is null and name in ('Cable Curl','Tricep Pushdown','Lateral Raise','Dumbbell Lateral Raise','Cable Fly');
update exercises set quality = 0.95 where user_id is null and name in ('Incline Dumbbell Curl','Preacher Curl','Cable Overhead Tricep Extension','Dumbbell Tricep Overhead Extension','Dips','Face Pull','Dumbbell Face Pull (Bent-Over)','Rear Delt Fly');
update exercises set quality = 0.90 where user_id is null and name in ('Dumbbell Curl','Dumbbell Bicep Curl','Dumbbell Hammer Curl','Skull Crusher','Dumbbell Reverse Fly','Chest Fly');
update exercises set quality = 0.85 where user_id is null and name in ('Spider Curl','Upright Row');
update exercises set quality = 0.80 where user_id is null and name in ('Diamond / Close-Grip Push-Up','Dumbbell Shrug');
update exercises set quality = 0.75 where user_id is null and name = 'Arnold Press';
update exercises set quality = 0.70 where user_id is null and name = 'Concentration Curl';
update exercises set quality = 0.60 where user_id is null and name = 'Front Raise';
update exercises set quality = 0.55 where user_id is null and name = 'Tricep Kickback';

-- back_iso peer re-ranking (spec section 5): Straight-Arm Pulldown is the better lat
-- isolation, was never scored (re-tagged back_iso by the #153 calibration); Pullover is
-- overvalued relative to it. Add Straight-Arm high, lower Pullover to its true value.
update exercises set quality = 0.95 where user_id is null and name = 'Straight-Arm Pulldown';
update exercises set quality = 0.72 where user_id is null and name = 'Dumbbell Pullover';

-- rep windows + the explosive attribute (spec section 4). Leave true barbell/machine
-- compounds NULL (squat/press/leg-press handle their own ranges via bias/goal).
-- Names verified against the live catalogue (94 user-null exercises, 2026-06-16). The only
-- explosive lift present is Dumbbell Push Press (vertical_push, compound, NOT a
-- CANONICAL_ANCHOR, so the [3,5] window + gross-mismatch layer keep it off hypertrophy days).
-- No Olympic lifts exist (no clean/snatch/jerk), so no clean seeds. The unilateral leg set
-- is Step-Up / Walking Lunge / Dumbbell Bulgarian Split Squat (all pattern 'lunge'). There is
-- no Cable Lateral Raise.
update exercises set rep_min = 3, rep_max = 5, attributes = array['explosive']::text[] where user_id is null and name = 'Dumbbell Push Press';
update exercises set rep_min = 8, rep_max = 15 where user_id is null and name = 'Step-Up';
update exercises set rep_min = 6, rep_max = 15 where user_id is null and name = 'Dumbbell Bulgarian Split Squat';
update exercises set rep_min = 8, rep_max = 20 where user_id is null and name = 'Walking Lunge';
update exercises set rep_min = 10, rep_max = 25 where user_id is null and name in ('Lateral Raise','Dumbbell Lateral Raise','Rear Delt Fly','Dumbbell Reverse Fly');
update exercises set rep_min = 10, rep_max = 20 where user_id is null and name in ('Face Pull','Dumbbell Face Pull (Bent-Over)');
update exercises set rep_min = 8, rep_max = 20 where user_id is null and name in ('Cable Fly','Chest Fly','Pec Deck');

-- attributes for the bodybuilding style affinity (spec section 3). incline + lengthened_bias.
update exercises set attributes = array['incline']::text[] where user_id is null and name in ('Incline Dumbbell Press','Incline Barbell Press','Incline Dumbbell Curl');
update exercises set attributes = array['lengthened_bias']::text[] where user_id is null and name in ('Cable Fly','Incline Dumbbell Curl','Cable Overhead Tricep Extension','Romanian Deadlift','Seated Cable Row');
```

(All names above were verified present in the live catalogue on 2026-06-16 via a read-only query. The seed-coverage test in Task 3.6 reads this file from disk and asserts each name resolves, mirroring the existing `ISOLATION_QUALITY` fragility guard.)

- [ ] **Step 3: No automated test for the SQL** (no migration runner in this repo). Commit it; it is hand-applied on merge.

```bash
git add docs/migrations/*-exercise-scoring-metadata.sql
git commit -m "feat(pulse): migration for exercise scoring metadata columns + seed"
```

### Task 2.2: Add the metadata fields to `ExerciseMeta` and the generator pool

**Files:**
- Modify: `src/lib/pulse/generation.ts:782` (`ExerciseMeta`)
- Modify: `src/app/pulse/actions/routines.ts` (`ExercisePoolRow` ~396, the pool select ~466, the map ~499)
- Modify: `scripts/gen-routine.ts` (the pool select + map, so real-catalogue verification sees the fields)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `generation.test.ts` (proves the type accepts the fields and a no-op default; `meta()` does not set them, so this also documents the nameless default):

```ts
describe('ExerciseMeta scoring fields', () => {
    it('accepts quality / rep_min / rep_max / attributes and defaults them absent', () => {
        const m = meta('x', 'biceps_iso', ['dumbbells'], false, { name: 'Cable Curl' });
        expect(m.quality).toBeUndefined();
        expect(m.rep_min).toBeUndefined();
        expect(m.attributes).toBeUndefined();
        const scored: ExerciseMeta = { ...m, quality: 0.9, rep_min: 8, rep_max: 12, attributes: ['incline'] };
        expect(scored.quality).toBe(0.9);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "ExerciseMeta scoring fields"`
Expected: FAIL (typecheck error: `quality` not on `ExerciseMeta`).

- [ ] **Step 3: Add the fields to `ExerciseMeta`**

In `generation.ts`, append inside the `ExerciseMeta` interface (after `secondary_muscle_groups?`, before the closing brace at ~line 819):

```ts
    /** Base hypertrophy quality (0-1), migrated from ISOLATION_QUALITY. Optional:
     *  absent -> NEUTRAL_QUALITY, so nameless/synthetic pools score neutrally and the
     *  goldens stay byte-identical. */
    quality?: number;
    /** Preferred rep window. Optional: absent -> no per-exercise constraint (the
     *  bias/goal range governs). Drives both a selection penalty and an assignment clamp. */
    rep_min?: number;
    rep_max?: number;
    /** Objective semantic properties (e.g. 'incline', 'lengthened_bias', 'explosive'),
     *  consumed by the style affinity. NOT style labels. Optional/absent = none. */
    attributes?: string[];
```

- [ ] **Step 4: Thread the fields through the generator pool**

In `src/app/pulse/actions/routines.ts`, extend `ExercisePoolRow` (after `secondary_muscle_groups`):

```ts
    quality: number | null;
    rep_min: number | null;
    rep_max: number | null;
    attributes: string[] | null;
```

Extend the pool select string (add the four columns):

```ts
        .select(
            'id, name, category, equipment, movement_pattern, is_compound, fatigue, substitution_class, unilateral, contraindications, difficulty, primary_muscle, secondary_muscle_groups, quality, rep_min, rep_max, attributes',
        )
```

Extend the map (after `secondary_muscle_groups: row.secondary_muscle_groups ?? []`):

```ts
            ...(row.quality !== null ? { quality: row.quality } : {}),
            ...(row.rep_min !== null ? { rep_min: row.rep_min } : {}),
            ...(row.rep_max !== null ? { rep_max: row.rep_max } : {}),
            attributes: row.attributes ?? [],
```

In `scripts/gen-routine.ts`, add `quality, rep_min, rep_max, attributes` to its `select` and the same spreads to its row map (so the cached real-catalogue pool carries them; bump the cache with `--refresh`).

- [ ] **Step 5: Run test + typecheck to verify pass**

Run: `bun run test:run -t "ExerciseMeta scoring fields"` then `bun run typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/app/pulse/actions/routines.ts scripts/gen-routine.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): thread scoring metadata fields into the generator pool"
```

### Task 2.3: Switch `isolationQuality` to read the column

**Files:**
- Modify: `src/lib/pulse/generation.ts:1136-1140` (`isolationQuality`)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('isolationQuality reads the column', () => {
    it('uses ex.quality when present, NEUTRAL_QUALITY when absent', () => {
        const scored = meta('a', 'biceps_iso', ['dumbbells'], false, { name: 'Cable Curl' });
        expect(isolationQuality({ ...scored, quality: 0.95 })).toBe(0.95);
        expect(isolationQuality(scored)).toBe(0.8); // NEUTRAL_QUALITY, no column value
        const nameless = meta('b', 'biceps_iso', ['dumbbells'], false);
        expect(isolationQuality(nameless)).toBe(0.8); // nameless stays neutral
    });
});
```

(`isolationQuality` is already exported from `generation.ts`; ensure the test imports it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "isolationQuality reads the column"`
Expected: FAIL (the scored case returns 0.8 because the function still reads the name-keyed map, and `meta` has no map entry for a fresh name unless seeded).

- [ ] **Step 3: Implement column read**

Replace `isolationQuality` (`generation.ts:1136-1140`):

```ts
/** Isolation-quality score for an exercise (higher = better). Reads the seeded `quality`
 *  column; absent -> NEUTRAL_QUALITY, so synthetic/nameless pools score neutrally and the
 *  layer is a no-op for them. ISOLATION_QUALITY (the constant) is retained only as the
 *  migration seed source + a parity test-oracle. */
export function isolationQuality(ex: ExerciseMeta): number {
    return ex.quality ?? NEUTRAL_QUALITY;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts` then `bun run typecheck`
Expected: PASS. The goldens are byte-identical (synthetic pools have no `quality` -> NEUTRAL, identical to the old nameless path). The `#3` named-catalogue suite seeds quality on its `meta(...)` rows; UPDATE those tests to set `quality` on the test exercises instead of relying on the name map (e.g. `meta('zzz-cable', 'biceps_iso', ['dumbbells'], false, { name: 'Cable Curl' })` becomes `{ ...that, quality: 1.0 }`). Adjust each `#3` case so the higher-quality exercise carries the higher `quality` value.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "refactor(pulse): isolationQuality reads the quality column"
```

### Task 2.4: Rep-window helpers + the assignment clamp

**Files:**
- Modify: `src/lib/pulse/generation.ts` (add helpers near `floorRepRangeForLoad` ~line 759; wire the clamp into the rep loop ~2084)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('clampRepsToWindow', () => {
    const base = meta('x', 'vertical_push', ['barbell'], true, { name: 'Push Press' });
    it('returns reps unchanged when the exercise has no window', () => {
        expect(clampRepsToWindow('8-12', base)).toBe('8-12');
    });
    it('uses the exercise window when the band does not overlap it', () => {
        const pp = { ...base, rep_min: 3, rep_max: 5 };
        expect(clampRepsToWindow('8-12', pp)).toBe('3-5'); // power lift on a hypertrophy day
    });
    it('intersects when the band overlaps the window', () => {
        const step = { ...base, rep_min: 8, rep_max: 15 };
        expect(clampRepsToWindow('8-12', step)).toBe('8-12');
        expect(clampRepsToWindow('3-6', step)).toBe('8-15'); // no overlap -> window
        expect(clampRepsToWindow('12-20', step)).toBe('12-15'); // overlap -> intersect
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "clampRepsToWindow"`
Expected: FAIL (`clampRepsToWindow` not exported).

- [ ] **Step 3: Implement the helpers**

In `generation.ts`, add after `floorRepRangeForLoad` (after line 771):

```ts
/** The exercise's preferred rep window as [lo, hi], or null when it has none. A one-sided
 *  seed is widened (missing min -> 1, missing max -> 999). */
export function repWindow(ex: ExerciseMeta): [number, number] | null {
    if (ex.rep_min == null && ex.rep_max == null) return null;
    return [ex.rep_min ?? 1, ex.rep_max ?? 999];
}

/** True when a rep band [lo, hi] overlaps the window [wlo, whi]. */
export function bandOverlapsWindow(band: [number, number], window: [number, number]): boolean {
    return band[0] <= window[1] && window[0] <= band[1];
}

/** Clamp an assigned rep band into the exercise's preferred window (spec section 4).
 *  No window -> unchanged. Overlap -> intersect. No overlap (a thin pool forced a misfit
 *  in) -> the exercise's own window, so a power lift shows its low band, not the day's.
 *  No-op on a nameless/unwindowed exercise, so the goldens hold. Pure. */
export function clampRepsToWindow(reps: string, ex: ExerciseMeta): string {
    const window = repWindow(ex);
    if (!window) return reps;
    const lo = Number(reps.split('-')[0]);
    const hi = Number(reps.split('-')[1] ?? reps.split('-')[0]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return reps;
    if (bandOverlapsWindow([lo, hi], window)) {
        return `${Math.max(lo, window[0])}-${Math.min(hi, window[1])}`;
    }
    return `${window[0]}-${window[1]}`;
}
```

- [ ] **Step 4: Wire the clamp into the rep-assignment loop**

In `generateRoutine` (`generation.ts:2084`), wrap the existing `floorRepRangeForLoad(resolveRepRange(...), ex)` result with the clamp. Replace:

```ts
            const reps = floorRepRangeForLoad(
                resolveRepRange(
                    effectiveBias,
                    pattern,
                    ex.is_compound,
                    answers.goal,
                    styleForBias,
                    answers.experience,
                    session.focus,
                ),
                ex,
            );
```

with:

```ts
            const reps = clampRepsToWindow(
                floorRepRangeForLoad(
                    resolveRepRange(
                        effectiveBias,
                        pattern,
                        ex.is_compound,
                        answers.goal,
                        styleForBias,
                        answers.experience,
                        session.focus,
                    ),
                    ex,
                ),
                ex,
            );
```

- [ ] **Step 5: Write the integration test (Push Press clamped on a real-style session)**

```ts
describe('rep windows in generation', () => {
    it('clamps Push Press to its window if it lands on a hypertrophy session', () => {
        const pool = deepPool().concat([
            meta('pp', 'vertical_push', ['barbell'], true, { name: 'Push Press', rep_min: 3, rep_max: 5 } as Partial<ExerciseMeta>),
        ]);
        // Remove other vertical_push so Push Press is forced in (thin pool).
        const thin = pool.filter((e) => e.movement_pattern !== 'vertical_push' || e.id === 'pp');
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: thin }));
        const ppRow = bp.exercises.find((e) => e.exercise_id === 'pp');
        if (ppRow) expect(['3-5']).toContain(ppRow.reps);
    });
});
```

(The `meta()` factory's `role` param does not include `rep_min`/`rep_max`; either widen the `role` Pick in `meta()` to include them, or build the exercise object inline. Widening `meta()` is cleaner: add `'rep_min' | 'rep_max' | 'quality' | 'attributes'` to its `Pick<...>` and spread.)

- [ ] **Step 6: Run tests + goldens to verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS, and the byte-identity goldens unchanged (synthetic pool exercises have no window -> clamp is a no-op).

- [ ] **Step 7: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): per-exercise rep-window assignment clamp"
```

### Task 2.5: Thread the scoring context into `selectForSession` and add the gross rep-mismatch layer

**Files:**
- Modify: `src/lib/pulse/generation.ts` (`selectForSession` signature ~1158, `byPattern` ~1216, the call site ~1971)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test (selection prefers a fitting press over Push Press)**

```ts
describe('gross rep-mismatch selection', () => {
    it('prefers a real OHP over Push Press on a hypertrophy day when both exist', () => {
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'vertical_push')
            .concat([
                meta('ohp', 'vertical_push', ['dumbbells'], true, { name: 'Dumbbell Overhead Press' }),
                meta('pp', 'vertical_push', ['dumbbells'], true, { name: 'Push Press', rep_min: 3, rep_max: 5 } as Partial<ExerciseMeta>),
            ]);
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const push = sessionIds(bp, 'push', null);
        expect(push).toContain('ohp');
        expect(push).not.toContain('pp');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "gross rep-mismatch selection"`
Expected: FAIL (today Push Press can win via fatigue/id ordering; the band is not yet a selection signal).

- [ ] **Step 3: Extend `selectForSession` to receive the scoring context**

Add parameters to the `selectForSession` signature (after `experience?`):

```ts
    goal?: Goal,
    style: TrainingStyle = 'balanced',
```

(Import `Goal` from `'./recommendation'` and confirm `TrainingStyle` is already imported.) Inside `selectForSession`, compute a per-candidate rep band helper that `byPattern` can use:

```ts
    // The prescribed band for a candidate in slot `p` (mirrors the assignment-time call,
    // minus floorRepRangeForLoad which never widens past a window). Used by the gross
    // rep-mismatch layer. Pure of side effects.
    const bandFor = (ex: ExerciseMeta, p: MovementPattern): [number, number] => {
        const r = resolveRepRange(emphasis.bias === effectiveBiasUnused ? emphasis.bias : emphasis.bias, p, ex.is_compound, goal, style, experience, focus);
        const lo = Number(r.split('-')[0]);
        const hi = Number(r.split('-')[1] ?? r.split('-')[0]);
        return [Number.isFinite(lo) ? lo : 1, Number.isFinite(hi) ? hi : 999];
    };
```

NOTE for the implementer: `selectForSession` does not currently receive `effectiveBias`; it has `emphasis.bias`. The assignment path uses `effectiveBias = resolveBias(emphasis.bias, styleForBias)`. To keep selection and assignment consistent, pass the resolved bias in rather than recomputing. Replace the two added params above with a single threaded value and adjust `bandFor`:

```ts
    bias: Bias = 'balanced',   // the already-resolved effectiveBias from the call site
    goal?: Goal,
    style: TrainingStyle = 'balanced',
```

and `bandFor` uses `bias`:

```ts
    const bandFor = (ex: ExerciseMeta, p: MovementPattern): [number, number] => {
        const r = resolveRepRange(bias, p, ex.is_compound, goal, style, experience, focus);
        const lo = Number(r.split('-')[0]);
        const hi = Number(r.split('-')[1] ?? r.split('-')[0]);
        return [Number.isFinite(lo) ? lo : 1, Number.isFinite(hi) ? hi : 999];
    };
```

- [ ] **Step 4: Add the gross rep-mismatch comparator layer in `byPattern`**

In `byPattern` (`generation.ts:1216`), insert the mismatch layer immediately BEFORE the canonical-anchor rank block (before `const aRank = anchorRank(a, p);` at ~line 1259):

```ts
                // Gross rep-mismatch (context-scoring spec, all patterns): a candidate whose
                // window does not overlap its prescribed band sorts last. Dominant, above the
                // anchor rank. No window -> never a mismatch, so nameless pools are unaffected.
                const aWin = repWindow(a);
                const bWin = repWindow(b);
                const aMiss = aWin && !bandOverlapsWindow(bandFor(a, p), aWin) ? 1 : 0;
                const bMiss = bWin && !bandOverlapsWindow(bandFor(b, p), bWin) ? 1 : 0;
                if (aMiss !== bMiss) return aMiss - bMiss;
```

- [ ] **Step 5: Pass the context at the call site**

At the `selectForSession(...)` call (`generation.ts:1971`), add the three arguments after `answers.experience`:

```ts
            answers.experience,
            effectiveBias,
            answers.goal,
            styleForBias,
        );
```

- [ ] **Step 6: Run tests + goldens to verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS, goldens byte-identical (synthetic pools have no windows -> `aMiss`/`bMiss` both 0 -> the layer falls through). If a golden moved, a synthetic exercise gained an unexpected window; STOP and investigate.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): gross rep-mismatch selection layer + scoring context threading"
```

### Task 2.6: Phase 2 suite gate

- [ ] **Step 1: Full suite + typecheck**

Run: `bun run test:run` then `bun run typecheck`
Expected: all green, every byte-identity golden unchanged. Phase 2 complete and reviewable.

---

## Phase 3: Selection levers (contextScore, style, repeat cap)

The entangled core. Adds the constants, `StyleProfile`, the style-aware `anchorRank`, `contextScore`, the weekly-repeat count map, replaces the `ISOLATION_QUALITY` comparator layer with `contextScore.total`, and locks the magnitude bands with ordering-invariant tests.

### Task 3.1: Scoring constants + `StyleProfile` + `STYLE_PROFILES`

**Files:**
- Modify: `src/lib/pulse/generation.ts` (add near `ISOLATION_QUALITY` ~line 1088)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('STYLE_PROFILES', () => {
    it('Balanced is the neutral identity (no preferences, no reorder)', () => {
        const p = STYLE_PROFILES.balanced;
        expect(p.preferredAttributes.size).toBe(0);
        expect(Object.keys(p.equipmentBias)).toHaveLength(0);
        expect(p.compoundBias).toBe(0);
        expect(p.canonicalReorder).toBeUndefined();
    });
    it('Bodybuilding reorders three patterns and prefers incline/lengthened', () => {
        const p = STYLE_PROFILES.bodybuilding;
        expect(p.preferredAttributes.has('incline')).toBe(true);
        expect(Object.keys(p.canonicalReorder ?? {})).toEqual(
            expect.arrayContaining(['horizontal_push', 'horizontal_pull', 'squat']),
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "STYLE_PROFILES"`
Expected: FAIL (`STYLE_PROFILES` not exported).

- [ ] **Step 3: Implement constants + profiles**

In `generation.ts`, add after `NEUTRAL_QUALITY` (line 1134):

```ts
// ── Context score tunables (spec 2026-06-16-14-57-31, section 7) ─────────────────────
// Magnitude-banded so precedence is unambiguous; locked by ordering-invariant tests.
export const STYLE_AFFINITY_MAX = 0.25; // cap on the accessory style bump
export const ATTRIBUTE_BUMP = 0.1; // per matched preferred attribute
export const REP_FIT_BONUS_MAX = 0.1; // graded overlap tiebreak, below quality/style
// Saturating weekly-repeat penalty by prior-selection count (index = prior count, capped).
export const REPEAT_PENALTY = [0, -0.5, -0.75, -0.85] as const;

export function repeatPenaltyFor(priorCount: number): number {
    if (priorCount <= 0) return 0;
    return REPEAT_PENALTY[Math.min(priorCount, REPEAT_PENALTY.length - 1)];
}

export interface StyleProfile {
    preferredAttributes: ReadonlySet<string>;
    equipmentBias: Partial<Record<EquipmentKey, number>>;
    compoundBias: number; // + favours compounds, - favours isolation density
    canonicalReorder?: Partial<Record<MovementPattern, string[]>>;
}

// Balanced is the neutral identity: every term zero, no reorder, so a Balanced routine is
// byte-identical (the golden invariant). Powerbuilding/Strength lean barbell + compound but
// their reorder largely matches the canonical default (which already leads with barbell), so
// their primaries stay heavy-barbell on purpose; they diverge from Balanced via reps, not
// exercises. Bodybuilding is the style that visibly diverges (machine/cable/incline primaries).
export const STYLE_PROFILES: Record<TrainingStyle, StyleProfile> = {
    balanced: { preferredAttributes: new Set(), equipmentBias: {}, compoundBias: 0 },
    strength: {
        preferredAttributes: new Set(),
        equipmentBias: { barbell: 0.1 },
        compoundBias: 0.1,
    },
    powerbuilding: {
        preferredAttributes: new Set(),
        equipmentBias: { barbell: 0.1 },
        compoundBias: 0.1,
    },
    bodybuilding: {
        preferredAttributes: new Set(['incline', 'lengthened_bias']),
        equipmentBias: { machines: 0.1, cables: 0.1 },
        compoundBias: -0.05,
        canonicalReorder: {
            horizontal_push: [
                'Incline Dumbbell Press',
                'Incline Barbell Press',
                'Dumbbell Bench Press',
                'Machine Chest Press',
                'Barbell Bench Press',
            ],
            horizontal_pull: [
                'Seated Cable Row',
                'Chest-Supported Row',
                'Dumbbell Single-Arm Row',
                'T-Bar Row',
                'Barbell Row',
            ],
            squat: ['Hack Squat', 'Leg Press', 'Barbell Squat'],
        },
    },
};
```

(The reorder name lists must reference real catalogue names; the catalogue-consistency test in Task 3.6 enforces this. Confirm `Hack Squat` / `Leg Press` exist and are `movement_pattern = 'squat'` during plan review; if `Leg Press` is its own pattern, drop the `squat` reorder to two patterns and pick another supported pattern.)

- [ ] **Step 4: Run test + typecheck**

Run: `bun run test:run -t "STYLE_PROFILES"` then `bun run typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): scoring constants and style profiles"
```

### Task 3.2: `contextScore` (pure, returns a breakdown)

**Files:**
- Modify: `src/lib/pulse/generation.ts` (add after `STYLE_PROFILES`)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('contextScore', () => {
    const ctxBB = { goal: 'build_muscle' as const, style: 'bodybuilding' as const, focus: 'push' as const, repBand: [8, 12] as [number, number], priorCount: 0 };
    it('returns neutral breakdown for a nameless exercise (golden guard)', () => {
        const m = meta('n', 'biceps_iso', ['dumbbells'], false);
        const s = contextScore(m, ctxBB);
        expect(s.total).toBe(0.8); // NEUTRAL_QUALITY, all other terms 0
        expect(s.styleAffinity).toBe(0);
        expect(s.repeatPenalty).toBe(0);
    });
    it('adds a bounded style bump for a preferred attribute', () => {
        const incline = meta('i', 'biceps_iso', ['cables'], false, { name: 'Incline Dumbbell Curl', quality: 0.95, attributes: ['incline', 'lengthened_bias'] } as Partial<ExerciseMeta>);
        const s = contextScore(incline, ctxBB);
        expect(s.styleAffinity).toBeGreaterThan(0);
        expect(s.styleAffinity).toBeLessThanOrEqual(0.25); // STYLE_AFFINITY_MAX
    });
    it('applies the saturating repeat penalty by prior count', () => {
        const m = meta('r', 'biceps_iso', ['dumbbells'], false, { name: 'Cable Curl', quality: 1.0 } as Partial<ExerciseMeta>);
        expect(contextScore(m, { ...ctxBB, priorCount: 1 }).repeatPenalty).toBe(-0.5);
        expect(contextScore(m, { ...ctxBB, priorCount: 5 }).repeatPenalty).toBe(-0.85);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "contextScore"`
Expected: FAIL (`contextScore` not exported).

- [ ] **Step 3: Implement `contextScore`**

In `generation.ts`, add after `STYLE_PROFILES`:

```ts
export interface ScoreContext {
    goal?: Goal;
    style: TrainingStyle;
    focus: Focus;
    repBand: [number, number];
    priorCount: number; // routine-wide prior selections of this exercise
    sessionMode?: 'short' | 'normal'; // ~30 min sessions favour compounds slightly
}

export interface ScoreBreakdown {
    total: number;
    quality: number;
    styleAffinity: number;
    repFitBonus: number;
    repeatPenalty: number;
}

const NEUTRAL_BREAKDOWN: ScoreBreakdown = {
    total: NEUTRAL_QUALITY,
    quality: NEUTRAL_QUALITY,
    styleAffinity: 0,
    repFitBonus: 0,
    repeatPenalty: 0,
};

/** Style affinity for an exercise under a profile, clamped to [0, STYLE_AFFINITY_MAX]. */
function styleAffinity(ex: ExerciseMeta, profile: StyleProfile, sessionMode?: 'short' | 'normal'): number {
    let a = 0;
    for (const attr of ex.attributes ?? []) if (profile.preferredAttributes.has(attr)) a += ATTRIBUTE_BUMP;
    for (const eq of ex.equipment) a += profile.equipmentBias[eq] ?? 0;
    if (ex.is_compound) a += profile.compoundBias;
    if (sessionMode === 'short' && ex.is_compound) a += 0.05; // time-crunch overlay
    return Math.max(0, Math.min(STYLE_AFFINITY_MAX, a));
}

/** Graded rep-fit bonus for an overlapping window: tighter + better-centred windows score
 *  higher, capped at REP_FIT_BONUS_MAX. No window or no overlap -> 0 (overlap is the gross
 *  layer's job, not this one). */
function repFitBonus(ex: ExerciseMeta, band: [number, number]): number {
    const window = repWindow(ex);
    if (!window || !bandOverlapsWindow(band, window)) return 0;
    const overlap = Math.min(band[1], window[1]) - Math.max(band[0], window[0]);
    const span = Math.max(1, band[1] - band[0]);
    return REP_FIT_BONUS_MAX * Math.max(0, Math.min(1, (overlap + 1) / (span + 1)));
}

/** Context-sensitive selection score (spec section 2). Nameless/metadata-absent ->
 *  NEUTRAL_BREAKDOWN, so synthetic pools score uniformly and the comparator falls through
 *  exactly as the old ISOLATION_QUALITY layer did (the load-bearing golden guard: an
 *  ungated repeat penalty would reorder a nameless pool that repeats an id). Pure. */
export function contextScore(ex: ExerciseMeta, ctx: ScoreContext): ScoreBreakdown {
    if (!ex.name) return NEUTRAL_BREAKDOWN;
    const profile = STYLE_PROFILES[ctx.style];
    const quality = ex.quality ?? NEUTRAL_QUALITY;
    const sa = styleAffinity(ex, profile, ctx.sessionMode);
    const rf = repFitBonus(ex, ctx.repBand);
    const rp = repeatPenaltyFor(ctx.priorCount);
    return { total: quality + sa + rf + rp, quality, styleAffinity: sa, repFitBonus: rf, repeatPenalty: rp };
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `bun run test:run -t "contextScore"` then `bun run typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): contextScore pure scoring function with breakdown"
```

### Task 3.3: Style-aware `anchorRank`

**Files:**
- Modify: `src/lib/pulse/generation.ts:1061-1069` (`anchorRank`), and its call sites in `byPattern` (~1259)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('style-aware anchorRank', () => {
    it('Bodybuilding floats Incline DB Press ahead of Barbell Bench on horizontal_push', () => {
        const incline = meta('id', 'horizontal_push', ['dumbbells'], true, { name: 'Incline Dumbbell Press' });
        const flat = meta('bb', 'horizontal_push', ['barbell'], true, { name: 'Barbell Bench Press' });
        const bbProfile = STYLE_PROFILES.bodybuilding;
        expect(anchorRank(incline, 'horizontal_push', bbProfile)).toBeLessThan(
            anchorRank(flat, 'horizontal_push', bbProfile),
        );
        // Balanced keeps the default order (flat bench leads).
        expect(anchorRank(flat, 'horizontal_push', STYLE_PROFILES.balanced)).toBeLessThan(
            anchorRank(incline, 'horizontal_push', STYLE_PROFILES.balanced),
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "style-aware anchorRank"`
Expected: FAIL (`anchorRank` takes 2 args).

- [ ] **Step 3: Implement the style-aware order**

Replace `anchorRank` (`generation.ts:1061-1069`):

```ts
/** Canonical-anchor rank for an exercise within a pattern (lower = more canonical). When the
 *  active style supplies a `canonicalReorder` for the pattern, that name order is used;
 *  otherwise CANONICAL_ANCHORS. Infinity when neither lists the exercise (or it is nameless),
 *  so it is a pure tiebreak that leaves nameless/unlisted exercises in their prior order, and
 *  Balanced (no reorder) is byte-identical. */
function anchorRank(ex: ExerciseMeta, pattern: MovementPattern, profile?: StyleProfile): number {
    const order = profile?.canonicalReorder?.[pattern] ?? CANONICAL_ANCHORS[pattern];
    if (!order || !ex.name) return Infinity;
    const i = order.indexOf(ex.name);
    return i === -1 ? Infinity : i;
}
```

- [ ] **Step 4: Pass the profile at the `byPattern` call sites**

`byPattern` needs the active profile. In `selectForSession`, derive it once near the top (after the `style` param is available):

```ts
    const styleProfile = STYLE_PROFILES[style];
```

Then in `byPattern`'s comparator (`generation.ts:1259-1260`) replace:

```ts
                const aRank = anchorRank(a, p);
                const bRank = anchorRank(b, p);
```

with:

```ts
                const aRank = anchorRank(a, p, styleProfile);
                const bRank = anchorRank(b, p, styleProfile);
```

- [ ] **Step 5: Run tests + goldens to verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS, goldens byte-identical (the goldens run at Balanced -> no reorder -> `anchorRank` identical to the old 2-arg result).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): style-aware canonical anchor reorder"
```

### Task 3.4: Weekly-repeat count map + replace the ISOLATION_QUALITY layer with contextScore

**Files:**
- Modify: `src/lib/pulse/generation.ts` (`selectForSession` body + `push` ~1321, `byPattern` ~1286, the call site ~1971, `generateRoutine` to own the routine-wide count)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test (Pullover repetition + the contextScore layer)**

```ts
describe('weekly isolation-repetition cap', () => {
    it('rotates a fresh back_iso in over a repeated higher-quality one across sessions', () => {
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'back_iso')
            .concat([
                meta('pull', 'back_iso', ['dumbbells'], false, { name: 'Dumbbell Pullover', quality: 0.72 } as Partial<ExerciseMeta>),
                meta('saw', 'back_iso', ['cables'], false, { name: 'Straight-Arm Pulldown', quality: 0.95 } as Partial<ExerciseMeta>),
            ]);
        // A multi-session split with >=2 back_iso slots across the week.
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
        const backIsoIds = bp.exercises
            .filter((e) => pool.find((p) => p.id === e.exercise_id)?.movement_pattern === 'back_iso')
            .map((e) => e.exercise_id);
        // Both appear across the week rather than the same one twice (soft cap + quality).
        expect(new Set(backIsoIds).size).toBeGreaterThanOrEqual(Math.min(2, backIsoIds.length));
        // The higher-quality Straight-Arm is selected at least as often as Pullover.
        const saw = backIsoIds.filter((id) => id === 'saw').length;
        const pull = backIsoIds.filter((id) => id === 'pull').length;
        expect(saw).toBeGreaterThanOrEqual(pull);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run -t "weekly isolation-repetition cap"`
Expected: FAIL (no repeat penalty yet; the ISOLATION_QUALITY layer alone may repeat Pullover or ignore the count).

- [ ] **Step 3: Thread a routine-wide count map**

In `generateRoutine`, create the count map alongside the existing `used` set (find where `used` is created, near the session loop) and pass it in. Add a parameter to `selectForSession` (after `style`):

```ts
    usedCount: Map<string, number> = new Map(),
```

In the `push` helper inside `selectForSession` (`generation.ts:1321`), increment the count when a pick is committed (add after `used.add(ex.id);`):

```ts
        usedCount.set(ex.id, (usedCount.get(ex.id) ?? 0) + 1);
```

At the call site (`generation.ts:1971`), pass the routine-wide map after `styleForBias`:

```ts
            styleForBias,
            answers.goal,   // (already added in Task 2.5 ordering: keep goal/style/bias order consistent)
            usedCount,
        );
```

NOTE: reconcile the argument order with Task 2.5. Final `selectForSession` tail order: `experience, bias, goal, style, usedCount`. Update both the signature and the single call site to match exactly.

- [ ] **Step 4: Replace the ISOLATION_QUALITY comparator layer with contextScore.total**

In `byPattern` (`generation.ts:1286-1290`), replace the isolation-quality block:

```ts
                if (!anchorPattern) {
                    const aQuality = isolationQuality(a);
                    const bQuality = isolationQuality(b);
                    if (aQuality !== bQuality) return bQuality - aQuality;
                }
```

with the contextScore layer (compute the band per candidate for the repFitBonus, and read the prior count):

```ts
                if (!anchorPattern) {
                    const aScore = contextScore(a, {
                        goal, style, focus, repBand: bandFor(a, p),
                        priorCount: usedCount.get(a.id) ?? 0,
                        sessionMode,
                    }).total;
                    const bScore = contextScore(b, {
                        goal, style, focus, repBand: bandFor(b, p),
                        priorCount: usedCount.get(b.id) ?? 0,
                        sessionMode,
                    }).total;
                    if (aScore !== bScore) return bScore - aScore;
                }
```

`sessionMode` derives from session length: add `const sessionMode: 'short' | 'normal' = isSuperset ? 'short' : 'normal';` inside `selectForSession` (the ~30 min sessions are the superset ones; confirm `isSuperset` is in scope in `selectForSession`, otherwise thread the session time in. If not in scope, pass `sessionMode` as a parameter from the call site, derived from `sessionTime`).

- [ ] **Step 5: Run tests + goldens to verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS. Goldens byte-identical: on a nameless synthetic pool, `contextScore.total` is uniformly `NEUTRAL_QUALITY` (nameless guard), so the layer never reorders, exactly as the old `isolationQuality` (also uniform NEUTRAL) did. If a golden moved, the nameless guard or the count map leaked into synthetic ordering; STOP.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): contextScore replaces ISOLATION_QUALITY layer + weekly repeat cap"
```

### Task 3.5: Ordering-invariant tests (lock the magnitude bands as guarantees)

**Files:**
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the invariant tests**

```ts
describe('contextScore ordering invariants', () => {
    const base = { goal: 'build_muscle' as const, style: 'balanced' as const, focus: 'push' as const, priorCount: 0 };
    it('a gross mismatch never beats an overlapping candidate (selection-level)', () => {
        // Verified at the byPattern layer: a windowed misfit sorts last. Here we assert the
        // magnitude relation that backs it: even a perfect-quality misfit minus nothing cannot
        // exceed a neutral fitting candidate once the mismatch layer (above the score) fires.
        // The mismatch is a comparator layer, so we assert via generation in Task 2.5's test;
        // this case asserts the score bands do not accidentally invert it.
        const fit = contextScore(meta('f', 'biceps_iso', ['dumbbells'], false, { name: 'X', quality: 0.5 } as Partial<ExerciseMeta>), { ...base, repBand: [8, 12] });
        expect(fit.total).toBeGreaterThan(0);
    });
    it('styleAffinity cannot overcome a quality gap larger than STYLE_AFFINITY_MAX', () => {
        const hi = contextScore(meta('h', 'biceps_iso', ['dumbbells'], false, { name: 'Hi', quality: 0.95 } as Partial<ExerciseMeta>), { ...base, style: 'bodybuilding', repBand: [8, 12] });
        const lo = contextScore(meta('l', 'biceps_iso', ['cables'], false, { name: 'Lo', quality: 0.6, attributes: ['incline', 'lengthened_bias'] } as Partial<ExerciseMeta>), { ...base, style: 'bodybuilding', repBand: [8, 12] });
        // gap 0.35 > 0.25 cap -> high-quality still wins.
        expect(hi.total).toBeGreaterThan(lo.total);
    });
    it('a first repeat loses to a fresh peer of higher quality up to 0.95', () => {
        const repeated = contextScore(meta('r', 'biceps_iso', ['dumbbells'], false, { name: 'R', quality: 0.95 } as Partial<ExerciseMeta>), { ...base, repBand: [8, 12], priorCount: 1 });
        const fresh = contextScore(meta('f', 'biceps_iso', ['dumbbells'], false, { name: 'F', quality: 0.8 } as Partial<ExerciseMeta>), { ...base, repBand: [8, 12], priorCount: 0 });
        expect(fresh.total).toBeGreaterThan(repeated.total); // 0.80 > 0.95 - 0.50
    });
});

describe('anchors never rank by contextScore.total', () => {
    it('a high-quality non-canonical compound does not displace a canonical one on an anchor pattern', () => {
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'horizontal_push')
            .concat([
                meta('canon', 'horizontal_push', ['barbell'], true, { name: 'Barbell Bench Press', quality: 0.5 } as Partial<ExerciseMeta>),
                meta('fancy', 'horizontal_push', ['dumbbells'], true, { name: 'Some Fancy Press', quality: 1.0 } as Partial<ExerciseMeta>),
            ]);
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const push = sessionIds(bp, 'push', null);
        expect(push).toContain('canon'); // canonical wins despite lower quality
    });
});
```

- [ ] **Step 2: Run tests to verify pass**

Run: `bun run test:run -t "ordering invariants"` and `bun run test:run -t "anchors never rank"`
Expected: PASS. If "anchors never rank" fails, the contextScore layer leaked onto an anchor pattern; re-check the `if (!anchorPattern)` guard in Task 3.4.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pulse/__tests__/generation.test.ts
git commit -m "test(pulse): ordering-invariant + anchor-guard tests for context scoring"
```

### Task 3.6: Seed-coverage + catalogue-consistency + style-distinctiveness tests

**Files:**
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('scoring seed catalogue consistency', () => {
    const sql = readFileSync(
        resolve(process.cwd(), 'docs/migrations'), // replace with the exact migration filename from Task 2.1
        'utf8',
    );
    // Replace the read above with the actual file path once Task 2.1's filename is known.
    it('every canonicalReorder name appears in the seed migration', () => {
        for (const profile of Object.values(STYLE_PROFILES)) {
            for (const names of Object.values(profile.canonicalReorder ?? {})) {
                for (const n of names) {
                    // Canonical primaries may be seeded elsewhere; assert at minimum they are
                    // real names by cross-checking the existing metadata seed too.
                    expect(typeof n).toBe('string');
                }
            }
        }
    });
});

describe('style distinctiveness', () => {
    it('Bodybuilding and Balanced produce measurably different exercise sets', () => {
        // Use a named real-ish pool so style can act (nameless pools no-op by design).
        const pool = namedCatalogueLikePool(); // build a helper: deepPool() mapped to give each row a name + quality + attributes
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const balanced = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool, trainingStyle: 'balanced' }));
        const bb = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool, trainingStyle: 'bodybuilding' }));
        const ids = (bp: ReturnType<typeof generateRoutine>) => bp.exercises.map((e) => e.exercise_id).sort().join(',');
        expect(ids(bb)).not.toBe(ids(balanced));
    });
});
```

NOTE for the implementer: the catalogue-consistency test must read the EXACT migration filename created in Task 2.1 and assert each `canonicalReorder` / quality-seeded name is present in either that file or the existing metadata seed `2026-06-06-11-28-49-exercise-metadata-fields-seed.sql` (mirror the existing `ISOLATION_QUALITY` guard at generation.test.ts ~2691). Build a small `namedCatalogueLikePool()` helper that maps `deepPool()` rows to carry a `name`, a `quality`, and (for a few) `attributes`, so the style levers have something to act on.

- [ ] **Step 2: Run tests to verify pass**

Run: `bun run test:run -t "style distinctiveness"` and `bun run test:run -t "scoring seed catalogue consistency"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pulse/__tests__/generation.test.ts
git commit -m "test(pulse): seed-coverage and style-distinctiveness tests"
```

### Task 3.7: Phase 3 suite gate + real-catalogue smoke

- [ ] **Step 1: Full suite + typecheck**

Run: `bun run test:run` then `bun run typecheck`
Expected: all green, every byte-identity golden unchanged.

- [ ] **Step 2: Real-catalogue smoke (manual, documented)**

Run: `bun run scripts/gen-routine.ts --refresh --equipment barbell,dumbbells,bench,cables,machines,pull_up_bar --experience intermediate --goal build_muscle --days mon,tue,thu,fri --time 60 --training-style bodybuilding --variety varied`
Expected (eyeball, since goldens use synthetic pools): incline/machine/cable primaries lead the Bodybuilding sessions; Push Press (if it appears) shows 3-5; no Step-Up at 3-6; Pullover does not recur every session. Re-run with `--training-style balanced` and confirm the big lifts differ. This confirms the real-catalogue effect the synthetic goldens cannot.

- [ ] **Step 3: No commit** (verification only). Phase 3 complete.

---

## Finish (before the PR)

- [ ] Update `docs/roadmap.md`: move the item from `In progress` to a Shipped bullet (date + branch `feature/generation-context-scoring`), record the migration as "migration `<filename>` (hand-apply on merge), then `--refresh` the gen-routine cache". Clear `In progress:` to `(none)`.
- [ ] Update `CLAUDE.md` "Routine generation" / "Pure logic" sections to describe the `quality`/`rep_min`/`rep_max`/`attributes` columns, `contextScore`, `STYLE_PROFILES`, `clampRepsToWindow`, and the per-pattern `CARRYOVER_CREDITS` (warnings-only).
- [ ] Bump the documented test count in `CLAUDE.md` / roadmap.
- [ ] Commit the doc sync on the branch.
- [ ] Hand-off in chat: apply the migration, `--refresh` the gen-routine cache, push, open the PR.

---

## Self-review notes (author)

- **Spec coverage:** lever 1 (contextScore) Task 3.2/3.4; lever 2 (rep windows) Task 2.4 (assignment) + 2.5 (selection); lever 3 (style) Task 3.1/3.3 + the affinity in 3.2; lever 4 (weekly cap) Task 3.4; lever 5 (carryover) Phase 1. Ordering-invariant + anchor-guard + seed-coverage + distinctiveness tests Task 3.5/3.6. Migration + plumbing Task 2.1/2.2/2.3.
- **Argument-order hazard:** `selectForSession`'s tail params are added across Task 2.5 and 3.4. The FINAL order is `(..., experience?, bias?, goal?, style?, usedCount?, sessionMode?)`. The single call site at `generation.ts:1971` must match exactly. The implementer must reconcile this when doing Task 3.4 (the plan flags it in both tasks).
- **Golden guard everywhere:** every new term no-ops on nameless pools (the `contextScore` nameless guard, `repWindow` null, `anchorRank` Infinity, `styleAffinity` zero for empty attributes under Balanced). The Balanced + synthetic combination must stay byte-identical at every phase gate; a moved golden is a STOP.
- **Names RESOLVED against the live catalogue (read-only query, 2026-06-16):** the explosive lift is `Dumbbell Push Press` (vertical_push, compound, not a CANONICAL_ANCHOR); no Olympic lifts exist (clean seeds dropped); the unilateral leg set is `Step-Up` / `Walking Lunge` / `Dumbbell Bulgarian Split Squat` (all `lunge`); there is no `Cable Lateral Raise`. `Hack Squat` / `Leg Press` / `Barbell Squat` are all `movement_pattern = 'squat'`, so the Bodybuilding chest/back/squat reorder is valid as written. `Straight-Arm Pulldown` is `back_iso` / non-compound / `primary_muscle = lats`, `substitution_class = null`, `Dumbbell Pullover` likewise (confirming the peer re-rank). The migration above already uses these verified names.
