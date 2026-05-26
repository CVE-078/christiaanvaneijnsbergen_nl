import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseDetailPane from '../ExerciseDetailPane';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3–4',
    reps: '8–12',
    load: 'Start 18–20kg per DB',
    note: 'Full ROM, slow eccentric (3s down).',
};

const defaultProps = {
    exercise,
    exIdx: 0,
    week: 1,
    type: 'push' as const,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    timerTrigger: 0,
};

describe('ExerciseDetailPane', () => {
    it('renders the exercise name in the header', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('renders the set/rep info', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        expect(screen.getByText(/3–4 sets · 8–12 reps/)).toBeInTheDocument();
    });

    it('renders the correct number of Save buttons (one per max set)', () => {
        render(<ExerciseDetailPane {...defaultProps} />);
        // sets: '3–4' → parseMaxSets → 4
        const saveBtns = screen.getAllByRole('button', { name: /save/i });
        expect(saveBtns).toHaveLength(4);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const onSave = vi.fn();
        render(<ExerciseDetailPane {...defaultProps} onSave={onSave} />);
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '60');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith('1-push-0-0', expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });
});
