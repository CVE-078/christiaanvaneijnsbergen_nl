import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseCard from '../ExerciseCard';
import type { RoutineExercise } from '@/lib/pulse/types';

const routineExercise: RoutineExercise = {
    id: 're-uuid-001',
    routine_id: 'r-1',
    exercise_id: 'ex-1',
    workout_type: 'chest',
    order: 0,
    sets: '3-4',
    reps: '8-12',
    starting_weight_kg: null,
    exercise: {
        id: 'ex-1',
        name: 'Dumbbell Bench Press',
        category: 'chest',
        default_sets: '3-4',
        default_reps: '8-12',
        user_id: null,
    },
};

const defaultProps = {
    routineExercise,
    exIdx: 0,
    week: 1,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: () => {},
    onDelete: () => {},
};

// '3-4' → parseMaxSets returns 4 (takes upper bound)
const MAX_SETS = 4;
const RE_ID = 're-uuid-001';

describe('ExerciseCard', () => {
    it('does not show completed indicator when no sets are logged', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.queryAllByLabelText(/all sets done/i)).toHaveLength(0);
    });

    it('shows completed indicator when all sets are logged', () => {
        const logs: Record<string, { kg: number; reps: number; rir: number; saved: boolean }> = {
            [`1-${RE_ID}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-1`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-2`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-3`]: { kg: 60, reps: 10, rir: 3, saved: true },
        };
        render(<ExerciseCard {...defaultProps} logs={logs} />);
        expect(screen.getAllByLabelText(/all sets done/i).length).toBeGreaterThan(0);
    });

    it('renders the exercise name', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('expands to show SetLogger rows when clicked', async () => {
        render(<ExerciseCard {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        const saveButtons = screen.getAllByRole('button', { name: /save/i });
        expect(saveButtons.length).toBe(MAX_SETS);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const onSave = vi.fn();
        render(<ExerciseCard {...defaultProps} onSave={onSave} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '60');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith(`1-${RE_ID}-0`, expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });
});
