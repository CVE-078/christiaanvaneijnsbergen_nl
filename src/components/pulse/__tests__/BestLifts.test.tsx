import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BestLifts from '../BestLifts';
import type { RoutineExercise, BestSet } from '@/lib/pulse/types';

// Minimal RoutineExercise fixture. BestLifts only reads re.id, re.exercise.name,
// and re.workout_type, so all other fields can be stubs.
function makeRE(id: string, name: string, workout_type: RoutineExercise['workout_type'] = 'push'): RoutineExercise {
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type,
        order: 0,
        sets: '3',
        reps: '8',
        starting_weight_kg: null,
        rest_seconds: null,
        variant: null,
        superset_group_id: null,
        exercise: {
            id,
            name,
            category: 'chest',
            default_sets: '3',
            default_reps: '8',
            user_id: null,
        },
    };
}

describe('BestLifts', () => {
    it('shows top set and e1RM per lift', () => {
        // The id can be any string that matches between allRoutineExercises and bestSets.
        const reId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const allRoutineExercises: RoutineExercise[] = [makeRE(reId, 'Barbell Bench Press', 'push')];
        const bestSets: Record<string, BestSet> = {
            [reId]: { routineExerciseId: reId, week: 1, kg: 90, reps: 6, e1rm: 105 },
        };

        render(<BestLifts allRoutineExercises={allRoutineExercises} bestSets={bestSets} unit="kg" />);

        // Exercise name
        expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
        // Top set kg
        expect(screen.getByText(/90/)).toBeInTheDocument();
        // Reps
        expect(screen.getByText(/× 6/)).toBeInTheDocument();
        // e1RM value (105)
        expect(screen.getByText(/105/)).toBeInTheDocument();
    });

    it('shows "No sets logged yet." when bestSets is empty', () => {
        render(<BestLifts allRoutineExercises={[]} bestSets={{}} unit="kg" />);
        expect(screen.getByText(/no sets logged yet/i)).toBeInTheDocument();
    });

    it('accents the top entry e1RM, not lower entries', () => {
        const id1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const id2 = 'ffffffff-0000-1111-2222-333333333333';
        const allRoutineExercises = [makeRE(id1, 'Bench Press', 'push'), makeRE(id2, 'Overhead Press', 'push')];
        // id1 has higher e1rm, so it is idx 0 (top entry)
        const bestSets: Record<string, BestSet> = {
            [id1]: { routineExerciseId: id1, week: 1, kg: 100, reps: 5, e1rm: 117 },
            [id2]: { routineExerciseId: id2, week: 1, kg: 60, reps: 8, e1rm: 78 },
        };

        render(<BestLifts allRoutineExercises={allRoutineExercises} bestSets={bestSets} unit="kg" />);

        // Both exercises render
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Overhead Press')).toBeInTheDocument();
        // Both e1RM values render
        expect(screen.getByText(/117/)).toBeInTheDocument();
        expect(screen.getByText(/78/)).toBeInTheDocument();
    });
});
