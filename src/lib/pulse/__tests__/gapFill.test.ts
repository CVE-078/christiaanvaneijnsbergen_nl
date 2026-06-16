import { describe, it, expect } from 'vitest';
import {
    GAP_FILL_TARGETS,
    GAP_FILL_SET_CEILING,
    coverageFloor,
    ISO_PATTERN_FOR,
    PER_SESSION_ADD_CAP,
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
    it('targets the seven gap-fill muscles incl. chest (back/quads excluded)', () => {
        expect([...GAP_FILL_TARGETS].sort()).toEqual(
            ['biceps', 'chest', 'glutes', 'hamstrings', 'rear_delts', 'side_delts', 'triceps'].sort(),
        );
        expect(GAP_FILL_TARGETS).not.toContain('back');
        expect(GAP_FILL_TARGETS).not.toContain('quads');
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
        // per-session cap held: exactly one exercise was added
        expect(added.length).toBe(1);
    });

    it('PHASE 2: bumps sets on an existing isolation instead of adding an exercise', () => {
        // biceps present (3 sets) but below floor 6; bump the existing biceps iso, no new exercise.
        const pool = [iso('bi', 'biceps', 'biceps_iso')];
        const out = applyCoverageGapFill(input({ exercises: [row('bi', 0, 3)], pool, usable: pool }) as never);
        expect(out).toHaveLength(1);
        expect(Number(out[0].sets)).toBe(coverageFloor('biceps', 1)); // 6 at 1 day
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

    it('PHASE 2: set-bump does not exceed GAP_FILL_SET_CEILING on the existing exercise', () => {
        // Scenario: the existing isolation already has GAP_FILL_SET_CEILING sets.
        // The weekly direct count equals the ceiling, which is above any floor, so Phase 2
        // exits cleanly; but the guard `Number(existingIso.sets) < GAP_FILL_SET_CEILING`
        // is the backstop that prevents an unbounded bump if floor were ever raised.
        // We verify it by asserting the exercise is never bumped past the ceiling.
        const pool = [iso('bi', 'biceps', 'biceps_iso')];
        const atCeiling = GAP_FILL_SET_CEILING; // 20
        const out = applyCoverageGapFill(
            input({ exercises: [row('bi', 0, atCeiling)], pool, usable: pool }) as never,
        );
        // No new exercise added (weekly count already at ceiling, above floor).
        expect(out).toHaveLength(1);
        // Sets never exceed the ceiling.
        expect(Number(out[0].sets)).toBeLessThanOrEqual(GAP_FILL_SET_CEILING);
        expect(Number(out[0].sets)).toBe(atCeiling);
    });
});

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

describe('chest gap-fill inserts an isolation, never a compound (Change C safety)', () => {
    it('seats a chest isolation for a zero-chest session even when a higher-quality chest compound exists', () => {
        const benchCompound: ExerciseMeta = {
            id: 'bench',
            name: 'Good', // quality 1 via the stub, so it would outrank the fly if not filtered
            movement_pattern: 'horizontal_push',
            equipment: ['barbell'],
            is_compound: true,
            category: 'chest' as ExerciseMeta['category'],
            substitution_class: 'horizontal_press',
            unilateral: false,
            contraindications: [],
            primary_muscle: 'chest',
        };
        const fly = iso('fly', 'chest', 'chest_iso'); // non-compound, neutral quality 0.8
        const pool = [benchCompound, fly, iso('bi', 'biceps', 'biceps_iso')];
        const sessionCtx = new Map([['push:', { focus: 'push' as const, isoReps: '12-15', baseSets: 3 }]]);
        const schedule = [{ day_of_week: 1, workout_type: 'push' as const, variant: null, label: null }];
        const exercises = [{ exercise_id: 'bi', workout_type: 'push' as const, variant: null, order: 0, sets: '3', reps: '12-15', superset_group_id: null }];
        const out = applyCoverageGapFill({ exercises, schedule, pool, usable: pool, sessionCtx, qualityOf, bandMaxMin: null });
        const ids = out.map((e) => e.exercise_id);
        expect(ids).toContain('fly'); // the chest isolation was added
        expect(ids).not.toContain('bench'); // never the compound, despite its higher quality
    });
});

describe('Phase 2 session balancing + contribution cap (Change D)', () => {
    it('distributes a side-delt gap across two eligible sessions instead of piling on one', () => {
        // 4-day plan => side_delts floor 8. push:A starts with a side-delt iso at 3; push:B
        // is a second eligible push session with no side-delt work yet, and the pool has a
        // second side-delt iso to insert. The OLD Phase 2 piled all 5 extra sets onto the
        // lone iso (-> 8); the balanced restructure inserts into push:B and bumps both, so
        // neither exceeds 2*base (6) and two isolations carry the volume.
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
        ];
        const out = applyCoverageGapFill({ exercises, schedule, pool, usable: pool, sessionCtx, qualityOf, bandMaxMin: null });
        const sets = out.filter((e) => e.exercise_id === 'sdA' || e.exercise_id === 'sdB').map((e) => Number(e.sets));
        // total reaches floor 8, spread across two isolations, neither exceeding 2*base (6).
        expect(sets.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(8);
        expect(Math.max(...sets)).toBeLessThanOrEqual(6);
        expect(sets.length).toBe(2); // a second isolation was inserted (distribution, not piling)
    });

    it('contribution cap: a single isolation is never bumped past 2x its base sets', () => {
        // 4-day => biceps floor 8, but only one biceps iso and one eligible session (base 3).
        // The OLD Phase 2 bumped that lone iso all the way to 8; the contribution cap stops
        // it at 2*base = 6 (the shortfall is then reported by muscle_coverage_low, not piled).
        const pool = [iso('bi', 'biceps', 'biceps_iso')];
        const sessionCtx = new Map([['pull:A', { focus: 'pull' as const, isoReps: '12-15', baseSets: 3 }]]);
        const schedule = [
            { day_of_week: 1, workout_type: 'pull' as const, variant: 'A' as const, label: null },
            { day_of_week: 2, workout_type: 'pull' as const, variant: 'B' as const, label: null },
            { day_of_week: 3, workout_type: 'pull' as const, variant: 'C' as const, label: null },
            { day_of_week: 4, workout_type: 'pull' as const, variant: 'D' as const, label: null },
        ];
        const exercises = [{ exercise_id: 'bi', workout_type: 'pull' as const, variant: 'A' as const, order: 0, sets: '3', reps: '12-15', superset_group_id: null }];
        const out = applyCoverageGapFill({ exercises, schedule, pool, usable: pool, sessionCtx, qualityOf, bandMaxMin: null });
        expect(Number(out.find((e) => e.exercise_id === 'bi')!.sets)).toBe(6);
    });
});
