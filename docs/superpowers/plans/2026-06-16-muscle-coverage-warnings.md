# Muscle-coverage warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a warn-only per-muscle weekly-volume observability layer to the Pulse generator: a structured per-exercise muscle field, a pure direct-set tally vs validated targets, a `gen-routine.ts` diagnostic readout, and one `muscle_coverage_low` warning, without changing any generation output.

**Architecture:** A new 13-value `Muscle` taxonomy (separate from the 10 reporting `ExerciseCategory` buckets). A new `exercises.primary_muscle` column (+ a fine `secondary_muscle_groups[]`) seeded by SQL CASE from `substitution_class` / `movement_pattern`. A pure `src/lib/pulse/muscleVolume.ts` tallies weekly DIRECT sets per muscle (effective sets computed too, diagnostic-only) and flags muscles below their target band. The flag surfaces in the dev diagnostic and as one validator warning key. The generator is untouched, so all goldens stay byte-identical.

**Tech Stack:** TypeScript (strict), Vitest, Supabase (hand-applied SQL migration), Bun.

**Spec:** `docs/superpowers/specs/2026-06-16-09-21-12-muscle-coverage-warnings-design.md`. Read it first; this plan implements it exactly.

---

## Key design decisions baked into this plan (from the spec + review loop)

- **Warn on DIRECT sets only** (primary muscle). `effective` (direct + 0.5/secondary) is computed but diagnostic-only, never used by the gap logic.
- **Warning-targeted muscles are the 9 in the validated table.** `front_delts` / `calves` / `core` are in the taxonomy + diagnostic but NEVER warning-targeted (informational-only).
- **`back` is an aggregate target** (`lats + upper_back`) owned by the tally; a unit test locks the roll-up. Documented as a temporary v1 simplification.
- **No-data guard:** if no exercise in the blueprint has a stored `primary_muscle` (synthetic test pools), `muscleCoverageGaps` returns `[]`. This is what keeps the existing P2.3 validator golden test clean and is also correct (cannot warn about coverage you cannot measure).
- **The user-facing warning is a single static key with generic, hedged copy.** The `warnings` column stores static keys rendered via the static `WARNING_COPY` map, so it cannot list dynamic muscles. The dynamic, severity-sorted per-muscle detail lives in the `gen-routine.ts` diagnostic (the spec's primary evidence surface). Parameterizing the persisted warning to name specific muscles is a deliberate v1 deferral (flagged in the handoff).
- **`deriveSeedPrimaryMuscle` is the seed derivation mirror** (used by the seed-consistency test and as a diagnostic fallback for un-seeded rows). It is NOT used by the warning tally (the tally reads the stored column only), so synthetic pools stay unattributed and goldens stay clean.

---

## File structure

- **Create** `src/lib/pulse/muscleVolume.ts`: pure: `MUSCLE_SET_TARGETS`, `SECONDARY_SET_CREDIT`, `weeklyMuscleSets`, `targetDirectSets`, `muscleCoverageGaps`, `deriveSeedPrimaryMuscle`.
- **Create** `src/lib/pulse/__tests__/muscleVolume.test.ts`: unit tests for the above.
- **Create** `docs/migrations/<timestamp>-exercise-primary-muscle.sql`: add columns + CASE seed + CHECK.
- **Modify** `src/lib/pulse/types.ts`: add `MUSCLES` const + `Muscle` type (next to `EXERCISE_CATEGORIES`).
- **Modify** `src/lib/pulse/generation.ts`: add `primary_muscle?` + `secondary_muscle_groups?` to `ExerciseMeta`.
- **Modify** `src/app/pulse/actions/routines.ts`: thread the two new fields through `ExercisePoolRow`, the select, and the pool `.map`.
- **Modify** `src/lib/pulse/programValidation.ts`: emit `muscle_coverage_low` via `muscleCoverageGaps`.
- **Modify** `src/lib/pulse/constants.ts`: add `WARNING_COPY['muscle_coverage_low']`.
- **Modify** `src/lib/pulse/__tests__/programValidation.test.ts`: warning fires / quiet / no-data tests.
- **Modify** `scripts/gen-routine.ts`: per-muscle diagnostic readout.

---

## Task 1: Muscle taxonomy + weekly tally

**Files:**
- Modify: `src/lib/pulse/types.ts` (add `MUSCLES` + `Muscle` near `EXERCISE_CATEGORIES`, around line 278)
- Modify: `src/lib/pulse/generation.ts` (add two optional fields to `ExerciseMeta`, around line 780)
- Create: `src/lib/pulse/muscleVolume.ts`
- Create/Test: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Add the taxonomy to `types.ts`**

Add near `EXERCISE_CATEGORIES` / `ExerciseCategory` (the file already uses the `(typeof X)[number]` pattern):

```typescript
// Programming muscles (Tier-2 muscle-coverage warnings). A SEPARATE, finer concept
// from the 10 ExerciseCategory reporting buckets: it splits shoulders into front/side/
// rear delts and legs into quads/hamstrings (glutes/calves already separate) so the
// generator can be evaluated for per-muscle direct work. Programming coverage, not
// biomechanical truth (see muscleVolume.ts).
export const MUSCLES = [
    'chest',
    'lats',
    'upper_back',
    'front_delts',
    'side_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];
```

- [ ] **Step 2: Add the two optional fields to `ExerciseMeta` (`generation.ts`)**

Inside `export interface ExerciseMeta { ... }`, after the `difficulty?` field, add:

```typescript
    /** Programming muscle this exercise directly trains (Tier-2 muscle-coverage
     *  warnings). Optional: synthetic test pools omit it, so the tally treats them as
     *  unattributed and the warning never fires on them (golden-stable). Real catalogue
     *  exercises carry it (seeded by the primary-muscle migration). */
    primary_muscle?: Muscle;
    /** Fine secondary muscles (same Muscle taxonomy), feeding the diagnostic-only
     *  effective-set estimate. Optional / may be empty. */
    secondary_muscle_groups?: Muscle[];
```

Add `Muscle` to the existing `import type { ... } from './types'` near the top of `generation.ts` (the file already imports `MovementPattern`, `RestrictionFlag`, etc. from `./types`).

- [ ] **Step 3: Write the failing test for `weeklyMuscleSets`**

Create `src/lib/pulse/__tests__/muscleVolume.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { weeklyMuscleSets } from '@/lib/pulse/muscleVolume';
import type { ExerciseMeta, RoutineBlueprint } from '@/lib/pulse/generation';
import type { Muscle } from '@/lib/pulse/types';

// Minimal ExerciseMeta with a programming muscle.
function ex(id: string, primary: Muscle, secondaries: Muscle[] = []): ExerciseMeta {
    return {
        id,
        movement_pattern: 'horizontal_push',
        equipment: ['dumbbells'],
        is_compound: true,
        category: 'chest',
        substitution_class: null,
        unilateral: false,
        contraindications: [],
        primary_muscle: primary,
        secondary_muscle_groups: secondaries,
    };
}

function bp(rows: Array<{ id: string; sets: number }>): RoutineBlueprint {
    return {
        schedule: [],
        warnings: [],
        exercises: rows.map((r, i) => ({
            exercise_id: r.id,
            workout_type: 'full_body' as RoutineBlueprint['exercises'][number]['workout_type'],
            variant: null,
            order: i,
            sets: String(r.sets),
            reps: '8-12',
            superset_group_id: null,
        })),
    };
}

describe('weeklyMuscleSets', () => {
    it('credits direct sets to the primary muscle and 0.5 per set to each secondary', () => {
        const pool = [ex('bench', 'chest', ['front_delts', 'triceps'])];
        const result = weeklyMuscleSets(bp([{ id: 'bench', sets: 4 }]), pool);
        expect(result.chest).toEqual({ direct: 4, effective: 4 });
        expect(result.front_delts).toEqual({ direct: 0, effective: 2 });
        expect(result.triceps).toEqual({ direct: 0, effective: 2 });
    });

    it('sums sets for a muscle across multiple exercises', () => {
        const pool = [ex('bench', 'chest'), ex('fly', 'chest')];
        const result = weeklyMuscleSets(bp([{ id: 'bench', sets: 4 }, { id: 'fly', sets: 3 }]), pool);
        expect(result.chest.direct).toBe(7);
    });

    it('ignores exercises with no primary_muscle (unattributed synthetic rows)', () => {
        const nameless: ExerciseMeta = { ...ex('x', 'chest'), primary_muscle: undefined };
        const result = weeklyMuscleSets(bp([{ id: 'x', sets: 4 }]), [nameless]);
        expect(result.chest.direct).toBe(0);
    });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: FAIL, `weeklyMuscleSets` is not exported (module not found / undefined).

- [ ] **Step 5: Implement `weeklyMuscleSets` in `muscleVolume.ts`**

Create `src/lib/pulse/muscleVolume.ts`:

```typescript
import { MUSCLES } from './types';
import type { Muscle } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';

// Muscle-coverage observability (Tier-2 Spec 1). PROGRAMMING COVERAGE, NOT BIOMECHANICAL
// TRUTH: the per-exercise muscle attribution is a coaching heuristic, and the warning is
// a generator-quality signal, not a verdict on a routine. Warn on DIRECT sets (primary
// muscle); `effective` adds a 0.5-per-secondary estimate that is diagnostic-only and
// non-normative (a labelled heuristic, never used to decide a warning). See the spec.

/** Diagnostic-only secondary-set credit. A heuristic, NOT a validated conversion; kept
 *  as a single constant so it can be tuned later without touching the data model. */
export const SECONDARY_SET_CREDIT = 0.5;

export interface MuscleSetCount {
    direct: number;
    effective: number;
}

/** Weekly per-muscle set volume for a finished routine. `direct` = sets whose exercise's
 *  primary_muscle is this muscle; `effective` = direct + SECONDARY_SET_CREDIT per set for
 *  each secondary muscle. Exercises without a stored primary_muscle contribute nothing
 *  (so synthetic / unattributed pools yield an all-zero tally). Deterministic. */
export function weeklyMuscleSets(
    blueprint: RoutineBlueprint,
    pool: ExerciseMeta[],
): Record<Muscle, MuscleSetCount> {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const out = {} as Record<Muscle, MuscleSetCount>;
    for (const m of MUSCLES) out[m] = { direct: 0, effective: 0 };

    for (const row of blueprint.exercises) {
        const meta = metaById.get(row.exercise_id);
        const primary = meta?.primary_muscle;
        if (!primary) continue;
        const sets = Number(row.sets);
        if (!Number.isFinite(sets) || sets <= 0) continue;
        out[primary].direct += sets;
        out[primary].effective += sets;
        for (const sec of meta?.secondary_muscle_groups ?? []) {
            out[sec].effective += sets * SECONDARY_SET_CREDIT;
        }
    }
    return out;
}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/types.ts src/lib/pulse/generation.ts src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): muscle taxonomy + weekly per-muscle set tally"
```

---

## Task 2: Targets, back roll-up, and coverage gaps

**Files:**
- Modify: `src/lib/pulse/muscleVolume.ts`
- Modify: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Write the failing tests for targets + gaps**

Append to `src/lib/pulse/__tests__/muscleVolume.test.ts`:

```typescript
import { muscleCoverageGaps, targetDirectSets, MUSCLE_SET_TARGETS } from '@/lib/pulse/muscleVolume';

describe('muscleCoverageGaps', () => {
    // Pool: one direct exercise per muscle so we can dial each muscle's weekly sets.
    const poolFor = (muscles: Muscle[]) => muscles.map((m, i) => ex(`${m}-${i}`, m));

    it('flags a muscle below its band minimum, with a severity ratio', () => {
        const pool = poolFor(['side_delts']);
        // 3 sets of side delts, target min 8 -> gap, ratio 3/8.
        const gaps = muscleCoverageGaps(bp([{ id: 'side_delts-0', sets: 3 }]), pool);
        const sd = gaps.find((g) => g.target === 'side_delts');
        expect(sd).toBeDefined();
        expect(sd!.direct).toBe(3);
        expect(sd!.min).toBe(8);
        expect(sd!.ratio).toBeCloseTo(3 / 8);
    });

    it('does NOT flag a muscle at or above its minimum', () => {
        const pool = poolFor(['biceps']);
        const gaps = muscleCoverageGaps(bp([{ id: 'biceps-0', sets: 8 }]), pool);
        expect(gaps.some((g) => g.target === 'biceps')).toBe(false);
    });

    it('aggregates lats + upper_back into the back target (roll-up)', () => {
        const pool = poolFor(['lats', 'upper_back']);
        // lats 4 + upper_back 9 = 13 >= back min 12 -> back NOT flagged.
        const gaps = muscleCoverageGaps(
            bp([{ id: 'lats-0', sets: 4 }, { id: 'upper_back-1', sets: 9 }]),
            pool,
        );
        expect(gaps.some((g) => g.target === 'back')).toBe(false);
        // targetDirectSets owns the roll-up.
        expect(targetDirectSets({ lats: 4, upper_back: 9 } as Record<Muscle, number>, 'back')).toBe(13);
    });

    it('sorts gaps worst-first by ratio', () => {
        const pool = poolFor(['biceps', 'side_delts']);
        // biceps 6/8 = 0.75, side_delts 2/8 = 0.25 -> side_delts first.
        const gaps = muscleCoverageGaps(
            bp([{ id: 'biceps-0', sets: 6 }, { id: 'side_delts-1', sets: 2 }]),
            pool,
        );
        expect(gaps.map((g) => g.target)).toEqual(['side_delts', 'biceps']);
    });

    it('never flags informational-only muscles (front_delts / calves / core)', () => {
        expect(MUSCLE_SET_TARGETS).not.toHaveProperty('front_delts');
        expect(MUSCLE_SET_TARGETS).not.toHaveProperty('calves');
        expect(MUSCLE_SET_TARGETS).not.toHaveProperty('core');
        const pool = poolFor(['front_delts']);
        const gaps = muscleCoverageGaps(bp([{ id: 'front_delts-0', sets: 0.0001 }]), pool);
        expect(gaps.some((g) => g.target === 'front_delts')).toBe(false);
    });

    it('NO-DATA GUARD: returns [] when no exercise has a primary_muscle', () => {
        const unattributed: ExerciseMeta = { ...ex('x', 'chest'), primary_muscle: undefined };
        const gaps = muscleCoverageGaps(bp([{ id: 'x', sets: 1 }]), [unattributed]);
        expect(gaps).toEqual([]);
    });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: FAIL, `muscleCoverageGaps` / `targetDirectSets` / `MUSCLE_SET_TARGETS` not exported.

- [ ] **Step 3: Implement targets + roll-up + gaps in `muscleVolume.ts`**

Append to `src/lib/pulse/muscleVolume.ts`:

```typescript
/** A warning-target key: a Muscle, or the aggregate 'back' (= lats + upper_back). The
 *  9 keys here are exactly the muscles in the validated science table; front_delts /
 *  calves / core are deliberately absent (informational-only). */
export type MuscleTarget =
    | 'chest'
    | 'back'
    | 'side_delts'
    | 'rear_delts'
    | 'biceps'
    | 'triceps'
    | 'quads'
    | 'hamstrings'
    | 'glutes';

/** Weekly direct-set bands (intermediate hypertrophy), the validated target table. */
export const MUSCLE_SET_TARGETS: Record<MuscleTarget, { min: number; max: number }> = {
    chest: { min: 10, max: 16 },
    back: { min: 12, max: 18 },
    side_delts: { min: 8, max: 14 },
    rear_delts: { min: 6, max: 12 },
    biceps: { min: 8, max: 12 },
    triceps: { min: 8, max: 12 },
    quads: { min: 10, max: 16 },
    hamstrings: { min: 8, max: 14 },
    glutes: { min: 8, max: 14 },
};

/** Direct sets attributed to a target. Owns the back roll-up (lats + upper_back) so the
 *  taxonomy and the target definitions cannot drift apart. NOTE: the back aggregate is a
 *  v1 simplification (a lats-2 / upper_back-15 program passes back-17 while being
 *  one-dimensional); the lats-vs-upper-back split is what the Spec 2 variety scoring
 *  addresses. Documented, not a silent gap. */
export function targetDirectSets(direct: Record<Muscle, number>, target: MuscleTarget): number {
    if (target === 'back') return (direct.lats ?? 0) + (direct.upper_back ?? 0);
    return direct[target as Muscle] ?? 0;
}

export interface MuscleGap {
    target: MuscleTarget;
    direct: number;
    min: number;
    ratio: number; // direct / min; lower = more severe
}

/** Targeted muscles whose weekly DIRECT sets fall below the band minimum, worst-first by
 *  ratio. Under-dose only. NO-DATA GUARD: if no exercise carries a primary_muscle the
 *  routine is unattributed (synthetic pool) and we cannot assess coverage, so return []
 *  (this keeps the P2.3 validator goldens clean). */
export function muscleCoverageGaps(blueprint: RoutineBlueprint, pool: ExerciseMeta[]): MuscleGap[] {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const hasAttribution = blueprint.exercises.some((r) => metaById.get(r.exercise_id)?.primary_muscle);
    if (!hasAttribution) return [];

    const counts = weeklyMuscleSets(blueprint, pool);
    const direct = {} as Record<Muscle, number>;
    for (const m of MUSCLES) direct[m] = counts[m].direct;

    const gaps: MuscleGap[] = [];
    for (const target of Object.keys(MUSCLE_SET_TARGETS) as MuscleTarget[]) {
        const { min } = MUSCLE_SET_TARGETS[target];
        const d = targetDirectSets(direct, target);
        if (d < min) gaps.push({ target, direct: d, min, ratio: d / min });
    }
    gaps.sort((a, b) => a.ratio - b.ratio || a.target.localeCompare(b.target));
    return gaps;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): per-muscle targets, back roll-up, coverage gaps"
```

---

## Task 3: Seed-derivation helper + consistency test

**Files:**
- Modify: `src/lib/pulse/muscleVolume.ts`
- Modify: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Write the failing test for `deriveSeedPrimaryMuscle`**

Append to `src/lib/pulse/__tests__/muscleVolume.test.ts`:

```typescript
import { deriveSeedPrimaryMuscle } from '@/lib/pulse/muscleVolume';
import { MUSCLES } from '@/lib/pulse/types';
import type { MovementPattern } from '@/lib/pulse/types';

describe('deriveSeedPrimaryMuscle (seed mirror)', () => {
    const ALL_PATTERNS: MovementPattern[] = [
        'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge',
        'lunge', 'calf', 'core', 'chest_iso', 'back_iso', 'shoulder_iso', 'biceps_iso',
        'triceps_iso', 'glute_iso', 'quad_iso', 'hamstring_iso',
    ];
    const valid = new Set<string>(MUSCLES);

    it('returns a valid Muscle for every movement pattern (total coverage)', () => {
        for (const p of ALL_PATTERNS) {
            expect(valid.has(deriveSeedPrimaryMuscle(p, null, 'X'))).toBe(true);
        }
    });

    it('resolves delt heads from substitution_class', () => {
        expect(deriveSeedPrimaryMuscle('shoulder_iso', 'lateral_raise', 'Lateral Raise')).toBe('side_delts');
        expect(deriveSeedPrimaryMuscle('shoulder_iso', 'rear_delt_isolation', 'Rear Delt Fly')).toBe('rear_delts');
        expect(deriveSeedPrimaryMuscle('shoulder_iso', 'front_delt_isolation', 'Front Raise')).toBe('front_delts');
        expect(deriveSeedPrimaryMuscle('vertical_push', 'vertical_press', 'Arnold Press')).toBe('front_delts');
    });

    it('disambiguates glute vs hamstring on the hinge family', () => {
        expect(deriveSeedPrimaryMuscle('hinge', 'glute_pattern', 'Hip Thrust')).toBe('glutes');
        expect(deriveSeedPrimaryMuscle('hinge', 'hinge_pattern', 'Romanian Deadlift')).toBe('hamstrings');
    });

    it('the lat-biased back_iso override resolves Dumbbell Pullover to lats', () => {
        expect(deriveSeedPrimaryMuscle('back_iso', null, 'Dumbbell Pullover')).toBe('lats');
        expect(deriveSeedPrimaryMuscle('back_iso', null, 'Dumbbell Shrug')).toBe('upper_back');
    });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts -t "deriveSeedPrimaryMuscle"`
Expected: FAIL, `deriveSeedPrimaryMuscle` not exported.

- [ ] **Step 3: Implement `deriveSeedPrimaryMuscle` in `muscleVolume.ts`**

Add the import for `MovementPattern` to the top of `muscleVolume.ts` (extend the existing `import type { Muscle } from './types'`):

```typescript
import type { Muscle, MovementPattern } from './types';
```

Append:

```typescript
/** The seed derivation for primary_muscle, mirrored from the migration's SQL CASE.
 *  Production reads the STORED exercises.primary_muscle column (so manual corrections
 *  stick); this helper is used only by (a) the seed-consistency test and (b) the
 *  gen-routine.ts diagnostic as a fallback for un-seeded rows. It is an INITIAL SEED
 *  HEURISTIC, not biomechanical truth (the back lats/upper_back split especially), and
 *  individual exercises are revised manually over time. Total over every MovementPattern. */
export function deriveSeedPrimaryMuscle(
    pattern: MovementPattern | null,
    substitutionClass: string | null,
    name: string,
): Muscle {
    // Explicit overrides for fuzzy back_iso lifts (the rest of back_iso -> upper_back).
    if (name === 'Dumbbell Pullover') return 'lats';

    // Delt heads come from substitution_class (patterns cannot resolve front/side/rear).
    if (substitutionClass === 'lateral_raise') return 'side_delts';
    if (substitutionClass === 'rear_delt_isolation') return 'rear_delts';
    if (substitutionClass === 'front_delt_isolation' || substitutionClass === 'vertical_press') return 'front_delts';
    // Glute-dominant hinges (Hip Thrust, Glute Bridge) before the hinge -> hamstrings rule.
    if (substitutionClass === 'glute_pattern' || pattern === 'glute_iso') return 'glutes';

    switch (pattern) {
        case 'squat':
        case 'lunge':
        case 'quad_iso':
            return 'quads';
        case 'hinge':
        case 'hamstring_iso':
            return 'hamstrings';
        case 'vertical_pull':
            return 'lats';
        case 'horizontal_pull':
        case 'back_iso':
            return 'upper_back';
        case 'horizontal_push':
        case 'chest_iso':
            return 'chest';
        case 'vertical_push':
            return 'front_delts';
        case 'shoulder_iso':
            return 'side_delts';
        case 'biceps_iso':
            return 'biceps';
        case 'triceps_iso':
            return 'triceps';
        case 'calf':
            return 'calves';
        case 'core':
        case null:
            return 'core';
    }
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts`
Expected: PASS (all muscleVolume tests).

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): primary-muscle seed derivation + consistency test"
```

---

## Task 4: Migration (columns + CASE seed + CHECK)

**Files:**
- Create: `docs/migrations/<timestamp>-exercise-primary-muscle.sql`

This migration is hand-applied (repo convention). The CASE mirrors `deriveSeedPrimaryMuscle` exactly. It was verified against all 94 catalogue exercises (zero unmapped) during planning.

- [ ] **Step 1: Get a timestamp for the filename**

Run: `date +%Y-%m-%d-%H-%M-%S`
Use it as the filename prefix: `docs/migrations/<timestamp>-exercise-primary-muscle.sql`.

- [ ] **Step 2: Write the migration**

```sql
-- Tier-2 muscle-coverage warnings: per-exercise programming-muscle attribution.
-- Adds a STORED primary_muscle (+ a fine secondary_muscle_groups) at the 13-muscle
-- programming taxonomy, SEPARATE from the coarse category / secondary_muscles (10
-- reporting buckets), which are left intact. The seed CASE is an INITIAL HEURISTIC
-- (mirrors deriveSeedPrimaryMuscle in muscleVolume.ts), not biomechanical truth;
-- rows are revised manually over time. For programming analysis, not anatomy truth.

alter table exercises add column if not exists primary_muscle text;
alter table exercises add column if not exists secondary_muscle_groups text[] not null default '{}';

-- Seed primary_muscle for the seeded catalogue (user_id is null). Order matters:
-- delt heads + glute-dominant hinges are resolved before the pattern fallbacks.
update exercises set primary_muscle = case
    when name = 'Dumbbell Pullover' then 'lats'
    when substitution_class = 'lateral_raise' then 'side_delts'
    when substitution_class = 'rear_delt_isolation' then 'rear_delts'
    when substitution_class in ('front_delt_isolation', 'vertical_press') then 'front_delts'
    when substitution_class = 'glute_pattern' or movement_pattern = 'glute_iso' then 'glutes'
    when movement_pattern in ('squat', 'lunge', 'quad_iso') then 'quads'
    when movement_pattern in ('hinge', 'hamstring_iso') then 'hamstrings'
    when movement_pattern = 'vertical_pull' then 'lats'
    when movement_pattern in ('horizontal_pull', 'back_iso') then 'upper_back'
    when movement_pattern in ('horizontal_push', 'chest_iso') then 'chest'
    when movement_pattern = 'vertical_push' then 'front_delts'
    when movement_pattern = 'shoulder_iso' then 'side_delts'
    when movement_pattern = 'biceps_iso' then 'biceps'
    when movement_pattern = 'triceps_iso' then 'triceps'
    when movement_pattern = 'calf' then 'calves'
    when movement_pattern = 'core' then 'core'
    else 'core'
end
where user_id is null;

-- Coarse secondary seed for compounds only (feeds the diagnostic-only effective metric;
-- non-normative). Isolations keep the '{}' default. Tunable later.
update exercises set secondary_muscle_groups = case
    when movement_pattern = 'horizontal_push' then array['front_delts', 'triceps']
    when movement_pattern = 'vertical_push' then array['triceps']
    when movement_pattern = 'horizontal_pull' then array['biceps', 'rear_delts']
    when movement_pattern = 'vertical_pull' then array['biceps']
    when substitution_class = 'glute_pattern' then array['hamstrings']
    when movement_pattern in ('squat', 'lunge') then array['glutes']
    when movement_pattern = 'hinge' then array['glutes']
    else secondary_muscle_groups
end::text[]
where user_id is null;

-- Guard: primary_muscle (when set) must be one of the 13 programming muscles.
alter table exercises drop constraint if exists exercises_primary_muscle_check;
alter table exercises add constraint exercises_primary_muscle_check check (
    primary_muscle is null or primary_muscle in (
        'chest','lats','upper_back','front_delts','side_delts','rear_delts',
        'biceps','triceps','quads','hamstrings','glutes','calves','core'
    )
);
```

- [ ] **Step 3: Commit (migration is hand-applied on merge, not by this plan)**

```bash
git add docs/migrations/
git commit -m "feat(pulse): migration for per-exercise primary_muscle + secondaries"
```

Note for the human merge routine: apply this migration against Supabase, then refresh the diagnostic cache with `bun run scripts/gen-routine.ts --refresh ...` so the readout reflects the seeded data.

---

## Task 5: Thread the new fields through the generation pool

**Files:**
- Modify: `src/app/pulse/actions/routines.ts` (`ExercisePoolRow` ~line 395, the select ~line 465, the `.map` ~line 498)

No unit test (server actions hit Supabase and have no test harness in this repo); verified by typecheck. The fields flow `DB select -> ExercisePoolRow -> ExerciseMeta`, so the validator (Task 6) sees them.

- [ ] **Step 1: Add the two fields to `ExercisePoolRow`**

In `interface ExercisePoolRow`, after `difficulty: ExerciseMeta['difficulty'] | null;` add:

```typescript
    primary_muscle: ExerciseMeta['primary_muscle'] | null;
    secondary_muscle_groups: Muscle[] | null;
```

Add `Muscle` to the existing `import type { ... } from '@/lib/pulse/types'` in this file (it already imports `EquipmentKey`, `RestrictionFlag`, etc.).

- [ ] **Step 2: Add the columns to the pool select**

Change the select string (currently ending `... contraindications, difficulty`) to:

```typescript
        .select(
            'id, name, category, equipment, movement_pattern, is_compound, fatigue, substitution_class, unilateral, contraindications, difficulty, primary_muscle, secondary_muscle_groups',
        )
```

- [ ] **Step 3: Map the fields onto `ExerciseMeta`**

In the `.map((row) => ({ ... }))` that builds `pool`, after the `difficulty` spread line add:

```typescript
            ...(row.primary_muscle ? { primary_muscle: row.primary_muscle } : {}),
            secondary_muscle_groups: row.secondary_muscle_groups ?? [],
```

- [ ] **Step 4: Typecheck and commit**

```bash
bun run typecheck
git add src/app/pulse/actions/routines.ts
git commit -m "feat(pulse): thread primary_muscle + secondaries into the generation pool"
```

---

## Task 6: The `muscle_coverage_low` validator warning

**Files:**
- Modify: `src/lib/pulse/programValidation.ts`
- Modify: `src/lib/pulse/constants.ts`
- Modify: `src/lib/pulse/__tests__/programValidation.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/pulse/__tests__/programValidation.test.ts`, the existing `POOL` (one `meta` per pattern, `id === pattern`) has NO `primary_muscle`, so the no-data guard keeps the muscle warning silent there. The `blueprint(rows)` helper sets each exercise's `exercise_id` to `row.pattern`, so an attributed pool whose ids equal the pattern names lines up with it. Append inside the `describe('validateProgram (P2.3)', ...)` block:

```typescript
    // ── Muscle-coverage warning (Tier-2 Spec 1) ───────────────────────────────
    it('flags muscle_coverage_low when a targeted muscle is under-dosed', () => {
        // ids == patterns so the blueprint helper (exercise_id = pattern) matches.
        const musclePool: ExerciseMeta[] = [
            { ...meta('shoulder_iso', 'shoulder_iso'), primary_muscle: 'side_delts' },
            { ...meta('horizontal_push', 'horizontal_push'), primary_muscle: 'chest' },
        ];
        // side_delts 3 sets < min 8 (gap); chest 12 sets >= min 10 (ok).
        const bp = blueprint([
            { pattern: 'shoulder_iso', sets: 3 },
            { pattern: 'horizontal_push', sets: 12 },
        ]);
        expect(validateProgram(bp, musclePool)).toContain('muscle_coverage_low');
    });

    it('does NOT flag muscle_coverage_low on an unattributed (synthetic) pool', () => {
        // The standard POOL has no primary_muscle -> no-data guard -> silent.
        const bp = blueprint([{ pattern: 'horizontal_push' }, { pattern: 'horizontal_pull' }]);
        expect(validateProgram(bp, POOL)).not.toContain('muscle_coverage_low');
    });
```

- [ ] **Step 2: Run and watch the first test fail**

Run: `bun run test:run src/lib/pulse/__tests__/programValidation.test.ts -t "muscle_coverage_low"`
Expected: FAIL, `muscle_coverage_low` is not emitted yet (the first test fails; the second already passes by absence).

- [ ] **Step 3: Wire `muscleCoverageGaps` into `validateProgram`**

In `src/lib/pulse/programValidation.ts`, add the import at the top:

```typescript
import { muscleCoverageGaps } from './muscleVolume';
```

Add a constant near the other warning-key constants (`PUSH_PULL_IMBALANCE` etc.):

```typescript
const MUSCLE_COVERAGE_LOW = 'muscle_coverage_low';
```

Add a check inside `validateProgram` (after the existing CHECK 1 push/pull block; it is additive and independent). The push/pull check stays exactly as-is:

```typescript
    // CHECK 1b: per-muscle direct-set coverage (Tier-2 Spec 1). Warn-only, additive,
    // independent of the push/pull check above. Reads each exercise's stored
    // primary_muscle via the pool; the no-data guard inside muscleCoverageGaps keeps
    // this silent for unattributed (synthetic) pools, so it does not change the goldens.
    if (muscleCoverageGaps(blueprint, pool).length > 0) {
        warnings.push(MUSCLE_COVERAGE_LOW);
    }
```

- [ ] **Step 4: Add the warning copy**

In `src/lib/pulse/constants.ts`, add to the `WARNING_COPY` object (generic, hedged copy; the dynamic per-muscle detail lives in the diagnostic, see the plan header):

```typescript
    muscle_coverage_low: {
        title: 'Some muscles may be under-dosed',
        body: 'A few muscles look like they are getting less direct work this week than is ideal for growth. That can be fine for a focused block; if a muscle matters to you, add a direct set or two for it. These targets are guidelines, not hard rules.',
    },
```

- [ ] **Step 5: Run the new tests and the full validator file**

Run: `bun run test:run src/lib/pulse/__tests__/programValidation.test.ts`
Expected: PASS (all, including the P2.3 goldens which use the unattributed `POOL` / `deepPool` and stay clean via the no-data guard).

- [ ] **Step 6: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/programValidation.ts src/lib/pulse/constants.ts src/lib/pulse/__tests__/programValidation.test.ts
git commit -m "feat(pulse): muscle_coverage_low warning (warn-only, no-data-guarded)"
```

---

## Task 7: Diagnostic readout in `gen-routine.ts`

**Files:**
- Modify: `scripts/gen-routine.ts`

Verified by running the script (no unit test for the dev tool). Uses `deriveSeedPrimaryMuscle` as a fallback so the readout works even against a pre-migration cache.

- [ ] **Step 1: Import the muscle helpers**

Add to the imports at the top of `scripts/gen-routine.ts`:

```typescript
import { weeklyMuscleSets, muscleCoverageGaps, deriveSeedPrimaryMuscle, MUSCLE_SET_TARGETS } from '@/lib/pulse/muscleVolume';
import { MUSCLES } from '@/lib/pulse/types';
```

- [ ] **Step 2: Backfill primary_muscle on the pool (diagnostic fallback)**

The cached pool may predate the migration. After `pool` is built (around line 117, before `generateRoutine`), backfill any missing `primary_muscle` so the readout works regardless:

```typescript
for (const e of pool) {
    if (!e.primary_muscle) e.primary_muscle = deriveSeedPrimaryMuscle(e.movement_pattern, e.substitution_class, e.name ?? '');
}
```

(Add `primary_muscle` + `secondary_muscle_groups` to the script's pool `.map` if you also want secondaries; for the direct-set readout, primary_muscle is enough.)

- [ ] **Step 3: Print the per-muscle readout after the warnings line**

After the existing `console.log(\`\n=== warnings: ...\`)` at the end of the script, add:

```typescript
const counts = weeklyMuscleSets(blueprint, pool);
const fmt = (m: (typeof MUSCLES)[number]) => {
    const d = counts[m].direct;
    const t = (MUSCLE_SET_TARGETS as Record<string, { min: number; max: number }>)[m];
    return t ? `${m} ${d}/${t.min} (${Math.round((d / t.min) * 100)}%)` : `${m} ${d}`;
};
console.log('\n=== weekly muscle volume (direct sets · target) ===');
console.log('  ' + MUSCLES.map(fmt).join(' · '));
const gaps = muscleCoverageGaps(blueprint, pool);
console.log(
    `=== potential gaps (worst first): ${
        gaps.length ? gaps.map((g) => `${g.target} ${Math.round(g.ratio * 100)}%`).join(', ') : '(none)'
    } ===`,
);
```

- [ ] **Step 4: Run the diagnostic and eyeball it**

Run: `bun run scripts/gen-routine.ts --equipment dumbbells,barbell,bench,cables,machines,pull_up_bar --days 6 --time 60 --goal build_muscle`
Expected: prints the routine, then a `weekly muscle volume` line and a `potential gaps` line (e.g. side_delts / rear_delts likely flagged on a minimalist config). Confirm the numbers look plausible.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-routine.ts
git commit -m "chore(pulse): per-muscle volume readout in the generation diagnostic"
```

---

## Task 8: Full verification + docs sync

**Files:**
- Modify: `docs/roadmap.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`

- [ ] **Step 1: Full suite + typecheck (golden stability)**

Run: `bun run test:run` then `bun run typecheck`
Expected: all tests pass (prior count + the new muscleVolume + programValidation tests). The generation goldens MUST be unchanged (this feature touches no selection logic). If any golden churned, stop and investigate; that is a bug, not a rebaseline.

- [ ] **Step 2: Em-dash sweep on every file touched**

Run: `grep -rn "—" src/lib/pulse/muscleVolume.ts src/lib/pulse/programValidation.ts src/lib/pulse/constants.ts scripts/gen-routine.ts docs/migrations/*primary-muscle.sql`
Expected: no output (the placeholder cell exception does not apply here). Fix any hit.

- [ ] **Step 3: Roadmap + CLAUDE.md + parent-plan sync**

- `docs/roadmap.md`: add a Shipped bullet for Tier-2 Spec 1 (date + branch, NOT a PR number), noting the warn-only muscle-coverage layer, the new `primary_muscle` data + migration (hand-apply on merge), and that variety scoring (Spec 2) + gap-fill (Spec 3) remain.
- `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`: under "Remaining work", mark the Tier-2 (a) muscle-based warnings sub-part shipped and point to this plan + the spec.
- `CLAUDE.md`: in the "Pure logic" / lib-modules area, add `muscleVolume.ts` (the new `Muscle` taxonomy, `weeklyMuscleSets` / `muscleCoverageGaps`, warn-only, direct-set metric) and note the new `exercises.primary_muscle` column + that `programValidation` now emits `muscle_coverage_low`.

- [ ] **Step 4: Commit the docs sync**

```bash
git add docs/roadmap.md CLAUDE.md docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md
git commit -m "docs(roadmap): ship Tier-2 spec 1 muscle-coverage warnings"
```

---

## Self-review notes (for the implementer)

- **Golden stability is the safety net.** This feature adds a column, a pure module, one validator warning, and a diagnostic. It changes NO selection logic. If a generation golden moves, something is wrong.
- **The no-data guard is load-bearing.** It is the single reason the existing P2.3 validator goldens (which run on the unattributed `deepPool`) stay clean. Do not remove it; do not give synthetic test pools a `primary_muscle` unless a test specifically wants the warning.
- **The migration CASE and `deriveSeedPrimaryMuscle` must stay in lockstep.** If you change one, change the other; the consistency test guards pattern coverage but not value-by-value equality.
- **Do not run `bun run format` repo-wide.** Format only the files you touched, and `git add` only the listed paths.
