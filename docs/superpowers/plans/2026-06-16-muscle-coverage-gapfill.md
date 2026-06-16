# Minimum-coverage gap-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, capped, post-generation pass that closes the worst small-muscle volume gaps (side/rear delts, biceps, triceps, hamstrings, glutes) by appending isolation sets/exercises, without changing the base program structure or any existing golden.

**Architecture:** A pure `src/lib/pulse/gapFill.ts` module (`applyCoverageGapFill`) that takes the finished exercise list plus a small per-session context and returns an augmented list. It runs inside `generateRoutine` after the priority-set bump and before the `over_time` duration guard, gated on the pool carrying `primary_muscle` (so synthetic pools no-op and all goldens stay byte-identical). It reuses `weeklyMuscleSets` (Spec 1) for the tally and a `qualityOf` callback (so it honors `ISOLATION_QUALITY` without importing it, keeping the module cycle-free).

**Tech Stack:** TypeScript (strict), Vitest, Bun. No migration.

**Spec:** `docs/superpowers/specs/2026-06-16-11-13-09-muscle-coverage-gapfill-design.md`. Read it first; this plan implements it exactly. Evidence: `docs/audits/2026-06-16-10-49-42-muscle-coverage-evidence-sweep.md`.

---

## Design decisions baked into this plan

- **Six targets only:** `side_delts, rear_delts, biceps, triceps, hamstrings, glutes`. chest/back/quads are warning-only (the generator's compounds cover them).
- **Two phases, zeros first:** Phase 1 eliminates trainable zeros; Phase 2 nudges below-floor partials toward `MUSCLE_COVERAGE_FLOOR`.
- **Cheap-first ladder:** at/above floor -> nothing; below floor with an existing isolation -> bump its sets (repeatable, capped by `GAP_FILL_SET_CEILING`); zero or nothing-to-bump -> insert ONE isolation; can't -> leave to the `muscle_coverage_low` warning.
- **Caps:** `PER_SESSION_ADD_CAP = 1`, `ROUTINE_ADD_CAP = 4` (added exercises, both phases; zeros consume first; set-bumps do not count). `GAP_FILL_SET_CEILING = 20`. Existing pattern cap (<=2 of one pattern/session) respected.
- **Time overflow:** a Phase 1 zero-kill insert may push a session over its time band (within +1/session); a Phase 2 insert may not (it needs headroom).
- **Isolation only, never compounds.** `gapFill.ts` is PURE: no runtime import from `generation.ts` (only type imports), so there is no import cycle.

## File structure

- **Create** `src/lib/pulse/gapFill.ts`: pure: constants (`GAP_FILL_TARGETS`, `MUSCLE_COVERAGE_FLOOR`, `MUSCLE_REGION`, `ISO_PATTERN_FOR`, the caps + ceiling), helpers (`poolCanTrainMuscle`, `pickIsolationForMuscle`, `pickSessionForMuscle`), and `applyCoverageGapFill`.
- **Create** `src/lib/pulse/__tests__/gapFill.test.ts`: unit tests.
- **Modify** `src/lib/pulse/generation.ts`: export `isolationQuality`; build per-session context in the session loop; call `applyCoverageGapFill` after the priority bump and rebuild `perSessionRows` from the result, both gated on muscle attribution, before the duration guard.
- **Modify** `src/lib/pulse/muscleVolume.ts`: (only if needed) nothing planned; `weeklyMuscleSets` is already exported.

---

## Task 1: gapFill constants, region map, and the pure pickers

**Files:**
- Create: `src/lib/pulse/gapFill.ts`
- Create/Test: `src/lib/pulse/__tests__/gapFill.test.ts`
- Modify: `src/lib/pulse/generation.ts` (export `isolationQuality`)

- [ ] **Step 1: Export `isolationQuality` from `generation.ts`**

Find `function isolationQuality(ex: ExerciseMeta): number {` (added in fix #3, near `ISOLATION_QUALITY`) and add `export`:

```typescript
export function isolationQuality(ex: ExerciseMeta): number {
    return ex.name ? (ISOLATION_QUALITY[ex.name] ?? NEUTRAL_QUALITY) : NEUTRAL_QUALITY;
}
```

(No behavior change; just exposes it so `generation.ts` can pass it to gap-fill as the `qualityOf` callback. It is a stable pure function; the existing `byPattern` keeps using it directly.)

- [ ] **Step 2: Write the failing test for the constants + pickers**

Create `src/lib/pulse/__tests__/gapFill.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    GAP_FILL_TARGETS,
    MUSCLE_COVERAGE_FLOOR,
    ISO_PATTERN_FOR,
    poolCanTrainMuscle,
    pickIsolationForMuscle,
} from '@/lib/pulse/gapFill';
import type { ExerciseMeta } from '@/lib/pulse/generation';
import type { Muscle, MovementPattern } from '@/lib/pulse/types';

function iso(id: string, muscle: Muscle, pattern: MovementPattern, name?: string, fatigue?: number): ExerciseMeta {
    return {
        id,
        name,
        movement_pattern: pattern,
        equipment: ['dumbbells'],
        is_compound: false,
        category: 'shoulders' as ExerciseMeta['category'],
        substitution_class: null,
        unilateral: false,
        contraindications: [],
        primary_muscle: muscle,
        ...(fatigue !== undefined ? { fatigue } : {}),
    };
}
// Quality stub: name 'Good' -> 1, 'Bad' -> 0.2, else neutral 0.8.
const qualityOf = (e: ExerciseMeta) => (e.name === 'Good' ? 1 : e.name === 'Bad' ? 0.2 : 0.8);

describe('gapFill constants', () => {
    it('targets exactly the six accessory muscles (chest/back/quads excluded)', () => {
        expect([...GAP_FILL_TARGETS].sort()).toEqual(
            ['biceps', 'glutes', 'hamstrings', 'rear_delts', 'side_delts', 'triceps'].sort(),
        );
        expect(MUSCLE_COVERAGE_FLOOR).not.toHaveProperty('chest');
        expect(MUSCLE_COVERAGE_FLOOR).not.toHaveProperty('back');
        expect(MUSCLE_COVERAGE_FLOOR).not.toHaveProperty('quads');
    });
    it('maps each target to its isolation pattern (never a compound anchor)', () => {
        expect(ISO_PATTERN_FOR.side_delts).toBe('shoulder_iso');
        expect(ISO_PATTERN_FOR.rear_delts).toBe('shoulder_iso');
        expect(ISO_PATTERN_FOR.biceps).toBe('biceps_iso');
        expect(ISO_PATTERN_FOR.hamstrings).toBe('hamstring_iso');
    });
});

describe('poolCanTrainMuscle', () => {
    it('is true only when the usable pool has a direct isolation for the muscle', () => {
        const pool = [iso('r1', 'rear_delts', 'shoulder_iso')];
        expect(poolCanTrainMuscle('rear_delts', pool)).toBe(true);
        expect(poolCanTrainMuscle('biceps', pool)).toBe(false);
    });
});

describe('pickIsolationForMuscle', () => {
    it('picks the highest-quality isolation for the muscle, excluding already-used ids', () => {
        const pool = [
            iso('bad', 'side_delts', 'shoulder_iso', 'Bad'),
            iso('good', 'side_delts', 'shoulder_iso', 'Good'),
        ];
        expect(pickIsolationForMuscle('side_delts', pool, new Set(), qualityOf)?.id).toBe('good');
        // excluding 'good' falls back to 'bad'
        expect(pickIsolationForMuscle('side_delts', pool, new Set(['good']), qualityOf)?.id).toBe('bad');
    });
    it('returns null when no candidate matches the muscle', () => {
        const pool = [iso('r1', 'rear_delts', 'shoulder_iso')];
        expect(pickIsolationForMuscle('biceps', pool, new Set(), qualityOf)).toBeNull();
    });
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts`
Expected: FAIL, module `gapFill` not found / exports missing.

- [ ] **Step 4: Implement the constants + pickers in `gapFill.ts`**

Create `src/lib/pulse/gapFill.ts`:

```typescript
import type { Muscle, MovementPattern, Focus } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';
import { weeklyMuscleSets } from './muscleVolume';
import { estimateSessionMinutes } from './utils';

// Minimum-coverage gap-fill (Tier-2 Spec 3). A deterministic, capped, post-generation
// pass that appends isolation work to close small-muscle volume gaps. PURE: it imports
// no runtime value from generation.ts (only types), so there is no import cycle; the
// caller passes a `qualityOf` so this honors ISOLATION_QUALITY without importing it.

/** The six accessory muscles gap-fill chases. chest/back/quads are warning-only (the
 *  generator's compounds cover them); front_delts/calves/core are informational. */
export const GAP_FILL_TARGETS: readonly Muscle[] = [
    'side_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'hamstrings',
    'glutes',
];

/** The intervention floor (weekly DIRECT sets gap-fill drives toward). A deliberate
 *  policy choice ("worth fixing"), distinct from Spec 1's MUSCLE_SET_TARGETS band. */
export const MUSCLE_COVERAGE_FLOOR: Record<(typeof GAP_FILL_TARGETS)[number], number> = {
    side_delts: 6,
    rear_delts: 4,
    biceps: 6,
    triceps: 6,
    hamstrings: 6,
    glutes: 6,
};

/** The isolation pattern that directly trains each target. Never a compound anchor. */
export const ISO_PATTERN_FOR: Record<(typeof GAP_FILL_TARGETS)[number], MovementPattern> = {
    side_delts: 'shoulder_iso',
    rear_delts: 'shoulder_iso',
    biceps: 'biceps_iso',
    triceps: 'triceps_iso',
    hamstrings: 'hamstring_iso',
    glutes: 'glute_iso',
};

/** Session focuses each target may be added to. */
export const MUSCLE_REGION: Record<(typeof GAP_FILL_TARGETS)[number], readonly Focus[]> = {
    side_delts: ['push', 'upper', 'full_body'],
    rear_delts: ['push', 'pull', 'upper', 'full_body'],
    biceps: ['pull', 'upper', 'full_body'],
    triceps: ['push', 'upper', 'full_body'],
    hamstrings: ['legs', 'lower', 'full_body'],
    glutes: ['legs', 'lower', 'full_body'],
};

export const PER_SESSION_ADD_CAP = 1;
export const ROUTINE_ADD_CAP = 4;
export const GAP_FILL_SET_CEILING = 20;

/** True when the usable pool has a direct isolation for the muscle (so gap-fill can
 *  actually add work for it). */
export function poolCanTrainMuscle(muscle: Muscle, usable: ExerciseMeta[]): boolean {
    return usable.some((e) => e.primary_muscle === muscle);
}

/** The best isolation in the usable pool for a muscle: highest quality first, then
 *  lower fatigue (accessory preference), then stable id. Excludes already-used ids.
 *  Null when none matches. */
export function pickIsolationForMuscle(
    muscle: Muscle,
    usable: ExerciseMeta[],
    excludeIds: Set<string>,
    qualityOf: (ex: ExerciseMeta) => number,
): ExerciseMeta | null {
    const candidates = usable.filter((e) => e.primary_muscle === muscle && !excludeIds.has(e.id));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
        const q = qualityOf(b) - qualityOf(a);
        if (q !== 0) return q;
        const fa = a.fatigue ?? 3;
        const fb = b.fatigue ?? 3;
        if (fa !== fb) return fa - fb;
        return a.id.localeCompare(b.id);
    });
    return candidates[0];
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/gapFill.ts src/lib/pulse/__tests__/gapFill.test.ts src/lib/pulse/generation.ts
git commit -m "feat(pulse): gap-fill constants, region map, isolation picker"
```

---

## Task 2: `applyCoverageGapFill` (two-phase pass)

**Files:**
- Modify: `src/lib/pulse/gapFill.ts`
- Modify: `src/lib/pulse/__tests__/gapFill.test.ts`

The function signature (everything generation will pass):

```typescript
type Row = RoutineBlueprint['exercises'][number];
interface SessionCtx { focus: Focus; isoReps: string; baseSets: number }
interface GapFillInput {
    exercises: Row[];
    schedule: RoutineBlueprint['schedule'];
    pool: ExerciseMeta[];                 // full pool, for the weekly tally + id lookups
    usable: ExerciseMeta[];               // equipment-filtered candidates for inserts
    sessionCtx: Map<string, SessionCtx>;  // key = `${workout_type}:${variant ?? ''}`
    qualityOf: (ex: ExerciseMeta) => number;
    bandMaxMin: number | null;            // session time band max (null = no cap)
}
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/pulse/__tests__/gapFill.test.ts`:

```typescript
import { applyCoverageGapFill } from '@/lib/pulse/gapFill';
import type { RoutineBlueprint } from '@/lib/pulse/generation';

type Row = RoutineBlueprint['exercises'][number];
const SKEY = 'full_body:';
function row(id: string, order: number, sets = 3): Row {
    return { exercise_id: id, workout_type: 'full_body', variant: null, order, sets: String(sets), reps: '12-15', superset_group_id: null };
}
function ctx() {
    return new Map([[SKEY, { focus: 'full_body' as const, isoReps: '12-15', baseSets: 3 }]]);
}
// A usable pool with one isolation per target muscle (+ a couple of named-quality ones).
function usablePoolAllMuscles(): ExerciseMeta[] {
    const muscles: Array<[string, Muscle, MovementPattern]> = [
        ['sd', 'side_delts', 'shoulder_iso'],
        ['rd', 'rear_delts', 'shoulder_iso'],
        ['bi', 'biceps', 'biceps_iso'],
        ['tri', 'triceps', 'triceps_iso'],
        ['ham', 'hamstrings', 'hamstring_iso'],
        ['glu', 'glutes', 'glute_iso'],
    ];
    return muscles.map(([id, m, p]) => iso(id, m, p));
}
const input = (over: Partial<Parameters<typeof applyCoverageGapFill>[0]>) => ({
    schedule: [{ day_of_week: 1, workout_type: 'full_body' as const, variant: null, label: null }],
    pool: [],
    usable: usablePoolAllMuscles(),
    sessionCtx: ctx(),
    qualityOf,
    bandMaxMin: null,
    exercises: [],
    ...over,
});
const muscleOf = (pool: ExerciseMeta[], id: string) => pool.find((e) => e.id === id)?.primary_muscle;

describe('applyCoverageGapFill', () => {
    it('no-op when no exercise has a primary_muscle (synthetic pool)', () => {
        const ex = [{ ...row('x', 0), }];
        const out = applyCoverageGapFill(input({ exercises: ex, pool: [iso('x', 'biceps', 'biceps_iso')], usable: [] }) as never);
        // pool maps x->biceps but usable is empty, and the no-op guard keys off the
        // blueprint's own attribution: here x IS attributed, so guard passes; with usable
        // empty nothing can be added. Assert unchanged length.
        expect(out).toHaveLength(1);
    });

    it('PHASE 1: seats one isolation for a zero-coverage target the pool can train', () => {
        // Session trains only biceps; rear_delts is zero and the pool can train it.
        const pool = [iso('bi', 'biceps', 'biceps_iso'), iso('rd', 'rear_delts', 'shoulder_iso')];
        const out = applyCoverageGapFill(input({ exercises: [row('bi', 0)], pool, usable: pool }) as never);
        const added = out.filter((e) => e.exercise_id !== 'bi');
        expect(added.some((e) => muscleOf(pool, e.exercise_id) === 'rear_delts')).toBe(true);
    });

    it('PHASE 2: bumps sets on an existing isolation instead of adding an exercise', () => {
        // biceps present (3 sets) but below floor 6; bump the existing biceps iso, no new exercise.
        const pool = [iso('bi', 'biceps', 'biceps_iso')];
        const out = applyCoverageGapFill(input({ exercises: [row('bi', 0, 3)], pool, usable: pool }) as never);
        expect(out).toHaveLength(1);
        expect(Number(out[0].sets)).toBe(MUSCLE_COVERAGE_FLOOR.biceps); // 6
    });

    it('respects ROUTINE_ADD_CAP across many zeros', () => {
        // All six muscles zero, one session: +1/session cap means at most 1 insert here.
        const pool = usablePoolAllMuscles();
        const out = applyCoverageGapFill(input({ exercises: [], pool, usable: pool }) as never);
        expect(out.length).toBeLessThanOrEqual(PER_SESSION_ADD_CAP);
    });

    it('never inserts a compound', () => {
        const pool = [iso('bi', 'biceps', 'biceps_iso'), iso('rd', 'rear_delts', 'shoulder_iso')];
        const out = applyCoverageGapFill(input({ exercises: [row('bi', 0)], pool, usable: pool }) as never);
        for (const e of out) expect(pool.find((p) => p.id === e.exercise_id)?.is_compound ?? false).toBe(false);
    });

    it('is deterministic (same input -> identical output)', () => {
        const pool = usablePoolAllMuscles();
        const a = JSON.stringify(applyCoverageGapFill(input({ exercises: [row('bi', 0)], pool, usable: pool }) as never));
        const b = JSON.stringify(applyCoverageGapFill(input({ exercises: [row('bi', 0)], pool, usable: pool }) as never));
        expect(a).toBe(b);
    });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts -t "applyCoverageGapFill"`
Expected: FAIL, `applyCoverageGapFill` not exported.

- [ ] **Step 3: Implement `applyCoverageGapFill` in `gapFill.ts`**

Append to `src/lib/pulse/gapFill.ts`:

```typescript
type Row = RoutineBlueprint['exercises'][number];
interface SessionCtx {
    focus: Focus;
    isoReps: string;
    baseSets: number;
}
export interface GapFillInput {
    exercises: Row[];
    schedule: RoutineBlueprint['schedule'];
    pool: ExerciseMeta[];
    usable: ExerciseMeta[];
    sessionCtx: Map<string, SessionCtx>;
    qualityOf: (ex: ExerciseMeta) => number;
    bandMaxMin: number | null;
}

const sessionKey = (wt: string, variant: string | null) => `${wt}:${variant ?? ''}`;
const PATTERN_CAP = 2;

/** Append isolation work to close small-muscle gaps. Returns a new exercises array;
 *  never reorders or removes. No-op (returns the input array) when no exercise carries
 *  a primary_muscle, which keeps synthetic-pool goldens byte-identical. */
export function applyCoverageGapFill(input: GapFillInput): Row[] {
    const { schedule, pool, usable, sessionCtx, qualityOf, bandMaxMin } = input;
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const exercises = input.exercises.map((e) => ({ ...e }));
    if (!exercises.some((e) => metaById.get(e.exercise_id)?.primary_muscle)) return exercises;

    const direct = (): Record<Muscle, number> => {
        const counts = weeklyMuscleSets({ schedule, exercises, warnings: [] }, pool);
        const out = {} as Record<Muscle, number>;
        for (const m of GAP_FILL_TARGETS) out[m] = counts[m].direct;
        return out;
    };
    const usedIds = new Set(exercises.map((e) => e.exercise_id));
    let added = 0;

    const sessionRowsFor = (key: string) =>
        exercises.filter((e) => sessionKey(e.workout_type, e.variant) === key);
    const sessionMinutes = (key: string) =>
        estimateSessionMinutes(
            sessionRowsFor(key).map((e) => ({
                sets: Number(e.sets),
                is_compound: metaById.get(e.exercise_id)?.is_compound ?? false,
                reps: e.reps,
                supersetGroupId: e.superset_group_id,
            })),
        );
    const sessionAddCount = new Map<string, number>(); // gap-fill inserts per session

    // Sessions eligible for a muscle, best-placement first.
    const pickSession = (muscle: (typeof GAP_FILL_TARGETS)[number], allowOverTime: boolean): string | null => {
        const region = MUSCLE_REGION[muscle];
        const isoPattern = ISO_PATTERN_FOR[muscle];
        const keys = schedule
            .map((s) => ({ key: sessionKey(s.workout_type, s.variant), focus: sessionCtx.get(sessionKey(s.workout_type, s.variant))?.focus }))
            .filter((s) => s.focus && region.includes(s.focus));
        // 1) a session already training the muscle (augment existing exposure)
        const existing = keys.find((s) =>
            sessionRowsFor(s.key).some((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle),
        );
        const eligible = (key: string): boolean => {
            if ((sessionAddCount.get(key) ?? 0) >= PER_SESSION_ADD_CAP) return false;
            const patternCount = sessionRowsFor(key).filter(
                (e) => metaById.get(e.exercise_id)?.movement_pattern === isoPattern,
            ).length;
            if (patternCount >= PATTERN_CAP) return false;
            if (!pickIsolationForMuscle(muscle, usable, usedIds, qualityOf)) return false;
            if (!allowOverTime && bandMaxMin !== null && sessionMinutes(key) >= bandMaxMin) return false;
            return true;
        };
        if (existing && eligible(existing.key)) return existing.key;
        // 2) eligible session with the lowest current representation of the muscle,
        //    tiebreak fewest exercises then schedule order.
        const repOf = (key: string) =>
            sessionRowsFor(key).filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle).length;
        const candidates = keys.filter((s) => eligible(s.key));
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
            const r = repOf(a.key) - repOf(b.key);
            if (r !== 0) return r;
            const n = sessionRowsFor(a.key).length - sessionRowsFor(b.key).length;
            if (n !== 0) return n;
            return 0; // keys already in schedule order
        });
        return candidates[0].key;
    };

    const seat = (muscle: (typeof GAP_FILL_TARGETS)[number], key: string) => {
        const ex = pickIsolationForMuscle(muscle, usable, usedIds, qualityOf);
        if (!ex) return false;
        const [wt, variantRaw] = key.split(':');
        const variant = variantRaw === '' ? null : variantRaw;
        const ctxFor = sessionCtx.get(key);
        const order = Math.max(-1, ...sessionRowsFor(key).map((e) => e.order)) + 1;
        exercises.push({
            exercise_id: ex.id,
            workout_type: wt as Row['workout_type'],
            variant: variant as Row['variant'],
            order,
            sets: String(ctxFor?.baseSets ?? 3),
            reps: ctxFor?.isoReps ?? '12-15',
            superset_group_id: null,
        });
        usedIds.add(ex.id);
        sessionAddCount.set(key, (sessionAddCount.get(key) ?? 0) + 1);
        added += 1;
        return true;
    };

    // ---- Phase 1: eliminate zeros (trainable) ----
    const zeroTargets = GAP_FILL_TARGETS.filter((m) => direct()[m] === 0 && poolCanTrainMuscle(m, usable));
    for (const muscle of zeroTargets) {
        if (added >= ROUTINE_ADD_CAP) break;
        const key = pickSession(muscle, true); // zero-kill may overflow time
        if (key) seat(muscle, key);
    }

    // ---- Phase 2: nudge below-floor partials ----
    const ordered = [...GAP_FILL_TARGETS].sort(
        (a, b) => direct()[a] / MUSCLE_COVERAGE_FLOOR[a] - direct()[b] / MUSCLE_COVERAGE_FLOOR[b],
    );
    for (const muscle of ordered) {
        let guard = 0;
        while (direct()[muscle] < MUSCLE_COVERAGE_FLOOR[muscle] && guard++ < 50) {
            // try a set-bump on the cheapest existing isolation for this muscle
            const existingIso = exercises
                .filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle)
                .sort((a, b) => Number(a.sets) - Number(b.sets))[0];
            if (existingIso && direct()[muscle] < GAP_FILL_SET_CEILING && Number(existingIso.sets) < GAP_FILL_SET_CEILING) {
                existingIso.sets = String(Number(existingIso.sets) + 1);
                continue;
            }
            // nothing to bump: try one insert, within budget + headroom
            if (added >= ROUTINE_ADD_CAP) break;
            const key = pickSession(muscle, false); // below-floor insert needs headroom
            if (!key || !seat(muscle, key)) break;
        }
    }
    return exercises;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `bun run test:run src/lib/pulse/__tests__/gapFill.test.ts`
Expected: PASS (all gapFill tests).

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add src/lib/pulse/gapFill.ts src/lib/pulse/__tests__/gapFill.test.ts
git commit -m "feat(pulse): applyCoverageGapFill two-phase pass (zeros, then below-floor)"
```

---

## Task 3: Wire gap-fill into `generateRoutine`

**Files:**
- Modify: `src/lib/pulse/generation.ts` (the session loop ~1922-2079; the block after the priority bump ~2098; before the duration guard ~2103)

- [ ] **Step 1: Import gap-fill at the top of `generation.ts`**

Add near the other local imports:

```typescript
import { applyCoverageGapFill } from './gapFill';
import type { Focus } from './types';
```

(`Focus` may already be imported; if so, skip it.)

- [ ] **Step 2: Build the per-session context during the loop**

Before `style.sessions.forEach(...)` (around line 1918, next to `perSessionRows`), declare:

```typescript
const sessionCtx = new Map<string, { focus: Focus; isoReps: string; baseSets: number }>();
```

Inside the loop, AFTER `effectiveBias` is computed and `baseSets` is known (after line 2031 `const baseSets = Math.max(3, sets);`), add:

```typescript
        // Context gap-fill needs to add an isolation to this session later: an
        // isolation's reps depend on (bias, goal, style, focus), not the specific iso
        // pattern, so one resolved value per session is correct.
        sessionCtx.set(`${workout_type}:${variant ?? ''}`, {
            focus: session.focus,
            isoReps: resolveRepRange(effectiveBias, 'biceps_iso', false, answers.goal, styleForBias, answers.experience, session.focus),
            baseSets,
        });
```

- [ ] **Step 3: Call gap-fill after the priority bump, rebuild `perSessionRows`, before the duration guard**

Replace the duration-guard block (currently starting at the comment `// Duration guard (P1.4): ...`, around line 2100) by inserting the gap-fill + rebuild IMMEDIATELY BEFORE it. The whole inserted block is gated on muscle attribution, so synthetic pools are untouched:

```typescript
    // Tier-2 Spec 3: minimum-coverage gap-fill. Gated on muscle attribution, so on a
    // synthetic pool (no primary_muscle) nothing runs and the goldens stay byte-
    // identical. Runs AFTER the priority bump and BEFORE the duration guard so any
    // added work is reflected in the over_time estimate.
    if (usable.some((e) => e.primary_muscle)) {
        const filled = applyCoverageGapFill({
            exercises,
            schedule,
            pool,
            usable,
            sessionCtx,
            qualityOf: isolationQuality,
            bandMaxMin: SESSION_TIME_MAX_MIN[sessionTime],
        });
        // Replace the exercises list in place with the gap-filled one.
        exercises.length = 0;
        exercises.push(...filled);
        // Rebuild perSessionRows from the final exercises so the duration guard sees
        // the additions (group by session, derive is_compound from the pool).
        const bySession = new Map<string, Array<{ sets: number; is_compound: boolean; reps: string; supersetGroupId: string | null }>>();
        for (const s of schedule) bySession.set(`${s.workout_type}:${s.variant ?? ''}`, []);
        for (const e of exercises) {
            const key = `${e.workout_type}:${e.variant ?? ''}`;
            bySession.get(key)?.push({
                sets: Number(e.sets),
                is_compound: poolById.get(e.exercise_id)?.is_compound ?? false,
                reps: e.reps,
                supersetGroupId: e.superset_group_id,
            });
        }
        perSessionRows.length = 0;
        perSessionRows.push(...bySession.values());
    }
```

Note: `pool` is the generator's input pool (the variable already in scope as `input.pool` or `pool`); confirm the local name (the function destructures it). `poolById` is a `Map<string, ExerciseMeta>` of the pool by id; if one does not already exist in `generateRoutine`, add `const poolById = new Map(pool.map((e) => [e.id, e]));` once near the top of the function. `isolationQuality` and `SESSION_TIME_MAX_MIN` are already in this module.

- [ ] **Step 4: Add a golden byte-identity test guard**

Add to `src/lib/pulse/__tests__/generation.test.ts` (in a fitting describe block; reuse the existing `input` / `deepPool` helpers, which produce pools WITHOUT `primary_muscle`):

```typescript
describe('gap-fill: no-op on synthetic (unattributed) pools', () => {
    it('output is byte-identical to base for every style/day-count', () => {
        for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[config.days.length][0] as ProgramStyle;
            const a = JSON.stringify(generateRoutine(input({ style, trainingDays: config.days })));
            const b = JSON.stringify(generateRoutine(input({ style, trainingDays: config.days })));
            expect(a).toBe(b);
        }
    });
});
```

(The deepPool exercises have no `primary_muscle`, so the gate is false and gap-fill never runs. This plus the full existing golden suite confirms byte-identity.)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `bun run test:run` then `bun run typecheck`
Expected: all pass. The existing generation goldens MUST be unchanged (gap-fill is gated off for synthetic pools). If a golden churned, the gate or the perSessionRows rebuild is wrong; fix it, do not rebaseline.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): wire gap-fill into generateRoutine (gated, golden-safe)"
```

---

## Task 4: Real-catalogue verification + docs sync

**Files:**
- Modify: `docs/roadmap.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`

- [ ] **Step 1: Re-run the sweep and confirm the gaps close**

Run: `bun run scripts/muscle-sweep.ts`
Expected: the zero-coverage cases (e.g. rear_delts 0% on `ul-classic-4 / dumbbell`, `phul-4`, `fb-ul-hybrid-5`) are now non-zero, and the six targets rise toward their floors. Sessions grow by at most the caps. Capture a couple of before/after lines for the roadmap bullet. (The sweep backfills `primary_muscle` via the seed derivation, so it exercises the same gate.)

- [ ] **Step 2: Spot-check one config in the generator diagnostic**

Run: `bun run scripts/gen-routine.ts --equipment dumbbells,bench --days 4 --time 60 --goal build_muscle`
Expected: rear_delts is no longer 0; a rear-delt isolation appears; the `potential gaps` line is shorter. Confirm no compound was inserted and the session count grew by at most 1 where it did.

- [ ] **Step 3: Sync docs**

- `docs/roadmap.md`: add a Shipped bullet for Tier-2 Spec 3 (date + branch `feature/muscle-coverage-gapfill`, NOT a PR number), noting the post-gen gap-fill, the six accessory targets, the caps, no migration, and that Spec 2 (variety) was dropped on evidence. Note the suite count.
- `docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md`: mark Tier-2 (b) variety = DROPPED (evidence) and (c) gap-fill = SHIPPED, pointing to this plan + spec + the audit.
- `CLAUDE.md`: in the "Routine generation" area, add `gapFill.ts` (`applyCoverageGapFill`: post-gen, gated, two-phase, six accessory targets, `MUSCLE_COVERAGE_FLOOR`, caps, isolation-only, reuses `weeklyMuscleSets` + `isolationQuality`) and note it runs after the priority bump and before the duration guard.

- [ ] **Step 4: Em-dash sweep on touched files, then commit**

Run: `grep -rn "—" src/lib/pulse/gapFill.ts src/lib/pulse/__tests__/gapFill.test.ts docs/roadmap.md CLAUDE.md`
Expected: no output. Fix any hit.

```bash
git add docs/roadmap.md CLAUDE.md docs/superpowers/plans/2026-06-16-generation-hypertrophy-quality.md
git commit -m "docs(roadmap): ship Tier-2 spec 3 muscle-coverage gap-fill; drop spec 2"
```

---

## Self-review notes (for the implementer)

- **Golden safety is the gate, not luck.** The `if (usable.some(e => e.primary_muscle))` guard wraps the entire gap-fill + perSessionRows rebuild. Synthetic pools (deepPool, the goldens) have no `primary_muscle`, so the block never runs and the blueprint is identical. Never give a golden's synthetic pool a `primary_muscle`.
- **`gapFill.ts` stays pure and import-cycle-free:** it imports only types from `generation.ts` plus `weeklyMuscleSets` (muscleVolume) and `estimateSessionMinutes` (utils). `ISOLATION_QUALITY` is reached through the `qualityOf` callback, never imported.
- **The `while` loop in Phase 2 has a hard `guard` bound (50)** so a mis-set ceiling can never infinite-loop; in practice it exits on floor or ceiling far sooner.
- **Compounds are never inserted:** `ISO_PATTERN_FOR` only maps to isolation patterns, and `pickIsolationForMuscle` filters on `primary_muscle` of isolation exercises. A test asserts the inserted exercise is non-compound.
- **Do not run `bun run format`.** Format only the files you touched and `git add` only the listed paths. If a commit fails with a `gpg.format` error, retry it prefixed with `GIT_CONFIG_GLOBAL=/dev/null `.
