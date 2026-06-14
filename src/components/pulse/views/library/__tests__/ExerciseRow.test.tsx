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

    it('renders equipment and Compound in the metadata line when is_compound is true', () => {
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
        expect(meta.textContent).toContain('barbell');
        expect(meta.textContent).toContain('bench');
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

    it('clicking the row body calls onOpen', () => {
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

    it('chevron button has aria-label="Open details"', () => {
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
        expect(screen.getByRole('button', { name: 'Open details' })).toBeInTheDocument();
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
