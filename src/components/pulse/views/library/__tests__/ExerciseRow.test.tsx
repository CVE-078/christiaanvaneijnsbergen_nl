import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciseRow from '../ExerciseRow';
import type { DbExercise } from '@/lib/pulse/types';

const ex: DbExercise = {
    id: 'abc-123',
    name: 'Barbell Bench Press',
    category: 'chest',
    default_sets: '3',
    default_reps: '8-12',
    user_id: null,
    equipment: ['barbell', 'bench'],
    is_compound: true,
};

describe('ExerciseRow', () => {
    it('renders the exercise name', () => {
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    });

    it('renders human-readable equipment labels and Compound in the metadata line when is_compound is true', () => {
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        const meta = screen.getByTestId('exercise-row-meta');
        // Human-readable: 'Barbell' and 'Bench', not raw keys 'barbell'/'bench'.
        expect(meta.textContent).toContain('Barbell');
        expect(meta.textContent).toContain('Bench');
        expect(meta.textContent).not.toContain('barbell/bench');
        expect(meta.textContent).toContain('Compound');
    });

    it('renders Isolation when is_compound is false', () => {
        const isolation: DbExercise = { ...ex, is_compound: false };
        render(
            <ExerciseRow
                exercise={isolation}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByTestId('exercise-row-meta').textContent).toContain('Isolation');
    });

    it('includes category in metadata when showCategory is true', () => {
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={true}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByTestId('exercise-row-meta').textContent).toContain('Chest');
    });

    it('omits category from metadata when showCategory is false', () => {
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByTestId('exercise-row-meta').textContent).not.toContain('Chest');
    });

    it('favorite star has aria-pressed reflecting favorite prop', () => {
        const { rerender } = render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: /favorite/i })).toHaveAttribute('aria-pressed', 'false');

        rerender(
            <ExerciseRow
                exercise={ex}
                favorite={true}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: /favorite/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking the card (exercise-row-body) calls onOpen', () => {
        const onOpen = vi.fn();
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={onOpen}
                onToggleFavorite={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId('exercise-row-body'));
        expect(onOpen).toHaveBeenCalledWith(ex);
    });

    it('the card root has role="button" and is keyboard-activatable via Enter', () => {
        const onOpen = vi.fn();
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={onOpen}
                onToggleFavorite={vi.fn()}
            />,
        );
        const card = screen.getByTestId('exercise-row-body');
        expect(card).toHaveAttribute('role', 'button');
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onOpen).toHaveBeenCalledWith(ex);
    });

    it('the card root is keyboard-activatable via Space', () => {
        const onOpen = vi.fn();
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={onOpen}
                onToggleFavorite={vi.fn()}
            />,
        );
        fireEvent.keyDown(screen.getByTestId('exercise-row-body'), { key: ' ' });
        expect(onOpen).toHaveBeenCalledWith(ex);
    });

    it('chevron is decorative (aria-hidden, not a button)', () => {
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={vi.fn()}
                onToggleFavorite={vi.fn()}
            />,
        );
        // No button named "Open details" since chevron is now decorative.
        expect(screen.queryByRole('button', { name: 'Open details' })).not.toBeInTheDocument();
    });

    it('clicking the favorite star calls onToggleFavorite and does NOT call onOpen', () => {
        const onOpen = vi.fn();
        const onToggleFavorite = vi.fn();
        render(
            <ExerciseRow
                exercise={ex}
                favorite={false}
                hidden={false}
                showCategory={false}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /favorite/i }));
        expect(onToggleFavorite).toHaveBeenCalledWith(ex);
        expect(onOpen).not.toHaveBeenCalled();
    });
});
