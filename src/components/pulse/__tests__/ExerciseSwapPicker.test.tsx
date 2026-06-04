import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import type { DbExercise } from '@/lib/pulse/types';

const mk = (id: string, name: string): DbExercise =>
    ({ id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null,
       movement_pattern: 'horizontal_push', equipment: [] }) as DbExercise;

const candidates = [mk('a', 'Dumbbell Bench'), mk('b', 'Machine Press')];

function setup(overrides = {}) {
    const props = {
        originalName: 'Barbell Bench',
        week: 4,
        candidates,
        isSwapped: false,
        onSelect: vi.fn(),
        onRevert: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
    render(<ExerciseSwapPicker {...props} />);
    return props;
}

describe('ExerciseSwapPicker', () => {
    it('lists candidates and calls onSelect with the chosen exercise id', async () => {
        const props = setup();
        await userEvent.click(screen.getByText('Dumbbell Bench'));
        expect(props.onSelect).toHaveBeenCalledWith('a');
    });

    it('shows a revert option only when a swap is active', () => {
        const { rerender } = render(
            <ExerciseSwapPicker originalName="Barbell Bench" week={4} candidates={candidates}
                isSwapped={false} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.queryByRole('button', { name: /revert/i })).not.toBeInTheDocument();
        rerender(
            <ExerciseSwapPicker originalName="Barbell Bench" week={4} candidates={candidates}
                isSwapped={true} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument();
    });

    it('shows an empty state when there are no candidates', () => {
        setup({ candidates: [] });
        expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
    });
});
