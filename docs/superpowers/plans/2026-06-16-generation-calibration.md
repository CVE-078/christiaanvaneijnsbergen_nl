# Generation calibration pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate the generator from the review loop: load-limited rep floors, frequency-scaled accessory gap-fill floors, chest as a conditional gap-fill target, session-balanced gap-fill with a contribution cap, and two catalogue re-tags. No new architecture.

**Architecture:** Five bounded changes across `generation.ts` (a new pure `floorRepRangeForLoad` wired at the rep-assignment site), `gapFill.ts` (frequency-scaled floor function, chest target, balanced Phase 2 with a per-exercise contribution cap), `muscleVolume.ts` (`deriveSeedPrimaryMuscle` aligned to the re-tags), and a hand-applied migration. All changes stay gated on muscle attribution / dumbbell predicates so synthetic goldens are byte-identical.

**Tech Stack:** TypeScript (strict), Vitest, Bun. One hand-apply SQL migration.

**Spec:** `docs/superpowers/specs/2026-06-16-12-43-23-generation-calibration-design.md`. Read it first; this plan implements it.

---

## Resolved spec inconsistency (read before Task 4)

Spec Change D names a `GAP_FILL_PER_EXERCISE_SETS = 4` absolute cap AND a contribution cap whose own example reaches 6 (3 base + 3 gap-fill). Those conflict. This plan implements ONLY the **contribution cap** (gap-fill-added sets to any one exercise <= that exercise's base sets, so a 3-base isolation reaches at most 6), which satisfies both reviewer goals (no exercise becomes mostly gap-fill; distributions like 3+3 / 4+4 are allowed). The absolute `=4` is dropped. The existing `GAP_FILL_SET_CEILING = 20` (weekly per muscle) stays.

## File structure

- **Modify** `src/lib/pulse/generation.ts`: add `floorRepRangeForLoad` (pure) + wire it at the `resolveRepRange` call site.
- **Modify** `src/lib/pulse/gapFill.ts`: add `chest` to the targets; replace the flat `MUSCLE_COVERAGE_FLOOR` with a frequency-scaled `coverageFloor(muscle, dayCount)`; restructure Phase 2 to balance across sessions with the contribution cap.
- **Modify** `src/lib/pulse/muscleVolume.ts`: align `deriveSeedPrimaryMuscle` to the Dips re-tag.
- **Create** `docs/migrations/<timestamp>-exercise-dips-straightarm-reclassify.sql`.
- **Modify** the test files alongside each.

---

## Task 1: Load-limited rep floors (Change A)

**Files:**
- Modify: `src/lib/pulse/generation.ts` (add `floorRepRangeForLoad`; wire at the `reps = resolveRepRange(...)` site, ~line 2046)
- Test: `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `generation.test.ts` (import `floorRepRangeForLoad` from `@/lib/pulse/generation`). NOTE the `name` field on every test exercise: `floorRepRangeForLoad` no-ops on nameless exercises (synthetic-golden safety, mirroring `ISOLATION_QUALITY`), so the unit tests MUST pass named exercises to exercise the real path.

```typescript
describe('floorRepRangeForLoad (Change A: load-limited dumbbell compounds)', () => {
    const ex = (pattern: MovementPattern, equipment: EquipmentKey[], compound: boolean): ExerciseMeta => ({
        id: 'x', name: 'Dumbbell Test Lift', movement_pattern: pattern, equipment, is_compound: compound,
        category: 'legs' as ExerciseCategory, substitution_class: null, unilateral: false, contraindications: [],
    });
    it('floors a dumbbell-only lower compound below 10 reps to 10-15', () => {
        expect(floorRepRangeForLoad('6-8', ex('squat', ['dumbbells'], true))).toBe('10-15');
        expect(floorRepRangeForLoad('3-6', ex('hinge', ['dumbbells'], true))).toBe('10-15');
        expect(floorRepRangeForLoad('6-8', ex('lunge', ['dumbbells'], true))).toBe('10-15');
    });
    it('leaves it alone when already at/above 10 reps', () => {
        expect(floorRepRangeForLoad('10-15', ex('squat', ['dumbbells'], true))).toBe('10-15');
        expect(floorRepRangeForLoad('12-15', ex('squat', ['dumbbells'], true))).toBe('12-15');
    });
    it('does NOT touch barbell/machine/cable lower compounds', () => {
        expect(floorRepRangeForLoad('6-8', ex('squat', ['barbell'], true))).toBe('6-8');
        expect(floorRepRangeForLoad('6-8', ex('squat', ['dumbbells', 'machines'], true))).toBe('6-8');
    });
    it('does NOT touch isolations or upper-body dumbbell compounds (narrowed predicate)', () => {
        expect(floorRepRangeForLoad('6-8', ex('biceps_iso', ['dumbbells'], false))).toBe('6-8');
        expect(floorRepRangeForLoad('8-10', ex('shoulder_iso', ['dumbbells'], false))).toBe('8-10');
        expect(floorRepRangeForLoad('6-8', ex('horizontal_push', ['dumbbells'], true))).toBe('6-8');
    });
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts -t "floorRepRangeForLoad"`
Expected: FAIL, `floorRepRangeForLoad` not exported.

- [ ] **Step 3: Implement `floorRepRangeForLoad` in `generation.ts`**

Add near `resolveRepRange` (it is exported for the test):

```typescript
const LOAD_LIMITED_LOWER_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'lunge']);

/** Raise the rep range of a load-limited lift to 10-15. A "load-limited" lift is a
 *  dumbbell-only LOWER-BODY COMPOUND (goblet squat, dumbbell RDL, dumbbell split squat):
 *  it cannot be loaded heavily enough for low reps to be a strong stimulus. Narrowed to
 *  lower compounds only (Change A): isolations and upper-body dumbbell presses/rows are
 *  left to their assigned ranges (and to the future context-scoring layer).
 *
 *  No-ops on a NAMELESS exercise (synthetic test pools have no `name`), so the
 *  generation goldens stay byte-identical, exactly like ISOLATION_QUALITY /
 *  CANONICAL_ANCHORS. Real catalogue exercises all carry a name, so the floor applies
 *  there. Pure. */
export function floorRepRangeForLoad(reps: string, ex: ExerciseMeta): string {
    if (!ex.name) return reps;
    const dumbbellOnly =
        ex.equipment.includes('dumbbells') &&
        !ex.equipment.includes('barbell') &&
        !ex.equipment.includes('machines') &&
        !ex.equipment.includes('cables');
    if (!dumbbellOnly || !ex.is_compound || ex.movement_pattern === null) return reps;
    if (!LOAD_LIMITED_LOWER_PATTERNS.has(ex.movement_pattern)) return reps;
    const low = Number(reps.split('-')[0]);
    if (!Number.isFinite(low) || low >= 10) return reps;
    return '10-15';
}
```

- [ ] **Step 4: Wire it at the rep-assignment site**

In the `ordered.forEach(({ item, groupId }, order) => { ... })` loop, the line currently reads:

```typescript
            const reps = resolveRepRange(
                effectiveBias,
                pattern,
                ex.is_compound,
                answers.goal,
                styleForBias,
                answers.experience,
                session.focus,
            );
```

Wrap the result:

```typescript
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

- [ ] **Step 5: Run tests + full suite**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts` then `bun run test:run`
Expected: the new tests pass; ALL generation goldens unchanged. The `if (!ex.name) return reps` guard makes `floorRepRangeForLoad` a no-op on the synthetic `deepPool` (its exercises are nameless), so no golden's dumbbell lower compound moves. If a golden DOES churn, the guard is wrong or a synthetic fixture sprouted a name; fix the guard, do not rebaseline.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): rep floor for load-limited dumbbell lower compounds"
```

---

## Task 2: Catalogue re-tags + derivation alignment (Change E)

**Files:**
- Create: `docs/migrations/<timestamp>-exercise-dips-straightarm-reclassify.sql`
- Modify: `src/lib/pulse/muscleVolume.ts` (`deriveSeedPrimaryMuscle`)
- Test: `src/lib/pulse/__tests__/muscleVolume.test.ts`

- [ ] **Step 1: Write the migration**

Run `date +%Y-%m-%d-%H-%M-%S` for the filename prefix. Create `docs/migrations/<timestamp>-exercise-dips-straightarm-reclassify.sql`:

```sql
-- Reclassify two mis-tagged exercises (review loop, 2026-06-16). Data-only; the
-- generator reads only the corrected fields. Forward-only.
-- Dips: a compound chest+triceps press, was tagged triceps_iso / isolation.
update exercises set
    movement_pattern = 'horizontal_push',
    is_compound = true,
    substitution_class = 'horizontal_press',
    primary_muscle = 'chest',
    secondary_muscle_groups = array['triceps', 'front_delts']::text[]
where user_id is null and name = 'Dips';

-- Straight-Arm Pulldown: a lat isolation, was tagged vertical_pull / compound.
update exercises set
    movement_pattern = 'back_iso',
    is_compound = false,
    substitution_class = null,
    primary_muscle = 'lats',
    secondary_muscle_groups = '{}'::text[]
where user_id is null and name = 'Straight-Arm Pulldown';
```

- [ ] **Step 2: Write the failing test for the derivation alignment**

In `muscleVolume.test.ts`, the `deriveSeedPrimaryMuscle` describe block, add:

```typescript
    it('Dips (now horizontal_push compound) derives to chest, not triceps', () => {
        expect(deriveSeedPrimaryMuscle('horizontal_push', 'horizontal_press', 'Dips')).toBe('chest');
    });
    it('Straight-Arm Pulldown (now back_iso) derives to lats', () => {
        expect(deriveSeedPrimaryMuscle('back_iso', null, 'Straight-Arm Pulldown')).toBe('lats');
    });
```

- [ ] **Step 3: Run it, watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts -t "deriveSeedPrimaryMuscle"`
Expected: the Dips case passes already IF `horizontal_push` -> chest is the existing rule (it is: `case 'horizontal_push': ... return 'chest'`), and Straight-Arm via `back_iso` -> upper_back currently (NOT lats). So the Straight-Arm test FAILS (returns `upper_back`), and `Dips` passes. Confirm which fail.

- [ ] **Step 4: Align `deriveSeedPrimaryMuscle`**

The Dips path already resolves correctly via its new `horizontal_push` pattern (no code change needed for Dips). For Straight-Arm Pulldown: the existing `Dumbbell Pullover -> lats` name override is the precedent. Add Straight-Arm Pulldown to the same lat-biased `back_iso` override:

```typescript
    // Explicit overrides for lat-biased back_iso lifts (the rest of back_iso -> upper_back).
    if (name === 'Dumbbell Pullover' || name === 'Straight-Arm Pulldown') return 'lats';
```

(Replace the existing single-name `if (name === 'Dumbbell Pullover') return 'lats';` line with the above.)

- [ ] **Step 5: Run tests + full suite**

Run: `bun run test:run src/lib/pulse/__tests__/muscleVolume.test.ts` then `bun run test:run`
Expected: green, including the seed-consistency test (the migration changes DB data, not the seed SQL the test reads; the test asserts derivation totality, unaffected). Goldens unchanged (synthetic pools).

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/ src/lib/pulse/muscleVolume.ts src/lib/pulse/__tests__/muscleVolume.test.ts
git commit -m "feat(pulse): reclassify Dips (compound press) + Straight-Arm Pulldown (lat iso)"
```

Note for the merge routine: hand-apply the migration against Supabase.

---

## Task 3: Frequency-scaled floors + chest target (Changes B and C)

**Files:**
- Modify: `src/lib/pulse/gapFill.ts`
- Test: `src/lib/pulse/__tests__/gapFill.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `gapFill.test.ts`:

```typescript
import { coverageFloor, GAP_FILL_TARGETS } from '@/lib/pulse/gapFill';

describe('coverageFloor (Change B: frequency-scaled)', () => {
    it('keeps low-frequency floors and raises 4-6 day accessory floors', () => {
        expect(coverageFloor('side_delts', 3)).toBe(6);
        expect(coverageFloor('side_delts', 4)).toBe(8);
        expect(coverageFloor('side_delts', 6)).toBe(8);
        expect(coverageFloor('rear_delts', 3)).toBe(4);
        expect(coverageFloor('rear_delts', 5)).toBe(6);
        expect(coverageFloor('glutes', 4)).toBe(8); // raised to match hamstrings
        expect(coverageFloor('hamstrings', 4)).toBe(8);
    });
    it('chest floor is a flat 6 at every frequency (Change C)', () => {
        expect(coverageFloor('chest', 2)).toBe(6);
        expect(coverageFloor('chest', 4)).toBe(6);
        expect(coverageFloor('chest', 6)).toBe(6);
    });
});

describe('chest is a gap-fill target (Change C)', () => {
    it('GAP_FILL_TARGETS includes chest; back and quads are absent', () => {
        expect(GAP_FILL_TARGETS).toContain('chest');
        expect(GAP_FILL_TARGETS).not.toContain('back');
        expect(GAP_FILL_TARGETS).not.toContain('quads');
    });
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts -t "coverageFloor"`
Expected: FAIL, `coverageFloor` not exported / chest not in targets.

- [ ] **Step 3: Implement in `gapFill.ts`**

Extend the `GapFillTarget` type + targets:

```typescript
export type GapFillTarget =
    | 'side_delts' | 'rear_delts' | 'biceps' | 'triceps' | 'hamstrings' | 'glutes' | 'chest';

export const GAP_FILL_TARGETS: readonly GapFillTarget[] = [
    'side_delts', 'rear_delts', 'biceps', 'triceps', 'hamstrings', 'glutes', 'chest',
];
```

Add chest to `ISO_PATTERN_FOR` and `MUSCLE_REGION`:

```typescript
export const ISO_PATTERN_FOR: Record<GapFillTarget, MovementPattern> = {
    side_delts: 'shoulder_iso', rear_delts: 'shoulder_iso', biceps: 'biceps_iso',
    triceps: 'triceps_iso', hamstrings: 'hamstring_iso', glutes: 'glute_iso', chest: 'chest_iso',
};
export const MUSCLE_REGION: Record<GapFillTarget, readonly Focus[]> = {
    side_delts: ['push', 'upper', 'full_body'],
    rear_delts: ['push', 'pull', 'upper', 'full_body'],
    biceps: ['pull', 'upper', 'full_body'],
    triceps: ['push', 'upper', 'full_body'],
    hamstrings: ['legs', 'lower', 'full_body'],
    glutes: ['legs', 'lower', 'full_body'],
    chest: ['push', 'upper', 'full_body'],
};
```

Replace the flat `MUSCLE_COVERAGE_FLOOR` const with a frequency-scaled function:

```typescript
/** Weekly DIRECT-set floor gap-fill drives a muscle toward. A FLOOR, not a target: the
 *  +1/session, +4/routine, and 20-set caps still bound total added work, so on a 4-6 day
 *  plan the floor is aspirational within budget. Capped at 8 deliberately (the floor
 *  prevents neglect, not specialization). chest is a flat low 6 at every frequency
 *  (compounds carry it; gap-fill only catches the catastrophic lows). */
export function coverageFloor(muscle: GapFillTarget, dayCount: number): number {
    if (muscle === 'chest') return 6;
    const band = dayCount <= 3 ? 'low' : dayCount === 4 ? 'mid' : 'high';
    const table: Record<Exclude<GapFillTarget, 'chest'>, Record<'low' | 'mid' | 'high', number>> = {
        side_delts: { low: 6, mid: 8, high: 8 },
        rear_delts: { low: 4, mid: 6, high: 6 },
        biceps: { low: 6, mid: 8, high: 8 },
        triceps: { low: 6, mid: 8, high: 8 },
        hamstrings: { low: 6, mid: 8, high: 8 },
        glutes: { low: 6, mid: 8, high: 8 },
    };
    return table[muscle][band];
}
```

Then replace every use of `MUSCLE_COVERAGE_FLOOR[muscle]` inside `applyCoverageGapFill` with `coverageFloor(muscle, dayCount)`, where `dayCount` is computed once at the top of the function:

```typescript
    const dayCount = schedule.length;
```

(Sites: the Phase 2 ordering `sort` comparator, and the `while` loop's `if (sets >= ...)` check. Both currently read `MUSCLE_COVERAGE_FLOOR[a]` / `[muscle]`.)

- [ ] **Step 4: Run tests + full suite**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts` then `bun run test:run`
Expected: green; goldens unchanged (synthetic pools have no `primary_muscle`, so the gate is still false and gap-fill no-ops).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/gapFill.ts src/lib/pulse/__tests__/gapFill.test.ts
git commit -m "feat(pulse): frequency-scaled gap-fill floors + chest as a conditional target"
```

---

## Task 4: Session-balanced Phase 2 + contribution cap (Change D)

**Files:**
- Modify: `src/lib/pulse/gapFill.ts` (Phase 2 block, ~lines 208-235)
- Test: `src/lib/pulse/__tests__/gapFill.test.ts`

The contribution cap: a gap-fill-touched isolation's sets never exceed `2 * baseSetsForSession` (its base sets plus an equal gap-fill contribution; isolations are seeded at `baseSets`, so this is "added <= base"). Balancing: each set toward the floor goes to the eligible session with the LOWEST current direct sets of the muscle (bump an under-cap isolation there, else insert one), so volume distributes (3+3) instead of piling (6+0).

- [ ] **Step 1: Write the failing tests**

Append to `gapFill.test.ts` (reuse the existing `iso`, `row`, `ctx`, `input`, `qualityOf` helpers; extend the session context to two eligible sessions):

```typescript
describe('Phase 2 session balancing + contribution cap (Change D)', () => {
    it('distributes a side-delt gap across two eligible sessions instead of piling on one', () => {
        // Two push sessions, each with a side-delt isolation at 3 sets (total 6). Floor at
        // 4 days = 8, so gap-fill must add 2 more; balanced => both go to ~4, neither piles to 6.
        const pool = [iso('sdA', 'side_delts', 'shoulder_iso'), iso('sdB', 'side_delts', 'shoulder_iso')];
        const sessionCtx = new Map([
            ['push:A', { focus: 'push' as const, isoReps: '12-15', baseSets: 3 }],
            ['push:B', { focus: 'push' as const, isoReps: '12-15', baseSets: 3 }],
        ]);
        const schedule = [
            { day_of_week: 1, workout_type: 'push' as const, variant: 'A' as const, label: null },
            { day_of_week: 2, workout_type: 'push' as const, variant: 'B' as const, label: null },
            { day_of_week: 3, workout_type: 'push' as const, variant: 'C' as const, label: null },
            { day_of_week: 4, workout_type: 'push' as const, variant: 'D' as const, label: null },
        ];
        const exercises = [
            { exercise_id: 'sdA', workout_type: 'push' as const, variant: 'A' as const, order: 0, sets: '3', reps: '12-15', superset_group_id: null },
            { exercise_id: 'sdB', workout_type: 'push' as const, variant: 'B' as const, order: 0, sets: '3', reps: '12-15', superset_group_id: null },
        ];
        const out = applyCoverageGapFill({ exercises, schedule, pool, usable: pool, sessionCtx, qualityOf, bandMaxMin: null });
        const sets = out.filter((e) => e.exercise_id === 'sdA' || e.exercise_id === 'sdB').map((e) => Number(e.sets));
        // total reaches floor 8, and no single side-delt isolation exceeds 2*base (6).
        expect(sets.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(8);
        expect(Math.max(...sets)).toBeLessThanOrEqual(6);
    });

    it('contribution cap: a single isolation is never bumped past 2x its base sets', () => {
        const pool = [iso('bi', 'biceps', 'biceps_iso')];
        const sessionCtx = new Map([['pull:', { focus: 'pull' as const, isoReps: '12-15', baseSets: 3 }]]);
        const schedule = [{ day_of_week: 1, workout_type: 'pull' as const, variant: null, label: null }];
        const exercises = [{ exercise_id: 'bi', workout_type: 'pull' as const, variant: null, order: 0, sets: '3', reps: '12-15', superset_group_id: null }];
        // floor for biceps at 1 day (low) is 6; with only one biceps iso and one session,
        // it bumps to at most 2*base = 6 and stops (cannot exceed the contribution cap).
        const out = applyCoverageGapFill({ exercises, schedule, pool, usable: pool, sessionCtx, qualityOf, bandMaxMin: null });
        expect(Number(out.find((e) => e.exercise_id === 'bi')!.sets)).toBeLessThanOrEqual(6);
    });
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts -t "session balancing"`
Expected: the balancing test fails (current Phase 2 piles onto one isolation past the cap) or the cap test fails (current bump goes to the ceiling 20, not 6).

- [ ] **Step 3: Restructure Phase 2 in `gapFill.ts`**

Replace the Phase 2 block (the `const postPhase1 = direct(); const ordered = ...; for (const muscle of ordered) { ... }`) with:

```typescript
    // ---- Phase 2: distribute below-floor partials, balanced across sessions ----
    // Snapshot the tally once for ordering; ties break by declaration order.
    const postPhase1 = direct();
    const ordered = [...GAP_FILL_TARGETS].sort(
        (a, b) =>
            postPhase1[a] / coverageFloor(a, dayCount) - postPhase1[b] / coverageFloor(b, dayCount) ||
            GAP_FILL_TARGETS.indexOf(a) - GAP_FILL_TARGETS.indexOf(b),
    );
    // Direct sets of a muscle within one session.
    const muscleSetsInSession = (muscle: GapFillTarget, key: string) =>
        sessionRowsFor(key)
            .filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle)
            .reduce((n, e) => n + Number(e.sets), 0);
    for (const muscle of ordered) {
        let guard = 0;
        while (guard++ < 80) {
            if (direct()[muscle] >= coverageFloor(muscle, dayCount)) break;
            // Eligible sessions for this muscle, lowest current representation first.
            const region = MUSCLE_REGION[muscle];
            const keys = schedule
                .map((s) => sessionKey(s.workout_type, s.variant))
                .filter((k) => {
                    const f = sessionCtx.get(k)?.focus;
                    return f && region.includes(f);
                })
                .sort((a, b) => muscleSetsInSession(muscle, a) - muscleSetsInSession(muscle, b));
            let acted = false;
            for (const key of keys) {
                const base = sessionCtx.get(key)?.baseSets ?? 3;
                // bump an existing isolation here if it is under BOTH the per-exercise
                // contribution cap (2*base) and the weekly ceiling.
                const bumpable = sessionRowsFor(key)
                    .filter(
                        (e) =>
                            metaById.get(e.exercise_id)?.primary_muscle === muscle &&
                            Number(e.sets) < 2 * base &&
                            Number(e.sets) < GAP_FILL_SET_CEILING,
                    )
                    .sort((a, b) => Number(a.sets) - Number(b.sets))[0];
                if (bumpable && direct()[muscle] < GAP_FILL_SET_CEILING) {
                    bumpable.sets = String(Number(bumpable.sets) + 1);
                    acted = true;
                    break;
                }
                // else try to insert one here (budget + time + pool gated by seat/eligibility).
                if (
                    added < ROUTINE_ADD_CAP &&
                    (sessionAddCount.get(key) ?? 0) < PER_SESSION_ADD_CAP &&
                    sessionRowsFor(key).filter((e) => metaById.get(e.exercise_id)?.movement_pattern === ISO_PATTERN_FOR[muscle]).length < PATTERN_CAP &&
                    (bandMaxMin === null || sessionMinutes(key) < bandMaxMin) &&
                    seat(muscle, key)
                ) {
                    acted = true;
                    break;
                }
            }
            if (!acted) break; // no eligible session can take more for this muscle
        }
    }
    return exercises;
```

(This removes the old single-isolation bump/insert loop. `seat` already enforces the pool + `usedIds`; the insert guard above mirrors the eligibility the old `pickSession` used, so a Phase 2 insert still respects the per-session cap, pattern cap, time band, and routine cap.)

- [ ] **Step 4: Run tests + full suite**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts` then `bun run test:run`
Expected: the balancing + cap tests pass; the existing gapFill tests still pass (re-check the earlier "below-floor bumps sets" and "budget" tests still hold under the new loop; adjust their expectations only if the new balanced behavior changes WHICH session gets the set, never the cap/golden invariants); goldens unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/gapFill.ts src/lib/pulse/__tests__/gapFill.test.ts
git commit -m "feat(pulse): session-balanced gap-fill with per-exercise contribution cap"
```

---

## Task 5: Integration test + verification + docs

**Files:**
- Modify: `src/lib/pulse/__tests__/generation.test.ts` (real-catalogue-shaped integration test)
- Modify: `docs/roadmap.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-06-16-12-43-23-generation-calibration-design.md` (mark shipped)

- [ ] **Step 1: Add the major-muscle integration test**

The generation goldens use synthetic pools without `primary_muscle`, so gap-fill no-ops on them; this test needs an ATTRIBUTED pool. Build a small attributed full-body-ish pool (each exercise with `primary_muscle` + dumbbell equipment), generate a 4-day 30-min build-muscle routine, and assert the major muscles clear their minimums. Add to `generation.test.ts`:

```typescript
it('Change D/C: a 30-min 4-day routine keeps chest/back/quads >= 6 (no accessory-filled-while-major-collapses)', () => {
    // Attributed pool: dumbbell catalogue subset with primary_muscle set, so gap-fill runs.
    const pool = attributedDumbbellPool(); // helper: one+ exercise per pattern, primary_muscle tagged
    const bp = generateRoutine(
        input({ style: STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle, trainingDays: [1, 2, 4, 5], pool, sessionTime: '~30 min' }),
    );
    const counts = weeklyMuscleSets(bp, pool); // import from muscleVolume
    expect(counts.chest.direct + 0).toBeGreaterThanOrEqual(6);
    expect(counts.lats.direct + counts.upper_back.direct).toBeGreaterThanOrEqual(6);
    expect(counts.quads.direct).toBeGreaterThanOrEqual(6);
});
```

Write `attributedDumbbellPool()` as a small helper near the other pool helpers: take `deepPool()` and map each exercise to add `primary_muscle` via `deriveSeedPrimaryMuscle(e.movement_pattern, e.substitution_class, e.name ?? '')` (import it), and give the relevant ones real-ish dumbbell equipment. If wiring a full attributed pool proves heavy, the controller may instead assert this via `scripts/gen-routine.ts` output in Step 3 and drop this unit test; note which path you took.

- [ ] **Step 2: Full verification**

Run: `bun run test:run` then `bun run typecheck`
Expected: all green. Generation goldens unchanged (Task 1 is name-gated; no rebaseline). Em-dash sweep on touched files: `grep -rn "—" src/lib/pulse/gapFill.ts src/lib/pulse/generation.ts docs/migrations/*reclassify.sql` (expect none).

- [ ] **Step 3: Real-catalogue verification**

Run the sweep and a couple of configs:
```
bun run scripts/muscle-sweep.ts
bun run scripts/gen-routine.ts --equipment dumbbells,bench --days mon,wed,fri --time 45 --goal build_muscle --style fb-3
bun run scripts/gen-routine.ts --equipment dumbbells,barbell,bench,cables,machines,pull_up_bar --days 4 --time 30 --goal build_muscle --style ul-classic-4
```
Confirm: dumbbell goblet squat / RDL now read 10-15; 4-6 day accessory coverage rises toward the new floors; chest no longer drops to 3 on the 30-min plan; gap-fill distributes across sessions (no lone 6-set block where two sessions could share); Dips appears as a chest press and Straight-Arm Pulldown as a lat isolation. (The sweep backfills `primary_muscle` via the seed derivation, which now matches the migration.)

- [ ] **Step 4: Docs sync + commit**

- `docs/roadmap.md`: add a Shipped bullet for the calibration pass (date + branch `feature/generation-calibration`, the six changes, the hand-apply migration, suite count). Note context-scoring is the next generation spec, then Laldy.
- `CLAUDE.md`: update the `gapFill.ts` note (frequency-scaled `coverageFloor`, chest as a conditional target, session-balanced Phase 2 + contribution cap) and the generation rep-range note (`floorRepRangeForLoad`); note the Dips / Straight-Arm Pulldown reclassification.
- The spec: add a one-line "Shipped <date>" note at the top.

```bash
git add docs/roadmap.md CLAUDE.md docs/superpowers/specs/2026-06-16-12-43-23-generation-calibration-design.md src/lib/pulse/__tests__/generation.test.ts
git commit -m "docs(roadmap): ship generation calibration pass"
```

---

## Self-review notes (for the implementer)

- **`floorRepRangeForLoad` is name-gated for golden safety.** The synthetic `deepPool` builds `['dumbbells']` squat/hinge/lunge compounds, so without a guard the floor would churn nearly every golden (8-12 -> 10-15). The `if (!ex.name) return reps` guard makes it a no-op on nameless synthetic exercises (the same convention as ISOLATION_QUALITY / CANONICAL_ANCHORS); real catalogue exercises have names, so the floor applies there. The unit tests therefore pass NAMED exercises. If a generation golden churns, the guard is broken; do not rebaseline.
- **Gap-fill stays gated.** Everything in `gapFill.ts` runs only when `usable.some(e => e.primary_muscle)`; synthetic pools no-op, so the bulk of generation goldens are byte-identical regardless of Tasks 3-4.
- **Contribution cap, not the absolute 4.** Implement the per-exercise contribution cap (`< 2 * base`); do not add a `GAP_FILL_PER_EXERCISE_SETS = 4` constant (it conflicts with the 3+3 intent; see the top note).
- **Do not run `bun run format`.** Format only touched files; `git add` only the listed paths. If a commit hits the `gpg.format` error, retry with `GIT_CONFIG_GLOBAL=/dev/null `.
- The migration is hand-applied on merge; it changes real-catalogue data, not the synthetic goldens.
