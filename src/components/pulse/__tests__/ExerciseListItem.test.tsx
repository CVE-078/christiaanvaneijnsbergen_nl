import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseListItem from '../ExerciseListItem';

const exercise = {
    name: 'Dumbbell Bench Press',
    sets: '3–4',
    reps: '8–12',
    load: 'Start 18–20kg per DB',
    note: 'Full ROM',
};

const defaultProps = {
    exercise,
    exIdx: 0,
    week: 1,
    type: 'push' as const,
    logs: {},
    isActive: false,
    onClick: vi.fn(),
};

describe('ExerciseListItem', () => {
    it('renders the exercise name', () => {
        render(<ExerciseListItem {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('renders the exercise number padded to 2 digits', () => {
        render(<ExerciseListItem {...defaultProps} exIdx={2} />);
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        render(<ExerciseListItem {...defaultProps} onClick={onClick} />);
        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows the complete indicator when all sets are saved', () => {
        const logs = {
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-1': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-2': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-3': { kg: 60, reps: 10, rir: 3, saved: true },
        };
        render(<ExerciseListItem {...defaultProps} logs={logs} />);
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('does not show the complete indicator when sets are not done', () => {
        render(<ExerciseListItem {...defaultProps} />);
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
});
