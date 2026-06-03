import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkoutModeScreen from '../WorkoutModeScreen';
import type { RoutineExercise, Logs } from '@/lib/pulse/types';

const mockExercise = (id: string, name: string): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: 'e1',
    workout_type: 'push',
    variant: 'A',
    order: 1,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    rest_seconds: null,
    exercise: { id: 'e1', name, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

const defaultProps = {
    exercises: [mockExercise('re1', 'Bench Press'), mockExercise('re2', 'OHP')],
    sessionId: 'sess1',
    variant: 'A' as const,
    week: 1,
    logs: {} as Logs,
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
};

describe('WorkoutModeScreen', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows first exercise and progress', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument();
    });

    it('advances to next exercise on Next click', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByText('OHP')).toBeInTheDocument();
        expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument();
    });

    it('shows Finish button on last exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument();
    });

    it('calls onComplete when Finish is clicked', async () => {
        render(<WorkoutModeScreen {...defaultProps} exercises={[mockExercise('re1', 'Bench Press')]} />);
        fireEvent.click(screen.getByRole('button', { name: /finish workout/i }));
        expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    it('navigates back to previous exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        fireEvent.click(screen.getByRole('button', { name: /previous exercise/i }));
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('disables finish and early-finish buttons when sessionId is null', () => {
        render(
            <WorkoutModeScreen {...defaultProps} exercises={[mockExercise('re1', 'Bench Press')]} sessionId={null} />,
        );
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeDisabled();
    });
});
