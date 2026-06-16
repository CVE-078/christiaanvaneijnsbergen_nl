import { describe, it, expect } from 'vitest';
import { weeklyMuscleSets, muscleCoverageGaps, targetDirectSets, MUSCLE_SET_TARGETS, deriveSeedPrimaryMuscle, compoundCarryover } from '@/lib/pulse/muscleVolume';
import type { ExerciseMeta, RoutineBlueprint } from '@/lib/pulse/generation';
import type { Muscle, MovementPattern } from '@/lib/pulse/types';
import { MUSCLES } from '@/lib/pulse/types';

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
        expect(gaps.some((g) => (g.target as string) === 'front_delts')).toBe(false);
    });

    it('NO-DATA GUARD: returns [] when no exercise has a primary_muscle', () => {
        const unattributed: ExerciseMeta = { ...ex('x', 'chest'), primary_muscle: undefined };
        const gaps = muscleCoverageGaps(bp([{ id: 'x', sets: 1 }]), [unattributed]);
        expect(gaps).toEqual([]);
    });

    it('flags a muscle that is in the pool but absent from the blueprint (0 sets)', () => {
        // biceps has a pool exercise but the blueprint trains only chest -> biceps 0 < 8.
        const pool = [...poolFor(['chest']), ...poolFor(['biceps'])];
        const gaps = muscleCoverageGaps(bp([{ id: 'chest-0', sets: 12 }]), pool);
        expect(gaps.some((g) => g.target === 'biceps')).toBe(true);
    });
});

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

    it('Dips (now horizontal_push compound) derives to chest, not triceps', () => {
        expect(deriveSeedPrimaryMuscle('horizontal_push', 'horizontal_press', 'Dips')).toBe('chest');
    });
    it('Straight-Arm Pulldown (now back_iso) derives to lats', () => {
        expect(deriveSeedPrimaryMuscle('back_iso', null, 'Straight-Arm Pulldown')).toBe('lats');
    });
});
