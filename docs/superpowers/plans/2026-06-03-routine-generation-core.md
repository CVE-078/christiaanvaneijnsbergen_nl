# Routine Generation Core Implementation Plan (1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, deterministic `generateRoutine` engine plus the per-exercise metadata it needs, so a balanced, equipment-aware routine can be generated from the onboarding answers. Replaces the blunt `applyVolume` volume model.

**Architecture:** A pure function in `src/lib/pulse/generation.ts` (no I/O, no React, no Supabase) takes the onboarding answers + session length + chosen days + a pool of metadata-tagged exercises and returns a `RoutineBlueprint`. New nullable columns on `exercises` carry the metadata, seeded heuristically by a migration. Spec 2 wires this to a server action and UI.

**Tech Stack:** TypeScript (strict), Vitest. bun. SQL migrations applied by hand in Supabase.

**Conventions:** 4-space indent, no em dashes in code/comments. Local git identity is already `christiaanvaneijnsbergen@gmail.com`; commit with `git -c commit.gpgsign=false commit`. Do not run git push. Determinism: NO `Math.random` / `Date.now` in the engine (vitest config and good practice); all rotation is index-based.

**Real onboarding types (from `src/lib/pulse/recommendation.ts`, do not invent):**
`ExperienceLevel = 'beginner'|'intermediate'|'advanced'`, `DaysPerWeek = '2-3'|'4'|'5-6'`, `Goal = 'build_muscle'|'lose_fat'|'general_fitness'`, `OnboardingAnswers = { equipment: Set<EquipmentKey>; experience; goal; days }`. Session length is currently a loose string `'~30 min'|'45–60 min'|'90+ min'`.

---

## Task 1: Types + metadata migration

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Create: `docs/migrations/2026-06-03-exercise-generation-metadata.sql`

- [ ] **Step 1: Extend types**

In `types.ts`, add `'bodyweight'` to `EQUIPMENT_KEYS`, and add generation types + extend `DbExercise`:

```ts
export const EQUIPMENT_KEYS = ['dumbbells', 'barbell', 'bench', 'cables', 'machines', 'bodyweight'] as const;

export const MOVEMENT_PATTERNS = [
    'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
    'squat', 'hinge', 'lunge', 'calf', 'core',
    'chest_iso', 'back_iso', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'glute_iso',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export type SessionTime = '~30 min' | '45–60 min' | '90+ min';
```

Extend `DbExercise` with the metadata (nullable/defaulted so user exercises are fine):

```ts
export interface DbExercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_sets: string;
    default_reps: string;
    user_id: string | null;
    equipment?: EquipmentKey[];
    movement_pattern?: MovementPattern | null;
    is_compound?: boolean;
}
```

- [ ] **Step 2: Create the metadata migration (columns only; seed is Task 4)**

`docs/migrations/2026-06-03-exercise-generation-metadata.sql`:

```sql
-- Generation metadata for routine generation. Apply BEFORE the seed file.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_compound boolean NOT NULL DEFAULT false;
```

- [ ] **Step 3: Verify + commit**

Run: `bun run typecheck` (expect: clean; optional fields are backward compatible).

```bash
git add src/lib/pulse/types.ts docs/migrations/2026-06-03-exercise-generation-metadata.sql
git -c commit.gpgsign=false commit -m "feat(generation): metadata columns + generation types"
```

---

## Task 2: Volume + split tables (TDD)

**Files:**
- Create: `src/lib/pulse/generation.ts`
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write failing tests for the split + volume helpers**

```ts
import { describe, it, expect } from 'vitest';
import { selectSplit, volumeFor, repRangeFor } from '@/lib/pulse/generation';

describe('selectSplit', () => {
    it('beginner or 2-3 days -> all full_body', () => {
        expect(selectSplit('beginner', '2-3', 3)).toEqual(['full_body', 'full_body', 'full_body']);
        expect(selectSplit('advanced', '2-3', 2)).toEqual(['full_body', 'full_body']);
    });
    it('4 days (non-beginner) -> upper/lower alternating', () => {
        expect(selectSplit('intermediate', '4', 4)).toEqual(['upper', 'lower', 'upper', 'lower']);
    });
    it('5-6 days (non-beginner) -> push/pull/legs cycle', () => {
        expect(selectSplit('advanced', '5-6', 6)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs']);
    });
});

describe('volumeFor', () => {
    it('30 min never drops below the floor of 3 exercises / 2 sets', () => {
        const v = volumeFor('~30 min', 'beginner');
        expect(v.exercises).toBeGreaterThanOrEqual(3);
        expect(v.sets).toBeGreaterThanOrEqual(2);
    });
    it('90+ min gives more than 30 min', () => {
        expect(volumeFor('90+ min', 'intermediate').exercises).toBeGreaterThan(volumeFor('~30 min', 'intermediate').exercises);
    });
});

describe('repRangeFor', () => {
    it('maps goal to a rep range', () => {
        expect(repRangeFor('build_muscle')).toBe('8-12');
        expect(repRangeFor('lose_fat')).toBe('12-15');
        expect(repRangeFor('general_fitness')).toBe('10-12');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: FAIL (module/exports missing).

- [ ] **Step 3: Implement the tables + helpers**

```ts
import type { EquipmentKey, ExerciseCategory, MovementPattern, SessionTime, WorkoutType, WorkoutVariant } from './types';
import type { ExperienceLevel, DaysPerWeek, Goal, OnboardingAnswers } from './recommendation';

export type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export function selectSplit(experience: ExperienceLevel, days: DaysPerWeek, sessionCount: number): Focus[] {
    let pattern: Focus[];
    if (experience === 'beginner' || days === '2-3') pattern = ['full_body'];
    else if (days === '4') pattern = ['upper', 'lower'];
    else pattern = ['push', 'pull', 'legs'];
    return Array.from({ length: sessionCount }, (_, i) => pattern[i % pattern.length]);
}

const VOLUME: Record<SessionTime, Record<ExperienceLevel, { exercises: number; sets: number }>> = {
    '~30 min': { beginner: { exercises: 3, sets: 2 }, intermediate: { exercises: 4, sets: 3 }, advanced: { exercises: 4, sets: 3 } },
    '45–60 min': { beginner: { exercises: 5, sets: 3 }, intermediate: { exercises: 6, sets: 3 }, advanced: { exercises: 6, sets: 4 } },
    '90+ min': { beginner: { exercises: 7, sets: 3 }, intermediate: { exercises: 8, sets: 4 }, advanced: { exercises: 8, sets: 4 } },
};

export function volumeFor(sessionTime: SessionTime, experience: ExperienceLevel): { exercises: number; sets: number } {
    const v = VOLUME[sessionTime][experience];
    return { exercises: Math.max(3, v.exercises), sets: Math.max(2, v.sets) };
}

export function repRangeFor(goal: Goal): string {
    if (goal === 'build_muscle') return '8-12';
    if (goal === 'lose_fat') return '12-15';
    return '10-12';
}
```

- [ ] **Step 4: Run to verify it passes** (`bun run test:run src/lib/pulse/__tests__/generation.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git -c commit.gpgsign=false commit -m "feat(generation): split + volume + rep-range tables"
```

---

## Task 3: `generateRoutine` engine (TDD)

**Files:**
- Modify: `src/lib/pulse/generation.ts`
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Add the focus->slots map and selection logic**

Append to `generation.ts`:

```ts
// Ordered slots per focus: compounds first, then isolation accessories.
const FOCUS_SLOTS: Record<Focus, MovementPattern[]> = {
    full_body: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'vertical_push', 'vertical_pull', 'core'],
    upper: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'chest_iso', 'back_iso', 'shoulder_iso', 'biceps_iso', 'triceps_iso'],
    lower: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    push: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso'],
    pull: ['horizontal_pull', 'vertical_pull', 'back_iso', 'biceps_iso'],
    legs: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
};

const FOCUS_TYPE: Record<Focus, WorkoutType> = {
    full_body: 'full_body', upper: 'upper', lower: 'lower', push: 'push', pull: 'pull', legs: 'legs',
};

export interface ExerciseMeta {
    id: string;
    equipment: EquipmentKey[];
    movement_pattern: MovementPattern | null;
    is_compound: boolean;
    category: ExerciseCategory;
}

function hasEquipment(ex: ExerciseMeta, have: Set<EquipmentKey>): boolean {
    // bodyweight always available; otherwise every listed equipment must be owned.
    if (ex.equipment.length === 0) return true;
    return ex.equipment.every((e) => e === 'bodyweight' || have.has(e));
}

// Pick exercises for one session. `rotation` offsets candidate choice so repeated
// focuses (e.g. full body on multiple days) select different exercises.
function selectForSession(
    focus: Focus,
    count: number,
    pool: ExerciseMeta[],
    have: Set<EquipmentKey>,
    rotation: number,
): string[] {
    const usable = pool.filter((ex) => hasEquipment(ex, have));
    const byPattern = (p: MovementPattern) =>
        usable.filter((ex) => ex.movement_pattern === p).sort((a, b) => a.id.localeCompare(b.id));
    const chosen: string[] = [];
    const slots = FOCUS_SLOTS[focus];
    // First pass: one exercise per slot in order, rotated.
    for (const slot of slots) {
        if (chosen.length >= count) break;
        const candidates = byPattern(slot).filter((ex) => !chosen.includes(ex.id));
        if (candidates.length > 0) chosen.push(candidates[rotation % candidates.length].id);
    }
    // Backfill: keep filling from the slot list (allowing a second exercise per slot)
    // until we hit count or run out of usable exercises for this focus.
    let guard = 0;
    while (chosen.length < count && guard < 50) {
        guard++;
        let added = false;
        for (const slot of slots) {
            if (chosen.length >= count) break;
            const candidates = byPattern(slot).filter((ex) => !chosen.includes(ex.id));
            if (candidates.length > 0) {
                chosen.push(candidates[0].id);
                added = true;
            }
        }
        if (!added) break; // pool exhausted for this focus
    }
    return chosen;
}
```

- [ ] **Step 2: Write failing tests for `generateRoutine`**

```ts
import { generateRoutine } from '@/lib/pulse/generation';
import type { ExerciseMeta } from '@/lib/pulse/generation';

function meta(id: string, pattern: string, equipment: string[] = ['dumbbells'], compound = true): ExerciseMeta {
    return { id, movement_pattern: pattern as never, equipment: equipment as never, is_compound: compound, category: 'chest' as never };
}

// A pool wide enough to fill full-body sessions several ways.
const POOL: ExerciseMeta[] = [
    meta('sq1', 'squat'), meta('sq2', 'squat'), meta('sq3', 'squat'),
    meta('hp1', 'horizontal_push'), meta('hp2', 'horizontal_push'), meta('hp3', 'horizontal_push'),
    meta('hl1', 'horizontal_pull'), meta('hl2', 'horizontal_pull'), meta('hl3', 'horizontal_pull'),
    meta('hi1', 'hinge'), meta('hi2', 'hinge'),
    meta('vp1', 'vertical_push'), meta('vl1', 'vertical_pull'), meta('co1', 'core'),
    meta('bar1', 'squat', ['barbell']), // requires barbell
];

const baseInput = {
    answers: { equipment: new Set(['dumbbells'] as const), experience: 'intermediate', goal: 'build_muscle', days: '2-3' } as never,
    sessionTime: '~30 min' as const,
    trainingDays: [1, 3, 5],
    pool: POOL,
};

describe('generateRoutine', () => {
    it('30-min full body has at least 3 exercises per day and is never empty (the reported bug)', () => {
        const bp = generateRoutine(baseInput);
        for (const day of [1, 3, 5]) {
            const dayEx = bp.exercises.filter((e) => bp.schedule.find((s) => s.day_of_week === day && s.workout_type === e.workout_type && s.variant === e.variant));
            // simpler: count per (workout_type, variant) session
        }
        // 3 sessions, each >= 3 exercises
        expect(bp.schedule).toHaveLength(3);
        const perSession = bp.schedule.map((s) => bp.exercises.filter((e) => e.workout_type === s.workout_type && e.variant === s.variant).length);
        for (const n of perSession) expect(n).toBeGreaterThanOrEqual(3);
    });

    it('repeated full-body days are not identical (variation)', () => {
        const bp = generateRoutine(baseInput);
        // group exercise ids by (workout_type, variant)
        const sessions = bp.schedule.map((s) =>
            bp.exercises.filter((e) => e.workout_type === s.workout_type && e.variant === s.variant).map((e) => e.exercise_id).sort().join(','),
        );
        const distinct = new Set(sessions);
        expect(distinct.size).toBeGreaterThan(1);
    });

    it('respects equipment: dumbbells-only never selects the barbell-only exercise', () => {
        const bp = generateRoutine(baseInput);
        expect(bp.exercises.some((e) => e.exercise_id === 'bar1')).toBe(false);
    });

    it('no duplicate exercise within a single session', () => {
        const bp = generateRoutine(baseInput);
        for (const s of bp.schedule) {
            const ids = bp.exercises.filter((e) => e.workout_type === s.workout_type && e.variant === s.variant).map((e) => e.exercise_id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it('schedules onto the chosen training days with the goal rep range', () => {
        const bp = generateRoutine(baseInput);
        expect(bp.schedule.map((s) => s.day_of_week)).toEqual([1, 3, 5]);
        expect(bp.exercises.every((e) => e.reps === '8-12')).toBe(true);
    });
});
```

- [ ] **Step 3: Run to verify it fails** (`generateRoutine` not defined).

- [ ] **Step 4: Implement `generateRoutine`**

Append to `generation.ts`:

```ts
export interface GenerationInput {
    answers: OnboardingAnswers;
    sessionTime: SessionTime;
    trainingDays: number[];
    pool: ExerciseMeta[];
}

export interface RoutineBlueprint {
    schedule: Array<{ day_of_week: number; workout_type: WorkoutType; variant: WorkoutVariant | null }>;
    exercises: Array<{
        exercise_id: string;
        workout_type: WorkoutType;
        variant: WorkoutVariant | null;
        order: number;
        sets: string;
        reps: string;
    }>;
}

export function generateRoutine(input: GenerationInput): RoutineBlueprint {
    const { answers, sessionTime, trainingDays, pool } = input;
    const days = [...trainingDays].sort((a, b) => a - b);
    const focuses = selectSplit(answers.experience, answers.days, days.length);
    const { exercises: exCount, sets } = volumeFor(sessionTime, answers.experience);
    const reps = repRangeFor(answers.goal);
    const setsStr = String(sets);

    // Variant per focus occurrence: 1st occurrence of a focus -> A, 2nd -> B, cycling.
    // A focus that occurs only once across the whole week gets variant null.
    const focusTotal: Record<string, number> = {};
    for (const f of focuses) focusTotal[f] = (focusTotal[f] ?? 0) + 1;
    const focusSeen: Record<string, number> = {};

    const schedule: RoutineBlueprint['schedule'] = [];
    const exercises: RoutineBlueprint['exercises'] = [];

    focuses.forEach((focus, i) => {
        const occ = focusSeen[focus] ?? 0;
        focusSeen[focus] = occ + 1;
        const workout_type = FOCUS_TYPE[focus];
        const variant: WorkoutVariant | null = focusTotal[focus] > 1 ? (occ % 2 === 0 ? 'A' : 'B') : null;
        schedule.push({ day_of_week: days[i], workout_type, variant });

        const ids = selectForSession(focus, exCount, pool, answers.equipment, occ);
        ids.forEach((exercise_id, order) => {
            exercises.push({ exercise_id, workout_type, variant, order, sets: setsStr, reps });
        });
    });

    return { schedule, exercises };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS. (Note: with `2-3` days and A/B variants, 3 full-body days map to variants A, B, A; rotation `occ` still differs day 1 vs day 2, satisfying the variation test. Day 3 reuses A's exercise set, which is the documented 2-distinct-versions cap.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git -c commit.gpgsign=false commit -m "feat(generation): generateRoutine engine with selection and variation"
```

---

## Task 4: Metadata seed migration

**Files:**
- Create: `docs/migrations/2026-06-03-exercise-generation-metadata-seed.sql`

- [ ] **Step 1: Author the heuristic seed + overrides**

Create the seed. It derives equipment from name and a coarse pattern/compound from category + name keywords, then applies explicit overrides. Read the global exercise names first (`docs/migrations/2026-05-26-exercise-library-schema.sql` and `2026-05-30-rename-db-to-dumbbell.sql`) so the override `WHERE name = '…'` clauses match real names. Structure:

```sql
-- Generation metadata seed. Apply AFTER 2026-06-03-exercise-generation-metadata.sql.
-- Idempotent: pure UPDATEs scoped to global exercises (user_id IS NULL).

-- Equipment from name prefix.
UPDATE exercises SET equipment = ARRAY['dumbbells'] WHERE user_id IS NULL AND name ILIKE 'Dumbbell %';
UPDATE exercises SET equipment = ARRAY['barbell','bench'] WHERE user_id IS NULL AND name ILIKE 'Barbell %';
UPDATE exercises SET equipment = ARRAY['cables'] WHERE user_id IS NULL AND name ILIKE 'Cable %';
UPDATE exercises SET equipment = ARRAY['machines'] WHERE user_id IS NULL AND (name ILIKE 'Machine %' OR name ILIKE 'Lever %' OR name ILIKE 'Smith %');
UPDATE exercises SET equipment = ARRAY['bodyweight'] WHERE user_id IS NULL AND equipment = '{}';

-- Coarse movement_pattern + is_compound by category, then keyword overrides.
UPDATE exercises SET movement_pattern = 'chest_iso', is_compound = false WHERE user_id IS NULL AND category = 'chest';
UPDATE exercises SET movement_pattern = 'back_iso', is_compound = false WHERE user_id IS NULL AND category = 'back';
UPDATE exercises SET movement_pattern = 'shoulder_iso', is_compound = false WHERE user_id IS NULL AND category = 'shoulders';
UPDATE exercises SET movement_pattern = 'biceps_iso', is_compound = false WHERE user_id IS NULL AND category = 'biceps';
UPDATE exercises SET movement_pattern = 'triceps_iso', is_compound = false WHERE user_id IS NULL AND category = 'triceps';
UPDATE exercises SET movement_pattern = 'squat', is_compound = true WHERE user_id IS NULL AND category = 'legs';
UPDATE exercises SET movement_pattern = 'glute_iso', is_compound = false WHERE user_id IS NULL AND category = 'glutes';
UPDATE exercises SET movement_pattern = 'calf', is_compound = false WHERE user_id IS NULL AND category = 'calves';
UPDATE exercises SET movement_pattern = 'core', is_compound = false WHERE user_id IS NULL AND category = 'abs';

-- Keyword overrides for compound patterns (examples; extend to cover the library).
UPDATE exercises SET movement_pattern = 'horizontal_push', is_compound = true WHERE user_id IS NULL AND name ILIKE '%Bench Press%';
UPDATE exercises SET movement_pattern = 'vertical_push', is_compound = true WHERE user_id IS NULL AND (name ILIKE '%Shoulder Press%' OR name ILIKE '%Overhead Press%');
UPDATE exercises SET movement_pattern = 'horizontal_pull', is_compound = true WHERE user_id IS NULL AND name ILIKE '%Row%';
UPDATE exercises SET movement_pattern = 'vertical_pull', is_compound = true WHERE user_id IS NULL AND (name ILIKE '%Pulldown%' OR name ILIKE '%Pull-Up%' OR name ILIKE '%Pull Up%' OR name ILIKE '%Chin%');
UPDATE exercises SET movement_pattern = 'hinge', is_compound = true WHERE user_id IS NULL AND (name ILIKE '%Deadlift%' OR name ILIKE '%Romanian%' OR name ILIKE '%Hip Thrust%' OR name ILIKE '%Good Morning%');
UPDATE exercises SET movement_pattern = 'lunge', is_compound = true WHERE user_id IS NULL AND (name ILIKE '%Lunge%' OR name ILIKE '%Split Squat%' OR name ILIKE '%Step-Up%');
UPDATE exercises SET movement_pattern = 'squat', is_compound = true WHERE user_id IS NULL AND name ILIKE '%Squat%' AND name NOT ILIKE '%Split Squat%';
```

After writing it, the implementer reads the actual global exercise list and adds/corrects `WHERE name = '…'` override rows so every global exercise has a sensible `movement_pattern`, `is_compound`, and `equipment`. Verify with a query in the file's trailing comment:
`-- select name, equipment, movement_pattern, is_compound from exercises where user_id is null and movement_pattern is null;` should return zero rows after seeding.

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-06-03-exercise-generation-metadata-seed.sql
git -c commit.gpgsign=false commit -m "feat(generation): heuristic metadata seed for global exercises"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full suite**

Run: `bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests pass (existing + the new generation tests), lint clean (the 2 pre-existing exhaustive-deps warnings are acceptable).

- [ ] **Step 2: Format**

Run: `bun run format`, then re-run `bun run typecheck && bun run test:run`.

---

## Self-review

- **Spec coverage:** metadata model + columns (T1), types incl. SessionTime/MovementPattern (T1), volume model with floors (T2), split mapping (T2), rep range by goal (T2), engine with selection + equipment filtering + variation + no-dupes (T3), heuristic seed + overrides (T4), tests for every spec'd behavior incl. the 30-min floor bug (T2/T3), verify (T5). All spec sections mapped.
- **Out of scope confirmed:** no server action, UI, onboarding wiring, template audit, or `applyVolume` removal here (Spec 2). Engine is pure.
- **Type consistency:** `Focus`, `ExerciseMeta`, `GenerationInput`, `RoutineBlueprint`, `selectSplit`, `volumeFor`, `repRangeFor`, `generateRoutine` are used identically across tasks. Real onboarding types (`OnboardingAnswers`, `DaysPerWeek`, `Goal`, `ExperienceLevel`) imported from `recommendation.ts`, not redefined.
- **Determinism:** selection sorts candidates by id and rotates by index; no randomness, so tests are stable.
- **Known limitation (documented):** a focus repeated 3+ times reuses A/B variants cyclically, so it yields at most 2 distinct sessions per focus. Extending beyond A/B is a later concern, noted for Spec 2.
