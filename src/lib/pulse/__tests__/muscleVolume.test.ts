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
