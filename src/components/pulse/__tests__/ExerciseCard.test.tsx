import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseCard from '../ExerciseCard';
import { WORKOUTS } from '@/lib/pulse/data';

// WORKOUTS.push.exercises[0] = Dumbbell Bench Press, sets: '3â€“4' â†’ maxSets = 4
const exercise = WORKOUTS.push.exercises[0];

const defaultProps = {
    exercise,
    exIdx: 0,
    week: 1,
    type: 'push' as const,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: () => {},
    onDelete: () => {},
};

describe('ExerciseCard', () => {
    it('does not show completed indicator when no sets are logged', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.queryAllByLabelText(/all sets done/i)).toHaveLength(0);
    });

    it('shows completed indicator when all sets are logged', () => {
        // Dumbbell Bench Press: sets '3â€“4' â†’ parseMaxSets returns 4, so sets 0..3
        const logs: Record<string, { kg: number; reps: number; rir: number; saved: boolean }> = {
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-1': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-2': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-3': { kg: 60, reps: 10, rir: 3, saved: true },
        };
        render(<ExerciseCard {...defaultProps} logs={logs} />);
        expect(screen.getAllByLabelText(/all sets done/i).length).toBeGreaterThan(0);
    });

    it('renders the exercise name', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.getByText(exercise.name)).toBeInTheDocument();
    });

    it('expands to show SetLogger rows when clicked', async () => {
        render(<ExerciseCard {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`expand ${exercise.name}`, 'i') }));
        const saveButtons = screen.getAllByRole('button', { name: /save/i });
        expect(saveButtons.length).toBeGreaterThan(0);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const onSave = vi.fn();
        render(<ExerciseCard {...defaultProps} onSave={onSave} />);
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`expand ${exercise.name}`, 'i') }));
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '60');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith('1-push-0-0', expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });
});
